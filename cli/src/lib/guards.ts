import type { GuardFailure } from './output';
import type { RunState } from './runtime';

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

export function checkMissionCreate(runState: RunState | null): GuardResult {
  if (!runState) {
    return fail([{ code: 'run_state_missing', path: '.geas/run-state.yaml', status: 'missing' }]);
  }
  const failures: GuardFailure[] = [];
  if (runState.current_mission_id !== '') {
    failures.push({ code: 'mission_in_progress', detail: `current_mission_id=${runState.current_mission_id}` });
  }
  if (runState.current_stage !== '') {
    failures.push({ code: 'stage_not_idle', detail: `current_stage=${runState.current_stage}` });
  }
  if (runState.current_task_id !== '') {
    failures.push({ code: 'task_in_progress', detail: `current_task_id=${runState.current_task_id}` });
  }
  return failures.length === 0 ? ok() : fail(failures);
}

export function checkMissionSpecRecord(runState: RunState | null): GuardResult {
  if (!runState) return fail([{ code: 'run_state_missing' }]);
  const failures: GuardFailure[] = [];
  if (runState.current_mission_id === '') failures.push({ code: 'no_current_mission' });
  if (runState.current_stage !== 'specifying') failures.push({ code: 'stage_not_specifying', detail: runState.current_stage });
  return failures.length === 0 ? ok() : fail(failures);
}
