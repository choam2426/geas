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
import { runTaskContractRecord } from '../src/commands/task';

let workdir: string;
let originalCwd: string;
let missionId: string;

const minimalSpec = {
  name: '', goal: '', background: '', completion_criteria: [], included_scope: [], excluded_scope: [], acceptance_criteria: [], constraints: [], assumptions: [], risks: [],
};
const minimalDesign = {
  approach_strategy: '',
  alternatives_considered: [],
  key_concepts: [],
  scope_in: [],
  scope_out: [],
  task_breakdown: [
    { task_id: 'task-001', description: '', mission_coverage: [], depends_on: [], reason: '' },
  ],
  assumptions: [],
  risks: [],
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

test('task contract record fails for unknown task id', () => {
  const result = runTaskContractRecord('task-999', minimalContract);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.error.guards?.some((g) => g.code === 'task_unknown_in_design'));
  }
});
