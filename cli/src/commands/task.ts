import { Command } from 'commander';
import { join } from 'node:path';
import { frontmatterString, kindForEvidence, type EvidenceKind, type MarkdownArtifact } from '../lib/artifacts';
import {
  readRunState,
  readTaskState,
  taskDir,
  writeTaskState,
} from '../lib/runtime';
import {
  emptyLocation,
  failure,
  success,
  type FailureResult,
  type SuccessResult,
} from '../lib/output';
import { checkTaskContractRecord, checkTaskEvidenceRecord, checkTaskTransition } from '../lib/guards';
import { readMarkdownArtifact } from '../lib/io';
import { runTransaction } from '../lib/transaction';

export type TaskResult = SuccessResult | FailureResult;

const COMMAND_CONTRACT = 'task contract record';
const COMMAND_TRANSITION = 'task transition';
const COMMAND_TASK_EVIDENCE = 'task evidence record';

const KIND_TO_PREFIX: Record<EvidenceKind, string> = {
  implementation: 'implementation-evidence',
  verification: 'verification-evidence',
  review: 'review-evidence',
  challenger: 'challenger-evidence',
  task: 'task-evidence',
};

function isEvidenceKind(value: string): value is EvidenceKind {
  return ['implementation', 'verification', 'review', 'challenger', 'task'].includes(value);
}

function nextPhaseAfterEvidence(kind: EvidenceKind, artifact: MarkdownArtifact): 'verifying' | 'reviewing' | 'awaiting_user_judgment' | 'closed' {
  if (kind === 'implementation') return 'verifying';
  if (kind === 'verification') {
    return frontmatterString(artifact, 'verdict') === 'passed' ? 'reviewing' : 'awaiting_user_judgment';
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

export function runTaskContractRecord(taskId: string, artifact: MarkdownArtifact, cwd: string = process.cwd()): TaskResult {
  const runState = readRunState(cwd);
  const ts = runState ? readTaskState(runState.current_mission_id, taskId, cwd) : null;
  const current = loc(runState, taskId, ts?.phase ?? '');

  if (frontmatterString(artifact, 'task_id') !== taskId) {
    return {
      ok: false,
      command: COMMAND_CONTRACT,
      current,
      writes: [],
      error: { code: 'frontmatter_mismatch', detail: `task_id must match --task ${taskId}` },
    };
  }

  const guard = checkTaskContractRecord({ runState, taskId, artifact }, cwd);
  if (!guard.ok) {
    return { ok: false, command: COMMAND_CONTRACT, current, writes: [], error: { code: 'guard_failed', guards: guard.guards } };
  }

  const td = taskDir(runState!.current_mission_id, taskId, cwd);
  let number = 0;
  try {
    const result = runTransaction((tx) => {
      const written = tx.writeNumberedMarkdown(td, 'task-contract', artifact);
      if (!ts) tx.writeYaml(join(td, 'task-state.yaml'), { phase: 'unstarted' });
      return written;
    });
    number = result.number;
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, command: COMMAND_CONTRACT, current, writes: [], error: { code: 'task_contract_record_failed', detail } };
  }

  const writes: SuccessResult['writes'] = [{
    path: `.geas/missions/${runState!.current_mission_id}/tasks/${taskId}/task-contract-${String(number).padStart(3, '0')}.md`,
    type: 'created',
  }];

  const stateChanges: SuccessResult['state_changes'] = [];
  if (!ts) {
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

export function runTaskEvidenceRecord(taskId: string, kind: EvidenceKind, artifact: MarkdownArtifact, cwd: string = process.cwd()): TaskResult {
  const runState = readRunState(cwd);
  const ts = runState ? readTaskState(runState.current_mission_id, taskId, cwd) : null;
  const current = loc(runState, taskId, ts?.phase ?? '');

  if (artifact.kind !== kindForEvidence(kind)) {
    return { ok: false, command: COMMAND_TASK_EVIDENCE, current, writes: [], error: { code: 'artifact_kind_mismatch', detail: artifact.kind } };
  }
  if (frontmatterString(artifact, 'task_id') !== taskId) {
    return {
      ok: false,
      command: COMMAND_TASK_EVIDENCE,
      current,
      writes: [],
      error: { code: 'frontmatter_mismatch', detail: `task_id must match --task ${taskId}` },
    };
  }

  const guard = checkTaskEvidenceRecord(runState, taskId, kind, artifact, cwd);
  if (!guard.ok) {
    return { ok: false, command: COMMAND_TASK_EVIDENCE, current, writes: [], error: { code: 'guard_failed', guards: guard.guards } };
  }

  const td = taskDir(runState!.current_mission_id, taskId, cwd);
  const writes: SuccessResult['writes'] = [];
  const fromPhase = ts!.phase;
  const toPhase = nextPhaseAfterEvidence(kind, artifact);

  try {
    if (kind === 'task') {
      runTransaction((tx) => {
        tx.writeMarkdown(join(td, 'task-evidence.md'), artifact);
        tx.writeYaml(join(td, 'task-state.yaml'), { phase: toPhase });
      });
      writes.push({ path: `.geas/missions/${runState!.current_mission_id}/tasks/${taskId}/task-evidence.md`, type: 'created' });
    } else {
      const { number } = runTransaction((tx) => {
        const written = tx.writeNumberedMarkdown(td, KIND_TO_PREFIX[kind], artifact);
        tx.writeYaml(join(td, 'task-state.yaml'), { phase: toPhase });
        return written;
      });
      writes.push({ path: `.geas/missions/${runState!.current_mission_id}/tasks/${taskId}/${KIND_TO_PREFIX[kind]}-${String(number).padStart(3, '0')}.md`, type: 'created' });
    }
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, command: COMMAND_TASK_EVIDENCE, current, writes: [], error: { code: 'task_evidence_record_failed', detail } };
  }

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
    .requiredOption('--from <path>', 'Markdown artifact path or - for stdin')
    .description('Record Task Contract baseline')
    .action((opts: { task: string; from: string }) => {
      const read = readMarkdownArtifact(opts.from, 'task-contract');
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
      const result = runTaskContractRecord(opts.task, read.artifact);
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
    .requiredOption('--from <path>', 'Markdown artifact path or - for stdin')
    .description('Record Task scope Evidence')
    .action((opts: { task: string; kind: string; from: string }) => {
      if (!isEvidenceKind(opts.kind)) {
        failure({
          ok: false,
          command: COMMAND_TASK_EVIDENCE,
          current: emptyLocation(),
          writes: [],
          error: { code: 'flag_invalid', detail: `kind=${opts.kind}` },
        });
        return;
      }
      const read = readMarkdownArtifact(opts.from, kindForEvidence(opts.kind));
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
      const result = runTaskEvidenceRecord(opts.task, opts.kind, read.artifact);
      if (result.ok) success(result);
      else failure(result);
    });
}
