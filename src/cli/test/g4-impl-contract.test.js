/**
 * G4 Implementation Contract integration test.
 *
 *   geas impl-contract set --mission <id> --task <id>  (stdin: body)
 *
 * Contract summary (CLI.md §3 + §71, protocol 03):
 *   - Pre-implementation agreement: worker's concrete action plan.
 *   - CLI injects mission_id / task_id / created_at / updated_at.
 *   - Set is full-replace; CLI strips client-provided envelope fields.
 *   - Guards: mission user-approved, task contract approved, task state
 *     in ready or implementing (not terminal or later-stage).
 *   - Schema-validated against implementation-contract.schema.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { makeTempRoot, runCli, readArtifact } = require('./helpers/setup');

const MID = 'mission-20260420-g4impcon';

function baseSpec(overrides = {}) {
  return {
    name: 'G4 impl-contract test',
    description: 'pre-implementation agreement artifact surface',
    mode: 'standard',
    definition_of_done: 'impl-contract set writes and guards correctly',
    scope: {
      in: ['impl-contract set command'],
      out: ['other task command surface'],
    },
    acceptance_criteria: [
      'impl-contract set writes a schema-valid contract',
      'impl-contract set guards task state',
    ],
    constraints: ['no writes outside the CLI'],
    affected_surfaces: ['src/cli/src/commands/impl-contract.ts'],
    risks: ['impl-contract schema drift breaks pre-impl agreement'],
    ...overrides,
  };
}

function baseContract(overrides = {}) {
  return {
    title: 'G4 impl-contract task',
    goal: 'exercise impl-contract set',
    risk_level: 'normal',
    acceptance_criteria: ['impl-contract writes atomically'],
    verification_plan: 'manual via integration test',
    surfaces: ['src/cli/src/commands/impl-contract.ts'],
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

function validImplBody(overrides = {}) {
  return {
    summary: 'add X field to Y module',
    rationale: 'Y needs X to support new flow Z',
    change_scope: ['src/y/module.ts', 'src/y/types.ts'],
    planned_actions: [
      'extend type Y to include X',
      'update module.ts to honour X',
      'add test coverage for X',
    ],
    non_goals: ['refactor unrelated helpers'],
    alternatives_considered: ['add X as a separate module — rejected: too invasive'],
    assumptions: ['Y is the only consumer of this type'],
    open_questions: [],
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

function draftTaskReady(dir, missionId, taskId, overrides = {}) {
  let r = runCli(['task', 'draft', '--mission', missionId], {
    cwd: dir,
    input: JSON.stringify(baseContract(overrides)),
    env: { GEAS_MOCK_TASK_ID: taskId },
  });
  assert.equal(r.status, 0, `task draft failed: ${r.stderr}`);
  r = runCli(['task', 'approve', '--mission', missionId, '--task', taskId], {
    cwd: dir,
  });
  assert.equal(r.status, 0, `task approve failed: ${r.stderr}`);
}

function transitionTask(dir, missionId, taskId, toState) {
  const r = runCli(
    ['task', 'transition', '--mission', missionId, '--task', taskId, '--to', toState],
    { cwd: dir },
  );
  assert.equal(r.status, 0, `transition -> ${toState} failed: ${r.stderr}`);
}

// ── happy path ─────────────────────────────────────────────────────────

test('impl-contract set writes a valid contract in ready state', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    draftTaskReady(dir, MID, 'task-001');
    // task is in ready after approve.

    const r = runCli(
      ['impl-contract', 'set', '--mission', MID, '--task', 'task-001'],
      { cwd: dir, input: JSON.stringify(validImplBody()) },
    );
    assert.equal(r.status, 0, `impl-contract set failed: ${r.stderr}`);
    assert.equal(r.json.ok, true);
    assert.match(
      r.json.data.path,
      /\.geas\/missions\/mission-20260420-g4impcon\/tasks\/task-001\/implementation-contract\.json$/,
    );

    const onDisk = readArtifact(
      dir,
      `.geas/missions/${MID}/tasks/task-001/implementation-contract.json`,
    );
    assert.equal(onDisk.mission_id, MID);
    assert.equal(onDisk.task_id, 'task-001');
    assert.equal(onDisk.summary, 'add X field to Y module');
    assert.equal(onDisk.change_scope.length, 2);
    assert.equal(onDisk.planned_actions.length, 3);
    assert.ok(onDisk.created_at);
    assert.ok(onDisk.updated_at);
  } finally {
    cleanup();
  }
});

test('impl-contract set accepts implementing state', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    draftTaskReady(dir, MID, 'task-001');
    transitionTask(dir, MID, 'task-001', 'implementing');

    const r = runCli(
      ['impl-contract', 'set', '--mission', MID, '--task', 'task-001'],
      { cwd: dir, input: JSON.stringify(validImplBody()) },
    );
    assert.equal(r.status, 0, `impl-contract set (implementing) failed: ${r.stderr}`);
  } finally {
    cleanup();
  }
});

test('impl-contract set rejects schema-invalid body (missing required fields)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    draftTaskReady(dir, MID, 'task-001');

    // Missing summary / rationale / change_scope / planned_actions
    const r = runCli(
      ['impl-contract', 'set', '--mission', MID, '--task', 'task-001'],
      { cwd: dir, input: JSON.stringify({ summary: 'only this' }) },
    );
    assert.equal(r.status, 2, `expected schema_validation_failed, got ${r.stderr}`);
    assert.equal(r.json.error.code, 'schema_validation_failed');
  } finally {
    cleanup();
  }
});

test('impl-contract set rejects when mission is not approved', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    let r = runCli(['setup'], { cwd: dir });
    assert.equal(r.status, 0);
    r = runCli(['mission', 'create'], {
      cwd: dir,
      input: JSON.stringify(baseSpec()),
      env: { GEAS_MOCK_MISSION_ID: MID },
    });
    assert.equal(r.status, 0);
    // Skip mission approve.
    // Task draft is allowed even unapproved; we bypass task approve too
    // because mission is the first guard we hit.
    r = runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(baseContract()),
      env: { GEAS_MOCK_TASK_ID: 'task-001' },
    });
    assert.equal(r.status, 0);

    r = runCli(
      ['impl-contract', 'set', '--mission', MID, '--task', 'task-001'],
      { cwd: dir, input: JSON.stringify(validImplBody()) },
    );
    assert.equal(r.status, 3, `expected guard_failed, got ${r.stderr}`);
    assert.equal(r.json.error.code, 'guard_failed');
    assert.match(r.json.error.message, /not user-approved/);
  } finally {
    cleanup();
  }
});

test('impl-contract set rejects when task contract is not approved', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    // Draft without approve.
    const r = runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(baseContract()),
      env: { GEAS_MOCK_TASK_ID: 'task-001' },
    });
    assert.equal(r.status, 0);

    const r2 = runCli(
      ['impl-contract', 'set', '--mission', MID, '--task', 'task-001'],
      { cwd: dir, input: JSON.stringify(validImplBody()) },
    );
    assert.equal(r2.status, 3, `expected guard_failed, got ${r2.stderr}`);
    assert.equal(r2.json.error.code, 'guard_failed');
    assert.match(r2.json.error.message, /not approved/);
  } finally {
    cleanup();
  }
});

test('impl-contract set rejects when task state is reviewing (later-stage)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    draftTaskReady(dir, MID, 'task-001');
    // Force task state past implementing via low-level setter.
    const r = runCli(['state', 'task-set', '--mission', MID, '--task', 'task-001'], {
      cwd: dir,
      input: JSON.stringify({
        mission_id: MID,
        task_id: 'task-001',
        status: 'reviewing',
        active_agent: null,
        verify_fix_iterations: 0,
      }),
    });
    assert.equal(r.status, 0, `state task-set failed: ${r.stderr}`);

    const r2 = runCli(
      ['impl-contract', 'set', '--mission', MID, '--task', 'task-001'],
      { cwd: dir, input: JSON.stringify(validImplBody()) },
    );
    assert.equal(r2.status, 3, `expected guard_failed, got ${r2.stderr}`);
    assert.equal(r2.json.error.code, 'guard_failed');
    assert.match(r2.json.error.message, /ready or implementing/);
  } finally {
    cleanup();
  }
});

test('impl-contract set rejects when task state is cancelled (terminal)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    draftTaskReady(dir, MID, 'task-001');
    const r = runCli(['state', 'task-set', '--mission', MID, '--task', 'task-001'], {
      cwd: dir,
      input: JSON.stringify({
        mission_id: MID,
        task_id: 'task-001',
        status: 'cancelled',
        active_agent: null,
        verify_fix_iterations: 0,
      }),
    });
    assert.equal(r.status, 0, r.stderr);

    const r2 = runCli(
      ['impl-contract', 'set', '--mission', MID, '--task', 'task-001'],
      { cwd: dir, input: JSON.stringify(validImplBody()) },
    );
    assert.equal(r2.status, 3);
    assert.equal(r2.json.error.code, 'guard_failed');
  } finally {
    cleanup();
  }
});

test('impl-contract set full-replaces on second call', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    draftTaskReady(dir, MID, 'task-001');

    let r = runCli(
      ['impl-contract', 'set', '--mission', MID, '--task', 'task-001'],
      { cwd: dir, input: JSON.stringify(validImplBody({ summary: 'first draft' })) },
    );
    assert.equal(r.status, 0, r.stderr);
    const first = readArtifact(
      dir,
      `.geas/missions/${MID}/tasks/task-001/implementation-contract.json`,
    );

    r = runCli(
      ['impl-contract', 'set', '--mission', MID, '--task', 'task-001'],
      {
        cwd: dir,
        input: JSON.stringify(
          validImplBody({
            summary: 'second draft',
            planned_actions: ['only-one-action'],
            non_goals: [],
            alternatives_considered: [],
            assumptions: [],
            open_questions: [],
          }),
        ),
      },
    );
    assert.equal(r.status, 0, r.stderr);
    const second = readArtifact(
      dir,
      `.geas/missions/${MID}/tasks/task-001/implementation-contract.json`,
    );
    assert.equal(second.summary, 'second draft');
    assert.deepEqual(second.planned_actions, ['only-one-action']);
    // created_at preserved; updated_at advances.
    assert.equal(second.created_at, first.created_at);
    assert.ok(second.updated_at >= first.updated_at);
  } finally {
    cleanup();
  }
});

test('impl-contract set strips client-provided envelope fields', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    draftTaskReady(dir, MID, 'task-001');

    const r = runCli(
      ['impl-contract', 'set', '--mission', MID, '--task', 'task-001'],
      {
        cwd: dir,
        input: JSON.stringify({
          ...validImplBody(),
          mission_id: 'mission-19990101-bogusxxx',
          task_id: 'task-999',
          created_at: '1999-01-01T00:00:00Z',
          updated_at: '1999-01-01T00:00:00Z',
        }),
      },
    );
    assert.equal(r.status, 0, r.stderr);
    const onDisk = readArtifact(
      dir,
      `.geas/missions/${MID}/tasks/task-001/implementation-contract.json`,
    );
    // Envelope fields authoritatively set by the CLI, not by stdin.
    assert.equal(onDisk.mission_id, MID);
    assert.equal(onDisk.task_id, 'task-001');
    assert.notEqual(onDisk.created_at, '1999-01-01T00:00:00Z');
    assert.notEqual(onDisk.updated_at, '1999-01-01T00:00:00Z');
  } finally {
    cleanup();
  }
});

test('impl-contract set emits impl_contract_set event', () => {
  const fs = require('fs');
  const path = require('path');
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    draftTaskReady(dir, MID, 'task-001');

    const r = runCli(
      ['impl-contract', 'set', '--mission', MID, '--task', 'task-001'],
      { cwd: dir, input: JSON.stringify(validImplBody()) },
    );
    assert.equal(r.status, 0, r.stderr);

    const events = fs
      .readFileSync(path.join(dir, '.geas/events.jsonl'), 'utf-8')
      .split('\n')
      .filter((l) => l.length > 0)
      .map((l) => JSON.parse(l));
    const ev = events.find((e) => e.kind === 'impl_contract_set');
    assert.ok(ev, 'impl_contract_set event expected');
    assert.equal(ev.actor, 'cli:auto');
    assert.equal(ev.payload.mission_id, MID);
    assert.equal(ev.payload.task_id, 'task-001');
  } finally {
    cleanup();
  }
});
