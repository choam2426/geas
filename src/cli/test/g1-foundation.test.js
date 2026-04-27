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

test('geas setup creates the canonical .geas/ tree (--json envelope)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    // AC3 (task-006): --json keeps the envelope on stdout for assertion.
    const res = runCli(['--json', 'setup'], { cwd: dir });
    assert.equal(res.status, 0, `setup failed: ${res.stderr}`);
    assert.ok(res.json, 'setup with --json should emit a JSON envelope');
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
      '.geas/memory/shared.md',
    ]) {
      assert.ok(
        fs.existsSync(path.join(dir, f)),
        `expected file ${f} to exist after setup`,
      );
    }
    // No top-level candidates.json — consolidation candidates are
    // mission-scoped (`missions/{id}/consolidation/candidates.json`).
    assert.ok(
      !fs.existsSync(path.join(dir, '.geas/candidates.json')),
      '.geas/candidates.json (top-level) should not be created by setup',
    );

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

test('geas setup is idempotent on re-run (--json envelope)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    const first = runCli(['setup'], { cwd: dir });
    assert.equal(first.status, 0);
    const debtsBefore = readArtifact(dir, '.geas/debts.json');

    // AC3 (task-006): --json to inspect the existed[] envelope field.
    const second = runCli(['--json', 'setup'], { cwd: dir });
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

test('geas setup default-mode emits scalar text via registered formatter (post-AC3)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    const res = runCli(['setup'], { cwd: dir });
    assert.equal(res.status, 0, `setup failed: ${res.stderr}`);
    assert.equal(res.json, null, `default-mode stdout should be scalar; got: ${res.stdout}`);
    assert.match(res.stdout, /^project_root: /m);
    assert.match(res.stdout, /^geas_dir: /m);
    assert.match(res.stdout, /^created: /m);
    assert.match(res.stdout, /^existed: /m);
  } finally {
    cleanup();
  }
});

test('geas context reports empty missions after setup (--json envelope)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    const s = runCli(['setup'], { cwd: dir });
    assert.equal(s.status, 0);

    // AC3 (task-006): --json keeps the envelope on stdout; default
    // mode now produces scalar text via the registered formatter.
    const ctx = runCli(['--json', 'context'], { cwd: dir });
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

test('geas context default-mode emits scalar text via registered formatter (post-AC3)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    runCli(['setup'], { cwd: dir });
    const ctx = runCli(['context'], { cwd: dir });
    assert.equal(ctx.status, 0, `context failed: ${ctx.stderr}`);
    // Scalar formatter output: project_root + geas_dir + missions header
    // lines on stdout; no JSON envelope.
    assert.equal(ctx.json, null, `default-mode stdout should be scalar, not JSON; got: ${ctx.stdout}`);
    assert.match(ctx.stdout, /^project_root: /m);
    assert.match(ctx.stdout, /^geas_dir: /m);
    assert.match(ctx.stdout, /^missions: \(none\)$/m);
  } finally {
    cleanup();
  }
});

test('geas context fails clearly when .geas/ is missing — exit 4 (missing_artifact) with hint', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    // T2.a (mission-20260427-xIPG1sDY task-002 / AC2): missing_artifact
    // rotates from legacy exit=1 to category exit=4
    // (EXIT_CATEGORY_CODE.missing_artifact). The error envelope now
    // carries `hint` (singular) per CliErrorV2 instead of legacy `hints`
    // (plural). Single-system lock-in: this command's success and error
    // paths both flow through output.emit* — no envelope.emit calls
    // remain. AC3 flip (task-006): default-mode errors go to stderr
    // scalar; we use --json here to inspect the JSON envelope.
    const ctx = runCli(['--json', 'context'], { cwd: dir });
    assert.equal(
      ctx.status,
      4,
      `missing_artifact must exit 4 (category) after T2.a migration; got ${ctx.status}: ${ctx.stdout}`,
    );
    assert.ok(ctx.json, 'context with --json should emit a JSON envelope');
    assert.equal(ctx.json.ok, false);
    assert.equal(ctx.json.error.code, 'missing_artifact');
    assert.equal(typeof ctx.json.error.hint, 'string', 'AC2 mandates next-step hint on every error');
    assert.match(ctx.json.error.hint, /geas setup/);
    assert.ok(
      !('hints' in ctx.json.error),
      'legacy `hints` (plural) field must not appear in migrated command output',
    );
  } finally {
    cleanup();
  }
});

