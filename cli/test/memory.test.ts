import { test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../src/commands/init';
import { runMissionCreate } from '../src/commands/mission';
import { runMemoryRecord } from '../src/commands/memory';

let workdir: string;
let originalCwd: string;

beforeEach(() => {
  originalCwd = process.cwd();
  workdir = mkdtempSync(join(tmpdir(), 'geas-memory-'));
  process.chdir(workdir);
  runInit();
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(workdir, { recursive: true, force: true });
});

test('memory record fails when not in consolidating', () => {
  runMissionCreate();
  const r = runMemoryRecord('common', undefined, { guideline: 'g', applies_when: [], source_refs: [] });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.error.guards?.some((g) => g.code === 'stage_not_consolidating'));
});

test('memory record rejects invalid role name', () => {
  runMissionCreate();
  const r = runMemoryRecord('role', 'unknown-role', { guideline: 'g', applies_when: [], source_refs: [] });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.error.guards?.some((g) => g.code === 'role_invalid'));
});

test('memory record rejects schema-invalid payload', () => {
  const r = runMemoryRecord('common', undefined, { guideline: 'g' });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.code, 'schema_invalid');
});
