/**
 * G2 Mission integration test.
 *
 * Drives a full mission lifecycle through the CLI:
 *
 *   setup -> mission create -> mission approve
 *         -> (insert approved task) -> mission-state update --phase building
 *         -> phase-review building -> mission-state --phase polishing
 *         -> phase-review polishing -> mission-state --phase consolidating
 *         -> phase-review consolidating -> mission-verdict append
 *         -> mission-state --phase complete
 *
 * Each assertion verifies the guard behaviour described in protocol 02
 * and CLI.md §14.2.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeTempRoot, runCli, readArtifact } = require('./helpers/setup');

// Every test in this file uses a fixed mission id so CLI output is
// deterministic and we do not have to parse it out of responses.
const MID = 'mission-20260420-abcdefgh';

const VALID_SPEC = {
  name: 'G2 test mission',
  description: 'A mission whose lifecycle is driven by the G2 integration test.',
  mode: 'standard',
  definition_of_done: 'every phase advances under CLI guards without rejection',
  scope: {
    in: ['CLI mission command surface'],
    out: ['task command surface (G3)'],
  },
  acceptance_criteria: [
    'geas mission create writes a schema-valid spec',
    'phase transitions follow protocol 02',
    'mission-verdict is required to complete',
  ],
  constraints: ['no changes to .geas/ except through the CLI'],
  affected_surfaces: ['src/cli/src/commands/mission.ts'],
  risks: ['guard logic disagrees with protocol'],
};

function setupWithMission(dir) {
  const r1 = runCli(['setup'], { cwd: dir });
  assert.equal(r1.status, 0, `setup failed: ${r1.stderr}`);
  const r2 = runCli(['mission', 'create'], {
    cwd: dir,
    input: JSON.stringify(VALID_SPEC),
    env: { GEAS_MOCK_MISSION_ID: MID },
  });
  assert.equal(r2.status, 0, `mission create failed: ${r2.stderr}\n${r2.stdout}`);
  return r2;
}

function insertApprovedTask(dir, missionId, taskNumber = 1, extra = {}) {
  const taskId = `task-${String(taskNumber).padStart(3, '0')}`;
  const taskDir = path.join(
    dir,
    '.geas',
    'missions',
    missionId,
    'tasks',
    taskId,
  );
  fs.mkdirSync(path.join(taskDir, 'evidence'), { recursive: true });

  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const contract = {
    mission_id: missionId,
    task_id: taskId,
    title: `G2 synthetic task ${taskNumber}`,
    goal: 'exercise phase-advance guards',
    risk_level: 'normal',
    acceptance_criteria: ['task transitions to passed in the test harness'],
    verification_plan: 'manual via the test harness; no runtime checks',
    approved_by: 'user',
    surfaces: ['test-fixture'],
    routing: {
      primary_worker_type: 'software-engineer',
      required_reviewers: ['challenger'],
    },
    base_snapshot: 'synthetic',
    dependencies: [],
    supersedes: null,
    created_at: now,
    updated_at: now,
    ...extra.contract,
  };
  fs.writeFileSync(
    path.join(taskDir, 'contract.json'),
    JSON.stringify(contract, null, 2) + '\n',
  );

  const state = {
    mission_id: missionId,
    task_id: taskId,
    status: extra.status ?? 'passed',
    active_agent: null,
    verify_fix_iterations: 0,
    created_at: now,
    updated_at: now,
  };
  fs.writeFileSync(
    path.join(taskDir, 'task-state.json'),
    JSON.stringify(state, null, 2) + '\n',
  );

  return taskId;
}

// ─── Tests ──────────────────────────────────────────────────────────────

test('mission create writes a drafted (unapproved) mission spec', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    runCli(['setup'], { cwd: dir });
    const res = runCli(['mission', 'create'], {
      cwd: dir,
      input: JSON.stringify(VALID_SPEC),
      env: { GEAS_MOCK_MISSION_ID: MID },
    });
    assert.equal(res.status, 0, `create failed: ${res.stderr}\n${res.stdout}`);
    assert.ok(res.json);
    assert.equal(res.json.ok, true);
    assert.equal(res.json.data.ids.mission_id, MID);

    const spec = readArtifact(dir, `.geas/missions/${MID}/spec.json`);
    assert.equal(spec.user_approved, false);
    assert.equal(spec.id, MID);
    assert.equal(spec.mode, 'standard');
    assert.match(spec.created_at, /^\d{4}-\d{2}-\d{2}T/);

    const state = readArtifact(dir, `.geas/missions/${MID}/mission-state.json`);
    assert.equal(state.phase, 'specifying');
    assert.deepEqual(state.active_tasks, []);

    // Empty wrappers exist
    const pr = readArtifact(dir, `.geas/missions/${MID}/phase-reviews.json`);
    assert.deepEqual(pr.reviews, []);
    const mv = readArtifact(dir, `.geas/missions/${MID}/mission-verdicts.json`);
    assert.deepEqual(mv.verdicts, []);
    const delib = readArtifact(dir, `.geas/missions/${MID}/deliberations.json`);
    assert.equal(delib.level, 'mission');
    assert.deepEqual(delib.entries, []);
  } finally {
    cleanup();
  }
});

test('mission create rejects schema-invalid payloads', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    runCli(['setup'], { cwd: dir });
    const badSpec = { ...VALID_SPEC, mode: 'reckless' };
    const res = runCli(['mission', 'create'], {
      cwd: dir,
      input: JSON.stringify(badSpec),
      env: { GEAS_MOCK_MISSION_ID: MID },
    });
    assert.notEqual(res.status, 0);
    assert.equal(res.json.ok, false);
    assert.equal(res.json.error.code, 'schema_validation_failed');
  } finally {
    cleanup();
  }
});

test('mission phase advance rejected without approval', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupWithMission(dir);
    const res = runCli(
      ['mission-state', 'update', '--mission', MID, '--phase', 'building'],
      { cwd: dir },
    );
    assert.notEqual(res.status, 0);
    assert.equal(res.json.ok, false);
    assert.equal(res.json.error.code, 'guard_failed');
    assert.match(res.json.error.message, /not user-approved/);
  } finally {
    cleanup();
  }
});

test('mission approve flips user_approved and is idempotent', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupWithMission(dir);
    const r1 = runCli(['mission', 'approve', '--mission', MID], { cwd: dir });
    assert.equal(r1.status, 0);
    assert.equal(r1.json.ok, true);
    assert.equal(r1.json.data.already_approved, false);
    const spec = readArtifact(dir, `.geas/missions/${MID}/spec.json`);
    assert.equal(spec.user_approved, true);

    const r2 = runCli(['mission', 'approve', '--mission', MID], { cwd: dir });
    assert.equal(r2.status, 0);
    assert.equal(r2.json.data.already_approved, true);
  } finally {
    cleanup();
  }
});

test('mission create is rejected after approve (spec immutable)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupWithMission(dir);
    runCli(['mission', 'approve', '--mission', MID], { cwd: dir });
    // Re-creating the same mission id must collide.
    const res = runCli(['mission', 'create'], {
      cwd: dir,
      input: JSON.stringify(VALID_SPEC),
      env: { GEAS_MOCK_MISSION_ID: MID },
    });
    assert.notEqual(res.status, 0);
    assert.equal(res.json.error.code, 'path_collision');
  } finally {
    cleanup();
  }
});

test('specifying -> building rejected when no approved task exists', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupWithMission(dir);
    runCli(['mission', 'approve', '--mission', MID], { cwd: dir });
    const res = runCli(
      ['mission-state', 'update', '--mission', MID, '--phase', 'building'],
      { cwd: dir },
    );
    assert.notEqual(res.status, 0);
    assert.equal(res.json.error.code, 'guard_failed');
    assert.match(res.json.error.message, /approved task-contract/);
  } finally {
    cleanup();
  }
});

test('specifying -> building succeeds once an approved task exists', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupWithMission(dir);
    runCli(['mission', 'approve', '--mission', MID], { cwd: dir });
    // task in implementing so open_task_count > 0 but building guard
    // only requires an approved contract.
    insertApprovedTask(dir, MID, 1, { status: 'implementing' });
    const res = runCli(
      ['mission-state', 'update', '--mission', MID, '--phase', 'building'],
      { cwd: dir },
    );
    assert.equal(res.status, 0, `advance failed: ${res.stderr}\n${res.stdout}`);
    assert.equal(res.json.data.phase.to, 'building');
    const state = readArtifact(dir, `.geas/missions/${MID}/mission-state.json`);
    assert.equal(state.phase, 'building');
  } finally {
    cleanup();
  }
});

test('building -> polishing requires a matching phase-review', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupWithMission(dir);
    runCli(['mission', 'approve', '--mission', MID], { cwd: dir });
    insertApprovedTask(dir, MID, 1, { status: 'passed' });
    runCli(
      ['mission-state', 'update', '--mission', MID, '--phase', 'building'],
      { cwd: dir },
    );

    // No phase-review yet — advance refused.
    const reject = runCli(
      ['mission-state', 'update', '--mission', MID, '--phase', 'polishing'],
      { cwd: dir },
    );
    assert.notEqual(reject.status, 0);
    assert.equal(reject.json.error.code, 'guard_failed');
    assert.match(reject.json.error.message, /phase-review/);

    // Append a review, then advance.
    const appendRes = runCli(
      ['phase-review', 'append', '--mission', MID],
      {
        cwd: dir,
        input: JSON.stringify({
          mission_phase: 'building',
          status: 'passed',
          summary: 'tasks passed',
          next_phase: 'polishing',
        }),
      },
    );
    assert.equal(appendRes.status, 0, `phase-review append failed: ${appendRes.stderr}`);

    const ok = runCli(
      ['mission-state', 'update', '--mission', MID, '--phase', 'polishing'],
      { cwd: dir },
    );
    assert.equal(ok.status, 0, `advance failed: ${ok.stderr}\n${ok.stdout}`);
  } finally {
    cleanup();
  }
});

test('consolidating -> complete requires a mission-verdict', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupWithMission(dir);
    runCli(['mission', 'approve', '--mission', MID], { cwd: dir });
    insertApprovedTask(dir, MID, 1, { status: 'passed' });

    // specifying -> building
    runCli(
      ['mission-state', 'update', '--mission', MID, '--phase', 'building'],
      { cwd: dir },
    );
    // building -> polishing
    runCli(['phase-review', 'append', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify({
        mission_phase: 'building',
        status: 'passed',
        summary: 'ok',
        next_phase: 'polishing',
      }),
    });
    runCli(
      ['mission-state', 'update', '--mission', MID, '--phase', 'polishing'],
      { cwd: dir },
    );
    // polishing -> consolidating
    runCli(['phase-review', 'append', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify({
        mission_phase: 'polishing',
        status: 'passed',
        summary: 'ok',
        next_phase: 'consolidating',
      }),
    });
    runCli(
      ['mission-state', 'update', '--mission', MID, '--phase', 'consolidating'],
      { cwd: dir },
    );
    // consolidating phase-review must come BEFORE complete, and a
    // mission-verdict must exist.
    runCli(['phase-review', 'append', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify({
        mission_phase: 'consolidating',
        status: 'passed',
        summary: 'ok',
        next_phase: 'complete',
      }),
    });

    const reject = runCli(
      ['mission-state', 'update', '--mission', MID, '--phase', 'complete'],
      { cwd: dir },
    );
    assert.notEqual(reject.status, 0);
    assert.equal(reject.json.error.code, 'guard_failed');
    assert.match(reject.json.error.message, /mission-verdict/);

    // Append the verdict, then advance succeeds.
    const v = runCli(['mission-verdict', 'append', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify({
        verdict: 'approved',
        rationale: 'all phases closed, nothing to carry forward',
        carry_forward: [],
      }),
    });
    assert.equal(v.status, 0, `verdict append failed: ${v.stderr}\n${v.stdout}`);

    const ok2 = runCli(
      ['mission-state', 'update', '--mission', MID, '--phase', 'complete'],
      { cwd: dir },
    );
    assert.equal(ok2.status, 0, `complete failed: ${ok2.stderr}\n${ok2.stdout}`);
    const state = readArtifact(dir, `.geas/missions/${MID}/mission-state.json`);
    assert.equal(state.phase, 'complete');
  } finally {
    cleanup();
  }
});

test('unknown phase transitions are rejected (rewind, skip)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupWithMission(dir);
    runCli(['mission', 'approve', '--mission', MID], { cwd: dir });
    insertApprovedTask(dir, MID, 1, { status: 'passed' });
    runCli(
      ['mission-state', 'update', '--mission', MID, '--phase', 'building'],
      { cwd: dir },
    );

    // Rewind to specifying is never allowed.
    const rewind = runCli(
      ['mission-state', 'update', '--mission', MID, '--phase', 'specifying'],
      { cwd: dir },
    );
    assert.notEqual(rewind.status, 0);
    assert.equal(rewind.json.error.code, 'guard_failed');

    // Skipping polishing to consolidating is not allowed.
    const skip = runCli(
      ['mission-state', 'update', '--mission', MID, '--phase', 'consolidating'],
      { cwd: dir },
    );
    assert.notEqual(skip.status, 0);
    assert.equal(skip.json.error.code, 'guard_failed');

    // Unknown phase name
    const bogus = runCli(
      ['mission-state', 'update', '--mission', MID, '--phase', 'snacking'],
      { cwd: dir },
    );
    assert.notEqual(bogus.status, 0);
    assert.equal(bogus.json.error.code, 'invalid_argument');
  } finally {
    cleanup();
  }
});

test('mission state summary reports phase, approval, task counts', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupWithMission(dir);
    runCli(['mission', 'approve', '--mission', MID], { cwd: dir });
    insertApprovedTask(dir, MID, 1, { status: 'implementing' });
    insertApprovedTask(dir, MID, 2, { status: 'passed' });

    const res = runCli(['mission', 'state', '--mission', MID], { cwd: dir });
    assert.equal(res.status, 0);
    assert.equal(res.json.data.phase, 'specifying');
    assert.equal(res.json.data.user_approved, true);
    assert.equal(res.json.data.mode, 'standard');
    assert.equal(res.json.data.approved_task_count, 2);
    assert.equal(res.json.data.open_task_count, 1);
  } finally {
    cleanup();
  }
});

test('phase-review append validates entry shape', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupWithMission(dir);
    // Missing summary — schema must reject.
    const res = runCli(['phase-review', 'append', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify({
        mission_phase: 'specifying',
        status: 'passed',
        next_phase: 'building',
      }),
    });
    assert.notEqual(res.status, 0);
    assert.equal(res.json.error.code, 'schema_validation_failed');
  } finally {
    cleanup();
  }
});