test('geas context default mode (no --json) writes scalar error to stderr post-AC3', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    // AC3 (task-006 / mission-20260427-xIPG1sDY): default-mode errors
    // for migrated commands write `error: ...` + `hint: ...` to stderr,
    // not the JSON envelope to stdout. Exit code stays category-derived.
    const ctx = runCli(['context'], { cwd: dir });
    assert.equal(ctx.status, 4, 'missing_artifact still exits 4 in default mode');
    assert.equal(ctx.stdout, '', 'default-mode error must not write stdout');
    assert.match(ctx.stderr, /^error: /m, 'stderr carries the error line');
    assert.match(ctx.stderr, /^hint: .*geas setup/m, 'stderr carries the hint line');
    assert.equal(ctx.json, null, 'stdout is empty so JSON parse is null');
  } finally {
    cleanup();
  }
});

test('geas schema list returns every embedded schema name (--json envelope)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    // AC3 (task-006): --json keeps envelope on stdout; default mode now
    // emits a one-line scalar summary via the registered formatter.
    const res = runCli(['--json', 'schema', 'list'], { cwd: dir });
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

test('geas schema show dumps the requested schema as JSON (--json envelope)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    // AC3 (task-006): --json to access the full schema body; default
    // mode emits a one-line summary.
    const res = runCli(['--json', 'schema', 'show', 'debts'], { cwd: dir });
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

test('geas schema list default-mode emits scalar text via registered formatter (post-AC3)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    const res = runCli(['schema', 'list'], { cwd: dir });
    assert.equal(res.status, 0, `schema list failed: ${res.stderr}`);
    assert.equal(res.json, null, `default-mode stdout should be scalar; got: ${res.stdout}`);
    assert.match(res.stdout, /^schemas \(\d+\): /m);
    // Sanity: a few expected schema names appear in the comma list.
    for (const name of ['debts', 'evidence', 'task-contract']) {
      assert.ok(res.stdout.includes(name), `expected '${name}' in scalar output: ${res.stdout}`);
    }
  } finally {
    cleanup();
  }
});

test('geas schema show rejects unknown schemas — exit 2 (validation) with hint', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    // AC3 flip (task-006): use --json to inspect the JSON envelope on
    // stdout for migrated T2.a commands; default mode now goes to stderr
    // scalar.
    const res = runCli(['--json', 'schema', 'show', 'not-a-real-schema'], { cwd: dir });
    // T2.a (mission-20260427-xIPG1sDY task-002 / AC2): invalid_argument
    // rotates from legacy exit=1 to category exit=2 (validation).
    assert.equal(res.status, 2, `invalid_argument must exit 2 after T2.a: got ${res.status}`);
    assert.ok(res.json);
    assert.equal(res.json.ok, false);
    assert.equal(res.json.error.code, 'invalid_argument');
    assert.equal(typeof res.json.error.hint, 'string');
    assert.match(res.json.error.hint, /pick one of/);
    assert.ok(!('hints' in res.json.error), 'legacy `hints` plural is gone after T2.a');
  } finally {
    cleanup();
  }
});

test('geas schema dump returns a map of every schema (--json envelope)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    // AC3 (task-006): --json to access the full schema map; default
    // mode emits a one-line summary.
    const res = runCli(['--json', 'schema', 'dump'], { cwd: dir });
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

test('geas state mission-get reports missing artifact cleanly — exit 4 (missing_artifact) with hint', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    runCli(['setup'], { cwd: dir });
    // AC3 flip (task-006): --json to inspect the envelope; default mode
    // now writes scalar error to stderr.
    const res = runCli(
      ['--json', 'state', 'mission-get', '--mission', 'mission-20260420-abcdefgh'],
      { cwd: dir },
    );
    // T2.a (mission-20260427-xIPG1sDY task-002 / AC2): missing_artifact
    // rotates from legacy exit=1 to category exit=4
    // (EXIT_CATEGORY_CODE.missing_artifact). Single-system lock-in:
    // every error site in state.ts goes through emitErr + makeError.
    assert.equal(res.status, 4, `missing_artifact must exit 4 after T2.a: got ${res.status}`);
    assert.ok(res.json);
    assert.equal(res.json.ok, false);
    assert.equal(res.json.error.code, 'missing_artifact');
    assert.equal(typeof res.json.error.hint, 'string');
    assert.match(res.json.error.hint, /mission create/);
    assert.ok(!('hints' in res.json.error), 'legacy `hints` must not appear in migrated commands');
  } finally {
    cleanup();
  }
});

