import { Command } from 'commander';
import { existsSync } from 'node:fs';
import {
  ensureDir,
  generateMissionId,
  missionDir,
  readRunState,
  writeRunState,
} from '../lib/runtime';
import {
  emptyLocation,
  failure,
  success,
  type FailureResult,
  type SuccessResult,
} from '../lib/output';
import { checkMissionCreate } from '../lib/guards';

const COMMAND_CREATE = 'mission create';

export type MissionResult = SuccessResult | FailureResult;

export function runMissionCreate(cwd: string = process.cwd()): MissionResult {
  const runState = readRunState(cwd);
  const guard = checkMissionCreate(runState);
  if (!guard.ok) {
    return {
      ok: false,
      command: COMMAND_CREATE,
      current: emptyLocation(),
      writes: [],
      error: { code: 'guard_failed', guards: guard.guards },
    };
  }

  let id = generateMissionId();
  while (existsSync(missionDir(id, cwd))) {
    id = generateMissionId();
  }
  ensureDir(missionDir(id, cwd));

  const newState = {
    current_mission_id: id,
    current_stage: 'specifying' as const,
    current_task_id: '',
  };
  writeRunState(newState, cwd);

  return {
    ok: true,
    command: COMMAND_CREATE,
    current: { mission_id: id, stage: 'specifying', task_id: '', phase: '' },
    writes: [{ path: `.geas/missions/${id}/`, type: 'created' }],
    state_changes: [
      { pointer: 'current_mission_id', from: '', to: id },
      { pointer: 'current_stage', from: '', to: 'specifying' },
    ],
  };
}

export function registerMission(program: Command): void {
  const mission = program.command('mission').description('Mission lifecycle commands');
  mission
    .command('create')
    .description('Create a new Mission and enter the specifying stage')
    .action(() => {
      const result = runMissionCreate();
      if (result.ok) success(result);
      else failure(result);
    });
}
