/**
 * T2 unit tests — src/cli/src/lib/output.ts.
 *
 * Validates the two-mode output formatter (scalar text + JSON envelope),
 * the per-command formatter registry, and the OutputState singleton
 * surface introduced by mission-20260426 task-002 / acceptance criterion
 * T2.1.
 *
 * The emitOk / emitErr functions both call process.exit; tests that
 * exercise them spawn a child node process so they can observe exit
 * code + stdout/stderr without killing the test runner.
 *
 * Note on extension: written as `.js` to run under `node --test` since
 * tsconfig excludes test/. See errors.test.js for the same rationale.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const output = require(path.join(REPO_ROOT, 'src', 'cli', 'dist', 'lib', 'output'));

// Helper: spawn a node child to run a snippet that calls emit*. Returns
// {status, stdout, stderr, json}. The snippet must be self-contained.
function runChild(snippet) {
  const tmpFile = path.join(os.tmpdir(), `output-test-${Date.now()}-${Math.random()}.js`);
  fs.writeFileSync(tmpFile, snippet, 'utf-8');
  try {
    const res = spawnSync(process.execPath, [tmpFile], {
      cwd: os.tmpdir(),
      encoding: 'utf-8',
    });
    let json = null;
    if (res.stdout) {
      try {
        json = JSON.parse(res.stdout);
      } catch {
        json = null;
      }
    }
    return {
      status: res.status,
      stdout: res.stdout,
      stderr: res.stderr,
      json,
    };
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // best-effort
    }
  }
}

const OUTPUT_PATH = path.join(REPO_ROOT, 'src', 'cli', 'dist', 'lib', 'output').replace(/\\/g, '\\\\');

// ── In-process: state + registry ──────────────────────────────────────

test('OutputState defaults to mode=default, verbose=false, debug=false', () => {
  // Save and restore in case other in-process tests perturbed it.
  const before = output.getOutputMode();
  try {
    output.setOutputMode({ mode: 'default', verbose: false, debug: false });
    const state = output.getOutputMode();
    assert.equal(state.mode, 'default');
    assert.equal(state.verbose, false);
    assert.equal(state.debug, false);
  } finally {
    output.setOutputMode(before);
  }
});

test('setOutputMode updates only the provided fields (partial update)', () => {
  const before = output.getOutputMode();
  try {
    output.setOutputMode({ mode: 'default', verbose: false, debug: false });
    output.setOutputMode({ verbose: true });
    const state = output.getOutputMode();
    assert.equal(state.mode, 'default', 'mode untouched by partial update');
    assert.equal(state.verbose, true);
    assert.equal(state.debug, false);
  } finally {
    output.setOutputMode(before);
  }
});

test('getEffectiveJsonMode returns true under T2 invariant (default == JSON)', () => {
  const before = output.getOutputMode();
  try {
    output.setOutputMode({ mode: 'default', verbose: false, debug: false });
    assert.equal(output.getEffectiveJsonMode(), true);
    output.setOutputMode({ mode: 'json' });
    assert.equal(output.getEffectiveJsonMode(), true);
  } finally {
    output.setOutputMode(before);
  }
});

test('registerFormatter / lookupFormatter round-trip', () => {
  output._clearFormatterRegistry();
  try {
    assert.equal(output.lookupFormatter('test-cmd'), undefined);
    const fmt = (data) => `formatted: ${JSON.stringify(data)}`;
    output.registerFormatter('test-cmd', fmt);
    const found = output.lookupFormatter('test-cmd');
    assert.equal(found, fmt);
    assert.equal(found({ x: 1 }), 'formatted: {"x":1}');
  } finally {
    output._clearFormatterRegistry();
  }
});

test('registerFormatter replaces a prior registration silently', () => {
  output._clearFormatterRegistry();
  try {
    output.registerFormatter('cmd', () => 'first');
    output.registerFormatter('cmd', () => 'second');
    assert.equal(output.lookupFormatter('cmd')({ irrelevant: true }), 'second');
  } finally {
    output._clearFormatterRegistry();
  }
});

test('lookupFormatter returns undefined when registry is empty (T2 default state)', () => {
  output._clearFormatterRegistry();
  assert.equal(output.lookupFormatter('any-command'), undefined);
});

// ── Child-process: emitOk / emitErr ───────────────────────────────────

test('emitOk in JSON mode produces {ok:true,data} envelope and exits 0', () => {
  const snippet = `
    const o = require('${OUTPUT_PATH}');
    o.setOutputMode({ mode: 'json', verbose: false, debug: false });
    o.emitOk('test-cmd', { hello: 'world' });
  `;
  const res = runChild(snippet);
  assert.equal(res.status, 0);
  assert.ok(res.json, `expected JSON stdout, got: ${res.stdout}`);
  assert.equal(res.json.ok, true);
  assert.deepEqual(res.json.data, { hello: 'world' });
});

test('emitOk in default mode (T2 invariant) also produces JSON envelope when registry is empty', () => {
  const snippet = `
    const o = require('${OUTPUT_PATH}');
    o._clearFormatterRegistry();
    o.setOutputMode({ mode: 'default', verbose: false, debug: false });
    o.emitOk('unregistered-cmd', { value: 42 });
  `;
  const res = runChild(snippet);
  assert.equal(res.status, 0);
  assert.ok(res.json, `expected JSON envelope fallback, got: ${res.stdout}`);
  assert.equal(res.json.ok, true);
  assert.deepEqual(res.json.data, { value: 42 });
});

test('emitOk in default mode uses a registered scalar formatter and prints text on stdout', () => {
  const snippet = `
    const o = require('${OUTPUT_PATH}');
    o._clearFormatterRegistry();
    o.registerFormatter('greet', (data) => 'hello, ' + data.name);
    o.setOutputMode({ mode: 'default', verbose: false, debug: false });
    o.emitOk('greet', { name: 'Geas' });
  `;
  const res = runChild(snippet);
  assert.equal(res.status, 0);
  assert.equal(res.stdout.trim(), 'hello, Geas');
  assert.equal(res.json, null, 'scalar text should not be parseable as JSON');
});

test('emitOk in default mode with formatter ensures trailing newline on stdout', () => {
  const snippet = `
    const o = require('${OUTPUT_PATH}');
    o._clearFormatterRegistry();
    o.registerFormatter('no-newline', () => 'nonewline');
    o.setOutputMode({ mode: 'default', verbose: false, debug: false });
    o.emitOk('no-newline', {});
  `;
  const res = runChild(snippet);
  assert.equal(res.status, 0);
  assert.ok(res.stdout.endsWith('\n'), 'stdout should always end with a newline');
});

test('emitOk with --json forces JSON envelope even when a scalar formatter is registered', () => {
  const snippet = `
    const o = require('${OUTPUT_PATH}');
    o._clearFormatterRegistry();
    o.registerFormatter('forced', () => 'TEXT');
    o.setOutputMode({ mode: 'json', verbose: false, debug: false });
    o.emitOk('forced', { x: 1 });
  `;
  const res = runChild(snippet);
  assert.equal(res.status, 0);
  assert.ok(res.json, 'JSON should be emitted regardless of formatter');
  assert.equal(res.json.ok, true);
  assert.deepEqual(res.json.data, { x: 1 });
});

test('emitOk with --json --debug produces pretty-indented JSON', () => {
  const snippet = `
    const o = require('${OUTPUT_PATH}');
    o.setOutputMode({ mode: 'json', verbose: false, debug: true });
    o.emitOk('any', { x: 1 });
  `;
  const res = runChild(snippet);
  assert.equal(res.status, 0);
  // Pretty-printed JSON contains newlines and indentation
  assert.ok(res.stdout.includes('\n  '), `expected pretty indent, got: ${res.stdout}`);
  assert.ok(res.json, 'should still parse as JSON');
});

test('emitErr writes envelope on stdout and exits with the per-category code', () => {
  const cases = [
    ['validation', 2],
    ['guard', 3],
    ['missing_artifact', 4],
    ['io', 5],
    ['internal', 1],
  ];
  for (const [category, expectedCode] of cases) {
    const snippet = `
      const o = require('${OUTPUT_PATH}');
      o.setOutputMode({ mode: 'json', verbose: false, debug: false });
      o.emitErr({
        code: 'tag_for_${category}',
        message: 'test message ${category}',
        hint: 'do the right thing',
        exit_category: '${category}',
      });
    `;
    const res = runChild(snippet);
    assert.equal(res.status, expectedCode, `${category} should exit ${expectedCode}, got ${res.status}`);
    assert.ok(res.json, `${category} should emit JSON, got: ${res.stdout}`);
    assert.equal(res.json.ok, false);
    assert.equal(res.json.error.code, `tag_for_${category}`);
    assert.equal(res.json.error.message, `test message ${category}`);
    assert.equal(res.json.error.hint, 'do the right thing');
  }
});

test('emitErr omits hint key from envelope when hint is not provided', () => {
  const snippet = `
    const o = require('${OUTPUT_PATH}');
    o.setOutputMode({ mode: 'json', verbose: false, debug: false });
    o.emitErr({
      code: 'tag',
      message: 'no hint here',
      exit_category: 'internal',
    });
  `;
  const res = runChild(snippet);
  assert.equal(res.status, 1);
  assert.ok(res.json);
  assert.ok(!('hint' in res.json.error), 'hint should not appear when not provided');
});

test('emitErr in default mode (T2) also writes JSON envelope to stdout', () => {
  // T2 invariant: default mode falls through to JSON for errors so old
  // commands keep their exit codes and stdout shape.
  const snippet = `
    const o = require('${OUTPUT_PATH}');
    o.setOutputMode({ mode: 'default', verbose: false, debug: false });
    o.emitErr({
      code: 'guard_failed',
      message: 'cannot transition',
      hint: 'check status',
      exit_category: 'guard',
    });
  `;
  const res = runChild(snippet);
  assert.equal(res.status, 3);
  assert.ok(res.json, 'default-mode error should still emit JSON in T2');
  assert.equal(res.json.ok, false);
  assert.equal(res.json.error.code, 'guard_failed');
});

// ── T1 bridge equivalence (mission-20260427-xIPG1sDY task-001) ────────
//
// envelope.emit(envelope) routes through output.writeOkEnvelope /
// output.writeLegacyErrEnvelope under Option A but exits with the
// LEGACY EXIT_CODES integer. Validates that:
//   (a) success path produces a byte-identical {ok:true,data:...}
//       envelope and exits 0.
//   (b) error path produces a byte-identical
//       {ok:false,error:{code,message,hints?}} envelope (note: `hints`
//       plural — legacy field name), exit code is the legacy integer
//       (missing_artifact=1 NOT new-category 4; guard_failed=3),
//       hints field is preserved verbatim.
//   (c) debug mode pretty-prints the legacy envelope (proves the bridge
//       routes through output's OutputState).

const ENVELOPE_PATH = path
  .join(REPO_ROOT, 'src', 'cli', 'dist', 'lib', 'envelope')
  .replace(/\\/g, '\\\\');

test('envelope.emit (bridge) ok-path produces byte-identical legacy envelope', () => {
  const snippet = `
    const env = require('${ENVELOPE_PATH}');
    env.emit(env.ok({ x: 1, nested: { y: 'two' } }));
  `;
  const res = runChild(snippet);
  assert.equal(res.status, 0);
  // The exact stdout shape — single-line JSON, trailing newline — is
  // what 17 unmigrated commands rely on.
  assert.equal(
    res.stdout,
    '{"ok":true,"data":{"x":1,"nested":{"y":"two"}}}\n',
    'bridge ok-path stdout must match legacy envelope byte-for-byte',
  );
});

test('envelope.emit (bridge) err-path uses LEGACY EXIT_CODES integer and preserves `hints` plural', () => {
  // missing_artifact = 1 in legacy EXIT_CODES vs 4 in new EXIT_CATEGORY_CODE.
  // Bridge MUST exit 1 at T1 merge (Option A — fixture compatibility).
  const snippet = `
    const env = require('${ENVELOPE_PATH}');
    env.emit(env.err('missing_artifact', 'no artifact', { detail: 1 }));
  `;
  const res = runChild(snippet);
  assert.equal(
    res.status,
    1,
    'missing_artifact must exit 1 (legacy) at T1 merge, not 4 (new category)',
  );
  assert.equal(
    res.stdout,
    '{"ok":false,"error":{"code":"missing_artifact","message":"no artifact","hints":{"detail":1}}}\n',
    'bridge err-path stdout must match legacy envelope (note: `hints` plural)',
  );
});

test('envelope.emit (bridge) err-path: guard_failed exits 3 (legacy)', () => {
  const snippet = `
    const env = require('${ENVELOPE_PATH}');
    env.emit(env.err('guard_failed', 'bad transition'));
  `;
  const res = runChild(snippet);
  assert.equal(res.status, 3, 'guard_failed must exit 3 (legacy=new=3)');
  assert.ok(res.json);
  assert.equal(res.json.ok, false);
  assert.equal(res.json.error.code, 'guard_failed');
  assert.ok(
    !('hint' in res.json.error),
    'legacy envelope error has no `hint` (singular) field',
  );
  assert.ok(
    !('hints' in res.json.error),
    'optional `hints` is omitted when not provided',
  );
});

test('envelope.emit (bridge) honors output.setOutputMode debug for pretty-print', () => {
  // Routing through output.writeOkEnvelope means the bridge respects
  // the OutputState debug toggle, just as a v2-migrated command would.
  const snippet = `
    const env = require('${ENVELOPE_PATH}');
    const o = require('${OUTPUT_PATH}');
    o.setOutputMode({ mode: 'json', verbose: false, debug: true });
    env.emit(env.ok({ x: 1 }));
  `;
  const res = runChild(snippet);
  assert.equal(res.status, 0);
  assert.ok(
    res.stdout.includes('\n  '),
    `expected pretty-indented JSON, got: ${res.stdout}`,
  );
  assert.ok(res.json, 'still parses as JSON');
  assert.equal(res.json.ok, true);
  assert.deepEqual(res.json.data, { x: 1 });
});
