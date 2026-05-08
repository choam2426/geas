import { test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../src/commands/init';
import { runMissionCreate } from '../src/commands/mission';

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
