import { Command } from 'commander';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  ALL_ROLES,
  geasRoot,
  missionDir,
  readLatestMarkdownArtifact,
  readRunState,
  readTaskState,
  relGeasPath,
  taskDir,
} from '../lib/runtime';
import { emptyLocation, failure, success, type FailureResult, type SuccessResult } from '../lib/output';

const COMMAND = 'status';

type StatusPaths = {
  run_state: string;
  debt_ledger: string;
  memory: {
    common: string;
    roles: Record<string, string>;
  };
  current_mission: {
    mission_dir: string;
    mission_spec: string;
    mission_design: string;
    mission_judgment: string;
    mission_evidence: string;
  };
  current_task: {
    task_dir: string;
    task_state: string;
    task_contract: string;
    task_judgment: string;
    task_evidence: string;
  };
};

export type StatusResult = (SuccessResult & { paths: StatusPaths }) | FailureResult;

export function runStatus(cwd: string = process.cwd()): StatusResult {
  const root = geasRoot(cwd);
  const runState = readRunState(cwd);
  if (!runState) {
    return {
      ok: false,
      command: COMMAND,
      current: emptyLocation(),
      writes: [],
      error: { code: 'run_state_missing', detail: '.geas/run-state.yaml' },
    };
  }

  const current = {
    mission_id: runState.current_mission_id,
    stage: runState.current_stage,
    task_id: runState.current_task_id,
    phase: '',
  };

  const rolePaths: Record<string, string> = {};
  for (const role of ALL_ROLES) {
    rolePaths[role] = `.geas/memory/roles/${role}.yaml`;
  }

  let missionPaths: StatusPaths['current_mission'] = {
    mission_dir: '',
    mission_spec: '',
    mission_design: '',
    mission_judgment: '',
    mission_evidence: '',
  };
  let taskPaths: StatusPaths['current_task'] = {
    task_dir: '',
    task_state: '',
    task_contract: '',
    task_judgment: '',
    task_evidence: '',
  };

  if (runState.current_mission_id !== '') {
    const md = missionDir(runState.current_mission_id, cwd);
    const missionSpec = readLatestMarkdownArtifact(md, 'mission-spec', 'mission-spec');
    const missionDesign = readLatestMarkdownArtifact(md, 'mission-design', 'mission-design');
    const missionJudgment = readLatestMarkdownArtifact(md, 'user-judgment-result', 'user-judgment');
    const missionEvidence = join(md, 'mission-evidence.md');
    missionPaths = {
      mission_dir: relGeasPath(md, cwd),
      mission_spec: missionSpec ? relGeasPath(missionSpec.path, cwd) : '',
      mission_design: missionDesign ? relGeasPath(missionDesign.path, cwd) : '',
      mission_judgment: missionJudgment ? relGeasPath(missionJudgment.path, cwd) : '',
      mission_evidence: existsSync(missionEvidence) ? relGeasPath(missionEvidence, cwd) : '',
    };

    if (runState.current_task_id !== '') {
      const td = taskDir(runState.current_mission_id, runState.current_task_id, cwd);
      const taskState = readTaskState(runState.current_mission_id, runState.current_task_id, cwd);
      const taskContract = readLatestMarkdownArtifact(td, 'task-contract', 'task-contract');
      const taskJudgment = readLatestMarkdownArtifact(td, 'user-judgment-result', 'user-judgment');
      const taskEvidence = join(td, 'task-evidence.md');
      current.phase = taskState?.phase ?? '';
      taskPaths = {
        task_dir: relGeasPath(td, cwd),
        task_state: existsSync(join(td, 'task-state.yaml')) ? relGeasPath(join(td, 'task-state.yaml'), cwd) : '',
        task_contract: taskContract ? relGeasPath(taskContract.path, cwd) : '',
        task_judgment: taskJudgment ? relGeasPath(taskJudgment.path, cwd) : '',
        task_evidence: existsSync(taskEvidence) ? relGeasPath(taskEvidence, cwd) : '',
      };
    }
  }

  return {
    ok: true,
    command: COMMAND,
    current,
    writes: [],
    state_changes: [],
    paths: {
      run_state: '.geas/run-state.yaml',
      debt_ledger: existsSync(join(root, 'debts.yaml')) ? '.geas/debts.yaml' : '',
      memory: {
        common: '.geas/memory/common.yaml',
        roles: rolePaths,
      },
      current_mission: missionPaths,
      current_task: taskPaths,
    },
  };
}

export function registerStatus(program: Command): void {
  program
    .command('status')
    .description('Show read-only runtime status')
    .action(() => {
      const result = runStatus();
      if (result.ok) success(result);
      else failure(result);
    });
}