test('geas state mission-get rejects an invalid mission id — exit 2 (validation) with hint', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    runCli(['setup'], { cwd: dir });
    // AC3 flip (task-006): --json keeps the envelope on stdout; default
    // mode goes to stderr.
    const res = runCli(
      ['--json', 'state', 'mission-get', '--mission', 'not-a-mission-id'],
      { cwd: dir },
    );
    // T2.a / AC2: invalid_argument rotates from legacy exit=1 to
    // category exit=2 (validation).
    assert.equal(res.status, 2, `invalid_argument must exit 2 after T2.a: got ${res.status}`);
    assert.ok(res.json);
    assert.equal(res.json.ok, false);
    assert.equal(res.json.error.code, 'invalid_argument');
    assert.equal(typeof res.json.error.hint, 'string');
    assert.ok(!('hints' in res.json.error));
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
    // AC3 (task-006): --json keeps the envelope on stdout for assertion.
    const res = runCli(['--json', 'state', 'mission-set', '--mission', mid], {
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

test('geas state mission-set accepts the AC1 --payload-from-file flag (cross-check vs --file)', () => {
  // T2.a / AC1: free-body fields use --<field>-from-file. state-set's
  // payload IS the artifact body, so --payload-from-file is the
  // explicit alias; --file remains as functional alias for back-compat.
  const { dir, cleanup } = makeTempRoot();
  const fs = require('fs');
  const path = require('path');
  try {
    runCli(['setup'], { cwd: dir });
    const mid = 'mission-20260420-payldfil';
    const body = {
      mission_id: mid,
      phase: 'specifying',
      active_tasks: [],
    };
    const tmpPath = path.join(dir, 'payload.json');
    fs.writeFileSync(tmpPath, JSON.stringify(body), 'utf-8');
    // AC3 (task-006): --json keeps envelope on stdout for assertion.
    const res = runCli(
      ['--json', 'state', 'mission-set', '--mission', mid, '--payload-from-file', tmpPath],
      { cwd: dir },
    );
    assert.equal(res.status, 0, `--payload-from-file mission-set failed: ${res.stderr}`);
    assert.equal(res.json.ok, true);
    const written = readArtifact(dir, `.geas/missions/${mid}/mission-state.json`);
    assert.equal(written.mission_id, mid);
    assert.equal(written.phase, 'specifying');
  } finally {
    cleanup();
  }
});

test('geas state mission-get default-mode emits scalar text via registered formatter (post-AC3)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    runCli(['setup'], { cwd: dir });
    const mid = 'mission-20260420-abcdefgh';
    runCli(['state', 'mission-set', '--mission', mid], {
      cwd: dir,
      input: JSON.stringify({ mission_id: mid, phase: 'specifying', active_tasks: [] }),
    });
    const res = runCli(['state', 'mission-get', '--mission', mid], { cwd: dir });
    assert.equal(res.status, 0, `mission-get failed: ${res.stderr}`);
    assert.equal(res.json, null, `default-mode stdout should be scalar; got: ${res.stdout}`);
    assert.match(res.stdout, /^path: /m);
    assert.match(res.stdout, /^phase: specifying$/m);
    assert.match(res.stdout, new RegExp(`^mission_id: ${mid}$`, 'm'));
  } finally {
    cleanup();
  }
});

test('geas state mission-set rejects schema-invalid payloads — exit 2 (validation)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    runCli(['setup'], { cwd: dir });
    const mid = 'mission-20260420-abcdefgh';
    const badPayload = JSON.stringify({ phase: 'not-a-valid-phase' });
    // AC3 flip (task-006): --json to inspect the envelope on stdout.
    const res = runCli(['--json', 'state', 'mission-set', '--mission', mid], {
      cwd: dir,
      input: badPayload,
    });
    // T2.a / AC2: schema_validation_failed maps to category 'validation';
    // exit code value 2 unchanged from legacy but the error envelope now
    // carries `hint` (singular) + the legacy `hints` (plural) is gone.
    assert.equal(res.status, 2, `schema_validation_failed must exit 2: got ${res.status}`);
    assert.ok(res.json);
    assert.equal(res.json.ok, false);
    assert.equal(res.json.error.code, 'schema_validation_failed');
    assert.equal(typeof res.json.error.hint, 'string');
    assert.ok(!('hints' in res.json.error));
  } finally {
    cleanup();
  }
});

// ── schema template ──────────────────────────────────────────────────

