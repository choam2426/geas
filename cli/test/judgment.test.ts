import { test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../src/commands/init';
import { runMissionCreate, runMissionSpecRecord, runMissionDesignRecord, runMissionTransition } from '../src/commands/mission';
import { runTaskContractRecord, runTaskEvidenceRecord, runTaskTransition } from '../src/commands/task';
import { runJudgmentRecord } from '../src/commands/judgment';
import {
  implementationEvidence,
  missionDesign,
  missionJudgment,
  missionSpec,
  reviewEvidence,
  taskContract,
  taskEvidence,
  taskJudgment,
  verificationEvidence,
} from './helpers/artifacts';

let workdir: string;
let originalCwd: string;
let missionId: string;

const minimalSpec = missionSpec();
const minimalDesign = missionDesign();
const minimalContract = taskContract();
const implEv = implementationEvidence();
const verifPassed = verificationEvidence('passed');
const reviewEv = reviewEvidence();
const validJudgment = taskJudgment();

beforeEach(() => {
  originalCwd = process.cwd();
  workdir = mkdtempSync(join(tmpdir(), 'geas-judgment-'));
  process.chdir(workdir);
  runInit();
  const c = runMissionCreate();
  if (!c.ok) throw new Error('setup');
  missionId = c.current.mission_id;
  runMissionSpecRecord(minimalSpec);
  runMissionDesignRecord(minimalDesign);
  runTaskContractRecord('task-001', minimalContract);
  runMissionTransition('building', 'task-001');
  runTaskTransition('task-001', 'implementing');
  runTaskEvidenceRecord('task-001', 'implementation', implEv);
  runTaskEvidenceRecord('task-001', 'verification', verifPassed);
  runTaskEvidenceRecord('task-001', 'review', reviewEv);
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(workdir, { recursive: true, force: true });
});

test('task-result judgment writes numbered file in task dir', () => {
  const r = runJudgmentRecord('task-result', validJudgment, 'task-001');
  assert.equal(r.ok, true);
  assert.ok(existsSync(join(workdir, '.geas', 'missions', missionId, 'tasks', 'task-001', 'user-judgment-result-001.md')));
});

test('task-result judgment fails when phase is not awaiting_user_judgment', () => {
  // Fresh mission to avoid the awaiting_user_judgment setup
  process.chdir(originalCwd);
  rmSync(workdir, { recursive: true, force: true });
  workdir = mkdtempSync(join(tmpdir(), 'geas-judgment-'));
  process.chdir(workdir);
  runInit();
  const c = runMissionCreate();
  if (!c.ok) throw new Error('setup');
  missionId = c.current.mission_id;
  runMissionSpecRecord(minimalSpec);
  runMissionDesignRecord(minimalDesign);
  runTaskContractRecord('task-001', minimalContract);
  runMissionTransition('building', 'task-001');
  runTaskTransition('task-001', 'implementing');

  const r = runJudgmentRecord('task-result', validJudgment, 'task-001');
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.error.guards?.some((g) => g.code === 'phase_not_awaiting_user_judgment'));
});

test('mission-result judgment fails outside consolidating', () => {
  const r = runJudgmentRecord('mission-result', missionJudgment());
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.error.guards?.some((g) => g.code === 'stage_not_consolidating'));
});

test('task-result accepted then task evidence advances phase to closed', () => {
  // Setup is already in place from beforeEach (phase = awaiting_user_judgment).
  const judgment = runJudgmentRecord('task-result', validJudgment, 'task-001');
  assert.equal(judgment.ok, true);

  const r = runTaskEvidenceRecord('task-001', 'task', taskEvidence());
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.current.phase, 'closed');
});
