/**
 * T5.5 / A3 — envelope.ts legacy export removal binary verification.
 *
 * mission-20260427-xIPG1sDY task-005 / verification_plan step 5.
 *
 * Background:
 *   Before this mission envelope.ts exported four legacy symbols
 *   (`emit`, `err`, `ok`, `EXIT_CODES`) that were the canonical write
 *   path for every CLI command. Task-001 (T1) installed a bridge so
 *   `emit()` delegated to lib/output.ts writers while preserving legacy
 *   exit codes (Option A). Task-006 (T2) migrated all 17 commands to
 *   call output.emitOk/emitErr directly, leaving the legacy exports
 *   with zero in-tree consumers. Task-005 (T5) removes the four legacy
 *   exports entirely, leaving envelope.ts as solely the events.jsonl
 *   recorder (plus the actor-validation helper used by event.ts).
 *
 * What this fixture asserts (binary, as the contract spec requires):
 *
 *   (1) After `import * as env from '<dist>/lib/envelope'`, the four
 *       legacy export names are `undefined`. Any accidental re-introduction
 *       in a future commit fails this fixture immediately, regardless of
 *       whether the symbol is documented or used elsewhere.
 *
 *   (2) The two retained exports — `recordEvent` and `isValidActor` —
 *       remain `function`-typed. T5.6 (recordEvent preservation) requires
 *       this for the events.jsonl write path that other commands depend
 *       on. A removal of either one would silently break event logging
 *       across the bundle; this positive existence assertion catches it.
 *
 * Why binary (not behavioral):
 *   `emit()` and friends used to call `process.exit`, so any behavioral
 *   test would have had to spawn a child process. Binary export-presence
 *   testing is faster, deterministic, and matches the contract literal
 *   ("envelope-no-legacy-exports.test.js가 ... 4개를 binary 단언").
 */

'use strict';

const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const ENVELOPE_PATH = path.join(REPO_ROOT, 'src', 'cli', 'dist', 'lib', 'envelope');
const env = require(ENVELOPE_PATH);

test('envelope.ts: legacy export `emit` is undefined', () => {
  assert.equal(
    env.emit,
    undefined,
    'envelope.emit must be removed (T5.5); migrate callers to output.emitOk/emitErr',
  );
});

test('envelope.ts: legacy export `err` is undefined', () => {
  assert.equal(
    env.err,
    undefined,
    'envelope.err must be removed (T5.5); migrate callers to lib/errors.makeError + output.emitErr',
  );
});

test('envelope.ts: legacy export `ok` is undefined', () => {
  assert.equal(
    env.ok,
    undefined,
    'envelope.ok must be removed (T5.5); migrate callers to output.emitOk',
  );
});

test('envelope.ts: legacy export `EXIT_CODES` is undefined', () => {
  assert.equal(
    env.EXIT_CODES,
    undefined,
    'envelope.EXIT_CODES must be removed (T5.5); use lib/errors.EXIT_CATEGORY_CODE',
  );
});

// ── T5.6: positive existence — events recorder + actor validator stay ─

test('envelope.ts: recordEvent remains exported as a function (T5.6)', () => {
  assert.equal(
    typeof env.recordEvent,
    'function',
    'recordEvent must remain exported — events.jsonl recorder consumed by all mutation commands',
  );
});

test('envelope.ts: isValidActor remains exported as a function (T5.6)', () => {
  assert.equal(
    typeof env.isValidActor,
    'function',
    'isValidActor must remain exported — used by event.ts to gate event log appends',
  );
});

test('envelope.ts: eventsFilePath remains exported as a function (T5.6)', () => {
  // Used by g7-events.test.js + tests-internal helpers that locate the
  // events.jsonl path via the same builder envelope.ts uses.
  assert.equal(
    typeof env.eventsFilePath,
    'function',
    'eventsFilePath must remain exported — events path resolver',
  );
});
