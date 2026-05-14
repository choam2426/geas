import { Command } from 'commander';
import { frontmatterString, type MarkdownArtifact } from '../lib/artifacts';
import {
  missionDir,
  readRunState,
  taskDir,
  writeNumberedMarkdownArtifact,
} from '../lib/runtime';
import {
  emptyLocation,
  failure,
  success,
  type FailureResult,
  type SuccessResult,
} from '../lib/output';
import { checkJudgmentRecord } from '../lib/guards';
import { readMarkdownArtifact } from '../lib/io';

export type JudgmentResult = SuccessResult | FailureResult;

const COMMAND = 'judgment record';

export function runJudgmentRecord(
  target: 'task-result' | 'mission-result',
  artifact: MarkdownArtifact,
  taskId?: string,
  cwd: string = process.cwd(),
): JudgmentResult {
  const runState = readRunState(cwd);
  const current = runState
    ? { mission_id: runState.current_mission_id, stage: runState.current_stage, task_id: runState.current_task_id, phase: '' }
    : emptyLocation();

  if (frontmatterString(artifact, 'judgment_type') !== target) {
    return {
      ok: false,
      command: COMMAND,
      current,
      writes: [],
      error: { code: 'frontmatter_mismatch', detail: `judgment_type must match --target ${target}` },
    };
  }
  if (target === 'task-result' && frontmatterString(artifact, 'task_id') !== taskId) {
    return {
      ok: false,
      command: COMMAND,
      current,
      writes: [],
      error: { code: 'frontmatter_mismatch', detail: `task_id must match --task ${taskId ?? ''}` },
    };
  }

  const guard = checkJudgmentRecord(runState, target, taskId, cwd);
  if (!guard.ok) {
    return { ok: false, command: COMMAND, current, writes: [], error: { code: 'guard_failed', guards: guard.guards } };
  }

  const dir = target === 'task-result'
    ? taskDir(runState!.current_mission_id, taskId!, cwd)
    : missionDir(runState!.current_mission_id, cwd);
  const { number } = writeNumberedMarkdownArtifact(dir, 'user-judgment-result', artifact);

  const rel = target === 'task-result'
    ? `.geas/missions/${runState!.current_mission_id}/tasks/${taskId}/user-judgment-result-${String(number).padStart(3, '0')}.md`
    : `.geas/missions/${runState!.current_mission_id}/user-judgment-result-${String(number).padStart(3, '0')}.md`;

  return {
    ok: true,
    command: COMMAND,
    current,
    writes: [{ path: rel, type: 'created' }],
    state_changes: [],
  };
}

export function registerJudgment(program: Command): void {
  program
    .command('judgment')
    .description('User judgment')
    .command('record')
    .requiredOption('--target <target>', 'task-result or mission-result')
    .option('--task <task-id>', 'Required for task-result')
    .requiredOption('--from <path>', 'Markdown artifact path or - for stdin')
    .description('Record User Judgment')
    .action((opts: { target: 'task-result' | 'mission-result'; task?: string; from: string }) => {
      const read = readMarkdownArtifact(opts.from, 'user-judgment');
      if (!read.ok) {
        failure({
          ok: false,
          command: COMMAND,
          current: emptyLocation(),
          writes: [],
          error: { code: read.code, detail: read.detail },
        });
        return;
      }
      const result = runJudgmentRecord(opts.target, read.artifact, opts.task);
      if (result.ok) success(result);
      else failure(result);
    });
}
