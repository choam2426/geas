import { Command } from 'commander';
import {
  ensureDir,
  readRunState,
  readTaskState,
  taskDir,
  writeNumberedArtifact,
  writeTaskState,
  writeYamlAtomic,
} from '../lib/runtime';
import {
  emptyLocation,
  failure,
  success,
  type FailureResult,
  type SuccessResult,
} from '../lib/output';
import { checkTaskContractRecord, checkTaskEvidenceRecord, checkTaskTransition } from '../lib/guards';
import { validate, type SchemaId } from '../lib/schema';
import { readPayload } from '../lib/io';

export type TaskResult = SuccessResult | FailureResult;

const COMMAND_CONTRACT = 'task contract record';
const COMMAND_TRANSITION = 'task transition';
const COMMAND_TASK_EVIDENCE = 'task evidence record';

type EvidenceKind = 'implementation' | 'verification' | 'review' | 'challenger' | 'task';

const KIND_TO_SCHEMA: Record<EvidenceKind, SchemaId> = {
  implementation: 'implementation-evidence',
  verification: 'verification-evidence',
  review: 'review-evidence',
  challenger: 'challenger-evidence',
  task: 'task-evidence',
};

const KIND_TO_PREFIX: Record<EvidenceKind, string> = {
  implementation: 'implementation-evidence',
  verification: 'verification-evidence',
  review: 'review-evidence',
  challenger: 'challenger-evidence',
  task: 'task-evidence',
};

function nextPhaseAfterEvidence(kind: EvidenceKind, payload: { verdict?: string }): 'verifying' | 'reviewing' | 'awaiting_user_judgment' | 'closed' {
  if (kind === 'implementation') return 'verifying';
  if (kind === 'verification') {
    return payload.verdict === 'passed' ? 'reviewing' : 'awaiting_user_judgment';
  }
  if (kind === 'review' || kind === 'challenger') return 'awaiting_user_judgment';
  return 'closed';
}

const ALLOWED_PHASES = ['unstarted', 'implementing', 'verifying', 'reviewing', 'challenging', 'awaiting_user_judgment', 'closed'] as const;
type Phase = (typeof ALLOWED_PHASES)[number];

function loc(state: ReturnType<typeof readRunState>, taskId: string, phase: string) {
  if (!state) return emptyLocation();
  return { mission_id: state.current_mission_id, stage: state.current_stage, task_id: taskId || state.current_task_id, phase };
}

export function runTaskContractRecord(taskId: string, payload: unknown, cwd: string = process.cwd()): TaskResult {
  const runState = readRunState(cwd);
  const ts = runState ? readTaskState(runState.current_mission_id, taskId, cwd) : null;
  const current = loc(runState, taskId, ts?.phase ?? '');

  const v = validate('task-contract', payload);
  if (!v.valid) {
    return { ok: false, command: COMMAND_CONTRACT, current, writes: [], error: { code: 'schema_invalid', detail: v.errors.join('; ') } };
  }

  const guard = checkTaskContractRecord({ runState, taskId }, cwd);
  if (!guard.ok) {
    return { ok: false, command: COMMAND_CONTRACT, current, writes: [], error: { code: 'guard_failed', guards: guard.guards } };
  }

  const td = taskDir(runState!.current_mission_id, taskId, cwd);
  ensureDir(td);
  const { number } = writeNumberedArtifact(td, 'task-contract', payload);
  const writes: SuccessResult['writes'] = [{
    path: `.geas/missions/${runState!.current_mission_id}/tasks/${taskId}/task-contract-${String(number).padStart(3, '0')}.yaml`,
    type: 'created',
  }];

  const stateChanges: SuccessResult['state_changes'] = [];
  if (!ts) {
    writeTaskState(runState!.current_mission_id, taskId, { phase: 'unstarted' }, cwd);
    writes.push({
      path: `.geas/missions/${runState!.current_mission_id}/tasks/${taskId}/task-state.yaml`,
      type: 'created',
    });
    stateChanges.push({ pointer: `task[${taskId}].phase`, from: '', to: 'unstarted' });
  }

  return {
    ok: true,
    command: COMMAND_CONTRACT,
    current: loc(runState, taskId, ts?.phase ?? 'unstarted'),
    writes,
    state_changes: stateChanges,
  };
}

