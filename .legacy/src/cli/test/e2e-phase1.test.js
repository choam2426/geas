/**
 * Phase 1 End-to-End scenario test.
 *
 * This is the Phase 1 closure gate — it proves the v3 protocol runs end
 * to end through the CLI command surface without internal state
 * scaffolding beyond the CLI itself.
 *
 * Covers:
 *   1. Primary main-path scenario (setup → mission → tasks → phases → verdict → complete)
 *   2. Blocked path with a superseding task
 *   3. Verify-fix loop (changes_requested → rewind → iterate → pass)
 *   4. Full_depth deliberation allowed; standard deliberation rejected
 *
 * Each scenario is a separate test() for clear pass/fail isolation.
 *
 * Per `docs/ko/architecture/CLI.md` §14 and `docs/superpowers/specs/
 * 2026-04-20-migration-strategy-design.md` §3.8.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeTempRoot, runCli, readArtifact } = require('./helpers/setup');

// ── Helpers ─────────────────────────────────────────────────────────────

function baseSpec(overrides = {}) {
  return {
    name: 'Phase 1 E2E mission',
    description: 'End-to-end integration of the full Geas v3 protocol.',
    mode: 'standard',
    definition_of_done:
      'all phases advance via CLI guards; verdict issued; artifacts validate.',
    scope: {
      in: ['CLI-driven mission lifecycle', 'task lifecycle', 'consolidation'],
      out: ['external UI'],
    },
    acceptance_criteria: [
      'mission passes through specifying -> building -> polishing -> consolidating -> complete',
      'each task advances through the 9-state lifecycle under CLI guards',
      'consolidation writes debts / gap / memory-update',
      'final .geas tree matches the expected shape',
    ],
    constraints: ['no writes to .geas/ outside the CLI'],
    affected_surfaces: ['src/cli/'],
    risks: ['guard drift between groups breaks the end-to-end flow'],
    ...overrides,
  };
}

function baseContract(overrides = {}) {
  return {
    title: 'E2E task',
    goal: 'exercise an individual task through the full 9-state FSM',
    risk_level: 'normal',
    acceptance_criteria: ['task reaches passed status via CLI guards'],
    verification_plan: 'manual via the E2E integration test',
    surfaces: ['src/cli/'],
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

function validSelfCheck() {
  return {
    completed_work: 'landed the planned changes on the listed surfaces',
    reviewer_focus: [],
    known_risks: [],
    deviations_from_plan: [],
    gap_signals: [],
  };
}

function validReviewEntry(overrides = {}) {
  return {
    evidence_kind: 'review',
    summary: 'reviewed the implementation',
    verdict: 'approved',
    concerns: [],
    rationale: 'meets all acceptance criteria',
    scope_examined: 'all changed files',
    methods_used: ['code read-through'],
    scope_excluded: [],
    ...overrides,
  };
}

function validImplementationEntry(overrides = {}) {
  return {
    evidence_kind: 'implementation',
    summary: 'implemented the feature',
    ...overrides,
  };
}

function validImplContract(overrides = {}) {
  return {
    summary: 'implement the feature as scoped',
    rationale: 'required by the task contract',
    change_scope: ['src/cli/'],
    planned_actions: ['land planned changes', 'update tests'],
    non_goals: [],
    alternatives_considered: [],
    assumptions: [],
    open_questions: [],
    ...overrides,
  };
}

function validVerifierEntry(overrides = {}) {
  // verification-kind evidence: verdict=approved with all criteria passed.
  // Matches baseContract().acceptance_criteria by default.
  const {
    criteria = ['task reaches passed status via CLI guards'],
    verdict = 'approved',
    ...rest
  } = overrides;
  return {
    evidence_kind: 'verification',
    summary: 'verification ran cleanly',
    verdict,
    concerns: [],
    rationale: 'ran the verification plan; every criterion observed',
    scope_examined: 'workspace + outputs per verification_plan',
    methods_used: ['manual walk-through'],
    scope_excluded: [],
    criteria_results: criteria.map((c) => ({
      criterion: c,
      passed: verdict === 'approved',
      details: 'observed directly',
    })),
    ...rest,
  };
}

function validClosureEntry(overrides = {}) {
  return {
    evidence_kind: 'closure',
    summary: 'task closure by orchestrator',
    verdict: 'approved',
    rationale: 'all reviewers approved and gate passed',
    what_went_well: [],
    what_broke: [],
    what_was_surprising: [],
    next_time_guidance: [],
    ...overrides,
  };
}

// Legacy helpers (passingTierResults / failingTierResults) were removed
// when the gate was rewired to compute tier statuses from evidence files
// (see src/cli/src/commands/gate.ts). Tests build evidence that yields the
// target gate verdict instead of stubbing tier_results over stdin.

function setupMission(dir, missionId, specOverrides = {}) {
  let r = runCli(['setup'], { cwd: dir });
  assert.equal(r.status, 0, `setup failed: ${r.stderr}`);
  r = runCli(['mission', 'create'], {
    cwd: dir,
    input: JSON.stringify(baseSpec(specOverrides)),
    env: { GEAS_MOCK_MISSION_ID: missionId },
  });
  assert.equal(r.status, 0, `mission create failed: ${r.stderr}\n${r.stdout}`);
  r = runCli(['mission', 'approve', '--mission', missionId], { cwd: dir });
  assert.equal(r.status, 0, `mission approve failed: ${r.stderr}`);
}

function draftAndApproveTask(dir, missionId, taskId, contractOverrides = {}) {
  let r = runCli(['task', 'draft', '--mission', missionId], {
    cwd: dir,
    input: JSON.stringify(baseContract(contractOverrides)),
    env: { GEAS_MOCK_TASK_ID: taskId },
  });
  assert.equal(r.status, 0, `task draft ${taskId} failed: ${r.stderr}\n${r.stdout}`);
  r = runCli(['task', 'approve', '--mission', missionId, '--task', taskId], {
    cwd: dir,
  });
  assert.equal(r.status, 0, `task approve ${taskId} failed: ${r.stderr}`);
}

function transition(dir, missionId, taskId, to) {
  const r = runCli(
    ['task', 'transition', '--mission', missionId, '--task', taskId, '--to', to],
    { cwd: dir },
  );
  assert.equal(
    r.status,
    0,
    `transition ${taskId} -> ${to} failed: ${r.stderr}\n${r.stdout}`,
  );
  return r;
}

function fullTaskRun(dir, missionId, taskId, opts = {}) {
  // ready -> implementing
  transition(dir, missionId, taskId, 'implementing');

  // implementation contract (required for Tier 0 preflight)
  let r = runCli(
    ['impl-contract', 'set', '--mission', missionId, '--task', taskId],
    { cwd: dir, input: JSON.stringify(validImplContract()) },
  );
  assert.equal(r.status, 0, `impl-contract set failed: ${r.stderr}\n${r.stdout}`);

  // implementer evidence
  const implAgent = opts.implementer || 'software-engineer';
  r = runCli(
    [
      'evidence',
      'append',
      '--mission',
      missionId,
      '--task',
      taskId,
      '--agent',
      implAgent,
      '--slot',
      'implementer',
    ],
    { cwd: dir, input: JSON.stringify(validImplementationEntry()) },
  );
  assert.equal(r.status, 0, `implementer evidence failed: ${r.stderr}\n${r.stdout}`);

  // self-check
  r = runCli(
    ['self-check', 'append', '--mission', missionId, '--task', taskId],
    { cwd: dir, input: JSON.stringify(validSelfCheck()) },
  );
  assert.equal(r.status, 0, `self-check failed: ${r.stderr}\n${r.stdout}`);

  // Required reviewer evidence (challenger by default per baseContract).
  const reviewers = opts.reviewers || [
    { agent: 'challenger-a', slot: 'challenger' },
  ];
  for (const rv of reviewers) {
    r = runCli(
      [
        'evidence',
        'append',
        '--mission',
        missionId,
        '--task',
        taskId,
        '--agent',
        rv.agent,
        '--slot',
        rv.slot,
      ],
      { cwd: dir, input: JSON.stringify(validReviewEntry()) },
    );
    assert.equal(
      r.status,
      0,
      `reviewer evidence ${rv.agent}.${rv.slot} failed: ${r.stderr}\n${r.stdout}`,
    );
  }

  // verifier evidence (Tier 1 input — matches contract.acceptance_criteria)
  r = runCli(
    [
      'evidence',
      'append',
      '--mission',
      missionId,
      '--task',
      taskId,
      '--agent',
      opts.verifier || 'qa-engineer',
      '--slot',
      'verifier',
    ],
    {
      cwd: dir,
      input: JSON.stringify(
        validVerifierEntry({
          criteria: opts.acceptanceCriteria || [
            'task reaches passed status via CLI guards',
          ],
        }),
      ),
    },
  );
  assert.equal(r.status, 0, `verifier evidence failed: ${r.stderr}\n${r.stdout}`);

  // implementing -> reviewing
  transition(dir, missionId, taskId, 'reviewing');

  // gate run — no stdin; gate reads evidence files and computes tiers.
  // AC3 (task-006): --json envelope to inspect r.json.data.verdict.
  r = runCli(['--json', 'gate', 'run', '--mission', missionId, '--task', taskId], {
    cwd: dir,
  });
  assert.equal(r.status, 0, `gate run failed: ${r.stderr}\n${r.stdout}`);
  assert.equal(
    r.json.data.verdict,
    'pass',
    `gate verdict expected pass, got: ${JSON.stringify(r.json.data)}`,
  );

  // reviewing -> deciding
  transition(dir, missionId, taskId, 'deciding');

  // orchestrator closure evidence
  r = runCli(
    [
      'evidence',
      'append',
      '--mission',
      missionId,
      '--task',
      taskId,
      '--agent',
      'orchestrator',
      '--slot',
      'orchestrator',
    ],
    { cwd: dir, input: JSON.stringify(validClosureEntry()) },
  );
  assert.equal(r.status, 0, `closure append failed: ${r.stderr}\n${r.stdout}`);

  // deciding -> passed
  transition(dir, missionId, taskId, 'passed');

  const state = readArtifact(
    dir,
    `.geas/missions/${missionId}/tasks/${taskId}/task-state.json`,
  );
  assert.equal(state.status, 'passed');
}

function appendPhaseReview(dir, missionId, fromPhase, toPhase) {
  const r = runCli(['phase-review', 'append', '--mission', missionId], {
    cwd: dir,
    input: JSON.stringify({
      mission_phase: fromPhase,
      status: 'passed',
      summary: `${fromPhase} phase closed cleanly for E2E test`,
      next_phase: toPhase,
    }),
  });
  assert.equal(
    r.status,
    0,
    `phase-review ${fromPhase}->${toPhase} failed: ${r.stderr}\n${r.stdout}`,
  );
}

function advancePhase(dir, missionId, toPhase) {
  const r = runCli(
    ['mission-state', 'update', '--mission', missionId, '--phase', toPhase],
    { cwd: dir },
  );
  assert.equal(
    r.status,
    0,
    `phase advance -> ${toPhase} failed: ${r.stderr}\n${r.stdout}`,
  );
  return r;
}

// ── Primary E2E scenario ────────────────────────────────────────────────

test('E2E: full mission lifecycle (3 building tasks + polishing + consolidating + complete)', () => {
  const MID = 'mission-20260420-e2emain1';
  const { dir, cleanup } = makeTempRoot();
  try {
    // Step 1: `geas setup` creates the .geas/ skeleton.
    setupMission(dir, MID);

    // Confirm mission-state initial state is specifying.
    const initialState = readArtifact(
      dir,
      `.geas/missions/${MID}/mission-state.json`,
    );
    assert.equal(initialState.phase, 'specifying');

    // Confirm spec.user_approved flipped to true.
    const spec = readArtifact(dir, `.geas/missions/${MID}/spec.json`);
    assert.equal(spec.user_approved, true);

    // Step 4: three approved building tasks.
    draftAndApproveTask(dir, MID, 'task-001', {
      title: 'Building task 1',
      surfaces: ['surface-a'],
    });
    draftAndApproveTask(dir, MID, 'task-002', {
      title: 'Building task 2',
      surfaces: ['surface-b'],
    });
    draftAndApproveTask(dir, MID, 'task-003', {
      title: 'Building task 3',
      surfaces: ['surface-c'],
    });

    // Step 5: phase specifying -> building. Building guard does not need a
    // phase-review for its entry (that is a specifying->building rule);
    // approved-task-count >= 1 is the requirement.
    advancePhase(dir, MID, 'building');

    // Step 6: run each of the 3 tasks to passed.
    for (const tid of ['task-001', 'task-002', 'task-003']) {
      fullTaskRun(dir, MID, tid);
    }

    // Step 7: building -> polishing.
    appendPhaseReview(dir, MID, 'building', 'polishing');
    advancePhase(dir, MID, 'polishing');

    // Step 8: one polishing task through full lifecycle.
    draftAndApproveTask(dir, MID, 'task-004', {
      title: 'Polishing task',
      surfaces: ['docs'],
    });
    // A polishing task needs the normal ready-entry path. approved -> ready.
    // But task-004 is drafted+approved inside polishing phase, so we need
    // to drive it via the lifecycle like any other task.
    fullTaskRun(dir, MID, 'task-004');

    // Step 9: polishing -> consolidating.
    appendPhaseReview(dir, MID, 'polishing', 'consolidating');
    advancePhase(dir, MID, 'consolidating');

    // Step 10a: scaffold consolidation candidates. Walks task evidence and
    // writes missions/{mid}/consolidation/candidates.json (the support file
    // the dashboard reads and the convening of later promotion steps
    // consults). This used to be skipped by the E2E, leaving the
    // mission-scoped candidates path untested even though the dashboard
    // depends on it.
    let r = runCli(['consolidation', 'scaffold', '--mission', MID], {
      cwd: dir,
    });
    assert.equal(
      r.status,
      0,
      `consolidation scaffold failed: ${r.stderr}\n${r.stdout}`,
    );
    const candidates = readArtifact(
      dir,
      `.geas/missions/${MID}/consolidation/candidates.json`,
    );
    assert.ok(
      Array.isArray(candidates.debt_candidates),
      'scaffold should populate debt_candidates array',
    );

    // Step 10b: consolidating — debts, gap, memory-update, memory writes.
    // AC3 (task-006): --json envelope for programmatic assertion.
    r = runCli(['--json', 'debt', 'register'], {
      cwd: dir,
      input: JSON.stringify({
        severity: 'normal',
        kind: 'verification_gap',
        title: 'cover-later integration scenario',
        description:
          'the E2E scenario surfaced a gap in integration coverage for x',
        introduced_by: { mission_id: MID, task_id: 'task-001' },
      }),
    });
    assert.equal(r.status, 0, `debt register failed: ${r.stderr}\n${r.stdout}`);
    assert.equal(r.json.data.ids.debt_id, 'debt-001');

    r = runCli(['gap', 'set', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify({
        scope_in_summary: 'all planned tasks passed',
        scope_out_summary: 'future polish deferred to next mission',
        fully_delivered: ['task-001', 'task-002', 'task-003', 'task-004'],
        partially_delivered: [],
        not_delivered: [],
        unexpected_additions: [],
      }),
    });
    assert.equal(r.status, 0, `gap set failed: ${r.stderr}\n${r.stdout}`);

    r = runCli(['memory-update', 'set', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify({
        shared: {
          added: [
            {
              memory_id: 'e2e-learning',
              reason: 'phase 1 end-to-end scenario validated the 9-state FSM',
              evidence_refs: ['test/e2e-phase1.test.js'],
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
                memory_id: 'use-gate-run',
                reason: 'gate run is the only verification evidence path',
                evidence_refs: [],
              },
            ],
            removed: [],
          },
        ],
      }),
    });
    assert.equal(
      r.status,
      0,
      `memory-update set failed: ${r.stderr}\n${r.stdout}`,
    );

    // Shared + agent memory writes.
    r = runCli(['memory', 'shared-set'], {
      cwd: dir,
      input:
        '# Shared memory\n\n' +
        '## e2e-learning — the FSM enforces ordering\n\n' +
        'Body paragraph.\n',
    });
    assert.equal(r.status, 0, `memory shared-set failed: ${r.stderr}`);

    r = runCli(['memory', 'agent-set', '--agent', 'software-engineer'], {
      cwd: dir,
      input:
        '# software-engineer memory\n\n' +
        '- use gate run for verification evidence\n',
    });
    assert.equal(r.status, 0, `memory agent-set failed: ${r.stderr}`);

    // Step 11: mission-verdict.
    r = runCli(['mission-verdict', 'append', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify({
        verdict: 'approved',
        rationale:
          'all acceptance criteria met; debts + gap + memory captured for carry-over',
        carry_forward: ['debt-001'],
      }),
    });
    assert.equal(
      r.status,
      0,
      `mission-verdict append failed: ${r.stderr}\n${r.stdout}`,
    );

    // Step 12: consolidating -> complete.
    appendPhaseReview(dir, MID, 'consolidating', 'complete');
    advancePhase(dir, MID, 'complete');

    const finalState = readArtifact(
      dir,
      `.geas/missions/${MID}/mission-state.json`,
    );
    assert.equal(finalState.phase, 'complete');

    // Step 13: .geas/ tree shape assertion.
    const geasRoot = path.join(dir, '.geas');
    // Top-level project artifacts. (No `.geas/candidates.json` — consolidation
    // candidates are mission-scoped; see missions/{id}/consolidation/ below.)
    for (const p of [
      'config.json',
      'debts.json',
      'events.jsonl',
      'memory/shared.md',
      'memory/agents/software-engineer.md',
    ]) {
      assert.ok(
        fs.existsSync(path.join(geasRoot, p)),
        `expected ${p} to exist in .geas/ tree`,
      );
    }
    assert.ok(
      !fs.existsSync(path.join(geasRoot, 'candidates.json')),
      '.geas/candidates.json (top-level) should not exist — consolidation candidates are mission-scoped',
    );

    // Mission-level artifacts.
    const missionRoot = path.join(geasRoot, 'missions', MID);
    for (const p of [
      'spec.json',
      'mission-state.json',
      'phase-reviews.json',
      'mission-verdicts.json',
      'deliberations.json',
      'consolidation/candidates.json',
      'consolidation/gap.json',
      'consolidation/memory-update.json',
    ]) {
      assert.ok(
        fs.existsSync(path.join(missionRoot, p)),
        `expected ${p} to exist for mission ${MID}`,
      );
    }

    // Per-task artifacts exist for every task.
    for (const tid of ['task-001', 'task-002', 'task-003', 'task-004']) {
      const tRoot = path.join(missionRoot, 'tasks', tid);
      for (const p of [
        'contract.json',
        'task-state.json',
        'self-check.json',
        'gate-results.json',
        'deliberations.json',
        'evidence/software-engineer.implementer.json',
        'evidence/challenger-a.challenger.json',
        'evidence/orchestrator.orchestrator.json',
      ]) {
        assert.ok(
          fs.existsSync(path.join(tRoot, p)),
          `expected ${p} to exist for ${tid}`,
        );
      }
    }

    // Debts registered at project level (not under a mission).
    const debts = readArtifact(dir, '.geas/debts.json');
    assert.equal(debts.entries.length, 1);
    assert.equal(debts.entries[0].introduced_by.mission_id, MID);

    // Mission verdict persisted.
    const verdicts = readArtifact(
      dir,
      `.geas/missions/${MID}/mission-verdicts.json`,
    );
    assert.equal(verdicts.verdicts.length, 1);
    assert.equal(verdicts.verdicts[0].verdict, 'approved');

    // Phase review log contains the reviews we appended.
    const phaseReviews = readArtifact(
      dir,
      `.geas/missions/${MID}/phase-reviews.json`,
    );
    const transitions = phaseReviews.reviews.map(
      (rv) => `${rv.mission_phase}->${rv.next_phase}`,
    );
    assert.deepEqual(
      transitions,
      ['building->polishing', 'polishing->consolidating', 'consolidating->complete'],
      'phase-reviews log must match the phase transitions we drove',
    );
  } finally {
    cleanup();
  }
});

// ── Blocked-path scenario ───────────────────────────────────────────────

test('E2E blocked path: task blocked -> cancelled, superseding task completes to passed', () => {
  const MID = 'mission-20260420-e2eblock';
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);

    // Original task.
    draftAndApproveTask(dir, MID, 'task-001', {
      title: 'Original task',
      surfaces: ['surface-x'],
    });
    advancePhase(dir, MID, 'building');

    // Drive to implementing, then blocked.
    transition(dir, MID, 'task-001', 'implementing');
    transition(dir, MID, 'task-001', 'blocked');

    let state = readArtifact(
      dir,
      `.geas/missions/${MID}/tasks/task-001/task-state.json`,
    );
    assert.equal(state.status, 'blocked');

    // Orchestrator creates a superseding task.
    let r = runCli(['task', 'draft', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify(
        baseContract({
          title: 'Replacement task',
          surfaces: ['surface-x'],
          supersedes: 'task-001',
        }),
      ),
      env: { GEAS_MOCK_TASK_ID: 'task-002' },
    });
    assert.equal(r.status, 0, `superseding draft failed: ${r.stderr}\n${r.stdout}`);
    r = runCli(['task', 'approve', '--mission', MID, '--task', 'task-002'], {
      cwd: dir,
    });
    assert.equal(r.status, 0, `superseding approve failed: ${r.stderr}`);

    const contract = readArtifact(
      dir,
      `.geas/missions/${MID}/tasks/task-002/contract.json`,
    );
    assert.equal(contract.supersedes, 'task-001');

    // Cancel the blocked original task now that a replacement exists.
    transition(dir, MID, 'task-001', 'cancelled');
    state = readArtifact(
      dir,
      `.geas/missions/${MID}/tasks/task-001/task-state.json`,
    );
    assert.equal(state.status, 'cancelled');

    // Drive task-002 to passed via the full lifecycle.
    fullTaskRun(dir, MID, 'task-002');

    // Advance phases to complete to confirm the mission isn't stuck.
    appendPhaseReview(dir, MID, 'building', 'polishing');
    advancePhase(dir, MID, 'polishing');
    appendPhaseReview(dir, MID, 'polishing', 'consolidating');
    advancePhase(dir, MID, 'consolidating');

    // Minimal consolidation artifacts so consolidating->complete passes.
    r = runCli(['gap', 'set', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify({
        scope_in_summary: 'replacement task delivered scope after block',
        scope_out_summary: 'nothing deferred',
        fully_delivered: ['task-002'],
        partially_delivered: [],
        not_delivered: [],
        unexpected_additions: ['task-001 cancelled due to block'],
      }),
    });
    assert.equal(r.status, 0, r.stderr);
    r = runCli(['memory-update', 'set', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify({}),
    });
    assert.equal(r.status, 0, r.stderr);
    r = runCli(['mission-verdict', 'append', '--mission', MID], {
      cwd: dir,
      input: JSON.stringify({
        verdict: 'approved',
        rationale: 'replacement delivered despite original block',
        carry_forward: [],
      }),
    });
    assert.equal(r.status, 0, r.stderr);
    appendPhaseReview(dir, MID, 'consolidating', 'complete');
    advancePhase(dir, MID, 'complete');

    const finalMissionState = readArtifact(
      dir,
      `.geas/missions/${MID}/mission-state.json`,
    );
    assert.equal(finalMissionState.phase, 'complete');
  } finally {
    cleanup();
  }
});

// ── Verify-fix loop scenario ────────────────────────────────────────────

test('E2E verify-fix loop: reviewing -> implementing increments verify_fix_iterations', () => {
  const MID = 'mission-20260420-e2everif';
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    draftAndApproveTask(dir, MID, 'task-001', {
      title: 'Verify-fix task',
      surfaces: ['surface-y'],
    });
    advancePhase(dir, MID, 'building');

    // First round: ready -> implementing -> reviewing.
    transition(dir, MID, 'task-001', 'implementing');

    // impl-contract (Tier 0 preflight input)
    let r = runCli(
      ['impl-contract', 'set', '--mission', MID, '--task', 'task-001'],
      { cwd: dir, input: JSON.stringify(validImplContract()) },
    );
    assert.equal(r.status, 0, `impl-contract failed: ${r.stderr}\n${r.stdout}`);

    r = runCli(
      [
        'evidence',
        'append',
        '--mission',
        MID,
        '--task',
        'task-001',
        '--agent',
        'software-engineer',
        '--slot',
        'implementer',
      ],
      { cwd: dir, input: JSON.stringify(validImplementationEntry()) },
    );
    assert.equal(r.status, 0);
    r = runCli(
      ['self-check', 'append', '--mission', MID, '--task', 'task-001'],
      { cwd: dir, input: JSON.stringify(validSelfCheck()) },
    );
    assert.equal(r.status, 0);

    // Reviewer: first time, changes_requested.
    r = runCli(
      [
        'evidence',
        'append',
        '--mission',
        MID,
        '--task',
        'task-001',
        '--agent',
        'challenger-a',
        '--slot',
        'challenger',
      ],
      {
        cwd: dir,
        input: JSON.stringify(
          validReviewEntry({
            verdict: 'changes_requested',
            rationale: 'first pass has gaps',
            concerns: ['missing X'],
          }),
        ),
      },
    );
    assert.equal(r.status, 0);

    // Verifier: approved (so Tier 1 passes; Tier 2 carries the fail).
    r = runCli(
      [
        'evidence',
        'append',
        '--mission',
        MID,
        '--task',
        'task-001',
        '--agent',
        'qa-engineer',
        '--slot',
        'verifier',
      ],
      { cwd: dir, input: JSON.stringify(validVerifierEntry()) },
    );
    assert.equal(r.status, 0);

    transition(dir, MID, 'task-001', 'reviewing');

    // Gate run: tier 2 reviewer=changes_requested → overall fail.
    // AC3 (task-006): --json envelope to inspect r.json.data.verdict.
    r = runCli(['--json', 'gate', 'run', '--mission', MID, '--task', 'task-001'], {
      cwd: dir,
    });
    assert.equal(r.status, 0);
    assert.equal(r.json.data.verdict, 'fail');

    // Rewind: reviewing -> implementing; iteration counter bumps.
    transition(dir, MID, 'task-001', 'implementing');
    let state = readArtifact(
      dir,
      `.geas/missions/${MID}/tasks/task-001/task-state.json`,
    );
    assert.equal(state.verify_fix_iterations, 1);

    // Second round: fresh implementation evidence + an approved review.
    r = runCli(
      [
        'evidence',
        'append',
        '--mission',
        MID,
        '--task',
        'task-001',
        '--agent',
        'software-engineer',
        '--slot',
        'implementer',
      ],
      {
        cwd: dir,
        input: JSON.stringify(
          validImplementationEntry({ summary: 'addressed first-round concerns' }),
        ),
      },
    );
    assert.equal(r.status, 0);

    r = runCli(
      [
        'evidence',
        'append',
        '--mission',
        MID,
        '--task',
        'task-001',
        '--agent',
        'challenger-a',
        '--slot',
        'challenger',
      ],
      {
        cwd: dir,
        input: JSON.stringify(
          validReviewEntry({
            verdict: 'approved',
            rationale: 'concerns addressed on second pass',
          }),
        ),
      },
    );
    assert.equal(r.status, 0);

    transition(dir, MID, 'task-001', 'reviewing');

    // Second gate run: reviewer now approved, verifier still approved from
    // first round → Tier 1 pass, Tier 2 pass, overall pass.
    // AC3 (task-006): --json envelope to inspect r.json.data.verdict.
    r = runCli(['--json', 'gate', 'run', '--mission', MID, '--task', 'task-001'], {
      cwd: dir,
    });
    assert.equal(r.status, 0);
    assert.equal(r.json.data.verdict, 'pass');

    transition(dir, MID, 'task-001', 'deciding');

    r = runCli(
      [
        'evidence',
        'append',
        '--mission',
        MID,
        '--task',
        'task-001',
        '--agent',
        'orchestrator',
        '--slot',
        'orchestrator',
      ],
      { cwd: dir, input: JSON.stringify(validClosureEntry()) },
    );
    assert.equal(r.status, 0);

    transition(dir, MID, 'task-001', 'passed');
    state = readArtifact(
      dir,
      `.geas/missions/${MID}/tasks/task-001/task-state.json`,
    );
    assert.equal(state.status, 'passed');
    assert.equal(state.verify_fix_iterations, 1);

    // Gate-results has both runs, first fail and second pass.
    const gate = readArtifact(
      dir,
      `.geas/missions/${MID}/tasks/task-001/gate-results.json`,
    );
    assert.equal(gate.runs.length, 2);
    assert.equal(gate.runs[0].verdict, 'fail');
    assert.equal(gate.runs[1].verdict, 'pass');
  } finally {
    cleanup();
  }
});

// ── Full_depth deliberation scenario ────────────────────────────────────

test('E2E deliberation: full_depth accepts; standard rejects', () => {
  const MID_FULL = 'mission-20260420-e2efulld';
  const MID_STD = 'mission-20260420-e2estand';

  // Full_depth path.
  const full = makeTempRoot();
  try {
    setupMission(full.dir, MID_FULL, { mode: 'full_depth' });
    draftAndApproveTask(full.dir, MID_FULL, 'task-001');
    advancePhase(full.dir, MID_FULL, 'building');
    transition(full.dir, MID_FULL, 'task-001', 'implementing');

    const entry = {
      proposal_summary: 'should the task advance to reviewing now?',
      votes: [
        { voter: 'challenger', vote: 'agree', rationale: 'acceptable' },
        { voter: 'risk-assessor', vote: 'agree', rationale: 'risk low' },
        { voter: 'operator', vote: 'agree', rationale: 'ops ok' },
      ],
      result: 'agree',
    };
    // AC3 (task-006): --json envelope for programmatic assertion.
    const r = runCli(
      [
        '--json',
        'deliberation',
        'append',
        '--mission',
        MID_FULL,
        '--level',
        'task',
        '--task',
        'task-001',
      ],
      { cwd: full.dir, input: JSON.stringify(entry) },
    );
    assert.equal(r.status, 0, `full_depth deliberation failed: ${r.stderr}\n${r.stdout}`);
    assert.equal(r.json.data.result, 'agree');

    const delib = readArtifact(
      full.dir,
      `.geas/missions/${MID_FULL}/tasks/task-001/deliberations.json`,
    );
    assert.equal(delib.entries.length, 1);
  } finally {
    full.cleanup();
  }

  // Standard path (rejected).
  const std = makeTempRoot();
  try {
    setupMission(std.dir, MID_STD, { mode: 'standard' });
    draftAndApproveTask(std.dir, MID_STD, 'task-001');

    const entry = {
      proposal_summary: 'should we escalate?',
      votes: [
        { voter: 'challenger', vote: 'agree', rationale: 'yes' },
        { voter: 'decision-maker', vote: 'agree', rationale: 'yes' },
      ],
      result: 'agree',
    };
    // AC3 (task-006): --json envelope for programmatic assertion.
    const r = runCli(
      [
        '--json',
        'deliberation',
        'append',
        '--mission',
        MID_STD,
        '--level',
        'task',
        '--task',
        'task-001',
      ],
      { cwd: std.dir, input: JSON.stringify(entry) },
    );
    assert.notEqual(r.status, 0);
    assert.equal(r.json.error.code, 'guard_failed');
    assert.match(r.json.error.message, /full_depth/);
  } finally {
    std.cleanup();
  }
});
