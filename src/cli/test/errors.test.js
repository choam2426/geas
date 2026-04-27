/**
 * T2 unit tests — src/cli/src/lib/errors.ts.
 *
 * Validates the new {code, message, hint, exit_category} error shape and
 * the exit_category -> exit code mapping (validation=2, guard=3,
 * missing_artifact=4, io=5, internal=1) introduced by mission-20260426
 * task-002 / acceptance criterion T2.2.
 *
 * Note on extension: written as `.js` to run under `node --test` since
 * tsconfig excludes test/. Implementation contract documents this
 * deviation from the contract surfaces (which list `.test.ts`) under
 * open_questions Q1.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const errors = require(path.join(REPO_ROOT, 'src', 'cli', 'dist', 'lib', 'errors'));

test('EXIT_CATEGORY_CODE has exactly the five canonical categories', () => {
  const keys = Object.keys(errors.EXIT_CATEGORY_CODE).sort();
  assert.deepEqual(
    keys,
    ['guard', 'internal', 'io', 'missing_artifact', 'validation'],
    'EXIT_CATEGORY_CODE key set must be exactly the five categories from AC3',
  );
});

test('EXIT_CATEGORY_CODE mapping: validation=2 / guard=3 / missing_artifact=4 / io=5 / internal=1', () => {
  assert.equal(errors.EXIT_CATEGORY_CODE.validation, 2);
  assert.equal(errors.EXIT_CATEGORY_CODE.guard, 3);
  assert.equal(errors.EXIT_CATEGORY_CODE.missing_artifact, 4);
  assert.equal(errors.EXIT_CATEGORY_CODE.io, 5);
  assert.equal(errors.EXIT_CATEGORY_CODE.internal, 1);
});

test('exitCodeForCategory returns the right code for each known category', () => {
  assert.equal(errors.exitCodeForCategory('validation'), 2);
  assert.equal(errors.exitCodeForCategory('guard'), 3);
  assert.equal(errors.exitCodeForCategory('missing_artifact'), 4);
  assert.equal(errors.exitCodeForCategory('io'), 5);
  assert.equal(errors.exitCodeForCategory('internal'), 1);
});

test('exitCodeForCategory falls through to internal=1 for unknown categories', () => {
  assert.equal(errors.exitCodeForCategory('nonexistent_category'), 1);
  assert.equal(errors.exitCodeForCategory(''), 1);
  assert.equal(errors.exitCodeForCategory('VALIDATION'), 1, 'case-sensitive: uppercase falls through');
});

test('makeError populates code / message / exit_category and defaults to internal', () => {
  const e = errors.makeError('some_code', 'something went wrong');
  assert.equal(e.code, 'some_code');
  assert.equal(e.message, 'something went wrong');
  assert.equal(e.exit_category, 'internal');
  assert.equal(e.hint, undefined, 'no hint when not provided');
});

test('makeError honors explicit exit_category and hint', () => {
  const e = errors.makeError('schema_validation_failed', 'shape is bad', {
    hint: 'check the contract surfaces field',
    exit_category: 'validation',
  });
  assert.equal(e.code, 'schema_validation_failed');
  assert.equal(e.message, 'shape is bad');
  assert.equal(e.hint, 'check the contract surfaces field');
  assert.equal(e.exit_category, 'validation');
});

test('makeError omits hint key when hint is undefined (does not write hint:undefined)', () => {
  const e = errors.makeError('x', 'y');
  assert.ok(!('hint' in e), 'hint key should not be present when undefined');
});

test('CliErrorWithExit constructs from a CliErrorV2 payload and carries all fields', () => {
  const e = new errors.CliErrorWithExit({
    code: 'guard_failed',
    message: 'cannot transition',
    hint: 'review prior verdict',
    exit_category: 'guard',
  });
  assert.equal(e.code, 'guard_failed');
  assert.equal(e.message, 'cannot transition');
  assert.equal(e.hint, 'review prior verdict');
  assert.equal(e.exit_category, 'guard');
  assert.equal(e.name, 'CliErrorWithExit');
  assert.ok(e instanceof Error, 'extends Error');
});

test('CliErrorWithExit toEnvelope round-trips into CliErrorV2 shape', () => {
  const e = new errors.CliErrorWithExit({
    code: 'missing_artifact',
    message: 'no .geas/ tree at this root',
    hint: "run 'geas setup' to bootstrap",
    exit_category: 'missing_artifact',
  });
  const env = e.toEnvelope();
  assert.equal(env.code, 'missing_artifact');
  assert.equal(env.message, 'no .geas/ tree at this root');
  assert.equal(env.hint, "run 'geas setup' to bootstrap");
  assert.equal(env.exit_category, 'missing_artifact');
});

test('isCliErrorWithExit identifies real instances and rejects unrelated values', () => {
  const e = new errors.CliErrorWithExit({
    code: 'x',
    message: 'y',
    exit_category: 'internal',
  });
  assert.ok(errors.isCliErrorWithExit(e));
  assert.ok(!errors.isCliErrorWithExit(null));
  assert.ok(!errors.isCliErrorWithExit({}));
  assert.ok(!errors.isCliErrorWithExit(new Error('plain')));
});

test('isCliErrorWithExit accepts structurally-equivalent objects (cross-bundle safety)', () => {
  // Simulates the edge case where esbuild duplicates the class in two
  // bundles and `instanceof` fails — the structural fallback must kick in.
  const lookalike = {
    code: 'guard_failed',
    message: 'oops',
    exit_category: 'guard',
  };
  assert.ok(errors.isCliErrorWithExit(lookalike));
});

test('cliErrorFromException unwraps CliErrorWithExit into the v2 envelope', () => {
  const original = new errors.CliErrorWithExit({
    code: 'guard_failed',
    message: 'illegal transition',
    hint: 'check task-state.status',
    exit_category: 'guard',
  });
  const env = errors.cliErrorFromException(original);
  assert.equal(env.code, 'guard_failed');
  assert.equal(env.message, 'illegal transition');
  assert.equal(env.hint, 'check task-state.status');
  assert.equal(env.exit_category, 'guard');
});

test('cliErrorFromException maps a vanilla Error to internal-category', () => {
  const env = errors.cliErrorFromException(new Error('boom'));
  assert.equal(env.code, 'internal_error');
  assert.equal(env.message, 'boom');
  assert.equal(env.exit_category, 'internal');
});

test('cliErrorFromException stringifies non-Error throws into internal-category', () => {
  const env = errors.cliErrorFromException('a bare string');
  assert.equal(env.code, 'internal_error');
  assert.equal(env.message, 'a bare string');
  assert.equal(env.exit_category, 'internal');
});
