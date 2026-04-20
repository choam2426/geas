/**
 * G1 Foundation integration test.
 *
 * Covers: geas setup, geas context, geas schema list/show/dump, and
 * the --help / --version smoke surface. Each assertion creates its
 * own temp project root for isolation.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeTempRoot, runCli, readArtifact } = require('./helpers/setup');

test('geas --help prints usage', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    const res = runCli(['--help'], { cwd: dir });
    assert.equal(res.status, 0);
    assert.match(res.stdout, /Usage: geas/);
    assert.match(res.stdout, /setup/);
    assert.match(res.stdout, /context/);
    assert.match(res.stdout, /schema/);
    assert.match(res.stdout, /state/);
  } finally {
    cleanup();
  }
});

test('geas --version prints the CLI version', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    const res = runCli(['--version'], { cwd: dir });
    assert.equal(res.status, 0);
    assert.match(res.stdout.trim(), /^\d+\.\d+\.\d+$/);
  } finally {
    cleanup();
  }
});

test('geas setup creates the canonical .geas/ tree', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    const res = runCli(['setup'], { cwd: dir });
    assert.equal(res.status, 0, `setup failed: ${res.stderr}`);
    assert.ok(res.json, 'setup should emit a JSON envelope');
    assert.equal(res.json.ok, true);

    // Directories
    for (const d of [
      '.geas',
      '.geas/memory',
      '.geas/memory/agents',
      '.geas/missions',
      '.geas/.tmp',
    ]) {
      assert.ok(
        fs.existsSync(path.join(dir, d)),
        `expected directory ${d} to exist after setup`,
      );
    }

    // Files
    for (const f of [
      '.geas/config.json',
      '.geas/debts.json',
      '.geas/events.jsonl',
      '.geas/candidates.json',
      '.geas/memory/shared.md',
    ]) {
      assert.ok(
        fs.existsSync(path.join(dir, f)),
        `expected file ${f} to exist after setup`,
      );
    }

    // debts.json must be a valid empty debts artifact
    const debts = readArtifact(dir, '.geas/debts.json');
    assert.deepEqual(Object.keys(debts).sort(), [
      'created_at',
      'entries',
      'updated_at',
    ]);
    assert.deepEqual(debts.entries, []);
    assert.match(debts.created_at, /^\d{4}-\d{2}-\d{2}T/);
    assert.match(debts.updated_at, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    cleanup();
  }
});

test('geas setup is idempotent on re-run', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    const first = runCli(['setup'], { cwd: dir });
    assert.equal(first.status, 0);
    const debtsBefore = readArtifact(dir, '.geas/debts.json');

    const second = runCli(['setup'], { cwd: dir });
    assert.equal(second.status, 0);
    assert.equal(second.json.ok, true);
    // Existing paths should be reported as existed[] rather than created[]
    assert.ok(second.json.data.existed.includes('.geas/debts.json'));

    const debtsAfter = readArtifact(dir, '.geas/debts.json');
    assert.deepEqual(debtsAfter, debtsBefore, 'debts.json preserved on re-run');
  } finally {
    cleanup();
  }
});

test('geas context reports empty missions after setup', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    const s = runCli(['setup'], { cwd: dir });
    assert.equal(s.status, 0);

    const ctx = runCli(['context'], { cwd: dir });
    assert.equal(ctx.status, 0, `context failed: ${ctx.stderr}`);
    assert.ok(ctx.json);
    assert.equal(ctx.json.ok, true);
    assert.deepEqual(ctx.json.data.missions, []);
    assert.equal(typeof ctx.json.data.project_root, 'string');
    assert.equal(typeof ctx.json.data.geas_dir, 'string');
  } finally {
    cleanup();
  }
});

test('geas context fails clearly when .geas/ is missing', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    const ctx = runCli(['context'], { cwd: dir });
    assert.notEqual(ctx.status, 0);
    assert.ok(ctx.json, 'context should still emit an envelope');
    assert.equal(ctx.json.ok, false);
    assert.equal(ctx.json.error.code, 'missing_artifact');
  } finally {
    cleanup();
  }
});

test('geas schema list returns every embedded schema name', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    const res = runCli(['schema', 'list'], { cwd: dir });
    assert.equal(res.status, 0, `schema list failed: ${res.stderr}`);
    assert.ok(res.json);
    assert.equal(res.json.ok, true);
    const names = res.json.data.schemas;
    assert.ok(Array.isArray(names));
    const expected = [
      'debts',
      'deliberation',
      'evidence',
      'gap',
      'gate-results',
      'implementation-contract',
      'memory-update',
      'mission-spec',
      'mission-state',
      'mission-verdicts',
      'phase-reviews',
      'self-check',
      'task-contract',
      'task-state',
    ];
    assert.deepEqual([...names].sort(), expected);
  } finally {
    cleanup();
  }
});

test('geas schema show dumps the requested schema as JSON', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    const res = runCli(['schema', 'show', 'debts'], { cwd: dir });
    assert.equal(res.status, 0);
    assert.ok(res.json);
    assert.equal(res.json.ok, true);
    const schema = res.json.data.schema;
    assert.equal(schema.title, 'Geas Debts');
    assert.ok(schema.properties.entries);
  } finally {
    cleanup();
  }
});

test('geas schema show rejects unknown schemas', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    const res = runCli(['schema', 'show', 'not-a-real-schema'], { cwd: dir });
    assert.notEqual(res.status, 0);
    assert.ok(res.json);
    assert.equal(res.json.ok, false);
    assert.equal(res.json.error.code, 'invalid_argument');
  } finally {
    cleanup();
  }
});

test('geas schema dump returns a map of every schema', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    const res = runCli(['schema', 'dump'], { cwd: dir });
    assert.equal(res.status, 0);
    assert.ok(res.json);
    assert.equal(res.json.ok, true);
    const schemas = res.json.data.schemas;
    assert.equal(typeof schemas, 'object');
    assert.ok(schemas.debts);
    assert.ok(schemas['task-contract']);
  } finally {
    cleanup();
  }
});

test('geas state mission-get reports missing artifact cleanly', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    runCli(['setup'], { cwd: dir });
    const res = runCli(
      ['state', 'mission-get', '--mission', 'mission-20260420-abcdefgh'],
      { cwd: dir },
    );
    assert.notEqual(res.status, 0);
    assert.ok(res.json);
    assert.equal(res.json.ok, false);
    assert.equal(res.json.error.code, 'missing_artifact');
  } finally {
    cleanup();
  }
});

test('geas state mission-set writes and validates mission-state', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    runCli(['setup'], { cwd: dir });
    const mid = 'mission-20260420-abcdefgh';
    const payload = JSON.stringify({
      mission_id: mid,
      phase: 'specifying',
      active_tasks: [],
    });
    const res = runCli(['state', 'mission-set', '--mission', mid], {
      cwd: dir,
      input: payload,
    });
    assert.equal(res.status, 0, `mission-set failed: ${res.stderr}`);
    assert.ok(res.json);
    assert.equal(res.json.ok, true);

    const written = readArtifact(dir, `.geas/missions/${mid}/mission-state.json`);
    assert.equal(written.mission_id, mid);
    assert.equal(written.phase, 'specifying');
    assert.match(written.created_at, /^\d{4}-\d{2}-\d{2}T/);
    assert.match(written.updated_at, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    cleanup();
  }
});

test('geas state mission-set rejects schema-invalid payloads', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    runCli(['setup'], { cwd: dir });
    const mid = 'mission-20260420-abcdefgh';
    const badPayload = JSON.stringify({ phase: 'not-a-valid-phase' });
    const res = runCli(['state', 'mission-set', '--mission', mid], {
      cwd: dir,
      input: badPayload,
    });
    assert.notEqual(res.status, 0);
    assert.ok(res.json);
    assert.equal(res.json.ok, false);
    assert.equal(res.json.error.code, 'schema_validation_failed');
  } finally {
    cleanup();
  }
});
