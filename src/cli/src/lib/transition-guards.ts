/**
 * Transition-guard primitives and the mission-phase FSM.
 *
 * Shared guard types live at the top. The mission-phase lifecycle is
 * implemented here; task lifecycle is added by G3.
 *
 * Mission-phase lifecycle (protocol doc 02, mission-state schema):
 *
 *   specifying -> building -> polishing -> consolidating -> complete
 *
 * Allowed rollbacks after a passed phase-review:
 *   polishing -> building
 *   consolidating -> polishing
 *   consolidating -> building
 *
 * Rewinds to specifying are never allowed; mission spec is immutable
 * after user approval.
 */

export interface GuardPass {
  ok: true;
}

export interface GuardFail {
  ok: false;
  reason: string;
  hints?: unknown;
}

export type GuardResult = GuardPass | GuardFail;

export function pass(): GuardPass {
  return { ok: true };
}

export function fail(reason: string, hints?: unknown): GuardFail {
  return hints !== undefined ? { ok: false, reason, hints } : { ok: false, reason };
}

/**
 * Check that a (from, to) pair is present in a transition table.
 */
export function isKnownTransition(
  table: ReadonlySet<string>,
  from: string,
  to: string,
): boolean {
  return table.has(`${from}->${to}`);
}

// ── Mission-phase FSM ──────────────────────────────────────────────────

export type MissionPhase =
  | 'specifying'
  | 'building'
  | 'polishing'
  | 'consolidating'
  | 'complete';

export const MISSION_PHASES: readonly MissionPhase[] = [
  'specifying',
  'building',
  'polishing',
  'consolidating',
  'complete',
] as const;

/**
 * Canonical set of allowed mission-phase transitions. Keep in sync with
 * protocol doc 02 and phase-reviews.schema `next_phase` enum.
 */
export const MISSION_PHASE_TRANSITIONS: ReadonlySet<string> = new Set([
  // Forward path
  'specifying->building',
  'building->polishing',
  'polishing->consolidating',
  'consolidating->complete',
  // Allowed rollbacks (after a passed phase-review whose next_phase matches)
  'polishing->building',
  'consolidating->polishing',
  'consolidating->building',
]);

export function isValidMissionPhase(v: unknown): v is MissionPhase {
  return typeof v === 'string' && (MISSION_PHASES as readonly string[]).includes(v);
}

/**
 * Hints a caller supplies describing the mission's current artifact
 * situation. The guard uses these (rather than re-reading files) so that
 * callers can compose the check from state they already have.
 */
export interface MissionPhaseHints {
  /** mission-spec.user_approved — must be true to leave specifying. */
  specApproved: boolean;
  /**
   * Count of task-contract files under the mission whose `approved_by`
   * is non-null. Building requires at least one.
   */
  approvedTaskCount: number;
  /**
   * Count of open (non-terminal, non-blocked) tasks under the mission.
   * Consolidating requires this to be zero.
   */
  openTaskCount: number;
  /**
   * Whether a phase-review was already appended whose next_phase matches
   * the requested target for the *previous* phase. This is how the CLI
   * couples `mission-state update --phase <p>` with the phase-review
   * written at the end of the prior phase.
   */
  priorPhaseReviewPassedToTarget: boolean;
  /**
   * Whether a mission-verdict was appended. Required to enter `complete`.
   */
  missionVerdictExists: boolean;
}

/**
 * Check whether a mission can advance from `from` to `to` given the
 * supplied artifact situation. Returns a GuardPass/GuardFail rather than
 * throwing — callers decide how to surface the reason.
 */
