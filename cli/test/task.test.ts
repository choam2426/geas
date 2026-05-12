import { test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../src/commands/init';
import {
  runMissionCreate,
  runMissionSpecRecord,
  runMissionDesignRecord,
} from '../src/commands/mission';
import { runTaskContractRecord, runTaskTransition, runTaskEvidenceRecord } from '../src/commands/task';
import { runMissionTransition } from '../src/commands/mission';

let workdir: string;
let originalCwd: string;
let missionId: string;

const minimalSpec = {
  name: '', goal: '', background: '', completion_criteria: [], included_scope: [], excluded_scope: [], acceptance_criteria: [], constraints: [], assumptions: [], risks: [],
};
const minimalDesign = {
  plan_summary: '',
  approach_strategy: '',
  alternatives_considered: [],
  key_concepts: [],
  scope_in: [],
  scope_out: [],
  plan_outline: [],
  decision_points: [],
  assumptions: [],
  risks: [],
  change_triggers: [],
};
const minimalContract = {
  description: 't1',
  mission_relation: '',
  depends_on: [],
  scope_in: [],
  scope_out: [],
  deliverables: [],
  acceptance_criteria: [],
  verification_checks: [],
  review_focus: [],
  risk_level: 'low',
  risks: [],
};

beforeEach(() => {
  originalCwd = process.cwd();
  workdir = mkdtempSync(join(tmpdir(), 'geas-task-'));
  process.chdir(workdir);
  runInit();
  const c = runMissionCreate();
  if (!c.ok) throw new Error('mission create failed');
  missionId = c.current.mission_id;
  runMissionSpecRecord(minimalSpec);
  runMissionDesignRecord(minimalDesign);
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(workdir, { recursive: true, force: true });
});

test('task contract record stores numbered contract and creates task-state', () => {
  const result = runTaskContractRecord('task-001', minimalContract);
  assert.equal(result.ok, true);
  const taskBase = join(workdir, '.geas', 'missions', missionId, 'tasks', 'task-001');
  assert.ok(existsSync(join(taskBase, 'task-contract-001.yaml')));
  assert.ok(existsSync(join(taskBase, 'task-state.yaml')));
  const ts = readFileSync(join(taskBase, 'task-state.yaml'), 'utf8');
  assert.match(ts, /phase: unstarted/);
});

test('task contract record creates a new task id', () => {
  const result = runTaskContractRecord('task-999', minimalContract);
  assert.equal(result.ok, true);
  const taskBase = join(workdir, '.geas', 'missions', missionId, 'tasks', 'task-999');
  assert.ok(existsSync(join(taskBase, 'task-contract-001.yaml')));
  assert.ok(existsSync(join(taskBase, 'task-state.yaml')));
});

test('task contract record rejects unsupported risk level', () => {
  const result = runTaskContractRecord('task-001', { ...minimalContract, risk_level: 'critical' });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'schema_invalid');
  }
});

test('task contract record rejects unknown dependency', () => {
  const result = runTaskContractRecord('task-001', { ...minimalContract, depends_on: ['task-999'] });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.error.guards?.some((g) => g.code === 'dependency_unknown'));
  }
});

test('task contract record rejects dependency cycle', () => {
  const first = runTaskContractRecord('task-001', minimalContract);
  assert.equal(first.ok, true);
  const second = runTaskContractRecord('task-002', { ...minimalContract, depends_on: ['task-001'] });
  assert.equal(second.ok, true);
  const cycle = runTaskContractRecord('task-001', { ...minimalContract, depends_on: ['task-002'] });
  assert.equal(cycle.ok, false);
  if (!cycle.ok) {
    assert.ok(cycle.error.guards?.some((g) => g.code === 'dependency_cycle'));
  }
});

test('task transition unstarted->implementing succeeds when stage is building', () => {
  runTaskContractRecord('task-001', minimalContract);
  const trans = runMissionTransition('building', 'task-001');
  assert.equal(trans.ok, true);
  const result = runTaskTransition('task-001', 'implementing');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const ts = readFileSync(join(workdir, '.geas', 'missions', missionId, 'tasks', 'task-001', 'task-state.yaml'), 'utf8');
  assert.match(ts, /phase: implementing/);
});

