/**
 * G3 Task integration test.
 *
 * Drives the 9-state task FSM through the CLI and checks the guards:
 *
 *   draft -> approve -> transition(implementing)
 *         -> self-check/evidence stubs -> transition(reviewing)
 *         -> verification evidence stub -> transition(deciding)
 *         -> closure stub -> transition(passed)
 *
 *   blocked / escalated / cancelled branches, the
 *   reviewing -> implementing changes_requested loop (iteration bump),
 *   dependency gate, surface-conflict gate, and deterministic id
 *   generation via GEAS_MOCK_TASK_ID.
 *
 * G3's evidence-driven guards (implementing->reviewing, reviewing->deciding,
 * deciding->passed) check file presence only; G4 tightens them against
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
  // G4: self-check guard validates against the self-check schema.
  const body = {
    completed_work: 'stub implementation for test',
    reviewer_focus: [],
    known_risks: [],
    deviations_from_plan: [],
    gap_signals: [],
  };
  const res = runCli(
    ['self-check', 'append', '--mission', MID, '--task', taskId],
    { cwd: dir, input: JSON.stringify(body) },
  );
  if (res.status !== 0) {
    throw new Error(
      `self-check append failed: ${res.stderr}\n${res.stdout}`,
    );
  }
}

function writeReviewEvidenceStub(dir, taskId, agent, slot) {
  // G4: review evidence must have at least one review-kind entry with a
  // valid verdict.
  const body = {
    evidence_kind: 'review',
    summary: `stub review from ${agent}`,
    verdict: 'approved',
    concerns: [],
    rationale: 'stub review for test',
    scope_examined: 'stub scope',
    methods_used: ['stub method'],
    scope_excluded: [],
  };
  const res = runCli(
    [
      'evidence',
      'append',
      '--mission',
      MID,
      '--task',
      taskId,
      '--agent',
      agent,
      '--slot',
      slot,
    ],
    { cwd: dir, input: JSON.stringify(body) },
  );
  if (res.status !== 0) {
    throw new Error(
      `evidence append (${agent}.${slot}) failed: ${res.stderr}\n${res.stdout}`,
    );
  }
}

function writeImplContractStub(dir, taskId) {
  // Tier 0 preflight requires a schema-valid implementation-contract.json.
  const body = {
    summary: 'stub impl-contract for test',
    rationale: 'satisfy Tier 0 preflight',
    change_scope: ['src/cli/src/commands/task.ts'],
    planned_actions: ['advance lifecycle'],
    non_goals: [],
    alternatives_considered: [],
    assumptions: [],
    open_questions: [],
  };
  const res = runCli(
    ['impl-contract', 'set', '--mission', MID, '--task', taskId],
    { cwd: dir, input: JSON.stringify(body) },
  );
  if (res.status !== 0) {
    throw new Error(
      `impl-contract set failed: ${res.stderr}\n${res.stdout}`,
    );
  }
}

function writeVerifierEvidenceStub(dir, taskId, opts = {}) {
  // Tier 1 input: verifier evidence. approved verdict with all criteria
  // passed (matches contract.acceptance_criteria).
  const criteria = opts.criteria || ['lifecycle advances under CLI guards'];
  const verdict = opts.verdict || 'approved';
  const body = {
    evidence_kind: 'verification',
    summary: 'stub verifier entry for test',
    verdict,
    concerns: [],
    rationale: 'ran verification plan',
    scope_examined: 'all criteria per contract',
    methods_used: ['manual'],
    scope_excluded: [],
    criteria_results: criteria.map((c) => ({
      criterion: c,
      passed: verdict === 'approved',
      details: 'observed',
    })),
  };
  const res = runCli(
    [
      'evidence',
      'append',
      '--mission',
      MID,
      '--task',
      taskId,
      '--agent',
      opts.agent || 'qa-engineer',
      '--slot',
      'verifier',
    ],
    { cwd: dir, input: JSON.stringify(body) },
  );
  if (res.status !== 0) {
    throw new Error(
      `verifier evidence append failed: ${res.stderr}\n${res.stdout}`,
    );
  }
}

function runGatePass(dir, taskId) {
  // Gate computes tiers from files on disk; no stdin.
  const res = runCli(
    ['gate', 'run', '--mission', MID, '--task', taskId],
    { cwd: dir },
  );
  if (res.status !== 0) {
    throw new Error(`gate run failed: ${res.stderr}\n${res.stdout}`);
  }
  if (!res.json || res.json.data.verdict !== 'pass') {
    throw new Error(
      `gate run expected pass; got ${res.json && res.json.data.verdict}: ${res.stdout}`,
    );
  }
}

function writeClosureApproved(dir, taskId) {
  // G4: closure evidence is an entry with evidence_kind=closure and
  // verdict=approved in evidence/orchestrator.orchestrator.json.
  const body = {
    evidence_kind: 'closure',
    summary: 'G3 test closure stub',
    verdict: 'approved',
    rationale: 'all acceptance criteria satisfied',
    what_went_well: [],
    what_broke: [],
    what_was_surprising: [],
    next_time_guidance: [],
  };
  const res = runCli(
    [
      'evidence',
      'append',
      '--mission',
      MID,
      '--task',
      taskId,
      '--agent',
      'orchestrator',
      '--slot',
      'orchestrator',
    ],
    { cwd: dir, input: JSON.stringify(body) },
  );
  if (res.status !== 0) {
    throw new Error(
      `closure evidence append failed: ${res.stderr}\n${res.stdout}`,
    );
  }
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

test('9-state traversal drafted -> ready -> implementing -> reviewing -> deciding -> passed', () => {
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

    // implementing -> reviewing (needs impl-contract + self-check + review evidence for challenger)
    writeImplContractStub(dir, 'task-001');
    writeSelfCheckStub(dir, 'task-001');
    writeReviewEvidenceStub(dir, 'task-001', 'research-integrity-reviewer', 'challenger');
    r = runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'reviewing'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `implementing->reviewing failed: ${r.stderr}\n${r.stdout}`);

    // reviewing -> deciding (verifier evidence + gate run)
    writeVerifierEvidenceStub(dir, 'task-001');
    runGatePass(dir, 'task-001');
    r = runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'deciding'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `reviewing->deciding failed: ${r.stderr}\n${r.stdout}`);

    // deciding -> passed (needs closure approved)
    writeClosureApproved(dir, 'task-001');
    r = runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'passed'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `deciding->passed failed: ${r.stderr}\n${r.stdout}`);

    const state = readArtifact(
      dir,
      `.geas/missions/${MID}/tasks/task-001/task-state.json`,
    );
    assert.equal(state.status, 'passed');
  } finally {
    cleanup();
  }
});

test('implementing -> reviewing rejected without self-check', () => {
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
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'reviewing'],
      { cwd: dir },
    );
    assert.notEqual(res.status, 0);
    assert.equal(res.json.error.code, 'guard_failed');
    assert.match(res.json.error.message, /self-check/);
  } finally {
    cleanup();
  }
});

test('implementing -> reviewing allowed with only self-check — reviewer evidence is enforced by gate Tier 0 later', () => {
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
    // Intentionally no reviewer evidence — transition must still succeed.
    // Gate Tier 0 will enforce reviewer-evidence presence at gate run time.

    const res = runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'reviewing'],
      { cwd: dir },
    );
    assert.equal(res.status, 0, `transition should succeed: ${res.stderr}\n${res.stdout}`);
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

test('reviewing -> implementing (changes_requested) increments verify_fix_iterations', () => {
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
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'reviewing'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `implementing->reviewing failed: ${r.stderr}`);

    // Changes requested — go back to implementing.
    r = runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'implementing'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `reviewing->implementing failed: ${r.stderr}\n${r.stdout}`);

    const state = readArtifact(
      dir,
      `.geas/missions/${MID}/tasks/task-001/task-state.json`,
    );
    assert.equal(state.status, 'implementing');
    assert.equal(state.verify_fix_iterations, 1);

    // One more loop, iterations becomes 2.
    r = runCli(
      ['task', 'transition', '--mission', MID, '--task', 'task-001', '--to', 'reviewing'],
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

test('task deps remove drops listed deps and reports missing ones', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMissionApproved(dir);
    runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(
        draftContract({ dependencies: ['task-001', 'task-003'] }),
      ),
      env: { GEAS_MOCK_TASK_ID: 'task-002' },
    });
    // Remove one present + one absent. Present is dropped; absent reported.
    const r = runCli(
      ['task', 'deps', 'remove', '--mission', MID, '--task', 'task-002',
       '--deps', 'task-001,task-099'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `deps remove failed: ${r.stderr}`);
    assert.deepEqual(r.json.data.dependencies, ['task-003']);
    assert.deepEqual(r.json.data.removed, ['task-001']);
    assert.deepEqual(r.json.data.not_present, ['task-099']);

    // Re-running with the same args is idempotent: nothing removed, same list.
    const r2 = runCli(
      ['task', 'deps', 'remove', '--mission', MID, '--task', 'task-002',
       '--deps', 'task-001'],
      { cwd: dir },
    );
    assert.equal(r2.status, 0);
    assert.deepEqual(r2.json.data.dependencies, ['task-003']);
    assert.deepEqual(r2.json.data.removed, []);
    assert.deepEqual(r2.json.data.not_present, ['task-001']);
  } finally {
    cleanup();
  }
});

test('task deps remove rejects invalid task ids in --deps', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMissionApproved(dir);
    runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(draftContract()),
      env: { GEAS_MOCK_TASK_ID: 'task-002' },
    });
    const r = runCli(
      ['task', 'deps', 'remove', '--mission', MID, '--task', 'task-002',
       '--deps', 'not-a-task-id'],
      { cwd: dir },
    );
    assert.notEqual(r.status, 0);
    assert.equal(r.json.error.code, 'invalid_argument');
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

// ── T1 base-snapshot set ──────────────────────────────────────────────
//
// mission-20260427-xIPG1sDY task-001 / acceptance criterion T1.2.
// Validates the new `geas task base-snapshot set` subcommand:
//   (a) format-pass: 40-hex SHA mutates contract.base_snapshot + bumps
//       updated_at; the underlying write is atomic and the contract
//       still validates against the task-contract schema.
//   (b) format-fail: short SHA, oversize SHA, non-hex char, empty all
//       reject with invalid_argument and leave contract untouched.
//   (c) missing artifact: command on an unknown task surfaces
//       missing_artifact (not invalid_argument).
//   (d) no event: events.jsonl line count is identical before/after the
//       successful call (mission-design B2.1 — single-field mutation
//       policy mirrors `task deps add/remove`).

const VALID_SHA_LOWER = '1234567890abcdef1234567890abcdef12345678';
const VALID_SHA_UPPER = 'ABCDEF1234567890ABCDEF1234567890ABCDEF12';

function setupTaskInDrafted(dir, taskId = 'task-001') {
  setupMissionApproved(dir);
  const r = runCli(['task', 'draft', '--mission', MID], {
    cwd: dir,
    input: JSON.stringify(draftContract({ base_snapshot: 'initial-base' })),
    env: { GEAS_MOCK_TASK_ID: taskId },
  });
  assert.equal(r.status, 0, `draft failed: ${r.stderr}\n${r.stdout}`);
  return taskId;
}

function readEventsLineCount(dir) {
  const eventsPath = path.join(dir, '.geas', 'events.jsonl');
  if (!fs.existsSync(eventsPath)) return 0;
  const content = fs.readFileSync(eventsPath, 'utf-8');
  if (!content) return 0;
  return content.split('\n').filter((l) => l.length > 0).length;
}

test('task base-snapshot set accepts a 40-hex SHA and updates contract.base_snapshot', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    const tid = setupTaskInDrafted(dir);
    const res = runCli(
      [
        'task',
        'base-snapshot',
        'set',
        '--mission',
        MID,
        '--task',
        tid,
        '--base',
        VALID_SHA_LOWER,
      ],
      { cwd: dir },
    );
    assert.equal(res.status, 0, `set failed: ${res.stderr}\n${res.stdout}`);
    assert.equal(res.json.ok, true);
    assert.equal(res.json.data.base_snapshot, VALID_SHA_LOWER);

    const contract = readArtifact(
      dir,
      `.geas/missions/${MID}/tasks/${tid}/contract.json`,
    );
    assert.equal(contract.base_snapshot, VALID_SHA_LOWER);
    // updated_at should advance (was set by draft, then by set).
    assert.ok(typeof contract.updated_at === 'string' && contract.updated_at.length > 0);
  } finally {
    cleanup();
  }
});

test('task base-snapshot set accepts upper-case 40-hex SHA', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    const tid = setupTaskInDrafted(dir);
    const res = runCli(
      [
        'task',
        'base-snapshot',
        'set',
        '--mission',
        MID,
        '--task',
        tid,
        '--base',
        VALID_SHA_UPPER,
      ],
      { cwd: dir },
    );
    assert.equal(res.status, 0, `upper-case set failed: ${res.stderr}\n${res.stdout}`);
    const contract = readArtifact(
      dir,
      `.geas/missions/${MID}/tasks/${tid}/contract.json`,
    );
    assert.equal(contract.base_snapshot, VALID_SHA_UPPER);
  } finally {
    cleanup();
  }
});

test('task base-snapshot set rejects malformed SHAs without mutating the contract', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    const tid = setupTaskInDrafted(dir);
    const before = readArtifact(
      dir,
      `.geas/missions/${MID}/tasks/${tid}/contract.json`,
    );

    const badInputs = [
      '1234567890abcdef1234567890abcdef1234567', // 39 chars
      '1234567890abcdef1234567890abcdef123456789', // 41 chars
      '1234567890abcdef1234567890abcdef1234567g', // non-hex char 'g'
      'not-a-sha',
      '',
    ];
    for (const bad of badInputs) {
      const res = runCli(
        [
          'task',
          'base-snapshot',
          'set',
          '--mission',
          MID,
          '--task',
          tid,
          '--base',
          bad,
        ],
        { cwd: dir },
      );
      assert.notEqual(
        res.status,
        0,
        `bad SHA '${bad}' should be rejected (got status=${res.status})`,
      );
      assert.ok(res.json, `bad SHA '${bad}' should still emit JSON envelope`);
      assert.equal(res.json.ok, false);
      assert.equal(
        res.json.error.code,
        'invalid_argument',
        `bad SHA '${bad}' code mismatch`,
      );
    }

    const after = readArtifact(
      dir,
      `.geas/missions/${MID}/tasks/${tid}/contract.json`,
    );
    assert.equal(
      after.base_snapshot,
      before.base_snapshot,
      'rejected SHAs must leave base_snapshot unchanged',
    );
    assert.equal(
      after.updated_at,
      before.updated_at,
      'rejected SHAs must leave updated_at unchanged',
    );
  } finally {
    cleanup();
  }
});

test('task base-snapshot set surfaces missing_artifact for unknown task', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMissionApproved(dir);
    const res = runCli(
      [
        'task',
        'base-snapshot',
        'set',
        '--mission',
        MID,
        '--task',
        'task-999',
        '--base',
        VALID_SHA_LOWER,
      ],
      { cwd: dir },
    );
    assert.notEqual(res.status, 0);
    assert.ok(res.json);
    assert.equal(res.json.ok, false);
    assert.equal(res.json.error.code, 'missing_artifact');
  } finally {
    cleanup();
  }
});

test('task base-snapshot set does NOT append a new event (single-field mutation policy)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    const tid = setupTaskInDrafted(dir);
    const before = readEventsLineCount(dir);
    const res = runCli(
      [
        'task',
        'base-snapshot',
        'set',
        '--mission',
        MID,
        '--task',
        tid,
        '--base',
        VALID_SHA_LOWER,
      ],
      { cwd: dir },
    );
    assert.equal(res.status, 0, `set failed: ${res.stderr}\n${res.stdout}`);
    const after = readEventsLineCount(dir);
    assert.equal(
      after,
      before,
      `events.jsonl line count changed (${before} -> ${after}); base-snapshot set must not append events`,
    );
  } finally {
    cleanup();
  }
});