export function canAdvanceMissionPhase(
  from: string,
  to: string,
  hints: MissionPhaseHints,
): GuardResult {
  if (!isValidMissionPhase(from)) {
    return fail(`unknown source phase '${from}'`);
  }
  if (!isValidMissionPhase(to)) {
    return fail(`unknown target phase '${to}'`);
  }
  if (from === to) {
    return fail(`phase already '${from}' — no-op transition not allowed`);
  }
  if (from === 'complete') {
    return fail(`mission phase is 'complete' — terminal, no further transitions`);
  }
  if (!isKnownTransition(MISSION_PHASE_TRANSITIONS, from, to)) {
    return fail(
      `transition ${from} -> ${to} is not permitted`,
      { allowed_transitions: Array.from(MISSION_PHASE_TRANSITIONS).sort() },
    );
  }

  // specifying -> building: spec approved + at least one approved task.
  if (from === 'specifying' && to === 'building') {
    if (!hints.specApproved) {
      return fail(
        'mission spec is not user-approved; run `geas mission approve` first',
      );
    }
    if (hints.approvedTaskCount < 1) {
      return fail(
        'building requires at least one approved task-contract (approved_by non-null)',
      );
    }
    return pass();
  }

  // building -> polishing / polishing -> consolidating / rollbacks
  // all require a passed phase-review on the ending phase whose
  // next_phase matches `to`.
  if (!hints.priorPhaseReviewPassedToTarget) {
    return fail(
      `phase-review for ending phase '${from}' with next_phase='${to}' is required`,
      { hint: 'append a phase-review with status=passed and next_phase matching the target' },
    );
  }

  // consolidating -> complete: mission-verdict required.
  if (to === 'complete') {
    if (!hints.missionVerdictExists) {
      return fail(
        'completing a mission requires an appended mission-verdict',
      );
    }
  }

  // consolidating -> polishing / consolidating -> building rollbacks:
  // the phase-review alone is sufficient (no extra artifact beyond the
  // review).

  // polishing -> building rollback: no extra artifact required beyond
  // the phase-review.

  // building -> polishing forward: open task count should be zero (all
  // tasks terminated) OR phase-review explicitly waives via summary,
  // which the reviewer is responsible for stating. We only check the
  // schema-enforceable piece (open count) here.
  if (from === 'building' && to === 'polishing') {
    if (hints.openTaskCount > 0) {
      return fail(
        'building -> polishing requires all mission tasks to be terminated (passed/cancelled/escalated)',
        { open_task_count: hints.openTaskCount },
      );
    }
  }

  // polishing -> consolidating forward: same open-task guard.
  if (from === 'polishing' && to === 'consolidating') {
    if (hints.openTaskCount > 0) {
      return fail(
        'polishing -> consolidating requires all mission tasks to be terminated',
        { open_task_count: hints.openTaskCount },
      );
    }
  }

  return pass();
}

// ── Task lifecycle FSM ────────────────────────────────────────────────
//
// Task lifecycle — protocol doc 03. Nine states total:
//
//   drafted, ready, implementing, reviewed, verified, passed,
//   blocked, escalated, cancelled
//
// Main forward path:
//
//   drafted -> ready -> implementing -> reviewed -> verified -> passed
//
// blocked / escalated / cancelled branches may be entered from active
// states. blocked is recoverable (back to ready / implementing /
// reviewed); escalated routes to passed (if upward decision approves)
// or back to ready/implementing/reviewed (if upward decision asks for
// changes). passed / cancelled are terminal. escalated is a holding
// state awaiting upward judgment, but once reached, the only exits are
// the ones above.
//
// `reviewed -> implementing` is the changes_requested loop: the gate
// or closure decision asked for changes and the orchestrator re-enters
// implementing. Each such re-entry increments verify_fix_iterations.

export type TaskState =
  | 'drafted'
  | 'ready'
  | 'implementing'
  | 'reviewed'
  | 'verified'
  | 'passed'
  | 'blocked'
  | 'escalated'
  | 'cancelled';

export const TASK_STATES: readonly TaskState[] = [
  'drafted',
  'ready',
  'implementing',
  'reviewed',
  'verified',
  'passed',
  'blocked',
  'escalated',
  'cancelled',
] as const;

/**
 * Canonical set of allowed task transitions. Keep in sync with protocol
 * doc 03 transition table.
 *
 * Main path:
 *   drafted -> ready -> implementing -> reviewed -> verified -> passed
 *
 * Changes-requested loop from reviewed back into implementing. The
 * `verify -> implementing` edge is NOT present (protocol 03): a failed
 * gate returns the task to reviewed (re-review) or implementing via
 * orchestrator restoration, and the concrete restoration is decided by
 * the orchestrator. We model:
 *   reviewed -> implementing  (changes_requested fix loop)
 *   verified -> reviewed      (gate re-run requested)
 * both of which exist in protocol 03's prose ("Orchestrator가 이유에
 * 맞는 작업 상태로 되돌린다").
 *
 * blocked branch:
 *   implementing, reviewed, verified -> blocked
 *   blocked -> ready | implementing | reviewed
 *
 * escalated branch:
 *   blocked, verified -> escalated
 *   escalated -> passed | ready | implementing | reviewed
 *
 * cancel: any non-terminal state -> cancelled.
 * passed and cancelled are terminal; escalated is exited only through
 * the edges above.
 */
