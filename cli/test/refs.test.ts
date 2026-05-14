import { test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveProjectRef, resolveTaskArtifactRef } from '../src/lib/refs';

let workdir: string;
let originalCwd: string;
const missionId = '20260513-abc123';
const taskId = 'task-001';

beforeEach(() => {
  originalCwd = process.cwd();
  workdir = mkdtempSync(join(tmpdir(), 'geas-refs-'));
  process.chdir(workdir);
  const taskBase = join(workdir, '.geas', 'missions', missionId, 'tasks', taskId);
  mkdirSync(taskBase, { recursive: true });
  writeFileSync(join(taskBase, 'task-contract-001.md'), 'contract', 'utf8');
  writeFileSync(join(taskBase, 'task-evidence.md'), 'evidence', 'utf8');
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(workdir, { recursive: true, force: true });
});

test('task resolver accepts same task filename refs', () => {
  const result = resolveTaskArtifactRef(missionId, taskId, 'task-contract-001.md', workdir);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.path, join(workdir, '.geas', 'missions', missionId, 'tasks', taskId, 'task-contract-001.md'));
});

test('task resolver accepts mission-relative task refs', () => {
  const result = resolveTaskArtifactRef(missionId, taskId, 'tasks/task-001/task-contract-001.md', workdir);
  assert.equal(result.ok, true);
});

test('task resolver rejects missing refs', () => {
  const result = resolveTaskArtifactRef(missionId, taskId, 'missing.md', workdir);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'ref_missing');
});

test('task resolver rejects absolute refs', () => {
  const result = resolveTaskArtifactRef(missionId, taskId, join(workdir, 'outside.md'), workdir);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'ref_absolute');
});

test('task resolver rejects parent escapes', () => {
  const result = resolveTaskArtifactRef(missionId, taskId, '../task-002/task-contract-001.md', workdir);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'ref_escape');
});

test('task resolver rejects stale yaml readable artifact refs', () => {
  const result = resolveTaskArtifactRef(missionId, taskId, 'task-contract-001.yaml', workdir);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'ref_stale_yaml_artifact');
});

test('project resolver accepts geas-relative refs with or without prefix', () => {
  const withoutPrefix = resolveProjectRef(`missions/${missionId}/tasks/${taskId}/task-evidence.md`, workdir);
  const withPrefix = resolveProjectRef(`.geas/missions/${missionId}/tasks/${taskId}/task-evidence.md`, workdir);
  assert.equal(withoutPrefix.ok, true);
  assert.equal(withPrefix.ok, true);
});