test('schema template mission-spec --op create returns required fields without envelope', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    // AC3 (task-006): --json to access the full template body; default
    // mode emits a one-line summary via the registered formatter.
    const res = runCli(
      ['--json', 'schema', 'template', 'mission-spec', '--op', 'create'],
      { cwd: dir },
    );
    assert.equal(res.status, 0, `schema template failed: ${res.stderr}`);
    assert.equal(res.json.ok, true);
    const fill = res.json.data.you_must_fill;
    // Required agent-facing fields
    for (const k of [
      'mode',
      'name',
      'description',
      'definition_of_done',
      'scope',
      'acceptance_criteria',
      'constraints',
      'affected_surfaces',
      'risks',
    ]) {
      assert.ok(k in fill, `expected '${k}' in you_must_fill`);
    }
    // CLI-injected fields must NOT appear in you_must_fill
    for (const k of ['id', 'user_approved', 'created_at', 'updated_at']) {
      assert.ok(
        !(k in fill),
        `'${k}' is CLI-injected and should not be in you_must_fill`,
      );
    }
    const inject = res.json.data.cli_will_inject;
    assert.ok(Array.isArray(inject));
    assert.deepEqual(
      [...inject].sort(),
      ['created_at', 'id', 'updated_at', 'user_approved'],
    );
    // mode is an enum — placeholder should show enum options
    assert.match(String(fill.mode), /enum:/);
  } finally {
    cleanup();
  }
});

test('schema template evidence --op append --kind review returns review-specific fields', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    // AC3 (task-006): --json to access the full template body.
    const res = runCli(
      ['--json', 'schema', 'template', 'evidence', '--op', 'append', '--kind', 'review'],
      { cwd: dir },
    );
    assert.equal(res.status, 0, `review template failed: ${res.stderr}`);
    const fill = res.json.data.you_must_fill;
    // entry_id and created_at are envelope-injected
    assert.ok(!('entry_id' in fill));
    assert.ok(!('created_at' in fill));
    // evidence_kind is fixed to the --kind value
    assert.equal(fill.evidence_kind, 'review');
    // review branch requires these fields
    for (const k of [
      'verdict',
      'concerns',
      'rationale',
      'scope_examined',
      'methods_used',
      'scope_excluded',
    ]) {
      assert.ok(k in fill, `expected '${k}' in review template`);
    }
    // review verdict enum is narrowed to approved/changes_requested/blocked
    // and the placeholder must reflect that narrowing.
    assert.match(String(fill.verdict), /enum: approved \| changes_requested \| blocked/);
    assert.deepEqual(
      [...res.json.data.cli_will_inject].sort(),
      ['created_at', 'entry_id'],
    );
  } finally {
    cleanup();
  }
});

test('schema template evidence verification branch differs from review branch', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    // AC3 (task-006): --json to compare full template bodies.
    const rv = runCli(
      ['--json', 'schema', 'template', 'evidence', '--op', 'append', '--kind', 'review'],
      { cwd: dir },
    );
    const vv = runCli(
      ['--json', 'schema', 'template', 'evidence', '--op', 'append', '--kind', 'verification'],
      { cwd: dir },
    );
    const cv = runCli(
      ['--json', 'schema', 'template', 'evidence', '--op', 'append', '--kind', 'closure'],
      { cwd: dir },
    );
    assert.equal(rv.status, 0);
    assert.equal(vv.status, 0);
    assert.equal(cv.status, 0);
    // verification adds criteria_results
    assert.ok('criteria_results' in vv.json.data.you_must_fill);
    assert.ok(!('criteria_results' in rv.json.data.you_must_fill));
    // closure requires the retro fields and narrows verdict differently
    for (const k of [
      'what_went_well',
      'what_broke',
      'what_was_surprising',
      'next_time_guidance',
    ]) {
      assert.ok(k in cv.json.data.you_must_fill);
      assert.ok(!(k in rv.json.data.you_must_fill));
    }
    // closure verdict enum differs from review
    assert.match(
      String(cv.json.data.you_must_fill.verdict),
      /enum: approved \| changes_requested \| escalated \| cancelled/,
    );
  } finally {
    cleanup();
  }
});

test('schema template evidence --op append rejects missing --kind — exit 2 with hint listing valid kinds', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    // AC3 flip (task-006): --json to inspect the JSON envelope on stdout.
    const res = runCli(
      ['--json', 'schema', 'template', 'evidence', '--op', 'append'],
      { cwd: dir },
    );
    // T2.a / AC2: invalid_argument rotates 1 → 2 (validation). The
    // legacy `hints.valid_kinds` structured payload is folded into the
    // singular `hint` string per CliErrorV2 shape; the same data
    // (allowed kinds enumeration) is still reachable for callers, just
    // as a parseable hint message instead of a separate JSON field.
    assert.equal(res.status, 2, `invalid_argument must exit 2 after T2.a: got ${res.status}`);
    assert.equal(res.json.error.code, 'invalid_argument');
    assert.match(res.json.error.message, /requires --kind/);
    assert.equal(typeof res.json.error.hint, 'string');
    // Hint message contains the valid-kinds enumeration so callers can
    // still extract them by parsing the hint.
    for (const k of ['review', 'verification', 'closure']) {
      assert.ok(
        res.json.error.hint.includes(k),
        `hint must mention valid kind '${k}'; got: ${res.json.error.hint}`,
      );
    }
    assert.ok(!('hints' in res.json.error), 'legacy `hints` plural is gone after T2.a');
  } finally {
    cleanup();
  }
});