export const TASK_TRANSITIONS: ReadonlySet<string> = new Set([
  // Forward main path
  'drafted->ready',
  'ready->implementing',
  'implementing->reviewed',
  'reviewed->verified',
  'verified->passed',

  // Changes-requested loop
  'reviewed->implementing',
  'verified->reviewed',

  // Blocked entry
  'implementing->blocked',
  'reviewed->blocked',
  'verified->blocked',

  // Blocked exit (unblock)
  'blocked->ready',
  'blocked->implementing',
  'blocked->reviewed',

  // Escalation entry
  'blocked->escalated',
  'verified->escalated',

  // Escalation exit (upward verdict)
  'escalated->passed',
  'escalated->ready',
  'escalated->implementing',
  'escalated->reviewed',

  // Cancel from any non-terminal state
  'drafted->cancelled',
  'ready->cancelled',
  'implementing->cancelled',
  'reviewed->cancelled',
  'verified->cancelled',
  'blocked->cancelled',
  'escalated->cancelled',
]);

export function isValidTaskState(v: unknown): v is TaskState {
  return typeof v === 'string' && (TASK_STATES as readonly string[]).includes(v);
}

/**
 * Hints a caller supplies describing the task's artifact situation.
 * The guard uses these (rather than re-reading files) so callers can
 * compose the check from state they already have.
 *
 * Evidence-driven checks (implementing -> reviewed, reviewed ->
 * verified, verified -> passed) are delegated to G4. G3 only models
 * whether the minimum marker files exist (e.g. self-check.json,
 * closure evidence file). G4 tightens these into evidence.schema
 * validation and verdict inspection.
 */
export interface TaskStateHints {
  /**
   * Whether the task contract has been approved (approved_by non-null).
   * Required to leave drafted -> ready.
   */
  contractApproved: boolean;
  /**
   * Whether every task in `dependencies` has status === 'passed'.
   * Empty deps count as satisfied. Required for ready -> implementing.
   */
  dependenciesSatisfied: boolean;
  /**
   * List of dependency task ids that are not yet passed. Used only for
   * diagnostic hints when dependenciesSatisfied is false.
   */
  unsatisfiedDependencies: string[];
  /**
   * Whether no other task in the same mission currently holds the
   * implementer slot on an overlapping surface. Required for ready ->
   * implementing and blocked -> implementing. G4 may tighten this.
   */
  noSurfaceConflict: boolean;
  /**
   * Surface overlaps that blocked the transition (for hint payload).
   */
  conflictingSurfaces: string[];
  /**
   * Whether self-check.json exists AND validates against the self-check
   * schema. G4 tightens the G3 file-presence stub to full schema validation.
   */
  selfCheckExists: boolean;
  /**
   * Whether each required review slot has at least one evidence entry
   * with `evidence_kind=review` and a valid reviewer verdict
   * (approved / changes_requested / blocked). File presence alone is not
   * sufficient — the entry content is inspected.
   */
  reviewEvidenceExists: boolean;
  /**
   * Names of required review slots that have no valid review evidence
   * entry yet. Used only for diagnostics.
   */
  missingReviewSlots: string[];
  /**
   * Whether the latest gate-results run has `verdict=pass` and
   * `tier_results.tier_2.status=pass`. A verifier evidence file alone is
   * not sufficient — the gate must have actually run with a pass verdict.
   */
  verificationEvidenceExists: boolean;
  /**
   * Whether the orchestrator closure evidence file exists, its last entry
   * is a closure entry with `verdict=approved`, and the file validates
   * against the evidence schema. Required for verified -> passed and
   * escalated -> passed.
   */
  closureApproved: boolean;
}

/**
 * Check whether a task can transition from `from` to `to` given the
 * supplied artifact situation. Returns GuardPass/GuardFail.
 *
 * Terminal states (passed, cancelled) reject all transitions. escalated
 * permits only the four exits defined in TASK_TRANSITIONS.
 */
