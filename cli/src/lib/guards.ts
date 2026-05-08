import type { GuardFailure } from './output';

export type GuardResult = { ok: true } | { ok: false; guards: GuardFailure[] };

export function ok(): GuardResult {
  return { ok: true };
}

export function fail(guards: GuardFailure[]): GuardResult {
  return { ok: false, guards };
}

export function combine(...results: GuardResult[]): GuardResult {
  const failures: GuardFailure[] = [];
  for (const r of results) {
    if (!r.ok) failures.push(...r.guards);
  }
  if (failures.length === 0) return ok();
  return fail(failures);
}
