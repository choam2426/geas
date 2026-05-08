import { Command } from 'commander';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import * as yaml from 'js-yaml';
import {
  ensureDir,
  generateMissionId,
  missionDir,
  readRunState,
  writeNumberedArtifact,
  writeRunState,
} from '../lib/runtime';
import {
  emptyLocation,
  failure,
  success,
  type FailureResult,
  type SuccessResult,
} from '../lib/output';
import { checkMissionCreate, checkMissionSpecRecord } from '../lib/guards';
import { validate } from '../lib/schema';

const COMMAND_CREATE = 'mission create';
const COMMAND_SPEC = 'mission spec record';

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
  const dir = missionDir(id, cwd);

  const newState = {
    current_mission_id: id,
    current_stage: 'specifying' as const,
    current_task_id: '',
  };

  try {
    ensureDir(dir);
    writeRunState(newState, cwd);
  } catch (e: unknown) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort rollback
    }
    const detail = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      command: COMMAND_CREATE,
      current: emptyLocation(),
      writes: [],
      error: { code: 'mission_create_failed', detail },
    };
  }

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

export function runMissionSpecRecord(payload: unknown, cwd: string = process.cwd()): MissionResult {
  const runState = readRunState(cwd);
  const current = runState
    ? { mission_id: runState.current_mission_id, stage: runState.current_stage, task_id: runState.current_task_id, phase: '' }
    : emptyLocation();

  const guard = checkMissionSpecRecord(runState);
  if (!guard.ok) {
    return {
      ok: false,
      command: COMMAND_SPEC,
      current,
      writes: [],
      error: { code: 'guard_failed', guards: guard.guards },
    };
  }

  const v = validate('mission-spec', payload);
  if (!v.valid) {
    return {
      ok: false,
      command: COMMAND_SPEC,
      current,
      writes: [],
      error: { code: 'schema_invalid', detail: v.errors.join('; ') },
    };
  }

  const dir = missionDir(runState!.current_mission_id, cwd);
  const { number } = writeNumberedArtifact(dir, 'mission-spec', payload);
  const rel = `.geas/missions/${runState!.current_mission_id}/mission-spec-${String(number).padStart(3, '0')}.yaml`;

  return {
    ok: true,
    command: COMMAND_SPEC,
    current,
    writes: [{ path: rel, type: 'created' }],
    state_changes: [],
  };
}

function readPayload(from: string): unknown {
  const text = from === '-' ? readFileSync(0, 'utf8') : readFileSync(from, 'utf8');
  return yaml.load(text, { schema: yaml.CORE_SCHEMA });
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

  const spec = mission.command('spec').description('Mission Spec baseline');
  spec
    .command('record')
    .requiredOption('--from <path>', 'YAML payload path or - for stdin')
    .description('Record Mission Spec baseline')
    .action((opts: { from: string }) => {
      const payload = readPayload(opts.from);
      const result = runMissionSpecRecord(payload);
      if (result.ok) success(result);
      else failure(result);
    });
}