test('task transition rejects disallowed pair', () => {
  runTaskContractRecord('task-001', minimalContract);
  runMissionTransition('building', 'task-001');
  const result = runTaskTransition('task-001', 'closed');
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.guards?.some((g) => g.code === 'transition_not_allowed'));
});

const implEv = {
  summary: 'did stuff', changed_outputs: [], affected_scope: [], decisions: [], contract_deltas: [], self_checks: [], limits: [], reflection_candidates: [],
};
const verifEv = (verdict: 'passed' | 'changes_requested' | 'escalated') => ({
  summary: '', environment: '', target: [], checks_performed: [], criteria_results: [], outputs: [], deviations: [], unverified_scope: [], recheck_needed: [], verdict,
});
const reviewEv = {
  summary: '', target: [], review_focus_used: [], scope_in: [], scope_out: [], review_methods: [], findings: [], remaining_risks: [], verdict: 'passed', overall_recommendation: '',
};
const taskEv = {
  summary: '', user_judgment_summary: '', criteria_results: [], accepted_unverified_scope: [], accepted_remaining_risks: [],
};

function intoBuildingImplementing() {
  runTaskContractRecord('task-001', minimalContract);
  runMissionTransition('building', 'task-001');
  runTaskTransition('task-001', 'implementing');
}

test('implementation evidence advances phase to verifying', () => {
  intoBuildingImplementing();
  const r = runTaskEvidenceRecord('task-001', 'implementation', implEv);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const ts = readFileSync(join(workdir, '.geas', 'missions', missionId, 'tasks', 'task-001', 'task-state.yaml'), 'utf8');
  assert.match(ts, /phase: verifying/);
});

test('verification passed advances to reviewing', () => {
  intoBuildingImplementing();
  runTaskEvidenceRecord('task-001', 'implementation', implEv);
  const r = runTaskEvidenceRecord('task-001', 'verification', verifEv('passed'));
  assert.equal(r.ok, true);
  const ts = readFileSync(join(workdir, '.geas', 'missions', missionId, 'tasks', 'task-001', 'task-state.yaml'), 'utf8');
  assert.match(ts, /phase: reviewing/);
});

test('verification changes_requested advances to awaiting_user_judgment', () => {
  intoBuildingImplementing();
  runTaskEvidenceRecord('task-001', 'implementation', implEv);
  const r = runTaskEvidenceRecord('task-001', 'verification', verifEv('changes_requested'));
  assert.equal(r.ok, true);
  const ts = readFileSync(join(workdir, '.geas', 'missions', missionId, 'tasks', 'task-001', 'task-state.yaml'), 'utf8');
  assert.match(ts, /phase: awaiting_user_judgment/);
});

test('review evidence advances to awaiting_user_judgment', () => {
  intoBuildingImplementing();
  runTaskEvidenceRecord('task-001', 'implementation', implEv);
  runTaskEvidenceRecord('task-001', 'verification', verifEv('passed'));
  const r = runTaskEvidenceRecord('task-001', 'review', reviewEv);
  assert.equal(r.ok, true);
  const ts = readFileSync(join(workdir, '.geas', 'missions', missionId, 'tasks', 'task-001', 'task-state.yaml'), 'utf8');
  assert.match(ts, /phase: awaiting_user_judgment/);
});

test('task evidence rejected when judgment not accepted', () => {
  intoBuildingImplementing();
  runTaskEvidenceRecord('task-001', 'implementation', implEv);
  runTaskEvidenceRecord('task-001', 'verification', verifEv('passed'));
  runTaskEvidenceRecord('task-001', 'review', reviewEv);
  const r = runTaskEvidenceRecord('task-001', 'task', taskEv);
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.error.guards?.some((g) => g.code === 'task_judgment_not_accepted'));
});
