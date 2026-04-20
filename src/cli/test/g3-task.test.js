/**
 * G3 Task integration test.
 *
 * Drives the 9-state task FSM through the CLI and checks the guards:
 *
 *   draft -> approve -> transition(implementing)
 *         -> self-check/evidence stubs -> transition(reviewed)
 *         -> verification evidence stub -> transition(verified)
 *         -> closure stub -> transition(passed)
 *
 *   blocked / escalated / cancelled branches, the
 *   reviewed -> implementing changes_requested loop (iteration bump),
 *   dependency gate, surface-conflict gate, and deterministic id
 *   generation via GEAS_MOCK_TASK_ID.
 *
 * G3's evidence-driven guards (implementing->reviewed, reviewed->verified,
 * verified->passed) check file presence only; G4 tightens them against
 * evidence.schema verdicts. This test reflects that boundary by
 * constructing the marker files directly.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeTempRoot, runCli, readArtifact } = require('./helpers/setup');

const MID = 'mission-20260420-g3taskmn';

const VALID_SPEC = {
  name: 'G3 test mission',
  description: 'mission used to exercise the 9-state task lifecycle',
  mode: 'standard',
  definition_of_done: 'every task transition is guarded per protocol 03',
  scope: {
    in: ['task command surface'],
    out: ['evidence command surface (G4)'],
  },
  acceptance_criteria: [
    'geas task draft writes a schema-valid contract in drafted',
    'geas task approve moves state from drafted to ready',
    'transitions follow protocol doc 03',
  ],
  constraints: ['no writes to .geas/ outside the CLI'],
  affected_surfaces: ['src/cli/src/commands/task.ts'],
  risks: ['FSM disagrees with protocol 03 transition table'],
};

function setupMissionApproved(dir) {
  const r1 = runCli(['setup'], { cwd: dir });
  assert.equal(r1.status, 0, `setup failed: ${r1.stderr}`);
  const r2 = runCli(['mission', 'create'], {
    cwd: dir,
    input: JSON.stringify(VALID_SPEC),
    env: { GEAS_MOCK_MISSION_ID: MID },
  });
  assert.equal(r2.status, 0, `mission create failed: ${r2.stderr}\n${r2.stdout}`);
  const r3 = runCli(['mission', 'approve', '--mission', MID], { cwd: dir });
  assert.equal(r3.status, 0, `mission approve failed: ${r3.stderr}`);
}

function draftContract(overrides = {}) {
  // The CLI injects mission_id / task_id / timestamps / defaults.
  return {
    title: 'G3 task',
    goal: 'exercise the 9-state task FSM in the CLI',
    risk_level: 'normal',
    acceptance_criteria: ['lifecycle advances under CLI guards'],
    verification_plan: 'manual via the integration test',
    surfaces: ['src/cli/src/commands/task.ts'],
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

function taskDir(dir, taskId) {
  return path.join(dir, '.geas', 'missions', MID, 'tasks', taskId);
}

function writeSelfCheckStub(dir, taskId) {
  const p = path.join(taskDir(dir, taskId), 'self-check.json');
  // G3 only checks file existence; schema validation lands in G4.
  fs.writeFileSync(p, JSON.stringify({ stub: true }, null, 2) + '\n');
}

function writeReviewEvidenceStub(dir, taskId, agent, slot) {
  const evDir = path.join(taskDir(dir, taskId), 'evidence');
  fs.mkdirSync(evDir, { recursive: true });
  const p = path.join(evDir, `${agent}.${slot}.json`);
  fs.writeFileSync(
    p,
    JSON.stringify({ stub: true, agent, slot, entries: [] }, null, 2) + '\n',
  );
}

function writeVerificationEvidenceStub(dir, taskId, agent = 'qa-engineer') {
  writeReviewEvidenceStub(dir, taskId, agent, 'verifier');
}

function writeClosureApproved(dir, taskId) {
  const evDir = path.join(taskDir(dir, taskId), 'evidence');
  fs.mkdirSync(evDir, { recursive: true });
  const p = path.join(evDir, 'orchestrator.orchestrator.json');
  const body = {
    mission_id: MID,
    task_id: taskId,
    agent: 'orchestrator',
    slot: 'orchestrator',
    entries: [
      {
        entry_id: 1,
        evidence_kind: 'closure',
        verdict: 'approved',
        summary: 'G3 test closure stub',
        artifacts: [],
        memory_suggestions: [],
        debt_candidates: [],
        gap_signals: [],
        revision_ref: null,
        created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      },
    ],
    created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    updated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };
  fs.writeFileSync(p, JSON.stringify(body, null, 2) + '\n');
}

// ── Tests ──────────────────────────────────────────────────────────────

test('task draft writes a drafted contract and task-state', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMissionApproved(dir);
    const res = runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(draftContract()),
      env: { GEAS_MOCK_TASK_ID: 'task-001' },
    });
    assert.equal(res.status, 0, `draft failed: ${res.stderr}\n${res.stdout}`);
    assert.equal(res.json.ok, true);
    assert.equal(res.json.data.ids.task_id, 'task-001');

    const contract = readArtifact(
      dir,
      `.geas/missions/${MID}/tasks/task-001/contract.json`,
    );
    assert.equal(contract.task_id, 'task-001');
    assert.equal(contract.mission_id, MID);
    assert.equal(contract.approved_by, null);
    assert.deepEqual(contract.dependencies, []);
    assert.equal(contract.supersedes, null);

    const state = readArtifact(
      dir,
      `.geas/missions/${MID}/tasks/task-001/task-state.json`,
    );
    assert.equal(state.status, 'drafted');
    assert.equal(state.active_agent, null);
    assert.equal(state.verify_fix_iterations, 0);
  } finally {
    cleanup();
  }
});

test('task draft rejects schema-invalid payloads', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMissionApproved(dir);
    const bad = draftContract({ risk_level: 'reckless' });
    const res = runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(bad),
      env: { GEAS_MOCK_TASK_ID: 'task-001' },
    });
    assert.notEqual(res.status, 0);
    assert.equal(res.json.ok, false);
    assert.equal(res.json.error.code, 'schema_validation_failed');
  } finally {
    cleanup();
  }
});

test('task draft rejects missing required fields', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMissionApproved(dir);
    const incomplete = { title: 'x' }; // missing goal, risk_level, etc.
    const res = runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(incomplete),
      env: { GEAS_MOCK_TASK_ID: 'task-001' },
    });
    assert.notEqual(res.status, 0);
    assert.equal(res.json.error.code, 'schema_validation_failed');
  } finally {
    cleanup();
  }
});

test('task approve moves state drafted -> ready and sets approved_by', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMissionApproved(dir);
    runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(draftContract()),
      env: { GEAS_MOCK_TASK_ID: 'task-001' },
    });

    const res = runCli(
      ['task', 'approve', '--mission', MID, '--task', 'task-001'],
      { cwd: dir },
    );
    assert.equal(res.status, 0, `approve failed: ${res.stderr}\n${res.stdout}`);

    const contract = readArtifact(
      dir,
      `.geas/missions/${MID}/tasks/task-001/contract.json`,
    );
    assert.equal(contract.approved_by, 'user');

    const state = readArtifact(
      dir,
      `.geas/missions/${MID}/tasks/task-001/task-state.json`,
    );
    assert.equal(state.status, 'ready');
  } finally {
    cleanup();
  }
});

test('task approve accepts --by decision-maker for mid-mission adds', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMissionApproved(dir);
    runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(draftContract()),
      env: { GEAS_MOCK_TASK_ID: 'task-001' },
    });

    const res = runCli(
      ['task', 'approve', '--mission', MID, '--task', 'task-001', '--by', 'decision-maker'],
      { cwd: dir },
    );
    assert.equal(res.status, 0);
    const contract = readArtifact(
      dir,
      `.geas/missions/${MID}/tasks/task-001/contract.json`,
    );
    assert.equal(contract.approved_by, 'decision-maker');
  } finally {
    cleanup();
  }
});

test('transition drafted -> implementing rejected (must go through ready)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMissionApproved(dir);
    runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(draftContract()),
      env: { GEAS_MOCK_TASK_ID: 'task-001' },
    });
    const res = runCli(
      [
        'task', 'transition', '--mission', MID, '--task', 'task-001',
        '--to', 'implementing',
      ],
      { cwd: dir },
    );
    assert.notEqual(res.status, 0);
    assert.equal(res.json.error.code, 'guard_failed');
    assert.match(res.json.error.message, /not permitted/);
  } finally {
    cleanup();
  }
});

test('transition ready -> implementing rejected when dependencies not passed', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMissionApproved(dir);
    // task-001 is a dependency we will leave in drafted.
    runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(draftContract({ surfaces: ['surface-a'] })),
      env: { GEAS_MOCK_TASK_ID: 'task-001' },
    });
    // task-002 depends on task-001.
    runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(
        draftContract({
          surfaces: ['surface-b'],
          dependencies: ['task-001'],
        }),
      ),
      env: { GEAS_MOCK_TASK_ID: 'task-002' },
    });
    runCli(['task', 'approve', '--mission', MID, '--task', 'task-002'], { cwd: dir });

    const res = runCli(
      [
        'task', 'transition', '--mission', MID, '--task', 'task-002',
        '--to', 'implementing',
      ],
      { cwd: dir },
    );
    assert.notEqual(res.status, 0);
    assert.equal(res.json.error.code, 'guard_failed');
    assert.match(res.json.error.message, /dependency/);
    assert.deepEqual(
      res.json.error.hints.unsatisfied_dependencies,
      ['task-001'],
    );
  } finally {
    cleanup();
  }
});

test('transition ready -> implementing accepted when dependencies passed', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMissionApproved(dir);
    runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(draftContract({ surfaces: ['surface-a'] })),
      env: { GEAS_MOCK_TASK_ID: 'task-001' },
    });
    runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(
        draftContract({
          surfaces: ['surface-b'],
          dependencies: ['task-001'],
        }),
      ),
      env: { GEAS_MOCK_TASK_ID: 'task-002' },
    });
    // Mark task-001 as passed by editing its state directly (G4 adds the
    // evidence-driven path). Approve first so state-set is schema-valid.
    runCli(['task', 'approve', '--mission', MID, '--task', 'task-001'], { cwd: dir });
    const passedState = {
      mission_id: MID,
      task_id: 'task-001',
      status: 'passed',
      active_agent: null,
      verify_fix_iterations: 0,
    };
    const r = runCli(
      ['state', 'task-set', '--mission', MID, '--task', 'task-001'],
      { cwd: dir, input: JSON.stringify(passedState) },
    );
    assert.equal(r.status, 0, `task-set failed: ${r.stderr}`);

    runCli(['task', 'approve', '--mission', MID, '--task', 'task-002'], { cwd: dir });
    const res = runCli(
      [
        'task', 'transition', '--mission', MID, '--task', 'task-002',
        '--to', 'implementing',
      ],
      { cwd: dir },
    );
    assert.equal(
      res.status,
      0,
      `transition failed: ${res.stderr}\n${res.stdout}`,
    );
    const state = readArtifact(
      dir,
      `.geas/missions/${MID}/tasks/task-002/task-state.json`,
    );
    assert.equal(state.status, 'implementing');
  } finally {
    cleanup();
  }
});

test('9-state traversal drafted -> ready -> implementing -> reviewed -> verified -> passed', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMissionApproved(dir);
    runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(draftContract()),
      env: { GEAS_MOCK_TASK_ID: 'task-001' },
    });
    runCli(['task', 'approve', '--mission', MID, '--task', 'task-001'], { cwd: dir });

    // ready -> implementing
    let r = runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'implementing'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `ready->implementing failed: ${r.stderr}`);

    // implementing -> reviewed (needs self-check + review evidence for challenger)
    writeSelfCheckStub(dir, 'task-001');
    writeReviewEvidenceStub(dir, 'task-001', 'research-integrity-reviewer', 'challenger');
    r = runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'reviewed'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `implementing->reviewed failed: ${r.stderr}\n${r.stdout}`);

    // reviewed -> verified (needs verification evidence stub)
    writeVerificationEvidenceStub(dir, 'task-001');
    r = runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'verified'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `reviewed->verified failed: ${r.stderr}\n${r.stdout}`);

    // verified -> passed (needs closure approved)
    writeClosureApproved(dir, 'task-001');
    r = runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'passed'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `verified->passed failed: ${r.stderr}\n${r.stdout}`);

    const state = readArtifact(
      dir,
      `.geas/missions/${MID}/tasks/task-001/task-state.json`,
    );
    assert.equal(state.status, 'passed');
  } finally {
    cleanup();
  }
});

test('implementing -> reviewed rejected without self-check', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMissionApproved(dir);
    runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(draftContract()),
      env: { GEAS_MOCK_TASK_ID: 'task-001' },
    });
    runCli(['task', 'approve', '--mission', MID, '--task', 'task-001'], { cwd: dir });
    runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'implementing'],
      { cwd: dir },
    );
    const res = runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'reviewed'],
      { cwd: dir },
    );
    assert.notEqual(res.status, 0);
    assert.equal(res.json.error.code, 'guard_failed');
    assert.match(res.json.error.message, /self-check/);
  } finally {
    cleanup();
  }
});

test('implementing -> reviewed rejected when required reviewer slot has no evidence file', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMissionApproved(dir);
    runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(
        draftContract({
          routing: {
            primary_worker_type: 'software-engineer',
            required_reviewers: ['challenger', 'risk-assessor'],
          },
        }),
      ),
      env: { GEAS_MOCK_TASK_ID: 'task-001' },
    });
    runCli(['task', 'approve', '--mission', MID, '--task', 'task-001'], { cwd: dir });
    runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'implementing'],
      { cwd: dir },
    );
    writeSelfCheckStub(dir, 'task-001');
    writeReviewEvidenceStub(dir, 'task-001', 'challenger-a', 'challenger');
    // Missing risk-assessor evidence.

    const res = runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'reviewed'],
      { cwd: dir },
    );
    assert.notEqual(res.status, 0);
    assert.equal(res.json.error.code, 'guard_failed');
    assert.deepEqual(
      res.json.error.hints.missing_review_slots,
      ['risk-assessor'],
    );
  } finally {
    cleanup();
  }
});

test('blocked excursion: implementing -> blocked -> ready -> implementing', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMissionApproved(dir);
    runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(draftContract()),
      env: { GEAS_MOCK_TASK_ID: 'task-001' },
    });
    runCli(['task', 'approve', '--mission', MID, '--task', 'task-001'], { cwd: dir });
    runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'implementing'],
      { cwd: dir },
    );

    let r = runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'blocked'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `implementing->blocked failed: ${r.stderr}`);

    r = runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'ready'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `blocked->ready failed: ${r.stderr}`);

    r = runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'implementing'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `ready->implementing (resume) failed: ${r.stderr}`);
  } finally {
    cleanup();
  }
});

test('cancelled and passed are terminal; further transitions rejected', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMissionApproved(dir);
    // Cancelled terminal
    runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(draftContract()),
      env: { GEAS_MOCK_TASK_ID: 'task-001' },
    });
    let r = runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'cancelled'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `drafted->cancelled failed: ${r.stderr}`);
    // attempt cancelled -> ready should fail
    r = runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'ready'],
      { cwd: dir },
    );
    assert.notEqual(r.status, 0);
    assert.equal(r.json.error.code, 'guard_failed');
    assert.match(r.json.error.message, /terminal/);
  } finally {
    cleanup();
  }
});

test('escalated branch: blocked -> escalated -> passed (closure approved)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMissionApproved(dir);
    runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(draftContract()),
      env: { GEAS_MOCK_TASK_ID: 'task-001' },
    });
    runCli(['task', 'approve', '--mission', MID, '--task', 'task-001'], { cwd: dir });
    runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'implementing'],
      { cwd: dir },
    );
    runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'blocked'],
      { cwd: dir },
    );
    let r = runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'escalated'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `blocked->escalated failed: ${r.stderr}`);

    // No closure yet — escalated->passed rejected
    r = runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'passed'],
      { cwd: dir },
    );
    assert.notEqual(r.status, 0);
    assert.equal(r.json.error.code, 'guard_failed');
    assert.match(r.json.error.message, /closure/);

    writeClosureApproved(dir, 'task-001');
    r = runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'passed'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `escalated->passed failed: ${r.stderr}\n${r.stdout}`);
  } finally {
    cleanup();
  }
});

test('reviewed -> implementing (changes_requested) increments verify_fix_iterations', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMissionApproved(dir);
    runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(draftContract()),
      env: { GEAS_MOCK_TASK_ID: 'task-001' },
    });
    runCli(['task', 'approve', '--mission', MID, '--task', 'task-001'], { cwd: dir });
    runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'implementing'],
      { cwd: dir },
    );
    writeSelfCheckStub(dir, 'task-001');
    writeReviewEvidenceStub(dir, 'task-001', 'challenger-a', 'challenger');
    let r = runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'reviewed'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `implementing->reviewed failed: ${r.stderr}`);

    // Changes requested — go back to implementing.
    r = runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'implementing'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `reviewed->implementing failed: ${r.stderr}\n${r.stdout}`);

    const state = readArtifact(
      dir,
      `.geas/missions/${MID}/tasks/task-001/task-state.json`,
    );
    assert.equal(state.status, 'implementing');
    assert.equal(state.verify_fix_iterations, 1);

    // One more loop, iterations becomes 2.
    r = runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'reviewed'],
      { cwd: dir },
    );
    assert.equal(r.status, 0);
    r = runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'implementing'],
      { cwd: dir },
    );
    assert.equal(r.status, 0);
    const state2 = readArtifact(
      dir,
      `.geas/missions/${MID}/tasks/task-001/task-state.json`,
    );
    assert.equal(state2.verify_fix_iterations, 2);
  } finally {
    cleanup();
  }
});

test('unknown task state is rejected at argument parsing', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMissionApproved(dir);
    runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(draftContract()),
      env: { GEAS_MOCK_TASK_ID: 'task-001' },
    });
    runCli(['task', 'approve', '--mission', MID, '--task', 'task-001'], { cwd: dir });
    const res = runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'dancing'],
      { cwd: dir },
    );
    assert.notEqual(res.status, 0);
    assert.equal(res.json.error.code, 'invalid_argument');
  } finally {
    cleanup();
  }
});

test('surface-overlap conflict blocks second ready -> implementing', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMissionApproved(dir);
    // Two tasks with a shared surface.
    runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(draftContract({ surfaces: ['shared-surface'] })),
      env: { GEAS_MOCK_TASK_ID: 'task-001' },
    });
    runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(draftContract({ surfaces: ['shared-surface'] })),
      env: { GEAS_MOCK_TASK_ID: 'task-002' },
    });
    runCli(['task', 'approve', '--mission', MID, '--task', 'task-001'], { cwd: dir });
    runCli(['task', 'approve', '--mission', MID, '--task', 'task-002'], { cwd: dir });

    // task-001 claims the surface.
    let r = runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'implementing'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `first implementing failed: ${r.stderr}`);

    // task-002 must fail.
    r = runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-002', '--to', 'implementing'],
      { cwd: dir },
    );
    assert.notEqual(r.status, 0);
    assert.equal(r.json.error.code, 'guard_failed');
    assert.match(r.json.error.message, /surface/);
    assert.deepEqual(
      r.json.error.hints.conflicting_surfaces,
      ['shared-surface'],
    );
  } finally {
    cleanup();
  }
});

test('task deps add merges deduplicated dependencies', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMissionApproved(dir);
    runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(draftContract({ dependencies: ['task-001'] })),
      env: { GEAS_MOCK_TASK_ID: 'task-002' },
    });
    const r = runCli(
      ['task', 'deps', 'add', '--mission', MID, '--task', 'task-002',
       '--deps', 'task-001,task-003'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `deps add failed: ${r.stderr}`);
    assert.deepEqual(r.json.data.dependencies, ['task-001', 'task-003']);
    assert.deepEqual(r.json.data.added, ['task-003']);
  } finally {
    cleanup();
  }
});

test('GEAS_MOCK_TASK_ID env var produces deterministic ids', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMissionApproved(dir);
    const r = runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(draftContract()),
      env: { GEAS_MOCK_TASK_ID: 'task-042' },
    });
    assert.equal(r.status, 0);
    assert.equal(r.json.data.ids.task_id, 'task-042');
    assert.ok(
      fs.existsSync(
        path.join(dir, '.geas', 'missions', MID, 'tasks', 'task-042', 'contract.json'),
      ),
    );
  } finally {
    cleanup();
  }
});

test('task state summary reports contract fields and task-state status', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMissionApproved(dir);
    runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(
        draftContract({
          risk_level: 'high',
          surfaces: ['a', 'b'],
          dependencies: ['task-000'],
        }),
      ),
      env: { GEAS_MOCK_TASK_ID: 'task-007' },
    });
    runCli(['task', 'approve', '--mission', MID, '--task', 'task-007'], { cwd: dir });

    const r = runCli(
      ['task', 'state', '--mission', MID, '--task', 'task-007'],
      { cwd: dir },
    );
    assert.equal(r.status, 0);
    assert.equal(r.json.data.status, 'ready');
    assert.equal(r.json.data.approved_by, 'user');
    assert.equal(r.json.data.risk_level, 'high');
    assert.equal(r.json.data.primary_worker_type, 'software-engineer');
    assert.deepEqual(r.json.data.surfaces, ['a', 'b']);
    assert.deepEqual(r.json.data.dependencies, ['task-000']);
  } finally {
    cleanup();
  }
});
