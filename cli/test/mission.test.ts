import { test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../src/commands/init';
import { runMissionCreate, runMissionSpecRecord, runMissionDesignRecord } from '../src/commands/mission';

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

const minimalSpec = {
  name: 'Demo',
  goal: 'Demo goal',
  background: 'context',
  completion_criteria: ['done'],
  included_scope: ['scope a'],
  excluded_scope: [],
  acceptance_criteria: ['criterion'],
  constraints: [],
  assumptions: [],
  risks: [],
};

test('mission spec record stores numbered mission-spec', () => {
  const created = runMissionCreate();
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const id = created.current.mission_id;

  const result = runMissionSpecRecord(minimalSpec);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(existsSync(join(workdir, '.geas', 'missions', id, 'mission-spec-001.yaml')));
  assert.equal(result.writes[0]?.path, `.geas/missions/${id}/mission-spec-001.yaml`);
});

test('mission spec record rejects invalid payload', () => {
  runMissionCreate();
  const result = runMissionSpecRecord({ name: 'missing fields' });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'schema_invalid');
  }
});

test('mission spec record fails outside specifying stage', () => {
  // Setup a fresh workdir without runMissionCreate (no current mission)
  process.chdir(originalCwd);
  rmSync(workdir, { recursive: true, force: true });
  workdir = mkdtempSync(join(tmpdir(), 'geas-mission-'));
  process.chdir(workdir);
  runInit();
  const payload = { name: '', goal: '', background: '', completion_criteria: [], included_scope: [], excluded_scope: [], acceptance_criteria: [], constraints: [], assumptions: [], risks: [] };
  const result = runMissionSpecRecord(payload);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'guard_failed');
    assert.ok(result.error.guards?.some((g) => g.code === 'no_current_mission'));
  }
});

const minimalDesign = {
  approach_strategy: 'A',
  alternatives_considered: [],
  key_concepts: [],
  scope_in: [],
  scope_out: [],
  task_breakdown: [
    { task_id: 'task-001', description: 't1', mission_coverage: [], depends_on: [], reason: '' },
    { task_id: 'task-002', description: 't2', mission_coverage: [], depends_on: ['task-001'], reason: '' },
  ],
  assumptions: [],
  risks: [],
};

test('mission design record materializes task directories', () => {
  const created = runMissionCreate();
  if (!created.ok) throw new Error('setup');
  const id = created.current.mission_id;
  runMissionSpecRecord(minimalSpec);

  const result = runMissionDesignRecord(minimalDesign);
  assert.equal(result.ok, true);
  assert.ok(existsSync(join(workdir, '.geas', 'missions', id, 'mission-design-001.yaml')));
  assert.ok(existsSync(join(workdir, '.geas', 'missions', id, 'tasks', 'task-001')));
  assert.ok(existsSync(join(workdir, '.geas', 'missions', id, 'tasks', 'task-002')));
  // task-state.yaml should NOT exist — it's task contract record's job
  assert.equal(existsSync(join(workdir, '.geas', 'missions', id, 'tasks', 'task-001', 'task-state.yaml')), false);
});

test('mission design record rejects duplicate task_id', () => {
  runMissionCreate();
  runMissionSpecRecord(minimalSpec);
  const bad = {
    ...minimalDesign,
    task_breakdown: [
      { task_id: 'task-001', description: '', mission_coverage: [], depends_on: [], reason: '' },
      { task_id: 'task-001', description: '', mission_coverage: [], depends_on: [], reason: '' },
    ],
  };
  const result = runMissionDesignRecord(bad);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.guards?.some((g) => g.code === 'task_id_duplicate'));
});

test('mission design record rejects unknown dependency', () => {
  runMissionCreate();
  runMissionSpecRecord(minimalSpec);
  const bad = {
    ...minimalDesign,
    task_breakdown: [
      { task_id: 'task-001', description: '', mission_coverage: [], depends_on: ['task-999'], reason: '' },
    ],
  };
  const result = runMissionDesignRecord(bad);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.guards?.some((g) => g.code === 'dependency_unknown'));
});

test('mission design record rejects dependency cycle', () => {
  runMissionCreate();
  runMissionSpecRecord(minimalSpec);
  const bad = {
    ...minimalDesign,
    task_breakdown: [
      { task_id: 'task-001', description: '', mission_coverage: [], depends_on: ['task-002'], reason: '' },
      { task_id: 'task-002', description: '', mission_coverage: [], depends_on: ['task-001'], reason: '' },
    ],
  };
  const result = runMissionDesignRecord(bad);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.guards?.some((g) => g.code === 'dependency_cycle'));
});
