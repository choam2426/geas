import { test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../src/commands/init';

let workdir: string;
let originalCwd: string;

beforeEach(() => {
  originalCwd = process.cwd();
  workdir = mkdtempSync(join(tmpdir(), 'geas-init-'));
  process.chdir(workdir);
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(workdir, { recursive: true, force: true });
});

test('init creates .geas/ skeleton', () => {
  const result = runInit();
  assert.equal(result.ok, true);
  assert.ok(existsSync(join(workdir, '.geas', 'run-state.yaml')));
  assert.ok(existsSync(join(workdir, '.geas', 'debts.yaml')));
  assert.ok(existsSync(join(workdir, '.geas', 'memory', 'common.yaml')));
  assert.ok(existsSync(join(workdir, '.geas', 'memory', 'roles', 'orchestrator.yaml')));
  assert.ok(existsSync(join(workdir, '.geas', 'memory', 'roles', 'reviewer.yaml')));
  assert.ok(existsSync(join(workdir, '.geas', 'missions')));

  const runState = readFileSync(join(workdir, '.geas', 'run-state.yaml'), 'utf8');
  assert.match(runState, /current_mission_id: ['"]?['"]?/);
  assert.match(runState, /current_stage: ['"]?['"]?/);
  assert.match(runState, /current_task_id: ['"]?['"]?/);
});

test('init fails when .geas/ already exists', () => {
  runInit();
  const result = runInit();
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'already_initialized');
  }
});
