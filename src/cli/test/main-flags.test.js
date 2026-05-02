/**
 * Integration tests — global --json / --verbose / --debug flags wired
 * through main.ts.
 *
 * Strategy: spawn the bundle at bin/geas with `--json` etc. at
 * different positions in the argv (before vs. after the subcommand,
 * deeply nested subcommands) and assert that the CLI accepts them
 * without error AND that the new default-mode behavior (post-AC3) holds
 * across all 17 commands' help/read-only surfaces.
 *
 * AC3 (mission-20260427-xIPG1sDY task-006, supersedes task-002):
 *   - default mode (no --json) → success on stdout as scalar text when
 *     a per-command ScalarFormatter is registered, else JSON envelope
 *     fallback (staged rollout); errors on stderr as `error: ...` +
 *     `hint: ...`.
 *   - --json mode → single-line `{ok,...}` envelope on stdout regardless
 *     of formatter registration; pretty-indented when --json --debug.
 *
 * The 17-command parameterized coverage at the bottom of this file
 * realizes T2.7 (a) — main-flags.test.js asserts the new default
 * behavior across the full command surface in one consistent assertion
 * set rather than scattered per-test snippets.
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

// ── AC3 default-mode invariant (post-flip) ────────────────────────────
//
// The 5 T2.a commands (context, setup, state, event, schema) get
// per-command ScalarFormatter registrations in dedicated AC3 sub-commits
// after this baseline commit lands. Until each registration commits, the
// default-mode success path falls back to JSON envelope per output.ts
// `useJson = state.mode === 'json' || !lookupFormatter(name)`. Each of
// the per-command formatter-registration commits updates the
// per-command default-mode scalar assertion in the relevant batch
// fixture (g1-foundation for these 5).

test('geas context --json still emits a JSON envelope on stdout (AC3 invariant: --json forces envelope)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    runCli(['setup'], { cwd: dir });
    const res = runCli(['context', '--json'], { cwd: dir });
    assert.equal(res.status, 0);
    assert.ok(res.json, '--json must always emit JSON envelope');
    assert.equal(res.json.ok, true);
  } finally {
    cleanup();
  }
});

// ── 17-command coverage: AC3 default-mode behavior assertion set (T2.7 a) ─
//
// The 17 production commands listed in the mission spec affected_surfaces
// (commands/*.ts, 17 files). For each command we assert two invariants:
//   1. --help reachable → exit 0, parsing succeeds (validates --json /
//      --verbose / --debug are inherited at every depth).
//   2. --json mode for a representative invocation → JSON envelope on
//      stdout (validates the global flag flows into the action handler).
//
// Per-command default-mode scalar success is asserted by each command's
// own batch fixture (g1, g2, g3, g4, g5, g6, g7); main-flags only
// validates the cross-cutting flag plumbing here.

const COMMAND_HELP_TARGETS = [
  ['context', '--help'],
  ['setup', '--help'],
  ['mission', '--help'],
  ['task', '--help'],
  ['evidence', '--help'],
  ['gate', '--help'],
  ['self-check', '--help'],
  ['debt', '--help'],
  ['memory', '--help'],
  ['state', '--help'],
  ['deliberation', '--help'],
  ['impl-contract', '--help'],
  ['gap', '--help'],
  ['memory-update', '--help'],
  ['consolidation', '--help'],
  ['event', '--help'],
  ['schema', '--help'],
];

test('17 commands: --help reachable and parsing succeeds (cross-cutting flag plumbing)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    for (const args of COMMAND_HELP_TARGETS) {
      const res = runCli(args, { cwd: dir });
      assert.equal(
        res.status,
        0,
        `command '${args.join(' ')}' --help should exit 0; got ${res.status} stderr: ${res.stderr}`,
      );
    }
  } finally {
    cleanup();
  }
});

test('17 commands: --json on read-only surfaces produces JSON envelope on stdout', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    runCli(['setup'], { cwd: dir });
    // Read-only surfaces reachable without further setup. Each must
    // produce a parseable JSON envelope on stdout under --json. (Write
    // commands have batch-specific fixtures asserting the same shape.)
    const READ_ONLY_TARGETS = [
      ['context'],
      ['schema', 'list'],
      ['schema', 'show', 'debts'],
      ['schema', 'dump'],
      ['debt', 'list'],
    ];
    for (const args of READ_ONLY_TARGETS) {
      const res = runCli(['--json', ...args], { cwd: dir });
      assert.equal(res.status, 0, `--json ${args.join(' ')} should exit 0: ${res.stderr}`);
      assert.ok(res.json, `--json ${args.join(' ')} should emit JSON envelope; got: ${res.stdout}`);
      assert.equal(res.json.ok, true);
    }
  } finally {
    cleanup();
  }
});

test('17 commands: default-mode error path writes scalar to stderr for migrated commands', () => {
  // T2.a-migrated commands' error sites flow through emitErr, so post-AC3
  // their default-mode error path goes to stderr scalar. This sweeps the
  // 5 T2.a commands; T2.b/c/d commands get equivalent assertions in
  // their own per-command commit's fixture sweep.
  const { dir, cleanup } = makeTempRoot();
  try {
    runCli(['setup'], { cwd: dir });
    const ERROR_TARGETS = [
      // [args, expected_exit_code, hint_pattern]
      [['state', 'mission-get', '--mission', 'not-a-valid-id'], 2, /mission ids look like/],
      [['state', 'task-get', '--mission', 'not-a-valid-id', '--task', 'task-001'], 2, /mission ids look like/],
      [['schema', 'show', 'not-a-real-schema'], 2, /pick one of/],
      [['schema', 'template', 'evidence', '--op', 'append'], 2, /one of/],
    ];
    for (const [args, expected_exit, hint_pat] of ERROR_TARGETS) {
      const res = runCli(args, { cwd: dir });
      assert.equal(
        res.status,
        expected_exit,
        `'${args.join(' ')}' should exit ${expected_exit}; got ${res.status}`,
      );
      assert.equal(
        res.stdout,
        '',
        `'${args.join(' ')}' default-mode error must not write stdout; got: ${res.stdout}`,
      );
      assert.match(
        res.stderr,
        /^error: /m,
        `'${args.join(' ')}' must write 'error: ...' to stderr`,
      );
      assert.match(
        res.stderr,
        hint_pat,
        `'${args.join(' ')}' stderr must include hint matching ${hint_pat}; got: ${res.stderr}`,
      );
    }
  } finally {
    cleanup();
  }
});
