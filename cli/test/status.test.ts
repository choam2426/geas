import { test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../src/commands/init';
import { runMissionCreate, runMissionDesignRecord, runMissionSpecRecord } from '../src/commands/mission';
import { runStatus } from '../src/commands/status';
import { missionDesign, missionSpec } from './helpers/artifacts';

let workdir: string;
let originalCwd: string;

beforeEach(() => {
  originalCwd = process.cwd();
  workdir = mkdtempSync(join(tmpdir(), 'geas-status-'));
  process.chdir(workdir);
  runInit();
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(workdir, { recursive: true, force: true });
});

test('status reports yaml runtime paths after init', () => {
  const result = runStatus();
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.paths.run_state, '.geas/run-state.yaml');
  assert.equal(result.paths.debt_ledger, '.geas/debts.yaml');
  assert.equal(result.paths.memory.common, '.geas/memory/common.yaml');
  assert.equal(result.paths.current_mission.mission_spec, '');
});

test('status reports current markdown baseline paths', () => {
  const created = runMissionCreate();
  assert.equal(created.ok, true);
  runMissionSpecRecord(missionSpec());
  runMissionDesignRecord(missionDesign());

  const result = runStatus();
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const id = created.ok ? created.current.mission_id : '';
  assert.equal(result.paths.current_mission.mission_spec, `.geas/missions/${id}/mission-spec-001.md`);
  assert.equal(result.paths.current_mission.mission_design, `.geas/missions/${id}/mission-design-001.md`);
});
