import { join as pathJoin } from 'node:path';
import type { GuardFailure } from './output';
import { missionDir, readLatestNumbered, taskDir, readTaskState, type RunState } from './runtime';

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

const ALLOWED_MISSION_TRANSITIONS = new Set<string>([
  'specifying->building',
  'building->building',
  'building->consolidating',
  'building->specifying',
  'consolidating->building',
  'consolidating->specifying',
]);

type DesignPayload = { task_breakdown: Array<{ task_id: string; depends_on: string[] }> };

export function dependencyAccepted(missionId: string, depTaskId: string, cwd?: string): boolean {
  const td = taskDir(missionId, depTaskId, cwd);
  // task-evidence.yaml exists
  const fs = require('node:fs') as typeof import('node:fs');
  if (!fs.existsSync(`${td}/task-evidence.yaml`)) return false;
  const judgment = readLatestNumbered<{ decision: string }>(td, 'user-judgment-result');
  if (!judgment) return false;
  return ['accepted', 'accepted_with_limits'].includes(judgment.payload.decision);
}

export function checkMissionTransition(
  runState: RunState | null,
  toStage: 'specifying' | 'building' | 'consolidating',
  taskId: string | undefined,
  cwd?: string,
): GuardResult {
  if (!runState) return fail([{ code: 'run_state_missing' }]);
  if (runState.current_mission_id === '') return fail([{ code: 'no_current_mission' }]);
  const from = runState.current_stage;
  if (!ALLOWED_MISSION_TRANSITIONS.has(`${from}->${toStage}`)) {
    return fail([{ code: 'transition_not_allowed', detail: `${from}->${toStage}` }]);
  }

  const failures: GuardFailure[] = [];
  const mid = runState.current_mission_id;
  const md = missionDir(mid, cwd);

  if (toStage === 'building') {
    if (!taskId) {
      failures.push({ code: 'task_required' });
    } else {
      const spec = readLatestNumbered(md, 'mission-spec');
      const design = readLatestNumbered<DesignPayload>(md, 'mission-design');
      if (!spec) failures.push({ code: 'mission_spec_missing' });
      if (!design) failures.push({ code: 'mission_design_missing' });
      if (design && !design.payload.task_breakdown.some((t) => t.task_id === taskId)) {
        failures.push({ code: 'task_unknown', detail: taskId });
      }
      const td = taskDir(mid, taskId, cwd);
      const contract = readLatestNumbered(td, 'task-contract');
      if (!contract) failures.push({ code: 'task_contract_missing', path: pathJoin(td, 'task-contract-001.yaml') });

      if (design) {
        const node = design.payload.task_breakdown.find((t) => t.task_id === taskId);
        for (const dep of node?.depends_on ?? []) {
          if (!dependencyAccepted(mid, dep, cwd)) {
            failures.push({ code: 'dependency_not_ready', detail: dep });
          }
        }
      }

      if ((from === 'specifying' || from === 'consolidating') && runState.current_task_id !== '') {
        failures.push({ code: 'task_in_progress', detail: runState.current_task_id });
      }
      if (from === 'building' && runState.current_task_id !== taskId) {
        const prevState = readTaskState(mid, runState.current_task_id, cwd);
        if (!prevState || prevState.phase !== 'closed') {
          failures.push({ code: 'previous_task_not_closed', detail: runState.current_task_id });
        }
      }
    }
  }

  if (toStage === 'consolidating') {
    const design = readLatestNumbered<DesignPayload>(md, 'mission-design');
    if (!design) {
      failures.push({ code: 'mission_design_missing' });
    } else {
      for (const t of design.payload.task_breakdown) {
        const tdir = taskDir(mid, t.task_id, cwd);
        const fs = require('node:fs') as typeof import('node:fs');
        if (!fs.existsSync(`${tdir}/task-evidence.yaml`)) {
          failures.push({ code: 'task_evidence_missing', detail: t.task_id });
        }
        const judgment = readLatestNumbered<{ decision: string }>(tdir, 'user-judgment-result');
        if (!judgment || !['accepted', 'accepted_with_limits'].includes(judgment.payload.decision)) {
          failures.push({ code: 'task_judgment_not_accepted', detail: t.task_id });
        }
      }
    }
  }

  return failures.length === 0 ? ok() : fail(failures);
}

type TaskContractGuardCtx = {
  runState: RunState | null;
  taskId: string;
};

