import { test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runTransaction } from '../src/lib/transaction';
import { missionSpec } from './helpers/artifacts';

let workdir: string;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'geas-transaction-'));
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

test('transaction removes created files when a later write fails', () => {
  const artifactPath = join(workdir, 'artifact.md');

  assert.throws(() => {
    runTransaction((tx) => {
      tx.writeMarkdown(artifactPath, missionSpec());
      throw new Error('simulated state write failure');
    });
  });

  assert.equal(existsSync(artifactPath), false);
});

test('transaction restores updated files on failure', () => {
  const statePath = join(workdir, 'run-state.yaml');
  writeFileSync(statePath, 'current_stage: specifying\n', 'utf8');

  assert.throws(() => {
    runTransaction((tx) => {
      tx.writeYaml(statePath, { current_stage: 'building' });
      throw new Error('simulated artifact write failure');
    });
  });

  assert.equal(readFileSync(statePath, 'utf8'), 'current_stage: specifying\n');
});

test('transaction keeps committed writes', () => {
  const artifactPath = join(workdir, 'artifact.md');

  runTransaction((tx) => {
    tx.writeMarkdown(artifactPath, missionSpec());
  });

  assert.equal(existsSync(artifactPath), true);
});
