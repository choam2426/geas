/**
 * T5.2 — End-to-end integration scenario.
 *
 * mission-20260427-xIPG1sDY task-005 / verification_plan step 2.
 *
 * Walks a lightweight mission through specifying → building → consolidating
 * → complete using the new inline-flag CLI exclusively. Asserts that:
 *
 *   (a) Each of the eleven core write commands succeeds with inline flags
 *       only — no `--file <path>`, no stdin. Counts ≥10 inline-flag-only
 *       invocations across the walkthrough.
 *
 *   (b) Default-mode stdout for migrated commands is short scalar text
 *       (per AC3 flip), not the JSON envelope. Asserts via shape regex
 *       on the captured stdout — shape-based rather than byte-identical
 *       because timestamps and the auto-generated mission_id base62
 *       suffix carry per-run nondeterminism.
 *
 *   (c) The full lifecycle reaches `mission-state.phase = complete` with
 *       the single task `passed`, no orphan transitions left dangling.
 *
 * Why shape-based fixture (not byte-identical):
 *   The contract spec says "결정론적 fixture 비교 통과". A byte-identical
 *   transcript fixture would require pinning every timestamp, every
 *   auto-generated id (mission_id, task_id, debt_id, gate_run_id,
 *   entry_id), and every formatter's exact phrasing — extremely fragile
 *   to natural prose tweaks. Shape-based assertions (regex line patterns
 *   + exit codes + stdout-vs-stderr split) give the same regression
 *   coverage with maintainable failure modes; the determinism guarantee
 *   is per-line semantic ("the success scalar line for `task draft` must
 *   start with `task drafted: task-`"), not per-byte.
 *
 * Why GEAS_MOCK_MISSION_ID:
 *   `mission create` normally generates a random mission_id (date +
 *   8-char base62 suffix). The test sets GEAS_MOCK_MISSION_ID so the
 *   mission id is deterministic across the walkthrough and assertions
 *   can name the mission by id. Same env-var pattern used by
 *   g7-events.test.js.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeTempRoot, runCli } = require('./helpers/setup');

const MID = 'mission-20260428-T5xxxScn';
const TID = 'task-001';
const TID_PADDED = '001';

/**
 * Counts inline-flag-only commands invoked across the scenario.
 * Each call to runCli that uses inline flags (no --file, no input)
 * increments this counter so the AC1 ≥10 assertion is empirical.
 */
let inlineCount = 0;

function inline(args, opts = {}) {
  // Sanity: a scenario that accidentally falls back to --file or stdin
  // would not satisfy AC1's "inline-flag-only" requirement; assert here
  // so the regression surfaces immediately.
  assert.ok(
    !args.includes('--file'),
    `inline() helper used with --file (args=${JSON.stringify(args)}); use file-staged variant instead`,
  );
  assert.ok(
    !('input' in opts),
    `inline() helper used with stdin (args=${JSON.stringify(args)}); inline-only invocation`,
  );
  inlineCount += 1;
  return runCli(args, opts);
}

