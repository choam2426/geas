import { join as pathJoin } from 'node:path';
import type { GuardFailure } from './output';
import { missionDir, readLatestNumbered, type RunState } from './runtime';

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

type MissionDesignPayload = {
  task_breakdown: Array<{ task_id: string; depends_on: string[] }>;
};

export function checkMissionDesignRecord(
  runState: RunState | null,
  payload: MissionDesignPayload,
  cwd?: string,
): GuardResult {
  if (!runState) return fail([{ code: 'run_state_missing' }]);
  const failures: GuardFailure[] = [];
  if (runState.current_mission_id === '') failures.push({ code: 'no_current_mission' });
  if (runState.current_stage !== 'specifying') failures.push({ code: 'stage_not_specifying', detail: runState.current_stage });
  if (runState.current_mission_id !== '') {
    const dir = missionDir(runState.current_mission_id, cwd);
    const spec = readLatestNumbered(dir, 'mission-spec');
    if (!spec) failures.push({ code: 'mission_spec_missing', path: pathJoin(dir, 'mission-spec-001.yaml') });
  }

  // task_id duplicates
  const taskIds = payload.task_breakdown?.map((t) => t.task_id) ?? [];
  const dupes = taskIds.filter((id, i) => taskIds.indexOf(id) !== i);
  if (dupes.length > 0) failures.push({ code: 'task_id_duplicate', detail: Array.from(new Set(dupes)).join(',') });

  // dependency target exists
  const idSet = new Set(taskIds);
  for (const t of payload.task_breakdown ?? []) {
    for (const dep of t.depends_on ?? []) {
      if (!idSet.has(dep)) {
        failures.push({ code: 'dependency_unknown', detail: `${t.task_id} -> ${dep}` });
      }
    }
  }

  // dependency cycle (DFS)
  const graph = new Map<string, string[]>();
  for (const t of payload.task_breakdown ?? []) graph.set(t.task_id, t.depends_on ?? []);
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  function dfs(node: string): boolean {
    color.set(node, GRAY);
    for (const next of graph.get(node) ?? []) {
      const c = color.get(next) ?? WHITE;
      if (c === GRAY) return true;
      if (c === WHITE && dfs(next)) return true;
    }
    color.set(node, BLACK);
    return false;
  }
  for (const id of taskIds) {
    if ((color.get(id) ?? WHITE) === WHITE) {
      if (dfs(id)) {
        failures.push({ code: 'dependency_cycle' });
        break;
      }
    }
  }

  return failures.length === 0 ? ok() : fail(failures);
}
