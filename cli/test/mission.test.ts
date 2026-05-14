import { test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../src/commands/init';
import { runJudgmentRecord } from '../src/commands/judgment';
import { runMissionCreate, runMissionSpecRecord, runMissionDesignRecord, runMissionTransition, runMissionEvidenceRecord } from '../src/commands/mission';
import { runTaskContractRecord, runTaskEvidenceRecord, runTaskTransition } from '../src/commands/task';
import {
  implementationEvidence,
  missionDesign,
  missionEvidence,
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

beforeEach(() => {
  originalCwd = process.cwd();
  workdir = mkdtempSync(join(tmpdir(), 'geas-mission-'));
  process.chdir(workdir);
  runInit();
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(workdir, { recursive: true, force: true });
});

test('mission create allocates id and updates run-state', () => {
  const result = runMissionCreate();
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const id = result.current.mission_id;
  assert.match(id, /^\d{8}-[a-z0-9]{6}$/);
  assert.equal(result.current.stage, 'specifying');
  assert.ok(existsSync(join(workdir, '.geas', 'missions', id)));
  const runState = readFileSync(join(workdir, '.geas', 'run-state.yaml'), 'utf8');
  assert.match(runState, new RegExp(`current_mission_id: ['"]?${id}['"]?`));
  assert.match(runState, /current_stage: specifying/);
});

test('mission create fails when one is already in progress', () => {
  runMissionCreate();
  const result = runMissionCreate();
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'guard_failed');
    assert.ok(result.error.guards?.some((g) => g.code === 'mission_in_progress'));
  }
});

const minimalSpec = missionSpec();

test('mission spec record stores numbered mission-spec', () => {
  const created = runMissionCreate();
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const id = created.current.mission_id;

  const result = runMissionSpecRecord(minimalSpec);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(existsSync(join(workdir, '.geas', 'missions', id, 'mission-spec-001.md')));
  assert.equal(result.writes[0]?.path, `.geas/missions/${id}/mission-spec-001.md`);
});

test('mission spec record rejects invalid payload', () => {
  runMissionCreate();
  const result = runMissionSpecRecord(missionDesign());
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'artifact_kind_mismatch');
  }
});

test('mission spec record fails outside specifying stage', () => {
  // Setup a fresh workdir without runMissionCreate (no current mission)
  process.chdir(originalCwd);
  rmSync(workdir, { recursive: true, force: true });
  workdir = mkdtempSync(join(tmpdir(), 'geas-mission-'));
  process.chdir(workdir);
  runInit();
  const result = runMissionSpecRecord(minimalSpec);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'guard_failed');
    assert.ok(result.error.guards?.some((g) => g.code === 'no_current_mission'));
  }
});

const minimalDesign = missionDesign();

test('mission design record stores numbered mission-design without creating tasks', () => {
  const created = runMissionCreate();
  if (!created.ok) throw new Error('setup');
  const id = created.current.mission_id;
  runMissionSpecRecord(minimalSpec);

  const result = runMissionDesignRecord(minimalDesign);
  assert.equal(result.ok, true);
  assert.ok(existsSync(join(workdir, '.geas', 'missions', id, 'mission-design-001.md')));
  assert.equal(existsSync(join(workdir, '.geas', 'missions', id, 'tasks')), false);
});

test('mission transition fails when no task contract exists', () => {
  runMissionCreate();
  runMissionSpecRecord(minimalSpec);
  runMissionDesignRecord(minimalDesign);
  const result = runMissionTransition('building', 'task-001');
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.guards?.some((g) => g.code === 'task_contract_missing'));
});

test('mission transition rejects disallowed pair', () => {
  runMissionCreate();
  // Try specifying -> consolidating directly (not in allowed set)
  const result = runMissionTransition('consolidating');
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.guards?.some((g) => g.code === 'transition_not_allowed'));
});

test('mission transition specifying -> specifying not allowed', () => {
  runMissionCreate();
  const result = runMissionTransition('specifying');
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.guards?.some((g) => g.code === 'transition_not_allowed'));
});

const minimalMissionEvidence = missionEvidence();

test('mission evidence record fails outside consolidating', () => {
  runMissionCreate();
  const result = runMissionEvidenceRecord(minimalMissionEvidence);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.guards?.some((g) => g.code === 'stage_not_consolidating'));
});

test('mission evidence record rejects invalid payload', () => {
  runMissionCreate();
  const result = runMissionEvidenceRecord(missionSpec());
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'artifact_kind_mismatch');
  }
});

test('mission evidence record rejects missing refs', () => {
  enterAcceptedConsolidatingMission();
  const result = runMissionEvidenceRecord(missionEvidence('Demo', { userJudgmentRef: 'missing.md' }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.guards?.some((g) => g.code === 'artifact_ref_missing'));
});

function enterAcceptedConsolidatingMission(): void {
  runMissionCreate();
  runMissionSpecRecord(missionSpec());
  runMissionDesignRecord(missionDesign());
  runTaskContractRecord('task-001', taskContract());
  runMissionTransition('building', 'task-001');
  runTaskTransition('task-001', 'implementing');
  runTaskEvidenceRecord('task-001', 'implementation', implementationEvidence());
  runTaskEvidenceRecord('task-001', 'verification', verificationEvidence('passed'));
  runTaskEvidenceRecord('task-001', 'review', reviewEvidence());
  runJudgmentRecord('task-result', taskJudgment(), 'task-001');
  runTaskEvidenceRecord('task-001', 'task', taskEvidence());
  runMissionTransition('consolidating');
  runJudgmentRecord('mission-result', missionJudgment());
}