export function checkTaskContractRecord(ctx: TaskContractGuardCtx, cwd?: string): GuardResult {
  const { runState, taskId } = ctx;
  if (!runState) return fail([{ code: 'run_state_missing' }]);
  if (runState.current_mission_id === '') return fail([{ code: 'no_current_mission' }]);
  const failures: GuardFailure[] = [];
  if (!['specifying', 'building'].includes(runState.current_stage)) {
    failures.push({ code: 'stage_not_specifying_or_building', detail: runState.current_stage });
  }
  const md = missionDir(runState.current_mission_id, cwd);
  const design = readLatestNumbered<DesignPayload>(md, 'mission-design');
  if (!design) failures.push({ code: 'mission_design_missing' });
  if (design && !design.payload.task_breakdown.some((t) => t.task_id === taskId)) {
    failures.push({ code: 'task_unknown_in_design', detail: taskId });
  }
  if (runState.current_stage === 'building') {
    if (runState.current_task_id !== taskId) {
      failures.push({ code: 'task_not_current', detail: `current=${runState.current_task_id} requested=${taskId}` });
    }
    const td = taskDir(runState.current_mission_id, taskId, cwd);
    const ts = readTaskState(runState.current_mission_id, taskId, cwd);
    if (!ts || ts.phase !== 'awaiting_user_judgment') {
      failures.push({ code: 'phase_not_awaiting_user_judgment', detail: ts?.phase ?? 'missing' });
    }
    const judgment = readLatestNumbered<{ decision: string }>(td, 'user-judgment-result');
    if (!judgment || judgment.payload.decision !== 'revise') {
      failures.push({ code: 'judgment_not_revise' });
    }
  }
  return failures.length === 0 ? ok() : fail(failures);
}

const ALLOWED_TASK_TRANSITIONS = new Set<string>([
  'unstarted->implementing',
  'awaiting_user_judgment->implementing',
  'awaiting_user_judgment->verifying',
  'awaiting_user_judgment->reviewing',
  'reviewing->challenging',
  'awaiting_user_judgment->challenging',
  'verifying->awaiting_user_judgment',
  'reviewing->awaiting_user_judgment',
  'challenging->awaiting_user_judgment',
]);

const REVISE_REQUIRED_TARGETS = new Set<string>(['implementing', 'verifying', 'reviewing', 'challenging']);

export function checkTaskTransition(
  runState: RunState | null,
  taskId: string,
  toPhase: 'unstarted' | 'implementing' | 'verifying' | 'reviewing' | 'challenging' | 'awaiting_user_judgment' | 'closed',
  cwd?: string,
): GuardResult {
  if (!runState) return fail([{ code: 'run_state_missing' }]);
  if (runState.current_stage !== 'building') return fail([{ code: 'stage_not_building', detail: runState.current_stage }]);
  if (runState.current_task_id !== taskId) return fail([{ code: 'task_not_current', detail: `current=${runState.current_task_id}` }]);
  const failures: GuardFailure[] = [];
  const td = taskDir(runState.current_mission_id, taskId, cwd);
  const contract = readLatestNumbered(td, 'task-contract');
  if (!contract) failures.push({ code: 'task_contract_missing' });
  const ts = readTaskState(runState.current_mission_id, taskId, cwd);
  if (!ts) {
    failures.push({ code: 'task_state_missing' });
    return fail(failures);
  }
  const fromPhase = ts.phase;
  const pair = `${fromPhase}->${toPhase}`;
  if (!ALLOWED_TASK_TRANSITIONS.has(pair)) {
    failures.push({ code: 'transition_not_allowed', detail: pair });
  }
  if (fromPhase === 'awaiting_user_judgment' && REVISE_REQUIRED_TARGETS.has(toPhase)) {
    const judgment = readLatestNumbered<{ decision: string }>(td, 'user-judgment-result');
    if (!judgment || judgment.payload.decision !== 'revise') {
      failures.push({ code: 'judgment_not_revise', detail: judgment?.payload.decision ?? 'missing' });
    }
  }
  return failures.length === 0 ? ok() : fail(failures);
}

type EvidenceKind = 'implementation' | 'verification' | 'review' | 'challenger' | 'task';

const KIND_TO_REQUIRED_PHASE: Record<EvidenceKind, string> = {
  implementation: 'implementing',
  verification: 'verifying',
  review: 'reviewing',
  challenger: 'challenging',
  task: 'awaiting_user_judgment',
};

export function checkTaskEvidenceRecord(
  runState: RunState | null,
  taskId: string,
  kind: EvidenceKind,
  _payload: { verdict?: string },
  cwd?: string,
): GuardResult {
  if (!runState) return fail([{ code: 'run_state_missing' }]);
  if (runState.current_stage !== 'building') return fail([{ code: 'stage_not_building', detail: runState.current_stage }]);
  if (runState.current_task_id !== taskId) return fail([{ code: 'task_not_current', detail: `current=${runState.current_task_id}` }]);

  const failures: GuardFailure[] = [];
  const td = taskDir(runState.current_mission_id, taskId, cwd);
  const contract = readLatestNumbered(td, 'task-contract');
  if (!contract) failures.push({ code: 'task_contract_missing' });
  const ts = readTaskState(runState.current_mission_id, taskId, cwd);
  if (!ts) failures.push({ code: 'task_state_missing' });

  if (ts && ts.phase !== KIND_TO_REQUIRED_PHASE[kind]) {
    failures.push({ code: 'phase_does_not_match_kind', detail: `phase=${ts.phase} kind=${kind}` });
  }

  if (kind === 'task') {
    const judgment = readLatestNumbered<{ decision: string }>(td, 'user-judgment-result');
    if (!judgment || !['accepted', 'accepted_with_limits'].includes(judgment.payload.decision)) {
      failures.push({ code: 'task_judgment_not_accepted', detail: judgment?.payload.decision ?? 'missing' });
    }
    const fs = require('node:fs') as typeof import('node:fs');
    if (fs.existsSync(`${td}/task-evidence.yaml`)) {
      failures.push({ code: 'task_evidence_already_exists' });
    }
  }

  return failures.length === 0 ? ok() : fail(failures);
}

