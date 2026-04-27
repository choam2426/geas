/**
 * G6 Debt / Gap / Memory-Update integration test.
 *
 * Consolidation-phase artifact writers:
 *
 *   geas debt register                                        (stdin: entry)
 *   geas debt update-status --debt <id>                       (stdin: patch)
 *   geas debt list [--status ...] [--mission ...]             (read-only)
 *   geas gap set --mission <id>                               (stdin: body)
 *   geas memory-update set --mission <id>                     (stdin: body)
 *
 * Contract summary (CLI.md §3, §9, §14; protocol 07):
 *   - debts.json is **project-level**, not per-mission. Each entry carries
 *     `introduced_by.mission_id` for origin traceability.
 *   - `debt register` is append + CLI-assigned `debt_id` (monotonic); it
 *     never mutates existing entries.
 *   - `debt update-status` mutates only status/resolved_by/resolution_rationale
 *     on an existing entry; any other field patch is rejected.
 *   - gap.json + memory-update.json are mission-scoped consolidation
 *     artifacts under `missions/{id}/consolidation/`.
 *   - Schema validation rejects partially-formed payloads.
 *   - Consolidating-phase flow: gap_signals captured on closure evidence
 *     can be promoted to debt register calls that trace back to their
 *     source task via introduced_by.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeTempRoot, runCli, readArtifact } = require('./helpers/setup');

const MID = 'mission-20260420-g6debts0';
const MID_B = 'mission-20260420-g6debtsB';

function baseSpec(overrides = {}) {
  return {
    name: 'G6 debt/gap test',
    description: 'project-level debts + mission-level gap + memory-update',
    mode: 'standard',
    definition_of_done:
      'consolidation artifact writers behave per protocol 07',
    scope: {
      in: ['debt/gap/memory-update command surface'],
      out: ['events hooks surface (G7)'],
    },
    acceptance_criteria: [
      'debt register writes entries with CLI-assigned debt_id',
      'debt update-status mutates only status/resolved_by/resolution_rationale',
      'gap set validates against gap schema',
      'memory-update set validates against memory-update schema',
    ],
    constraints: ['no writes to .geas/ outside the CLI'],
    affected_surfaces: ['src/cli/src/commands/debt.ts'],
    risks: ['debts.json schema drift breaks consolidating phase'],
    ...overrides,
  };
}

function baseContract(overrides = {}) {
  return {
    title: 'G6 task',
    goal: 'exercise consolidation writers',
    risk_level: 'normal',
    acceptance_criteria: ['debts + gap + memory-update write atomically'],
    verification_plan: 'manual via the integration test',
    surfaces: ['src/cli/src/commands/debt.ts'],
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

function setupMission(dir, missionId) {
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
}

function draftTask(dir, missionId, taskId) {
  let r = runCli(['task', 'draft', '--mission', missionId], {
    cwd: dir,
    input: JSON.stringify(baseContract()),
    env: { GEAS_MOCK_TASK_ID: taskId },
  });
  assert.equal(r.status, 0, `task draft failed: ${r.stderr}`);
  r = runCli(['task', 'approve', '--mission', missionId, '--task', taskId], {
    cwd: dir,
  });
  assert.equal(r.status, 0, `task approve failed: ${r.stderr}`);
}

function validDebtBody(overrides = {}) {
  return {
    severity: 'normal',
    kind: 'verification_gap',
    title: 'integration coverage gap',
    description:
      'end-to-end coverage for debt register is thin; add more cases in G7',
    introduced_by: { mission_id: MID, task_id: 'task-001' },
    ...overrides,
  };
}

// ── debt register ──────────────────────────────────────────────────────

test('debt register writes an entry to project-level .geas/debts.json', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    draftTask(dir, MID, 'task-001');

    const r = runCli(['--json', 'debt', 'register'], {
      cwd: dir,
      input: JSON.stringify(validDebtBody()),
    });
    assert.equal(r.status, 0, `debt register failed: ${r.stderr}`);
    assert.equal(r.json.ok, true, r.stdout);
    assert.match(r.json.data.ids.debt_id, /^debt-001$/);
    // Path is project-level, NOT per-mission.
    assert.match(r.json.data.path, /\.geas\/debts\.json$/);
    assert.ok(
      !r.json.data.path.includes('/missions/'),
      'debts.json must live at project root, not under any mission',
    );

    const ledger = readArtifact(dir, '.geas/debts.json');
    assert.equal(ledger.entries.length, 1);
    const entry = ledger.entries[0];
    assert.equal(entry.debt_id, 'debt-001');
    assert.equal(entry.status, 'open');
    assert.equal(entry.resolved_by, null);
    assert.equal(entry.resolution_rationale, null);
    assert.equal(entry.introduced_by.mission_id, MID);
    assert.equal(entry.introduced_by.task_id, 'task-001');
  } finally {
    cleanup();
  }
});

test('debt register assigns monotonic debt-NNN ids and never mutates earlier entries', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    draftTask(dir, MID, 'task-001');
    draftTask(dir, MID, 'task-002');

    const r1 = runCli(['--json', 'debt', 'register'], {
      cwd: dir,
      input: JSON.stringify(validDebtBody({ title: 'first' })),
    });
    assert.equal(r1.status, 0, r1.stderr);
    assert.equal(r1.json.data.ids.debt_id, 'debt-001');

    const ledgerBefore = readArtifact(dir, '.geas/debts.json');

    const r2 = runCli(['--json', 'debt', 'register'], {
      cwd: dir,
      input: JSON.stringify(
        validDebtBody({
          title: 'second',
          introduced_by: { mission_id: MID, task_id: 'task-002' },
        }),
      ),
    });
    assert.equal(r2.status, 0, r2.stderr);
    assert.equal(r2.json.data.ids.debt_id, 'debt-002');

    const ledgerAfter = readArtifact(dir, '.geas/debts.json');
    assert.equal(ledgerAfter.entries.length, 2);

    // First entry unchanged byte-for-byte (append-only semantics for prior entries).
    assert.deepEqual(
      ledgerAfter.entries[0],
      ledgerBefore.entries[0],
      'existing entries must never be mutated by debt register',
    );
    assert.equal(ledgerAfter.entries[1].title, 'second');
    assert.equal(ledgerAfter.entries[1].introduced_by.task_id, 'task-002');

    const r3 = runCli(['--json', 'debt', 'register'], {
      cwd: dir,
      input: JSON.stringify(validDebtBody({ title: 'third' })),
    });
    assert.equal(r3.status, 0, r3.stderr);
    assert.equal(r3.json.data.ids.debt_id, 'debt-003');
  } finally {
    cleanup();
  }
});

test('debt register rejects entries missing required fields', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    draftTask(dir, MID, 'task-001');

    // missing introduced_by. AC2 (task-006): invalid_argument 1 → 2.
    let r = runCli(['--json', 'debt', 'register'], {
      cwd: dir,
      input: JSON.stringify({
        severity: 'normal',
        kind: 'risk',
        title: 't',
        description: 'd',
      }),
    });
    assert.equal(r.status, 2);
    assert.equal(r.json.error.code, 'invalid_argument');
    assert.match(r.json.error.message, /introduced_by/);

    // invalid severity
    r = runCli(['--json', 'debt', 'register'], {
      cwd: dir,
      input: JSON.stringify(validDebtBody({ severity: 'urgent' })),
    });
    assert.equal(r.status, 2);
    assert.equal(r.json.error.code, 'invalid_argument');
    assert.match(r.json.error.message, /severity/);

    // invalid kind
    r = runCli(['--json', 'debt', 'register'], {
      cwd: dir,
      input: JSON.stringify(validDebtBody({ kind: 'techdebt' })),
    });
    assert.equal(r.status, 2);
    assert.equal(r.json.error.code, 'invalid_argument');
    assert.match(r.json.error.message, /kind/);

    // missing title (schema-level failure after upfront checks pass)
    r = runCli(['--json', 'debt', 'register'], {
      cwd: dir,
      input: JSON.stringify({
        severity: 'normal',
        kind: 'risk',
        description: 'd',
        introduced_by: { mission_id: MID, task_id: 'task-001' },
      }),
    });
    assert.equal(r.status, 2, `expected schema_validation_failed, got ${r.stderr}`);
    assert.equal(r.json.error.code, 'schema_validation_failed');
  } finally {
    cleanup();
  }
});

test('debt register ignores caller-supplied debt_id and status (CLI owns them)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    draftTask(dir, MID, 'task-001');

    const r = runCli(['--json', 'debt', 'register'], {
      cwd: dir,
      input: JSON.stringify(
        validDebtBody({
          debt_id: 'debt-999',
          status: 'resolved',
          resolved_by: { mission_id: MID, task_id: 'task-001' },
          resolution_rationale: 'pretend resolved',
        }),
      ),
    });
    // Caller-supplied debt_id/status/resolved_by are dropped — CLI
    // forces debt-001/open/null by design.
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.json.data.ids.debt_id, 'debt-001');
    assert.equal(r.json.data.entry.status, 'open');
    assert.equal(r.json.data.entry.resolved_by, null);
  } finally {
    cleanup();
  }
});

// ── debt update-status ─────────────────────────────────────────────────

test('debt update-status flips open -> resolved with resolved_by + rationale', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    draftTask(dir, MID, 'task-001');
    draftTask(dir, MID, 'task-002');

    let r = runCli(['--json', 'debt', 'register'], {
      cwd: dir,
      input: JSON.stringify(validDebtBody()),
    });
    assert.equal(r.status, 0, r.stderr);
    const debtId = r.json.data.ids.debt_id;

    r = runCli(['--json', 'debt', 'update-status', '--debt', debtId], {
      cwd: dir,
      input: JSON.stringify({
        status: 'resolved',
        resolved_by: { mission_id: MID, task_id: 'task-002' },
        resolution_rationale: 'verification coverage added in task-002',
      }),
    });
    assert.equal(r.status, 0, `update-status failed: ${r.stderr}`);
    const updated = r.json.data.entry;
    assert.equal(updated.status, 'resolved');
    assert.equal(updated.resolved_by.task_id, 'task-002');
    assert.match(updated.resolution_rationale, /verification coverage/);

    const ledger = readArtifact(dir, '.geas/debts.json');
    assert.equal(ledger.entries[0].status, 'resolved');
    assert.equal(ledger.entries[0].introduced_by.task_id, 'task-001');
  } finally {
    cleanup();
  }
});

test('debt update-status rejects patches containing disallowed fields', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    draftTask(dir, MID, 'task-001');

    let r = runCli(['--json', 'debt', 'register'], {
      cwd: dir,
      input: JSON.stringify(validDebtBody()),
    });
    assert.equal(r.status, 0, r.stderr);

    r = runCli(['--json', 'debt', 'update-status', '--debt', 'debt-001'], {
      cwd: dir,
      input: JSON.stringify({
        status: 'resolved',
        resolved_by: { mission_id: MID, task_id: 'task-001' },
        resolution_rationale: 'ok',
        severity: 'critical', // <-- disallowed field
      }),
    });
    // AC2 (task-006) + design Decision 2: legacy append_only_violation
    // (exit 5) rotates to category 'guard' (exit 3) post-T2.d.
    assert.equal(r.status, 3, `expected guard category for append_only_violation, got ${r.stderr}`);
    assert.equal(r.json.error.code, 'append_only_violation');
    assert.match(r.json.error.message, /severity/);
  } finally {
    cleanup();
  }
});

test('debt update-status rejects missing debt ids', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);

    const r = runCli(['--json', 'debt', 'update-status', '--debt', 'debt-042'], {
      cwd: dir,
      input: JSON.stringify({
        status: 'resolved',
        resolved_by: { mission_id: MID, task_id: 'task-001' },
        resolution_rationale: 'ok',
      }),
    });
    assert.notEqual(r.status, 0);
    assert.equal(r.json.ok, false);
    assert.equal(r.json.error.code, 'missing_artifact');
  } finally {
    cleanup();
  }
});

test('debt update-status requires resolved_by + rationale for non-open status', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    draftTask(dir, MID, 'task-001');

    let r = runCli(['--json', 'debt', 'register'], {
      cwd: dir,
      input: JSON.stringify(validDebtBody()),
    });
    assert.equal(r.status, 0, r.stderr);

    r = runCli(['--json', 'debt', 'update-status', '--debt', 'debt-001'], {
      cwd: dir,
      input: JSON.stringify({ status: 'dropped' }),
    });
    // AC2 (task-006): invalid_argument rotates 1 → 2 (validation).
    assert.equal(r.status, 2);
    assert.equal(r.json.error.code, 'invalid_argument');
    assert.match(r.json.error.message, /resolved_by/);
  } finally {
    cleanup();
  }
});

// ── debt list ──────────────────────────────────────────────────────────

test('debt list filters by status and mission', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    draftTask(dir, MID, 'task-001');
    draftTask(dir, MID, 'task-002');

    // Two entries for MID, different tasks.
    let r = runCli(['--json', 'debt', 'register'], {
      cwd: dir,
      input: JSON.stringify(
        validDebtBody({
          title: 'open-one',
          introduced_by: { mission_id: MID, task_id: 'task-001' },
        }),
      ),
    });
    assert.equal(r.status, 0, r.stderr);

    r = runCli(['--json', 'debt', 'register'], {
      cwd: dir,
      input: JSON.stringify(
        validDebtBody({
          title: 'open-two',
          introduced_by: { mission_id: MID, task_id: 'task-002' },
        }),
      ),
    });
    assert.equal(r.status, 0, r.stderr);

    r = runCli(['--json', 'debt', 'update-status', '--debt', 'debt-002'], {
      cwd: dir,
      input: JSON.stringify({
        status: 'resolved',
        resolved_by: { mission_id: MID, task_id: 'task-002' },
        resolution_rationale: 'closed out inside task-002',
      }),
    });
    assert.equal(r.status, 0, r.stderr);

    // list everything
    r = runCli(['--json', 'debt', 'list'], { cwd: dir });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.json.data.total, 2);
    assert.deepEqual(r.json.data.counts, { open: 1, resolved: 1, dropped: 0 });

    // list by status
    r = runCli(['--json', 'debt', 'list', '--status', 'open'], { cwd: dir });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.json.data.total, 1);
    assert.equal(r.json.data.entries[0].debt_id, 'debt-001');

    // list by mission
    r = runCli(['--json', 'debt', 'list', '--mission', MID], { cwd: dir });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.json.data.total, 2);

    // list by mission that never owned any debt -> 0
    r = runCli(
      ['--json', 'debt', 'list', '--mission', 'mission-20260101-unknown0'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.json.data.total, 0);
  } finally {
    cleanup();
  }
});

// ── gap set ────────────────────────────────────────────────────────────

test('gap set writes consolidation/gap.json with schema validation', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);

    const body = {
      scope_in_summary: 'consolidation writers landed',
      scope_out_summary: 'event hooks deferred to G7',
      fully_delivered: ['debt register'],
      partially_delivered: ['debt list (no sorting options yet)'],
      not_delivered: ['dashboard integration (intentionally cut: out of scope)'],
      unexpected_additions: ['debt update-status rejection of disallowed fields'],
    };
    const r = runCli(['--json', 'gap', 'set', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(r.status, 0, `gap set failed: ${r.stderr}`);
    assert.match(
      r.json.data.path,
      /\.geas\/missions\/mission-20260420-g6debts0\/consolidation\/gap\.json$/,
    );
    const onDisk = readArtifact(
      dir,
      '.geas/missions/mission-20260420-g6debts0/consolidation/gap.json',
    );
    assert.equal(onDisk.mission_id, MID);
    assert.equal(onDisk.scope_in_summary, body.scope_in_summary);
    assert.ok(onDisk.created_at, 'created_at injected by CLI');
    assert.ok(onDisk.updated_at, 'updated_at injected by CLI');
  } finally {
    cleanup();
  }
});

test('gap set is full-replace (second call overwrites)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);

    let r = runCli(['--json', 'gap', 'set', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify({
        scope_in_summary: 'first',
        scope_out_summary: 'first-out',
        fully_delivered: ['first-item'],
        partially_delivered: [],
        not_delivered: [],
        unexpected_additions: [],
      }),
    });
    assert.equal(r.status, 0, r.stderr);
    const firstCreated = readArtifact(
      dir,
      '.geas/missions/mission-20260420-g6debts0/consolidation/gap.json',
    ).created_at;

    r = runCli(['--json', 'gap', 'set', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify({
        scope_in_summary: 'second',
        scope_out_summary: 'second-out',
        fully_delivered: ['second-item'],
        partially_delivered: [],
        not_delivered: [],
        unexpected_additions: [],
      }),
    });
    assert.equal(r.status, 0, r.stderr);
    const after = readArtifact(
      dir,
      '.geas/missions/mission-20260420-g6debts0/consolidation/gap.json',
    );
    assert.equal(after.scope_in_summary, 'second');
    assert.deepEqual(after.fully_delivered, ['second-item']);
    // created_at preserved, updated_at advanced.
    assert.equal(after.created_at, firstCreated, 'created_at preserved on replace');
    assert.ok(
      after.updated_at >= firstCreated,
      'updated_at must not rewind',
    );
  } finally {
    cleanup();
  }
});

test('gap set rejects payloads missing required fields', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    // missing scope_in_summary
    const r = runCli(['--json', 'gap', 'set', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify({
        scope_out_summary: 'out only',
      }),
    });
    assert.equal(r.status, 2, `expected schema_validation_failed, got ${r.stderr}`);
    assert.equal(r.json.error.code, 'schema_validation_failed');
  } finally {
    cleanup();
  }
});

// ── memory-update set ──────────────────────────────────────────────────

test('memory-update set writes consolidation/memory-update.json', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    const body = {
      shared: {
        added: [
          {
            memory_id: 'debt-origin-trace',
            reason:
              'project-level debts require introduced_by traceability on every entry',
            evidence_refs: ['g6-debt-gap.test.js'],
          },
        ],
        modified: [],
        removed: [],
      },
      agents: [
        {
          agent: 'software-engineer',
          added: [],
          modified: [
            {
              memory_id: 'prefer-atomic-write',
              reason: 'clarified that atomicWriteJson is the default',
              evidence_refs: [],
            },
          ],
          removed: [],
        },
      ],
    };
    const r = runCli(['--json', 'memory-update', 'set', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(r.status, 0, `memory-update set failed: ${r.stderr}`);
    assert.match(
      r.json.data.path,
      /\.geas\/missions\/mission-20260420-g6debts0\/consolidation\/memory-update\.json$/,
    );
    const onDisk = readArtifact(
      dir,
      '.geas/missions/mission-20260420-g6debts0/consolidation/memory-update.json',
    );
    assert.equal(onDisk.mission_id, MID);
    assert.equal(onDisk.shared.added[0].memory_id, 'debt-origin-trace');
    assert.equal(onDisk.agents[0].agent, 'software-engineer');
  } finally {
    cleanup();
  }
});

test('memory-update set defaults shared/agents to empty when omitted', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    // caller supplies nothing beyond an object — the CLI supplies empty
    // `shared` and `agents` blocks so the schema passes.
    const r = runCli(['--json', 'memory-update', 'set', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify({}),
    });
    assert.equal(r.status, 0, `memory-update set failed: ${r.stderr}`);
    const onDisk = readArtifact(
      dir,
      '.geas/missions/mission-20260420-g6debts0/consolidation/memory-update.json',
    );
    assert.deepEqual(onDisk.shared, { added: [], modified: [], removed: [] });
    assert.deepEqual(onDisk.agents, []);
  } finally {
    cleanup();
  }
});

test('memory-update set rejects malformed change entries', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    // change entry missing required fields (reason + evidence_refs)
    const r = runCli(['--json', 'memory-update', 'set', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify({
        shared: {
          added: [{ memory_id: 'x' }],
          modified: [],
          removed: [],
        },
        agents: [],
      }),
    });
    assert.equal(r.status, 2, `expected schema_validation_failed, got ${r.stderr}`);
    assert.equal(r.json.error.code, 'schema_validation_failed');
  } finally {
    cleanup();
  }
});

// ── event logging ──────────────────────────────────────────────────────

test('debt/gap/memory-update mutations append events.jsonl entries with cli:auto', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    draftTask(dir, MID, 'task-001');

    let r = runCli(['--json', 'debt', 'register'], {
      cwd: dir,
      input: JSON.stringify(validDebtBody()),
    });
    assert.equal(r.status, 0, r.stderr);

    r = runCli(['--json', 'debt', 'update-status', '--debt', 'debt-001'], {
      cwd: dir,
      input: JSON.stringify({
        status: 'dropped',
        resolved_by: { mission_id: MID, task_id: 'task-001' },
        resolution_rationale: 'no longer relevant',
      }),
    });
    assert.equal(r.status, 0, r.stderr);

    r = runCli(['--json', 'gap', 'set', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify({
        scope_in_summary: 's',
        scope_out_summary: 'o',
        fully_delivered: [],
        partially_delivered: [],
        not_delivered: [],
        unexpected_additions: [],
      }),
    });
    assert.equal(r.status, 0, r.stderr);

    r = runCli(['--json', 'memory-update', 'set', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify({}),
    });
    assert.equal(r.status, 0, r.stderr);

    const events = fs
      .readFileSync(path.join(dir, '.geas/events.jsonl'), 'utf-8')
      .split('\n')
      .filter((l) => l.length > 0)
      .map((l) => JSON.parse(l));

    const kinds = events.map((e) => e.kind);
    for (const expected of [
      'debt_registered',
      'debt_status_updated',
      'gap_set',
      'memory_update_set',
    ]) {
      assert.ok(
        kinds.includes(expected),
        `expected ${expected} in events, got ${JSON.stringify(kinds)}`,
      );
    }
    for (const ev of events.filter((e) =>
      ['debt_registered', 'debt_status_updated', 'gap_set', 'memory_update_set'].includes(
        e.kind,
      ),
    )) {
      assert.equal(ev.actor, 'cli:auto');
      assert.ok(typeof ev.created_at === 'string' && ev.created_at.length > 0);
    }
  } finally {
    cleanup();
  }
});

// ── consolidating-phase flow integration ───────────────────────────────
//
// Self-check captures raw gap_signals flags. Those are re-recorded with
// structure as evidence.closure.gap_signals[] entries. Consolidation then
// harvests them. The smallest traceable path the CLI guarantees is that
// `debt register` carries mission_id + task_id that match the originating
// evidence entry — so a reader of debts.json can grep mission_id into
// evidence paths and find the source closure entry. This test exercises
// that traceability without needing the full building-phase pipeline.

test('consolidating flow: closure gap_signals -> debt register retains source task traceability', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID_B);
    draftTask(dir, MID_B, 'task-001');
    draftTask(dir, MID_B, 'task-002');

    // Two different tasks feed debt register calls. Orchestrator
    // classifies each closure's gap_signal[] into a debt entry, keeping
    // mission_id/task_id faithful.
    const signals = [
      {
        severity: 'normal',
        kind: 'verification_gap',
        title: 'coverage thin on retry budget',
        description:
          'closure of task-001 flagged that verify-fix retry branches lack direct test coverage',
        introduced_by: { mission_id: MID_B, task_id: 'task-001' },
      },
      {
        severity: 'low',
        kind: 'documentation',
        title: 'CLI help lacks mutation scope note',
        description:
          'closure of task-002 flagged that `debt --help` does not mention the mutation scope',
        introduced_by: { mission_id: MID_B, task_id: 'task-002' },
      },
    ];

    for (const s of signals) {
      const r = runCli(['--json', 'debt', 'register'], {
        cwd: dir,
        input: JSON.stringify(s),
      });
      assert.equal(r.status, 0, `debt register failed for ${s.title}: ${r.stderr}`);
    }

    const ledger = readArtifact(dir, '.geas/debts.json');
    assert.equal(ledger.entries.length, 2);

    // Each debt's origin is still traceable.
    for (let i = 0; i < ledger.entries.length; i++) {
      const entry = ledger.entries[i];
      const source = signals[i];
      assert.equal(entry.introduced_by.mission_id, source.introduced_by.mission_id);
      assert.equal(entry.introduced_by.task_id, source.introduced_by.task_id);
      assert.equal(entry.title, source.title);
    }

    // Ledger is project-level: filtering by mission returns both debts
    // introduced during MID_B, no matter which task.
    const r = runCli(['--json', 'debt', 'list', '--mission', MID_B], { cwd: dir });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.json.data.total, 2);
    const sourceTasks = r.json.data.entries.map(
      (e) => e.introduced_by.task_id,
    );
    assert.deepEqual(sourceTasks.sort(), ['task-001', 'task-002']);
  } finally {
    cleanup();
  }
});
