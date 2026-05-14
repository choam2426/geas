import { join as pathJoin } from 'node:path';
import { existsSync } from 'node:fs';
import { frontmatterString, frontmatterStringArray, type MarkdownArtifact } from './artifacts';
import type { GuardFailure } from './output';
import { resolveProjectRef, resolveTaskArtifactRef, resolveMissionRef, type RefResolveFailure } from './refs';
import { listTaskIds, missionDir, readLatestMarkdownArtifact, taskDir, readTaskState, type RunState } from './runtime';

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

export function checkMissionDesignRecord(runState: RunState | null, cwd?: string): GuardResult {
  if (!runState) return fail([{ code: 'run_state_missing' }]);
  const failures: GuardFailure[] = [];
  if (runState.current_mission_id === '') failures.push({ code: 'no_current_mission' });
  if (runState.current_stage !== 'specifying') failures.push({ code: 'stage_not_specifying', detail: runState.current_stage });
  if (runState.current_mission_id !== '') {
    const dir = missionDir(runState.current_mission_id, cwd);
    const spec = readLatestMarkdownArtifact(dir, 'mission-spec', 'mission-spec');
    if (!spec) failures.push({ code: 'mission_spec_missing', path: pathJoin(dir, 'mission-spec-001.md') });
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

type TaskContractPayload = { depends_on: string[] };

function readTaskContract(missionId: string, taskId: string, cwd?: string) {
  return readLatestMarkdownArtifact(taskDir(missionId, taskId, cwd), 'task-contract', 'task-contract');
}

function listContractedTaskIds(missionId: string, cwd?: string): string[] {
  return listTaskIds(missionId, cwd).filter((taskId) => Boolean(readTaskContract(missionId, taskId, cwd)));
}

function checkArtifactRefKeys(
  missionId: string,
  artifact: MarkdownArtifact,
  keys: string[],
  cwd: string | undefined,
  taskId?: string,
): GuardFailure[] {
  const failures: GuardFailure[] = [];
  for (const key of keys) {
    const ref = frontmatterString(artifact, key);
    const resolved = taskId
      ? resolveTaskArtifactRef(missionId, taskId, ref, cwd)
      : resolveMissionRef(missionId, ref, cwd);
    if (!resolved.ok) failures.push(refFailureToGuard('artifact_ref', resolved));
  }
  return failures;
}

function refFailureToGuard(prefix: 'artifact_ref' | 'source_ref' | 'debt_ref', failure: RefResolveFailure): GuardFailure {
  const suffix = failure.code.replace(/^ref_/, '');
  return {
    code: `${prefix}_${suffix}`,
    path: failure.path ?? failure.ref,
  };
}

type DebtRefPayload = {
  status: string;
  source_refs: string[];
  accepted_in_ref: string;
  resolved_by_refs: string[];
};

function checkMissionAcceptedWindow(runState: RunState | null, cwd?: string): GuardFailure[] {
  if (!runState) return [{ code: 'run_state_missing' }];
  const failures: GuardFailure[] = [];
  if (runState.current_mission_id === '') failures.push({ code: 'no_current_mission' });
  if (runState.current_stage !== 'consolidating') {
    failures.push({ code: 'stage_not_consolidating', detail: runState.current_stage });
  }
  if (runState.current_mission_id !== '') {
    const md = missionDir(runState.current_mission_id, cwd);
    const judgment = readLatestMarkdownArtifact(md, 'user-judgment-result', 'user-judgment');
    if (!judgment || !['accepted', 'accepted_with_limits'].includes(frontmatterString(judgment.artifact, 'decision'))) {
      failures.push({ code: 'mission_judgment_not_accepted' });
    }
    const evPath = pathJoin(md, 'mission-evidence.md');
    if (existsSync(evPath)) failures.push({ code: 'mission_evidence_already_exists', path: evPath });
  }
  return failures;
}

function checkDebtRefs(payload: DebtRefPayload, cwd?: string): GuardFailure[] {
  const failures: GuardFailure[] = [];
  for (const ref of payload.source_refs ?? []) {
    const resolved = resolveProjectRef(ref, cwd);
    if (!resolved.ok) failures.push(refFailureToGuard('debt_ref', resolved));
  }

  const accepted = resolveProjectRef(payload.accepted_in_ref, cwd);
  if (!accepted.ok) failures.push(refFailureToGuard('debt_ref', accepted));

  for (const ref of payload.resolved_by_refs ?? []) {
    const resolved = resolveProjectRef(ref, cwd);
    if (!resolved.ok) failures.push(refFailureToGuard('debt_ref', resolved));
  }

  if (payload.status === 'resolved' && (payload.resolved_by_refs ?? []).length === 0) {
    failures.push({ code: 'resolved_by_refs_required' });
  }

  return failures;
}

function checkTaskDependencies(
  missionId: string,
  taskId: string,
  payload: TaskContractPayload,
  cwd?: string,
): GuardFailure[] {
  const failures: GuardFailure[] = [];
  const taskIds = new Set(listContractedTaskIds(missionId, cwd));
  taskIds.add(taskId);

  for (const dep of payload.depends_on ?? []) {
    if (!taskIds.has(dep)) {
      failures.push({ code: 'dependency_unknown', detail: `${taskId} -> ${dep}` });
    }
  }

  const graph = new Map<string, string[]>();
  for (const id of taskIds) {
    const contract = readTaskContract(missionId, id, cwd);
    const deps = id === taskId ? payload.depends_on ?? [] : frontmatterStringArray(contract!.artifact, 'depends_on');
    graph.set(id, deps);
  }

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  function dfs(node: string): boolean {
    color.set(node, GRAY);
    for (const next of graph.get(node) ?? []) {
      if (!taskIds.has(next)) continue;
      const c = color.get(next) ?? WHITE;
      if (c === GRAY) return true;
      if (c === WHITE && dfs(next)) return true;
    }
    color.set(node, BLACK);
    return false;
  }

  for (const id of taskIds) {
    if ((color.get(id) ?? WHITE) === WHITE && dfs(id)) {
      failures.push({ code: 'dependency_cycle' });
      break;
    }
  }

  return failures;
}

export function dependencyAccepted(missionId: string, depTaskId: string, cwd?: string): boolean {
  const td = taskDir(missionId, depTaskId, cwd);
  if (!existsSync(`${td}/task-evidence.md`)) return false;
  const judgment = readLatestMarkdownArtifact(td, 'user-judgment-result', 'user-judgment');
  if (!judgment) return false;
  return ['accepted', 'accepted_with_limits'].includes(frontmatterString(judgment.artifact, 'decision'));
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
      const spec = readLatestMarkdownArtifact(md, 'mission-spec', 'mission-spec');
      const design = readLatestMarkdownArtifact(md, 'mission-design', 'mission-design');
      if (!spec) failures.push({ code: 'mission_spec_missing' });
      if (!design) failures.push({ code: 'mission_design_missing' });
      const td = taskDir(mid, taskId, cwd);
      const contract = readTaskContract(mid, taskId, cwd);
      if (!contract) failures.push({ code: 'task_contract_missing', path: pathJoin(td, 'task-contract-001.md') });

      if (contract) {
        for (const dep of frontmatterStringArray(contract.artifact, 'depends_on')) {
          if (!dependencyAccepted(mid, dep, cwd)) failures.push({ code: 'dependency_not_ready', detail: dep });
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
    const design = readLatestMarkdownArtifact(md, 'mission-design', 'mission-design');
    if (!design) failures.push({ code: 'mission_design_missing' });
    const taskIds = listContractedTaskIds(mid, cwd);
    if (taskIds.length === 0) failures.push({ code: 'task_contract_missing' });
    for (const task of taskIds) {
      const tdir = taskDir(mid, task, cwd);
      if (!existsSync(`${tdir}/task-evidence.md`)) {
        failures.push({ code: 'task_evidence_missing', detail: task });
      }
      const judgment = readLatestMarkdownArtifact(tdir, 'user-judgment-result', 'user-judgment');
      if (!judgment || !['accepted', 'accepted_with_limits'].includes(frontmatterString(judgment.artifact, 'decision'))) {
        failures.push({ code: 'task_judgment_not_accepted', detail: task });
      }
    }
  }

  return failures.length === 0 ? ok() : fail(failures);
}

type TaskContractGuardCtx = {
  runState: RunState | null;
  taskId: string;
  artifact: MarkdownArtifact;
};

export function checkTaskContractRecord(ctx: TaskContractGuardCtx, cwd?: string): GuardResult {
  const { runState, taskId, artifact } = ctx;
  if (!runState) return fail([{ code: 'run_state_missing' }]);
  if (runState.current_mission_id === '') return fail([{ code: 'no_current_mission' }]);
  const failures: GuardFailure[] = [];
  if (!['specifying', 'building'].includes(runState.current_stage)) {
    failures.push({ code: 'stage_not_specifying_or_building', detail: runState.current_stage });
  }
  const md = missionDir(runState.current_mission_id, cwd);
  const design = readLatestMarkdownArtifact(md, 'mission-design', 'mission-design');
  if (!design) failures.push({ code: 'mission_design_missing' });
  failures.push(...checkTaskDependencies(runState.current_mission_id, taskId, {
    depends_on: frontmatterStringArray(artifact, 'depends_on'),
  }, cwd));
  if (runState.current_stage === 'building') {
    if (runState.current_task_id !== taskId) {
      failures.push({ code: 'task_not_current', detail: `current=${runState.current_task_id} requested=${taskId}` });
    }
    const td = taskDir(runState.current_mission_id, taskId, cwd);
    const ts = readTaskState(runState.current_mission_id, taskId, cwd);
    if (!ts || ts.phase !== 'awaiting_user_judgment') {
      failures.push({ code: 'phase_not_awaiting_user_judgment', detail: ts?.phase ?? 'missing' });
    }
    const judgment = readLatestMarkdownArtifact(td, 'user-judgment-result', 'user-judgment');
    if (!judgment || frontmatterString(judgment.artifact, 'decision') !== 'revise') {
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
  const contract = readLatestMarkdownArtifact(td, 'task-contract', 'task-contract');
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
    const judgment = readLatestMarkdownArtifact(td, 'user-judgment-result', 'user-judgment');
    if (!judgment || frontmatterString(judgment.artifact, 'decision') !== 'revise') {
      failures.push({ code: 'judgment_not_revise', detail: judgment ? frontmatterString(judgment.artifact, 'decision') : 'missing' });
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
  _artifact: MarkdownArtifact,
  cwd?: string,
): GuardResult {
  if (!runState) return fail([{ code: 'run_state_missing' }]);
  if (runState.current_stage !== 'building') return fail([{ code: 'stage_not_building', detail: runState.current_stage }]);
  if (runState.current_task_id !== taskId) return fail([{ code: 'task_not_current', detail: `current=${runState.current_task_id}` }]);

  const failures: GuardFailure[] = [];
  const td = taskDir(runState.current_mission_id, taskId, cwd);
  const contract = readLatestMarkdownArtifact(td, 'task-contract', 'task-contract');
  if (!contract) failures.push({ code: 'task_contract_missing' });
  const ts = readTaskState(runState.current_mission_id, taskId, cwd);
  if (!ts) failures.push({ code: 'task_state_missing' });

  const refKeys: Record<EvidenceKind, string[]> = {
    implementation: ['task_contract_ref'],
    verification: ['task_contract_ref', 'implementation_evidence_ref'],
    review: ['task_contract_ref', 'implementation_evidence_ref', 'verification_evidence_ref'],
    challenger: ['task_contract_ref', 'implementation_evidence_ref', 'verification_evidence_ref', 'review_evidence_ref'],
    task: ['task_contract_ref', 'user_judgment_ref'],
  };
  failures.push(...checkArtifactRefKeys(runState.current_mission_id, _artifact, refKeys[kind], cwd, taskId));

  if (ts && ts.phase !== KIND_TO_REQUIRED_PHASE[kind]) {
    failures.push({ code: 'phase_does_not_match_kind', detail: `phase=${ts.phase} kind=${kind}` });
  }

  if (kind === 'task') {
    const judgment = readLatestMarkdownArtifact(td, 'user-judgment-result', 'user-judgment');
    if (!judgment || !['accepted', 'accepted_with_limits'].includes(frontmatterString(judgment.artifact, 'decision'))) {
      failures.push({ code: 'task_judgment_not_accepted', detail: judgment ? frontmatterString(judgment.artifact, 'decision') : 'missing' });
    }
    if (existsSync(`${td}/task-evidence.md`)) {
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
  const failures: GuardFailure[] = checkMissionAcceptedWindow(runState, cwd);
  if (scope === 'role') {
    if (!role) failures.push({ code: 'role_required' });
    else if (!['orchestrator', 'work-designer', 'implementer', 'verifier', 'reviewer', 'challenger'].includes(role)) {
      failures.push({ code: 'role_invalid', detail: role });
    }
  }

  for (const ref of payload.source_refs ?? []) {
    const resolved = resolveProjectRef(ref, cwd);
    if (!resolved.ok) failures.push(refFailureToGuard('source_ref', resolved));
  }

  return failures.length === 0 ? ok() : fail(failures);
}

export function checkDebtRecord(runState: RunState | null, payload: DebtRefPayload, cwd?: string): GuardResult {
  const failures = [
    ...checkMissionAcceptedWindow(runState, cwd),
    ...checkDebtRefs(payload, cwd),
  ];
  return failures.length === 0 ? ok() : fail(failures);
}

export function checkDebtUpdate(runState: RunState | null, payload: DebtRefPayload, cwd?: string): GuardResult {
  const failures = [
    ...checkMissionAcceptedWindow(runState, cwd),
    ...checkDebtRefs(payload, cwd),
  ];
  return failures.length === 0 ? ok() : fail(failures);
}

export function checkMissionEvidenceRecord(runState: RunState | null, artifact?: MarkdownArtifact, cwd?: string): GuardResult {
  if (!runState) return fail([{ code: 'run_state_missing' }]);
  const failures: GuardFailure[] = [];
  if (runState.current_mission_id === '') failures.push({ code: 'no_current_mission' });
  if (runState.current_stage !== 'consolidating') failures.push({ code: 'stage_not_consolidating', detail: runState.current_stage });
  if (runState.current_mission_id !== '') {
    const md = missionDir(runState.current_mission_id, cwd);
    const judgment = readLatestMarkdownArtifact(md, 'user-judgment-result', 'user-judgment');
    if (!judgment || !['accepted', 'accepted_with_limits'].includes(frontmatterString(judgment.artifact, 'decision'))) {
      failures.push({ code: 'mission_judgment_not_accepted' });
    }
    const evPath = pathJoin(md, 'mission-evidence.md');
    if (existsSync(evPath)) failures.push({ code: 'mission_evidence_already_exists', path: evPath });
    if (artifact) {
      failures.push(...checkArtifactRefKeys(
        runState.current_mission_id,
        artifact,
        ['mission_spec_ref', 'mission_design_ref', 'user_judgment_ref'],
        cwd,
      ));
    }
  }
  return failures.length === 0 ? ok() : fail(failures);
}