type JudgmentTarget = 'task-result' | 'mission-result';

export function checkJudgmentRecord(
  runState: RunState | null,
  target: JudgmentTarget,
  taskId: string | undefined,
  cwd?: string,
): GuardResult {
  if (!runState) return fail([{ code: 'run_state_missing' }]);
  if (runState.current_mission_id === '') return fail([{ code: 'no_current_mission' }]);
  const failures: GuardFailure[] = [];
  if (target === 'task-result') {
    if (runState.current_stage !== 'building') failures.push({ code: 'stage_not_building', detail: runState.current_stage });
    if (!taskId) {
      failures.push({ code: 'task_required' });
    } else {
      if (runState.current_task_id !== taskId) failures.push({ code: 'task_not_current', detail: `current=${runState.current_task_id}` });
      const ts = readTaskState(runState.current_mission_id, taskId, cwd);
      if (!ts || ts.phase !== 'awaiting_user_judgment') {
        failures.push({ code: 'phase_not_awaiting_user_judgment', detail: ts?.phase ?? 'missing' });
      }
    }
  }
  if (target === 'mission-result') {
    if (runState.current_stage !== 'consolidating') failures.push({ code: 'stage_not_consolidating', detail: runState.current_stage });
  }
  return failures.length === 0 ? ok() : fail(failures);
}

type MemoryItemPayload = { source_refs: string[] };

export function checkMemoryRecord(
  runState: RunState | null,
  scope: 'common' | 'role',
  role: string | undefined,
  payload: MemoryItemPayload,
  cwd?: string,
): GuardResult {
  if (!runState) return fail([{ code: 'run_state_missing' }]);
  const failures: GuardFailure[] = [];
  if (runState.current_mission_id === '') failures.push({ code: 'no_current_mission' });
  if (runState.current_stage !== 'consolidating') failures.push({ code: 'stage_not_consolidating', detail: runState.current_stage });
  if (runState.current_mission_id !== '') {
    const md = missionDir(runState.current_mission_id, cwd);
    const judgment = readLatestNumbered<{ decision: string }>(md, 'user-judgment-result');
    if (!judgment || !['accepted', 'accepted_with_limits'].includes(judgment.payload.decision)) {
      failures.push({ code: 'mission_judgment_not_accepted' });
    }
  }
  if (scope === 'role') {
    if (!role) failures.push({ code: 'role_required' });
    else if (!['orchestrator', 'work-designer', 'implementer', 'verifier', 'reviewer', 'challenger'].includes(role)) {
      failures.push({ code: 'role_invalid', detail: role });
    }
  }

  // source_refs must point at existing artifacts under .geas/missions/<mid>/
  if (runState.current_mission_id !== '') {
    const fs = require('node:fs') as typeof import('node:fs');
    const md = missionDir(runState.current_mission_id, cwd);
    for (const ref of payload.source_refs ?? []) {
      const abs = pathJoin(md, ref);
      if (!fs.existsSync(abs)) {
        failures.push({ code: 'source_ref_missing', path: abs });
      }
    }
  }

  return failures.length === 0 ? ok() : fail(failures);
}

export function checkMissionEvidenceRecord(runState: RunState | null, cwd?: string): GuardResult {
  if (!runState) return fail([{ code: 'run_state_missing' }]);
  const failures: GuardFailure[] = [];
  if (runState.current_mission_id === '') failures.push({ code: 'no_current_mission' });
  if (runState.current_stage !== 'consolidating') failures.push({ code: 'stage_not_consolidating', detail: runState.current_stage });
  if (runState.current_mission_id !== '') {
    const md = missionDir(runState.current_mission_id, cwd);
    const judgment = readLatestNumbered<{ decision: string }>(md, 'user-judgment-result');
    if (!judgment || !['accepted', 'accepted_with_limits'].includes(judgment.payload.decision)) {
      failures.push({ code: 'mission_judgment_not_accepted' });
    }
    const fs = require('node:fs') as typeof import('node:fs');
    const evPath = pathJoin(md, 'mission-evidence.yaml');
    if (fs.existsSync(evPath)) failures.push({ code: 'mission_evidence_already_exists', path: evPath });
  }
  return failures.length === 0 ? ok() : fail(failures);
}
