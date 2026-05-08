import { Command } from 'commander';
import { existsSync, rmSync } from 'node:fs';
import {
  ensureDir,
  generateMissionId,
  missionDir,
  readRunState,
  taskDir,
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
import { checkMissionCreate, checkMissionDesignRecord, checkMissionSpecRecord } from '../lib/guards';
import { validate } from '../lib/schema';
import { readPayload } from '../lib/io';

const COMMAND_CREATE = 'mission create';
const COMMAND_SPEC = 'mission spec record';
const COMMAND_DESIGN = 'mission design record';

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

export function runMissionDesignRecord(payload: unknown, cwd: string = process.cwd()): MissionResult {
  const runState = readRunState(cwd);
  const current = runState
    ? { mission_id: runState.current_mission_id, stage: runState.current_stage, task_id: runState.current_task_id, phase: '' }
    : emptyLocation();

  const v = validate('mission-design', payload);
  if (!v.valid) {
    return { ok: false, command: COMMAND_DESIGN, current, writes: [], error: { code: 'schema_invalid', detail: v.errors.join('; ') } };
  }

  const guard = checkMissionDesignRecord(
    runState,
    payload as { task_breakdown: Array<{ task_id: string; depends_on: string[] }> },
    cwd,
  );
  if (!guard.ok) {
    return { ok: false, command: COMMAND_DESIGN, current, writes: [], error: { code: 'guard_failed', guards: guard.guards } };
  }

  const dir = missionDir(runState!.current_mission_id, cwd);
  const taskBreakdown = (payload as { task_breakdown: Array<{ task_id: string }> }).task_breakdown;

  // Track which task dirs we create for rollback on partial failure
  const createdTaskDirs: string[] = [];
  let writtenDesignPath: string | null = null;

  try {
    const { number, path: designPath } = writeNumberedArtifact(dir, 'mission-design', payload);
    writtenDesignPath = designPath;

    for (const t of taskBreakdown) {
      const tdir = taskDir(runState!.current_mission_id, t.task_id, cwd);
      if (!existsSync(tdir)) {
        ensureDir(tdir);
        createdTaskDirs.push(tdir);
      }
    }

    const rel = `.geas/missions/${runState!.current_mission_id}/mission-design-${String(number).padStart(3, '0')}.yaml`;
    const writes: SuccessResult['writes'] = [{ path: rel, type: 'created' }];
    for (const t of taskBreakdown) {
      writes.push({
        path: `.geas/missions/${runState!.current_mission_id}/tasks/${t.task_id}/`,
        type: 'created',
      });
    }

    return { ok: true, command: COMMAND_DESIGN, current, writes, state_changes: [] };
  } catch (e: unknown) {
    // Roll back: remove the design file and any task dirs we just created
    for (const d of createdTaskDirs) {
      try { rmSync(d, { recursive: true, force: true }); } catch { /* best-effort */ }
    }
    if (writtenDesignPath) {
      try { rmSync(writtenDesignPath, { force: true }); } catch { /* best-effort */ }
    }
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, command: COMMAND_DESIGN, current, writes: [], error: { code: 'design_record_failed', detail } };
  }
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
      const read = readPayload(opts.from);
      if (!read.ok) {
        failure({
          ok: false,
          command: 'mission spec record',
          current: emptyLocation(),
          writes: [],
          error: { code: read.code, detail: read.detail },
        });
        return;
      }
      const result = runMissionSpecRecord(read.payload);
      if (result.ok) success(result);
      else failure(result);
    });

  const design = mission.command('design').description('Mission Design baseline');
  design
    .command('record')
    .requiredOption('--from <path>', 'YAML payload path or - for stdin')
    .description('Record Mission Design baseline')
    .action((opts: { from: string }) => {
      const read = readPayload(opts.from);
      if (!read.ok) {
        failure({
          ok: false,
          command: COMMAND_DESIGN,
          current: emptyLocation(),
          writes: [],
          error: { code: read.code, detail: read.detail },
        });
        return;
      }
      const result = runMissionDesignRecord(read.payload);
      if (result.ok) success(result);
      else failure(result);
    });
}