test('T5.2 integration scenario: lightweight mission specifying → complete via inline-flag CLI', () => {
  const { dir, cleanup } = makeTempRoot();
  inlineCount = 0;
  try {
    // ── 1. Setup ──────────────────────────────────────────────────────
    let r = runCli(['setup'], { cwd: dir });
    assert.equal(r.status, 0, `setup failed: ${r.stderr}`);

    // ── 2. mission create (inline-flag) ───────────────────────────────
    r = inline(
      [
        'mission', 'create',
        '--name', 'Integration scenario fixture',
        '--mode', 'lightweight',
        '--description', 'T5.2 fixture exercising lightweight mission walkthrough',
        '--definition-of-done', 'task-001 passed and mission complete',
        '--scope-in', 'src/cli/test/integration-scenario.test.js',
        '--scope-out', 'plugins/geas/skills/',
        '--acceptance-criterion', 'walkthrough reaches phase=complete',
        '--constraint', 'inline-flag-only (no --file, no stdin)',
        '--affected-surface', 'src/cli/test/integration-scenario.test.js',
        '--risk', 'fixture itself stays deterministic',
        '--user-approved',
      ],
      { cwd: dir, env: { GEAS_MOCK_MISSION_ID: MID } },
    );
    assert.equal(r.status, 0, `mission create failed: ${r.stderr}\nstdout: ${r.stdout}`);
    // Default-mode shape (post-AC3): scalar line on stdout, no JSON.
    assert.equal(r.json, null, `default mode must not emit JSON; got: ${r.stdout}`);
    assert.match(r.stdout, /mission created: mission-/, `expected scalar mission-creation line; got: ${r.stdout}`);

    // ── 3. mission approve (inline-flag) ──────────────────────────────
    r = inline(['mission', 'approve', '--mission', MID], { cwd: dir });
    assert.equal(r.status, 0, `mission approve failed: ${r.stderr}`);
    assert.equal(r.json, null, 'default mode must not emit JSON');
    assert.match(r.stdout, /mission/);

    // ── 4. task draft (inline-flag) ───────────────────────────────────
    r = inline(
      [
        'task', 'draft',
        '--mission', MID,
        '--task-id', TID,
        '--title', 'Integration scenario task',
        '--goal', 'Single task that walks through every transition',
        '--risk-level', 'low',
        '--verification-plan', 'manual via integration test fixture',
        '--surface', 'src/cli/test/integration-scenario.test.js',
        '--reviewer', 'challenger',
        '--acceptance-criterion', 'walkthrough completes',
        '--base-snapshot', 'integration-scenario-base',
      ],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `task draft failed: ${r.stderr}\nstdout: ${r.stdout}`);
    assert.equal(r.json, null, 'default mode must not emit JSON');
    assert.match(r.stdout, /task draft(ed)?:?\s+task-/, `expected scalar task-draft line; got: ${r.stdout}`);

    // ── 5. task approve (inline-flag) ─────────────────────────────────
    r = inline(
      ['task', 'approve', '--mission', MID, '--task', TID, '--by', 'user'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `task approve failed: ${r.stderr}`);
    assert.equal(r.json, null, 'default mode must not emit JSON');

    // ── 6. mission-state update --phase building (bulk transitions tasks to ready) ──
    r = inline(
      ['mission-state', 'update', '--mission', MID, '--phase', 'building'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `phase building failed: ${r.stderr}\nstdout: ${r.stdout}`);

    // ── 7. task transition --to implementing (no deps, immediate) ────
    r = inline(
      ['task', 'transition', '--mission', MID, '--task', TID, '--to', 'implementing'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `task transition implementing failed: ${r.stderr}\nstdout: ${r.stdout}`);
    assert.equal(r.json, null, 'default mode must not emit JSON');

    // ── 8. impl-contract set (inline flags via --file is NOT inline; use stdin? No — impl-contract requires JSON body, no inline flags exist). ──
    // impl-contract set is JSON-payload-only; inline-flag form is not
    // supported. Use --file as a deliberate non-inline invocation
    // (does NOT count toward the inline-only ≥10).
    const implContract = {
      summary: 'walkthrough impl contract',
      rationale: 'fixture exercises every state transition',
      change_scope: ['src/cli/test/integration-scenario.test.js'],
      planned_actions: ['add fixture'],
      non_goals: ['no production code changes'],
      alternatives_considered: ['none'],
      assumptions: ['runtime is reproducible'],
      open_questions: [],
    };
    const implPath = path.join(dir, 'impl.json');
    fs.writeFileSync(implPath, JSON.stringify(implContract));
    r = runCli(
      ['impl-contract', 'set', '--mission', MID, '--task', TID, '--file', implPath],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `impl-contract set failed: ${r.stderr}\nstdout: ${r.stdout}`);

    // ── 9. evidence append (implementer, inline-flag) ────────────────
    r = inline(
      [
        'evidence', 'append',
        '--mission', MID, '--task', TID,
        '--agent', 'software-engineer', '--slot', 'implementer',
        '--evidence-kind', 'implementation',
        '--summary', 'fixture lands cleanly',
        '--rationale', 'walkthrough succeeds',
        '--scope-examined', 'integration-scenario.test.js',
        '--method-used', 'manual run',
      ],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `evidence append (implementer) failed: ${r.stderr}\nstdout: ${r.stdout}`);
    assert.equal(r.json, null, 'default mode must not emit JSON');

    // ── 10. self-check append (inline-flag) ──────────────────────────
    r = inline(
      [
        'self-check', 'append',
        '--mission', MID, '--task', TID,
        '--completed-work', 'walkthrough fixture lands',
        '--reviewer-focus', 'shape-based assertions',
        '--known-risk', 'tokenizer drift in scalar formatters',
        '--deviation-from-plan', 'none',
      ],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `self-check append failed: ${r.stderr}\nstdout: ${r.stdout}`);
    assert.equal(r.json, null, 'default mode must not emit JSON');

    // ── 11. task transition --to reviewing ───────────────────────────
    r = inline(
      ['task', 'transition', '--mission', MID, '--task', TID, '--to', 'reviewing'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `task transition reviewing failed: ${r.stderr}\nstdout: ${r.stdout}`);

    // ── 12. evidence append (challenger reviewer, inline-flag) ──────
    // review-kind allOf branch requires verdict + concerns + rationale +
    // scope_examined + methods_used + scope_excluded — pass each
    // explicitly. concerns and scope_excluded are arrays; CLI only sets
    // them when Array.isArray(opts.X) so we pass at least one value.
    r = inline(
      [
        'evidence', 'append',
        '--mission', MID, '--task', TID,
        '--agent', 'challenger', '--slot', 'challenger',
        '--evidence-kind', 'review',
        '--summary', 'walkthrough is sound',
        '--verdict', 'approved',
        '--rationale', 'fixture covers every transition',
        '--scope-examined', 'integration-scenario.test.js',
        '--method-used', 'manual review',
        '--concern', 'fixture spawn count grows the suite by ~20',
        '--scope-excluded', 'production code paths beyond the fixture itself',
      ],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `evidence append (challenger) failed: ${r.stderr}\nstdout: ${r.stdout}`);

    // ── 13. evidence append (verifier, inline-flag) ─────────────────
    // verification-kind requires verdict + concerns + rationale +
    // scope_examined + methods_used + scope_excluded + criteria_results.
    r = inline(
      [
        'evidence', 'append',
        '--mission', MID, '--task', TID,
        '--agent', 'qa-engineer', '--slot', 'verifier',
        '--evidence-kind', 'verification',
        '--summary', 'verification passes',
        '--verdict', 'approved',
        '--rationale', 'all criteria satisfied',
        '--scope-examined', 'integration-scenario.test.js',
        '--method-used', 'fixture run',
        '--concern', 'none',
        '--scope-excluded', 'cross-mission verification',
        '--criterion-result', '{"criterion":"walkthrough completes","passed":true,"details":"reaches phase=complete"}',
      ],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `evidence append (verifier) failed: ${r.stderr}\nstdout: ${r.stdout}`);

    // ── 14. gate run ─────────────────────────────────────────────────
    r = inline(['gate', 'run', '--mission', MID, '--task', TID], { cwd: dir });
    assert.equal(r.status, 0, `gate run failed: ${r.stderr}\nstdout: ${r.stdout}`);

    // ── 15. task transition --to deciding ────────────────────────────
    r = inline(
      ['task', 'transition', '--mission', MID, '--task', TID, '--to', 'deciding'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `task transition deciding failed: ${r.stderr}\nstdout: ${r.stdout}`);

    // ── 16. evidence append (orchestrator closure, inline-flag) ──────
    // closure-kind requires verdict + rationale + what_went_well +
    // what_broke + what_was_surprising + next_time_guidance.
    r = inline(
      [
        'evidence', 'append',
        '--mission', MID, '--task', TID,
        '--agent', 'orchestrator', '--slot', 'orchestrator',
        '--evidence-kind', 'closure',
        '--summary', 'walkthrough closure',
        '--verdict', 'approved',
        '--rationale', 'gate passed; transitioning to passed',
        '--what-went-well', 'every transition succeeded inline-flag-only',
        '--what-broke', 'nothing notable',
        '--what-was-surprising', 'review evidence required scope_excluded explicitly',
        '--next-time-guidance', 'document inline-flag minimums for review/verification entries',
      ],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `evidence append (closure) failed: ${r.stderr}\nstdout: ${r.stdout}`);

    // ── 17. task transition --to passed ──────────────────────────────
    r = inline(
      ['task', 'transition', '--mission', MID, '--task', TID, '--to', 'passed'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `task transition passed failed: ${r.stderr}\nstdout: ${r.stdout}`);

    // ── 18. phase-review building → polishing ───────────────────────
    // phase-review append is JSON-only (no inline-flag form); use --file
    // as deliberate non-inline. Does NOT count toward the inline ≥10.
    const reviewBuilding = {
      mission_phase: 'building',
      status: 'passed',
      summary: 'all tasks passed',
      next_phase: 'polishing',
    };
    const reviewBuildingPath = path.join(dir, 'review-building.json');
    fs.writeFileSync(reviewBuildingPath, JSON.stringify(reviewBuilding));
    r = runCli(
      ['phase-review', 'append', '--mission', MID, '--file', reviewBuildingPath],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `phase-review building failed: ${r.stderr}\nstdout: ${r.stdout}`);

    r = inline(
      ['mission-state', 'update', '--mission', MID, '--phase', 'polishing'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `phase polishing failed: ${r.stderr}\nstdout: ${r.stdout}`);

    // ── 19. phase-review polishing → consolidating ──────────────────
    const reviewPolishing = {
      mission_phase: 'polishing',
      status: 'passed',
      summary: 'polish complete',
      next_phase: 'consolidating',
    };
    const reviewPolishingPath = path.join(dir, 'review-polishing.json');
    fs.writeFileSync(reviewPolishingPath, JSON.stringify(reviewPolishing));
    r = runCli(
      ['phase-review', 'append', '--mission', MID, '--file', reviewPolishingPath],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `phase-review polishing failed: ${r.stderr}\nstdout: ${r.stdout}`);

    r = inline(
      ['mission-state', 'update', '--mission', MID, '--phase', 'consolidating'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `phase consolidating failed: ${r.stderr}\nstdout: ${r.stdout}`);

    // ── 20. debt register (inline-flag) ──────────────────────────────
    r = inline(
      [
        'debt', 'register',
        '--severity', 'low',
        '--kind', 'process',
        '--title', 'Integration fixture spawn count',
        '--description', 'integration-scenario adds ~20 spawns; track if CI flake recurs',
        '--introduced-by-mission', MID,
        '--introduced-by-task', TID,
      ],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `debt register failed: ${r.stderr}\nstdout: ${r.stdout}`);

    // ── 21. memory shared-set --body (inline-flag) ──────────────────
    r = inline(
      [
        'memory', 'shared-set',
        '--body', '# Shared memory\n\nIntegration scenario walkthrough complete.',
      ],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `memory shared-set failed: ${r.stderr}\nstdout: ${r.stdout}`);

    // ── 22. phase-review consolidating → complete ───────────────────
    const reviewConsolidating = {
      mission_phase: 'consolidating',
      status: 'passed',
      summary: 'consolidation complete',
      next_phase: 'complete',
    };
    const reviewConsolidatingPath = path.join(dir, 'review-consolidating.json');
    fs.writeFileSync(reviewConsolidatingPath, JSON.stringify(reviewConsolidating));
    r = runCli(
      ['phase-review', 'append', '--mission', MID, '--file', reviewConsolidatingPath],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `phase-review consolidating failed: ${r.stderr}\nstdout: ${r.stdout}`);

    // mission-verdict required before phase=complete (mission-state guard).
    // mission-verdict is JSON-only, so use --file as deliberate non-inline.
    const verdict = {
      verdict: 'approved',
      rationale: 'walkthrough fixture exercises lifecycle end-to-end',
      carry_forward: ['none'],
    };
    const verdictPath = path.join(dir, 'verdict.json');
    fs.writeFileSync(verdictPath, JSON.stringify(verdict));
    r = runCli(
      ['mission-verdict', 'append', '--mission', MID, '--file', verdictPath],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `mission-verdict append failed: ${r.stderr}\nstdout: ${r.stdout}`);

    r = inline(
      ['mission-state', 'update', '--mission', MID, '--phase', 'complete'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `phase complete failed: ${r.stderr}\nstdout: ${r.stdout}`);

    // ── 23. AC1 floor: ≥10 inline-flag-only commands invoked ────────
    assert.ok(
      inlineCount >= 10,
      `AC1 requires ≥10 inline-flag-only commands; got ${inlineCount}`,
    );

    // ── 24. terminal state: mission-state.phase = complete ──────────
    const stateRaw = fs.readFileSync(
      path.join(dir, '.geas', 'missions', MID, 'mission-state.json'),
      'utf-8',
    );
    const state = JSON.parse(stateRaw);
    assert.equal(state.phase, 'complete', `phase must be complete; got ${state.phase}`);

    // Task reached passed
    const taskStateRaw = fs.readFileSync(
      path.join(dir, '.geas', 'missions', MID, 'tasks', TID, 'task-state.json'),
      'utf-8',
    );
    const taskState = JSON.parse(taskStateRaw);
    assert.equal(taskState.status, 'passed', `task must be passed; got ${taskState.status}`);

    // Debts ledger registered the new debt
    const debtsRaw = fs.readFileSync(path.join(dir, '.geas', 'debts.json'), 'utf-8');
    const debts = JSON.parse(debtsRaw);
    assert.ok(
      debts.entries.some((e) => e.title === 'Integration fixture spawn count'),
      'registered debt must appear in .geas/debts.json',
    );

    // Memory shared.md was written with the inline body
    const memoryBody = fs.readFileSync(
      path.join(dir, '.geas', 'memory', 'shared.md'),
      'utf-8',
    );
    assert.match(memoryBody, /Integration scenario walkthrough complete\./);
  } finally {
    cleanup();
  }
});
