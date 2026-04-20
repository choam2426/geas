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
