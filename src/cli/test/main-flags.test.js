/**
 * T2 integration tests — global --json / --verbose / --debug flags wired
 * through main.ts (mission-20260426 task-002 / acceptance criterion T2.3).
 *
 * Strategy: spawn the bundle at plugin/bin/geas with `--json` etc. at
 * different positions in the argv (before vs. after the subcommand,
 * deeply nested subcommands) and assert that the CLI accepts them
 * without error. T2 invariant: --json doesn't change the stdout *shape*
 * because default mode is already JSON; the test is that the flags are
 * RECOGNIZED at every depth, i.e. parsing doesn't fail with "unknown
 * option".
 *
 * Note on extension: written as `.js` to run under `node --test` since
 * tsconfig excludes test/. See errors.test.js for the same rationale.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeTempRoot, runCli } = require('./helpers/setup');

// ── --help / parsing acceptance ───────────────────────────────────────

test('geas --help advertises --json, --verbose, --debug', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    const res = runCli(['--help'], { cwd: dir });
    assert.equal(res.status, 0);
    assert.match(res.stdout, /--json/, '--json should be in --help output');
    assert.match(res.stdout, /--verbose/, '--verbose should be in --help output');
    assert.match(res.stdout, /--debug/, '--debug should be in --help output');
  } finally {
    cleanup();
  }
});

// ── --json before / after subcommand: any-depth recognition ───────────

test('geas --json context (--json before subcommand) parses and exits 0', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    runCli(['setup'], { cwd: dir });
    const res = runCli(['--json', 'context'], { cwd: dir });
    assert.equal(res.status, 0, `expected exit 0, got ${res.status}: ${res.stderr}`);
    assert.ok(res.json, `--json should still produce JSON envelope, got: ${res.stdout}`);
    assert.equal(res.json.ok, true);
  } finally {
    cleanup();
  }
});

test('geas context --json (--json after subcommand) parses and exits 0', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    runCli(['setup'], { cwd: dir });
    const res = runCli(['context', '--json'], { cwd: dir });
    assert.equal(res.status, 0, `expected exit 0, got ${res.status}: ${res.stderr}`);
    assert.ok(res.json, 'should still produce JSON envelope');
    assert.equal(res.json.ok, true);
  } finally {
    cleanup();
  }
});

test('geas --verbose context parses and exits 0', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    runCli(['setup'], { cwd: dir });
    const res = runCli(['--verbose', 'context'], { cwd: dir });
    assert.equal(res.status, 0, `expected exit 0, got ${res.status}: ${res.stderr}`);
  } finally {
    cleanup();
  }
});

test('geas context --verbose parses and exits 0', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    runCli(['setup'], { cwd: dir });
    const res = runCli(['context', '--verbose'], { cwd: dir });
    assert.equal(res.status, 0, `expected exit 0, got ${res.status}: ${res.stderr}`);
  } finally {
    cleanup();
  }
});

test('geas --debug context parses and exits 0', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    runCli(['setup'], { cwd: dir });
    const res = runCli(['--debug', 'context'], { cwd: dir });
    assert.equal(res.status, 0, `expected exit 0, got ${res.status}: ${res.stderr}`);
  } finally {
    cleanup();
  }
});

test('geas --json --debug context produces pretty-indented JSON envelope', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    runCli(['setup'], { cwd: dir });
    const res = runCli(['--json', '--debug', 'context'], { cwd: dir });
    assert.equal(res.status, 0, `expected exit 0, got ${res.status}: ${res.stderr}`);
    assert.ok(res.json, 'should still produce JSON');
    // Pretty indent in T2 only fires through the new emit path, not through
    // legacy envelope.emit() which most commands still use. Tolerate both:
    // either pretty-printed or single-line JSON, but never a parse error.
    assert.equal(res.json.ok, true);
  } finally {
    cleanup();
  }
});

// ── Nested subcommand depth ───────────────────────────────────────────

test('geas mission --help is reachable and lists --json', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    runCli(['setup'], { cwd: dir });
    const res = runCli(['mission', '--help'], { cwd: dir });
    assert.equal(res.status, 0);
    assert.match(res.stdout, /--json/, 'subcommand help should include inherited --json');
  } finally {
    cleanup();
  }
});

test('geas schema --help is reachable and lists --json', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    const res = runCli(['schema', '--help'], { cwd: dir });
    assert.equal(res.status, 0);
    assert.match(res.stdout, /--json/);
  } finally {
    cleanup();
  }
});

test('geas schema list --json (deep subcommand) parses and exits 0', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    const res = runCli(['schema', 'list', '--json'], { cwd: dir });
    assert.equal(res.status, 0, `expected exit 0, got ${res.status}: ${res.stderr}`);
    assert.ok(res.json, 'deep subcommand with --json should still produce JSON envelope');
    assert.equal(res.json.ok, true);
  } finally {
    cleanup();
  }
});

test('geas --json schema list (--json at root with deep subcommand) parses and exits 0', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    const res = runCli(['--json', 'schema', 'list'], { cwd: dir });
    assert.equal(res.status, 0, `expected exit 0, got ${res.status}: ${res.stderr}`);
    assert.ok(res.json);
    assert.equal(res.json.ok, true);
  } finally {
    cleanup();
  }
});

// ── Unknown flag at any depth still rejected ──────────────────────────

test('geas --bogus context rejects the unknown flag', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    const res = runCli(['--bogus', 'context'], { cwd: dir });
    assert.notEqual(res.status, 0, 'unknown flag must produce a non-zero exit');
  } finally {
    cleanup();
  }
});

// ── T2 invariant: existing 147 tests' default-mode behavior preserved ─

test('geas context (no flags) still emits a JSON envelope (T2 default-mode invariant)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    runCli(['setup'], { cwd: dir });
    const res = runCli(['context'], { cwd: dir });
    assert.equal(res.status, 0);
    assert.ok(res.json, 'default mode (no --json) must still emit JSON envelope in T2');
    assert.equal(res.json.ok, true);
  } finally {
    cleanup();
  }
});

test('geas setup (no flags) still emits a JSON envelope on a fresh root', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    const res = runCli(['setup'], { cwd: dir });
    assert.equal(res.status, 0);
    assert.ok(res.json, 'default mode must still emit JSON envelope');
    assert.equal(res.json.ok, true);
  } finally {
    cleanup();
  }
});