export function canTransitionTaskState(
  from: string,
  to: string,
  hints: TaskStateHints,
): GuardResult {
  if (!isValidTaskState(from)) {
    return fail(`unknown source state '${from}'`);
  }
  if (!isValidTaskState(to)) {
    return fail(`unknown target state '${to}'`);
  }
  if (from === to) {
    return fail(`task state already '${from}' — no-op transition not allowed`);
  }
  if (from === 'passed' || from === 'cancelled') {
    return fail(`task is in terminal state '${from}' — no further transitions permitted`);
  }
  if (!isKnownTransition(TASK_TRANSITIONS, from, to)) {
    return fail(`transition ${from} -> ${to} is not permitted`, {
      allowed_transitions: Array.from(TASK_TRANSITIONS).sort(),
    });
  }

  // ── drafted -> ready: contract must be approved
  if (from === 'drafted' && to === 'ready') {
    if (!hints.contractApproved) {
      return fail(
        "task contract is not approved; call `geas task approve` first",
      );
    }
    return pass();
  }

  // ── ready -> implementing: dependencies passed + no surface conflict
  if (from === 'ready' && to === 'implementing') {
    if (!hints.dependenciesSatisfied) {
      return fail(
        'ready -> implementing requires every dependency task to be in `passed`',
        { unsatisfied_dependencies: hints.unsatisfiedDependencies },
      );
    }
    if (!hints.noSurfaceConflict) {
      return fail(
        'another active task overlaps the surface allowlist; only one implementer per surface is permitted',
        { conflicting_surfaces: hints.conflictingSurfaces },
      );
    }
    return pass();
  }

  // ── blocked -> implementing: same surface-conflict guard as ready
  if (from === 'blocked' && to === 'implementing') {
    if (!hints.noSurfaceConflict) {
      return fail(
        'another active task overlaps the surface allowlist; cannot unblock into implementing',
        { conflicting_surfaces: hints.conflictingSurfaces },
      );
    }
    return pass();
  }

  // ── escalated -> implementing: same surface-conflict guard
  if (from === 'escalated' && to === 'implementing') {
    if (!hints.noSurfaceConflict) {
      return fail(
        'another active task overlaps the surface allowlist; cannot re-enter implementing from escalated',
        { conflicting_surfaces: hints.conflictingSurfaces },
      );
    }
    return pass();
  }

  // ── implementing -> reviewed: schema-valid self-check + at least one
  // valid review entry per required reviewer slot.
  if (from === 'implementing' && to === 'reviewed') {
    if (!hints.selfCheckExists) {
      return fail(
        'implementing -> reviewed requires self-check.json to exist and validate against the self-check schema',
      );
    }
    if (!hints.reviewEvidenceExists) {
      return fail(
        'implementing -> reviewed requires at least one review-kind evidence entry with a valid verdict for every required review slot',
        { missing_review_slots: hints.missingReviewSlots },
      );
    }
    return pass();
  }

  // ── reviewed -> verified: gate-results last run verdict=pass with
  // tier_2.status=pass.
  if (from === 'reviewed' && to === 'verified') {
    if (!hints.verificationEvidenceExists) {
      return fail(
        'reviewed -> verified requires a gate-results run with verdict=pass and tier_2.status=pass',
      );
    }
    return pass();
  }

  // ── verified -> passed: schema-valid closure evidence with
  // verdict=approved.
  if (from === 'verified' && to === 'passed') {
    if (!hints.closureApproved) {
      return fail(
        'verified -> passed requires orchestrator closure evidence (evidence_kind=closure, verdict=approved) that validates against the evidence schema',
      );
    }
    return pass();
  }

  // ── escalated -> passed: closure evidence approved (same as verified->passed)
  if (from === 'escalated' && to === 'passed') {
    if (!hints.closureApproved) {
      return fail(
        'escalated -> passed requires orchestrator closure evidence with verdict=approved',
      );
    }
    return pass();
  }

  // All other edges (to blocked / cancelled / escalated / changes-requested
  // loops / reviewed restoration) are unconditional per protocol 03 once
  // the transition is in the known table.
  return pass();
}
