/**
 * G7 Events / Hooks integration test.
 *
 * Covers the automation-only event log contract (CLI.md §14.7, DESIGN.md
 * events section):
 *
 *   1. `geas event log` explicitly appends an entry.
 *   2. Protocol-waypoint mutations (mission create, task draft/approve,
 *      mission phase advance, evidence append, debt register, …)
 *      auto-append events.
 *   3. `.geas/events.jsonl` is JSONL (one JSON object per line).
 *   4. `entry_id` is CLI-assigned and monotonic (1, 2, 3, …).
 *   5. `created_at` is CLI-assigned; caller-supplied timestamps are
 *      ignored/overwritten.
 *   6. `actor` validation accepts slot ids + `user` + `cli:auto` and
 *      rejects everything else.
 *   7. Read-only commands (`geas context`, `geas mission state`,
 *      `geas debt list`) do NOT append events — scope discipline.
 *   8. Hook failure isolation: `geas event log` never fails the caller
 *      when underlying append hits a best-effort edge (caller's
 *      command stays ok).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeTempRoot, runCli } = require('./helpers/setup');

const MID = 'mission-20260420-g7evntsA';
const MID_B = 'mission-20260420-g7evntsB';

function readEvents(dir) {
  const p = path.join(dir, '.geas', 'events.jsonl');
  if (!fs.existsSync(p)) return [];
  return fs
    .readFileSync(p, 'utf-8')
    .split('\n')
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l));
}

function baseSpec(overrides = {}) {
  return {
    name: 'G7 event test',
    description: 'exercise events.jsonl automation-only scope',
    mode: 'standard',
    definition_of_done: 'events.jsonl entries match protocol waypoints',
    scope: {
      in: ['events.jsonl entries', 'geas event log'],
      out: ['dashboard surface'],
    },
    acceptance_criteria: [
      'events are JSONL (one line per event)',
      'entry_id is monotonic',
      'actor validation accepts slot ids + user + cli:auto',
    ],
    constraints: ['events.jsonl is automation-only'],
    affected_surfaces: ['src/cli/src/commands/event.ts'],
    risks: ['event log becomes a full audit log'],
    ...overrides,
  };
}

function baseContract(overrides = {}) {
  return {
    title: 'G7 task',
    goal: 'exercise event log on task draft',
    risk_level: 'normal',
    acceptance_criteria: ['events appear in events.jsonl'],
    verification_plan: 'manual via integration test',
    surfaces: ['src/cli/src/commands/event.ts'],
    routing: {
      primary_worker_type: 'software-engineer',
      required_reviewers: ['challenger'],
    },
    base_snapshot: 'synthetic-base',
    dependencies: [],
    supersedes: null,
    ...overrides,
  };
}

function setupMission(dir, missionId = MID) {
  let r = runCli(['setup'], { cwd: dir });
  assert.equal(r.status, 0, `setup failed: ${r.stderr}`);
  r = runCli(['mission', 'create'], {
    cwd: dir,
    input: JSON.stringify(baseSpec()),
    env: { GEAS_MOCK_MISSION_ID: missionId },
  });
  assert.equal(r.status, 0, `mission create failed: ${r.stderr}`);
  r = runCli(['mission', 'approve', '--mission', missionId], { cwd: dir });
  assert.equal(r.status, 0, `mission approve failed: ${r.stderr}`);
  return missionId;
}

// ── 1. Explicit `geas event log` ────────────────────────────────────────

test('geas event log appends an explicit entry with caller-supplied kind/actor', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir);
    // AC3 (task-006): --json keeps envelope on stdout for assertion.
    const r = runCli(['--json', 'event', 'log'], {
      cwd: dir,
      input: JSON.stringify({
        kind: 'manual_note',
        actor: 'orchestrator',
        mission_id: MID,
        payload: { note: 'sanity check' },
      }),
    });
    assert.equal(r.status, 0, `event log failed: ${r.stderr}`);
    assert.equal(r.json.ok, true, r.stdout);
    assert.equal(r.json.data.kind, 'manual_note');
    assert.equal(r.json.data.actor, 'orchestrator');

    const events = readEvents(dir);
    const manual = events.filter((e) => e.kind === 'manual_note');
    assert.equal(manual.length, 1, 'expected exactly one manual_note');
    assert.equal(manual[0].actor, 'orchestrator');
    assert.equal(manual[0].mission_id, MID);
    assert.deepEqual(manual[0].payload, { note: 'sanity check' });
  } finally {
    cleanup();
  }
});

test('geas event log accepts the AC1 --payload-from-file flag (cross-check vs stdin)', () => {
  // T2.a (mission-20260427-xIPG1sDY task-002 / AC1): event log's
  // payload IS the event body (a free-form JSON object), so per AC1 the
  // explicit free-body inline-flag fallback is --payload-from-file.
  // The historical --file remains as functional alias; stdin remains
  // as implicit fallback.
  const fs = require('fs');
  const path = require('path');
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir);
    const tmpPath = path.join(dir, 'event-payload.json');
    fs.writeFileSync(
      tmpPath,
      JSON.stringify({
        kind: 'manual_note_via_payload_file',
        actor: 'orchestrator',
        mission_id: MID,
        payload: { source: 'payload-from-file' },
      }),
      'utf-8',
    );
    // AC3 (task-006): --json keeps envelope on stdout for assertion.
    const r = runCli(['--json', 'event', 'log', '--payload-from-file', tmpPath], { cwd: dir });
    assert.equal(r.status, 0, `event log via --payload-from-file failed: ${r.stderr}`);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.data.kind, 'manual_note_via_payload_file');
    const events = readEvents(dir);
    const probe = events.find((e) => e.kind === 'manual_note_via_payload_file');
    assert.ok(probe, 'event must land in events.jsonl');
    assert.equal(probe.payload.source, 'payload-from-file');
  } finally {
    cleanup();
  }
});

// ── 2. Automation-scope auto-append ─────────────────────────────────────

test('mission create triggers mission_created event with cli:auto actor', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir);
    const events = readEvents(dir);
    const created = events.find((e) => e.kind === 'mission_created');
    assert.ok(created, `expected mission_created in ${JSON.stringify(events.map((e) => e.kind))}`);
    assert.equal(created.actor, 'cli:auto');
    assert.ok(created.payload && created.payload.mission_id === MID);
  } finally {
    cleanup();
  }
});

test('mission approve appends mission_approved with user actor', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir);
    const events = readEvents(dir);
    const approved = events.find((e) => e.kind === 'mission_approved');
    assert.ok(approved, 'mission_approved expected');
    assert.equal(approved.actor, 'user');
  } finally {
    cleanup();
  }
});

// ── 3. JSONL shape ──────────────────────────────────────────────────────

test('events.jsonl is valid JSONL — one JSON object per line, each newline-terminated', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir);
    const raw = fs.readFileSync(path.join(dir, '.geas', 'events.jsonl'), 'utf-8');
    assert.ok(raw.endsWith('\n'), 'events.jsonl must end with newline');
    const lines = raw.split('\n').filter((l) => l.length > 0);
    assert.ok(lines.length >= 2, `expected >=2 events, got ${lines.length}`);
    for (const line of lines) {
      const obj = JSON.parse(line);
      assert.equal(typeof obj.entry_id, 'number');
      assert.equal(typeof obj.kind, 'string');
      assert.equal(typeof obj.actor, 'string');
      assert.equal(typeof obj.created_at, 'string');
    }
  } finally {
    cleanup();
  }
});

test('geas event log default-mode emits scalar text via registered formatter (post-AC3)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir);
    const r = runCli(['event', 'log'], {
      cwd: dir,
      input: JSON.stringify({
        kind: 'scalar_probe',
        actor: 'orchestrator',
      }),
    });
    assert.equal(r.status, 0, `event log failed: ${r.stderr}`);
    assert.equal(r.json, null, `default-mode stdout should be scalar; got: ${r.stdout}`);
    assert.match(r.stdout, /^event logged: kind=scalar_probe actor=orchestrator/m);
  } finally {
    cleanup();
  }
});

// ── 4. entry_id monotonic ───────────────────────────────────────────────

test('entry_id is CLI-assigned and strictly increasing across mutations', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir);
    // Add a few more explicit events to exercise monotonicity.
    for (let i = 0; i < 3; i += 1) {
      const r = runCli(['event', 'log'], {
        cwd: dir,
        input: JSON.stringify({
          kind: 'manual_tick',
          actor: 'orchestrator',
          payload: { n: i },
        }),
      });
      assert.equal(r.status, 0, `event log ${i} failed: ${r.stderr}`);
    }
    const events = readEvents(dir);
    const ids = events.map((e) => e.entry_id);
    assert.deepEqual(
      ids,
      ids.slice().sort((a, b) => a - b),
      `entry_ids not sorted: ${JSON.stringify(ids)}`,
    );
    // First entry must be 1; ids must be unique; must be contiguous
    // 1..N (the CLI is the sole writer).
    assert.equal(ids[0], 1, `first entry_id must be 1, got ${ids[0]}`);
    assert.equal(new Set(ids).size, ids.length, 'entry_ids must be unique');
    const max = ids[ids.length - 1];
    assert.equal(max, ids.length, 'entry_ids must be contiguous');
  } finally {
    cleanup();
  }
});

// ── 5. Caller-supplied entry_id / created_at is ignored ─────────────────

test('caller-supplied entry_id and created_at are stripped and replaced by the CLI', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir);
    const bogusTs = '1999-12-31T23:59:59Z';
    const bogusId = 999;
    const r = runCli(['event', 'log'], {
      cwd: dir,
      input: JSON.stringify({
        kind: 'client_timestamp_test',
        actor: 'orchestrator',
        entry_id: bogusId,
        created_at: bogusTs,
      }),
    });
    assert.equal(r.status, 0, `event log failed: ${r.stderr}`);
    const events = readEvents(dir);
    const probe = events.find((e) => e.kind === 'client_timestamp_test');
    assert.ok(probe);
    assert.notEqual(probe.entry_id, bogusId, 'CLI must assign entry_id');
    assert.notEqual(probe.created_at, bogusTs, 'CLI must assign created_at');
    // Server timestamps are ISO 8601 UTC with Z suffix. Caller's
    // timestamp sat in 1999; CLI's must start with 20 or later.
    assert.match(probe.created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    assert.ok(probe.created_at > bogusTs, 'CLI timestamp must be newer');
  } finally {
    cleanup();
  }
});

// ── 6. Actor namespace validation ───────────────────────────────────────

test('geas event log accepts slot ids + user + cli:auto and rejects others', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir);
    const accepted = [
      'orchestrator',
      'decision-maker',
      'design-authority',
      'challenger',
      'implementer',
      'verifier',
      'risk-assessor',
      'operator',
      'communicator',
      'user',
      'cli:auto',
    ];
    for (const actor of accepted) {
      const r = runCli(['event', 'log'], {
        cwd: dir,
        input: JSON.stringify({ kind: 'actor_probe', actor }),
      });
      assert.equal(r.status, 0, `actor ${actor} should be accepted but got ${r.stderr}`);
    }
    const bad = ['', 'Orchestrator', 'SYSTEM', 'weird_actor!', 'cli:unknown:ns'];
    for (const actor of bad) {
      // AC3 flip (task-006): use --json so the JSON envelope stays on
      // stdout for programmatic inspection; default mode now writes
      // scalar `error: ...` to stderr for migrated commands.
      const r = runCli(['--json', 'event', 'log'], {
        cwd: dir,
        input: JSON.stringify({ kind: 'actor_probe_bad', actor }),
      });
      // T2.a (mission-20260427-xIPG1sDY task-002 / AC2): invalid_argument
      // rotates from legacy exit=1 to category exit=2 (validation) for
      // every error site in event.ts. Single-system lock-in: the
      // command's success and error paths both go through emit*.
      assert.equal(
        r.status,
        2,
        `actor ${JSON.stringify(actor)} must exit 2 (validation) after T2.a; got ${r.status}`,
      );
      assert.equal(r.json.ok, false);
      assert.equal(r.json.error.code, 'invalid_argument');
      assert.equal(typeof r.json.error.hint, 'string');
      assert.ok(!('hints' in r.json.error), 'legacy `hints` plural is gone after T2.a');
    }
  } finally {
    cleanup();
  }
});

// ── 7. Read-only commands do NOT append events ──────────────────────────

test('read-only commands (context, mission state-get, debt list) do not append events', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir);
    const before = readEvents(dir);
    // A burst of reads.
    let r = runCli(['context'], { cwd: dir });
    assert.equal(r.status, 0, `context failed: ${r.stderr}`);
    r = runCli(['state', 'mission-get', '--mission', MID], { cwd: dir });
    assert.equal(r.status, 0, `state mission-get failed: ${r.stderr}`);
    r = runCli(['debt', 'list'], { cwd: dir });
    assert.equal(r.status, 0, `debt list failed: ${r.stderr}`);
    r = runCli(['schema', 'list'], { cwd: dir });
    assert.equal(r.status, 0, `schema list failed: ${r.stderr}`);
    const after = readEvents(dir);
    assert.equal(
      after.length,
      before.length,
      `read-only calls appended ${after.length - before.length} events`,
    );
  } finally {
    cleanup();
  }
});

// ── 8. Scope discipline: state set / deps append do NOT emit events ────

test('state set and task deps append do not emit events (scope discipline)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID_B);
    // Draft a task so we can exercise deps append.
    let r = runCli(['task', 'draft', '--mission', MID_B], {
      cwd: dir,
      input: JSON.stringify(baseContract()),
      env: { GEAS_MOCK_TASK_ID: 'task-001' },
    });
    assert.equal(r.status, 0, `task draft failed: ${r.stderr}`);
    r = runCli(['task', 'draft', '--mission', MID_B], {
      cwd: dir,
      input: JSON.stringify(baseContract({ title: 'G7 dep task' })),
      env: { GEAS_MOCK_TASK_ID: 'task-002' },
    });
    assert.equal(r.status, 0, `task draft 2 failed: ${r.stderr}`);

    const before = readEvents(dir);
    // task deps add is a single-field mutation and should NOT emit.
    r = runCli(
      [
        'task',
        'deps',
        'add',
        '--mission',
        MID_B,
        '--task',
        'task-002',
        '--deps',
        'task-001',
      ],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `task deps add failed: ${r.stderr}\n${r.stdout}`);

    const afterDeps = readEvents(dir);
    assert.equal(
      afterDeps.length,
      before.length,
      `task deps add emitted ${afterDeps.length - before.length} events; expected 0`,
    );

    // state mission-set is a low-level primitive; no event expected.
    const stateCurrent = JSON.parse(
      fs.readFileSync(
        path.join(dir, '.geas', 'missions', MID_B, 'mission-state.json'),
        'utf-8',
      ),
    );
    delete stateCurrent.created_at;
    delete stateCurrent.updated_at;
    r = runCli(['state', 'mission-set', '--mission', MID_B], {
      cwd: dir,
      input: JSON.stringify(stateCurrent),
    });
    assert.equal(r.status, 0, `state mission-set failed: ${r.stderr}`);
    const afterState = readEvents(dir);
    assert.equal(
      afterState.length,
      afterDeps.length,
      'state mission-set must not append events',
    );
  } finally {
    cleanup();
  }
});

// ── 9. Best-effort: event append failure does not fail the command ─────
//
// We simulate failure by pre-creating `.geas/events.jsonl` as a DIRECTORY.
// fs.appendFileSync will throw EISDIR; recordEvent swallows it; the
// primary command still returns ok.

test('event log stays ok even if events.jsonl is unwritable (best-effort)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir);
    // Force a subsequent event append to fail by turning the log into
    // a directory. The primary command must still succeed.
    const logPath = path.join(dir, '.geas', 'events.jsonl');
    // Remove existing file and replace with a directory.
    fs.rmSync(logPath, { force: true });
    fs.mkdirSync(logPath, { recursive: true });
    // AC3 (task-006): --json keeps envelope on stdout for assertion.
    const r = runCli(['--json', 'event', 'log'], {
      cwd: dir,
      input: JSON.stringify({
        kind: 'best_effort_probe',
        actor: 'cli:auto',
      }),
    });
    assert.equal(r.status, 0, `event log should succeed even if append fails: ${r.stderr}`);
    assert.equal(r.json.ok, true);
  } finally {
    cleanup();
  }
});

// ── 10. Mutation isolation: primary write succeeds even if event fails ─
//
// Recreate the directory-as-log scenario and run a mutation that would
// normally auto-append. The mutation's artifact must still land atomic
// on disk; only the event is lost.

test('primary mutation succeeds atomically even when event append cannot write', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir);
    const logPath = path.join(dir, '.geas', 'events.jsonl');
    fs.rmSync(logPath, { force: true });
    fs.mkdirSync(logPath, { recursive: true });

    // Mission phase advance is a guarded mutation with an auto-event.
    // The phase-advance guard requires at least one approved task in
    // `specifying`, so we draft + approve one. Each of those writes
    // would also normally emit — but the directory-trap swallows them.
    let r = runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(baseContract()),
      env: { GEAS_MOCK_TASK_ID: 'task-001' },
    });
    assert.equal(r.status, 0, `task draft failed: ${r.stderr}`);
    const contractPath = path.join(
      dir,
      '.geas',
      'missions',
      MID,
      'tasks',
      'task-001',
      'contract.json',
    );
    assert.ok(fs.existsSync(contractPath), 'contract.json must land even when event append fails');
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf-8'));
    assert.equal(contract.task_id, 'task-001');
  } finally {
    cleanup();
  }
});
