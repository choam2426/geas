import { test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../src/commands/init';
import { runMissionCreate, runMissionSpecRecord, runMissionDesignRecord, runMissionTransition } from '../src/commands/mission';
import { runTaskContractRecord, runTaskEvidenceRecord, runTaskTransition } from '../src/commands/task';
import { runJudgmentRecord } from '../src/commands/judgment';

let workdir: string;
let originalCwd: string;
let missionId: string;

const minimalSpec = { name: '', goal: '', background: '', completion_criteria: [], included_scope: [], excluded_scope: [], acceptance_criteria: [], constraints: [], assumptions: [], risks: [] };
const minimalDesign = { approach_strategy: '', alternatives_considered: [], key_concepts: [], scope_in: [], scope_out: [], task_breakdown: [{ task_id: 'task-001', description: '', mission_coverage: [], depends_on: [], reason: '' }], assumptions: [], risks: [] };
const minimalContract = { description: '', mission_relation: '', depends_on: [], scope_in: [], scope_out: [], deliverables: [], acceptance_criteria: [], verification_checks: [], review_focus: [], risk_level: 'low', risks: [] };
const implEv = { summary: '', changed_outputs: [], affected_scope: [], decisions: [], contract_deltas: [], self_checks: [], limits: [], reflection_candidates: [] };
const verifPassed = { summary: '', environment: '', target: [], checks_performed: [], criteria_results: [], outputs: [], deviations: [], unverified_scope: [], recheck_needed: [], verdict: 'passed' };
const reviewEv = { summary: '', target: [], review_focus_used: [], scope_in: [], scope_out: [], review_methods: [], findings: [], remaining_risks: [], verdict: 'passed', overall_recommendation: '' };
const validJudgment = { decision: 'accepted', accepted_unverified_scope: [], accepted_remaining_risks: [], requested_actions: [] };

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
  assert.ok(existsSync(join(workdir, '.geas', 'missions', missionId, 'tasks', 'task-001', 'user-judgment-result-001.yaml')));
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
  const r = runJudgmentRecord('mission-result', validJudgment);
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.error.guards?.some((g) => g.code === 'stage_not_consolidating'));
});

test('task-result accepted then task evidence advances phase to closed', () => {
  // Setup is already in place from beforeEach (phase = awaiting_user_judgment).
  const judgment = runJudgmentRecord('task-result', validJudgment, 'task-001');
  assert.equal(judgment.ok, true);

  const taskEv = { summary: '', user_judgment_summary: '', criteria_results: [], accepted_unverified_scope: [], accepted_remaining_risks: [] };
  const r = runTaskEvidenceRecord('task-001', 'task', taskEv);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.current.phase, 'closed');
});