test('schema template rejects unknown schema / op / kind — exit 2 (validation) for each', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    // AC3 flip (task-006): --json to inspect error envelopes on stdout.
    let res = runCli(
      ['--json', 'schema', 'template', 'not-a-schema', '--op', 'create'],
      { cwd: dir },
    );
    assert.equal(res.status, 2);
    assert.equal(res.json.error.code, 'invalid_argument');
    assert.equal(typeof res.json.error.hint, 'string');

    res = runCli(
      ['--json', 'schema', 'template', 'mission-spec', '--op', 'nonsense'],
      { cwd: dir },
    );
    assert.equal(res.status, 2);
    assert.equal(res.json.error.code, 'invalid_argument');
    assert.match(res.json.error.message, /not registered/);
    assert.equal(typeof res.json.error.hint, 'string');

    res = runCli(
      ['--json', 'schema', 'template', 'evidence', '--op', 'append', '--kind', 'bogus'],
      { cwd: dir },
    );
    assert.equal(res.status, 2);
    assert.equal(res.json.error.code, 'invalid_argument');
    assert.match(res.json.error.message, /unknown kind/);
    assert.equal(typeof res.json.error.hint, 'string');
  } finally {
    cleanup();
  }
});

test('schema template task-contract --op draft enumerates agent-facing fields', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    // AC3 (task-006): --json to access the full template body.
    const res = runCli(
      ['--json', 'schema', 'template', 'task-contract', '--op', 'draft'],
      { cwd: dir },
    );
    assert.equal(res.status, 0, res.stderr);
    const fill = res.json.data.you_must_fill;
    // agent fills these
    for (const k of [
      'title',
      'goal',
      'risk_level',
      'acceptance_criteria',
      'verification_plan',
      'routing',
      'base_snapshot',
    ]) {
      assert.ok(k in fill, `expected '${k}' in task-contract draft template`);
    }
    // envelope
    for (const k of ['mission_id', 'task_id', 'created_at', 'updated_at']) {
      assert.ok(!(k in fill));
      assert.ok(res.json.data.cli_will_inject.includes(k));
    }
    // routing is an object with nested required fields populated.
    assert.equal(typeof fill.routing, 'object');
    assert.ok('primary_worker_type' in fill.routing);
    assert.ok('required_reviewers' in fill.routing);
  } finally {
    cleanup();
  }
});

test('schema template implementation-contract --op set produces correct envelope', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    // AC3 (task-006): --json to access the full template body.
    const res = runCli(
      ['--json', 'schema', 'template', 'implementation-contract', '--op', 'set'],
      { cwd: dir },
    );
    assert.equal(res.status, 0, res.stderr);
    const fill = res.json.data.you_must_fill;
    // agent fills the plan content
    for (const k of [
      'summary',
      'rationale',
      'change_scope',
      'planned_actions',
    ]) {
      assert.ok(k in fill);
    }
    // envelope
    assert.deepEqual(
      [...res.json.data.cli_will_inject].sort(),
      ['created_at', 'mission_id', 'task_id', 'updated_at'],
    );
    assert.equal(res.json.data.notes.schema, 'implementation-contract');
    assert.equal(res.json.data.notes.op, 'set');
  } finally {
    cleanup();
  }
});

test('schema template debts --op register templates the debt entry shape', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    // AC3 (task-006): --json to access the full template body.
    const res = runCli(
      ['--json', 'schema', 'template', 'debts', '--op', 'register'],
      { cwd: dir },
    );
    assert.equal(res.status, 0, res.stderr);
    const fill = res.json.data.you_must_fill;
    // Agent fills these — debt_id/status/resolved_by/resolution_rationale
    // are CLI-owned and must NOT appear.
    for (const k of ['severity', 'kind', 'title', 'description', 'introduced_by']) {
      assert.ok(k in fill, `expected '${k}' in debts register template`);
    }
    for (const k of ['debt_id', 'status', 'resolved_by', 'resolution_rationale']) {
      assert.ok(!(k in fill), `'${k}' should not be in you_must_fill`);
      assert.ok(res.json.data.cli_will_inject.includes(k));
    }
  } finally {
    cleanup();
  }
});
