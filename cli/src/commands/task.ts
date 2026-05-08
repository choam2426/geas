import { Command } from 'commander';
import {
  ensureDir,
  readRunState,
  readTaskState,
  taskDir,
  writeNumberedArtifact,
  writeTaskState,
} from '../lib/runtime';
import {
  emptyLocation,
  failure,
  success,
  type FailureResult,
  type SuccessResult,
} from '../lib/output';
import { checkTaskContractRecord } from '../lib/guards';
import { validate } from '../lib/schema';
import { readPayload } from '../lib/io';

export type TaskResult = SuccessResult | FailureResult;

const COMMAND_CONTRACT = 'task contract record';

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
}