export function runTaskTransition(taskId: string, toPhase: Phase, cwd: string = process.cwd()): TaskResult {
  const runState = readRunState(cwd);
  const ts = runState ? readTaskState(runState.current_mission_id, taskId, cwd) : null;
  const current = loc(runState, taskId, ts?.phase ?? '');

  if (toPhase === 'closed') {
    return {
      ok: false,
      command: COMMAND_TRANSITION,
      current,
      writes: [],
      error: {
        code: 'guard_failed',
        guards: [{ code: 'transition_not_allowed', detail: 'closed reached only via task evidence record' }],
      },
    };
  }

  const guard = checkTaskTransition(runState, taskId, toPhase, cwd);
  if (!guard.ok) {
    return { ok: false, command: COMMAND_TRANSITION, current, writes: [], error: { code: 'guard_failed', guards: guard.guards } };
  }

  const before = ts!.phase;
  writeTaskState(runState!.current_mission_id, taskId, { phase: toPhase }, cwd);
  return {
    ok: true,
    command: COMMAND_TRANSITION,
    current: { ...current, phase: toPhase },
    writes: [],
    state_changes: [{ pointer: `task[${taskId}].phase`, from: before, to: toPhase }],
  };
}

export function runTaskEvidenceRecord(taskId: string, kind: EvidenceKind, payload: unknown, cwd: string = process.cwd()): TaskResult {
  const runState = readRunState(cwd);
  const ts = runState ? readTaskState(runState.current_mission_id, taskId, cwd) : null;
  const current = loc(runState, taskId, ts?.phase ?? '');

  const v = validate(KIND_TO_SCHEMA[kind], payload);
  if (!v.valid) {
    return { ok: false, command: COMMAND_TASK_EVIDENCE, current, writes: [], error: { code: 'schema_invalid', detail: v.errors.join('; ') } };
  }

  const guard = checkTaskEvidenceRecord(runState, taskId, kind, payload as { verdict?: string }, cwd);
  if (!guard.ok) {
    return { ok: false, command: COMMAND_TASK_EVIDENCE, current, writes: [], error: { code: 'guard_failed', guards: guard.guards } };
  }

  const td = taskDir(runState!.current_mission_id, taskId, cwd);
  const writes: SuccessResult['writes'] = [];

  if (kind === 'task') {
    writeYamlAtomic(`${td}/task-evidence.yaml`, payload);
    writes.push({ path: `.geas/missions/${runState!.current_mission_id}/tasks/${taskId}/task-evidence.yaml`, type: 'created' });
  } else {
    const { number } = writeNumberedArtifact(td, KIND_TO_PREFIX[kind], payload);
    writes.push({ path: `.geas/missions/${runState!.current_mission_id}/tasks/${taskId}/${KIND_TO_PREFIX[kind]}-${String(number).padStart(3, '0')}.yaml`, type: 'created' });
  }

  const fromPhase = ts!.phase;
  const toPhase = nextPhaseAfterEvidence(kind, payload as { verdict?: string });
  writeTaskState(runState!.current_mission_id, taskId, { phase: toPhase }, cwd);

  return {
    ok: true,
    command: COMMAND_TASK_EVIDENCE,
    current: { ...current, phase: toPhase },
    writes,
    state_changes: [{ pointer: `task[${taskId}].phase`, from: fromPhase, to: toPhase }],
  };
}

export function registerTask(program: Command): void {
  const task = program.command('task').description('Task lifecycle commands');

  const contract = task.command('contract').description('Task Contract baseline');
  contract
    .command('record')
    .requiredOption('--task <task-id>', 'Target task id')
    .requiredOption('--from <path>', 'YAML payload path or - for stdin')
    .description('Record Task Contract baseline')
    .action((opts: { task: string; from: string }) => {
      const read = readPayload(opts.from);
      if (!read.ok) {
        failure({
          ok: false,
          command: COMMAND_CONTRACT,
          current: emptyLocation(),
          writes: [],
          error: { code: read.code, detail: read.detail },
        });
        return;
      }
      const result = runTaskContractRecord(opts.task, read.payload);
      if (result.ok) success(result);
      else failure(result);
    });

  task
    .command('transition')
    .requiredOption('--task <task-id>', 'Target task id')
    .requiredOption('--to <phase>', 'Target phase')
    .description('Transition task phase explicitly')
    .action((opts: { task: string; to: Phase }) => {
      const result = runTaskTransition(opts.task, opts.to);
      if (result.ok) success(result);
      else failure(result);
    });

  const evidence = task.command('evidence').description('Task scope Evidence');
  evidence
    .command('record')
    .requiredOption('--task <task-id>', 'Target task id')
    .requiredOption('--kind <kind>', 'implementation|verification|review|challenger|task')
    .requiredOption('--from <path>', 'YAML payload path or - for stdin')
    .description('Record Task scope Evidence')
    .action((opts: { task: string; kind: EvidenceKind; from: string }) => {
      const read = readPayload(opts.from);
      if (!read.ok) {
        failure({
          ok: false,
          command: COMMAND_TASK_EVIDENCE,
          current: emptyLocation(),
          writes: [],
          error: { code: read.code, detail: read.detail },
        });
        return;
      }
      const result = runTaskEvidenceRecord(opts.task, opts.kind, read.payload);
      if (result.ok) success(result);
      else failure(result);
    });
}
