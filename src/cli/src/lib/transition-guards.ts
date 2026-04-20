/**
 * Transition-guard skeleton.
 *
 * G1 ships the shared guard primitives only. Per-state transition tables
 * for the 9-state task lifecycle and 5-state mission phase lifecycle are
 * filled in by G2 (mission) and G3 (task).
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
 * G2/G3 will build the tables per lifecycle.
 */
export function isKnownTransition(
  table: ReadonlySet<string>,
  from: string,
  to: string,
): boolean {
  return table.has(`${from}->${to}`);
}
