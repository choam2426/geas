import { Command } from 'commander';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { frontmatterString, type MarkdownArtifact } from '../lib/artifacts';
import {
  generateMissionId,
  geasRoot,
  missionDir,
  readLatestMarkdownArtifact,
  readRunState,
  writeNumberedMarkdownArtifact,
} from '../lib/runtime';
import {
  emptyLocation,
  failure,
  success,
  type FailureResult,
  type SuccessResult,
} from '../lib/output';
import { checkMissionCreate, checkMissionDesignRecord, checkMissionEvidenceRecord, checkMissionSpecRecord, checkMissionTransition } from '../lib/guards';
import { readMarkdownArtifact } from '../lib/io';
import { runTransaction } from '../lib/transaction';

const COMMAND_CREATE = 'mission create';
const COMMAND_SPEC = 'mission spec record';
const COMMAND_DESIGN = 'mission design record';
const COMMAND_TRANSITION = 'mission transition';
const COMMAND_MISSION_EVIDENCE = 'mission evidence record';

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
    runTransaction((tx) => {
      tx.ensureDir(dir);
      tx.writeYaml(join(geasRoot(cwd), 'run-state.yaml'), newState);
    });
  } catch (e: unknown) {
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

export function runMissionSpecRecord(artifact: MarkdownArtifact, cwd: string = process.cwd()): MissionResult {
  const runState = readRunState(cwd);
  const current = runState
    ? { mission_id: runState.current_mission_id, stage: runState.current_stage, task_id: runState.current_task_id, phase: '' }
    : emptyLocation();

  if (artifact.kind !== 'mission-spec') {
    return { ok: false, command: COMMAND_SPEC, current, writes: [], error: { code: 'artifact_kind_mismatch', detail: artifact.kind } };
  }

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

  const dir = missionDir(runState!.current_mission_id, cwd);
  const { number } = writeNumberedMarkdownArtifact(dir, 'mission-spec', artifact);
  const rel = `.geas/missions/${runState!.current_mission_id}/mission-spec-${String(number).padStart(3, '0')}.md`;

  return {
    ok: true,
    command: COMMAND_SPEC,
    current,
    writes: [{ path: rel, type: 'created' }],
    state_changes: [],
  };
}

export function runMissionDesignRecord(artifact: MarkdownArtifact, cwd: string = process.cwd()): MissionResult {
  const runState = readRunState(cwd);
  const current = runState
    ? { mission_id: runState.current_mission_id, stage: runState.current_stage, task_id: runState.current_task_id, phase: '' }
    : emptyLocation();

  if (artifact.kind !== 'mission-design') {
    return { ok: false, command: COMMAND_DESIGN, current, writes: [], error: { code: 'artifact_kind_mismatch', detail: artifact.kind } };
  }

  const guard = checkMissionDesignRecord(runState, cwd);
  if (!guard.ok) {
    return { ok: false, command: COMMAND_DESIGN, current, writes: [], error: { code: 'guard_failed', guards: guard.guards } };
  }

  const dir = missionDir(runState!.current_mission_id, cwd);
  const spec = readLatestMarkdownArtifact(dir, 'mission-spec', 'mission-spec');
  if (spec && frontmatterString(spec.artifact, 'name') !== frontmatterString(artifact, 'name')) {
    return {
      ok: false,
      command: COMMAND_DESIGN,
      current,
      writes: [],
      error: { code: 'frontmatter_mismatch', detail: 'name does not match current Mission Spec' },
    };
  }
  let writtenDesignPath: string | null = null;

  try {
    const { number, path: designPath } = writeNumberedMarkdownArtifact(dir, 'mission-design', artifact);
    writtenDesignPath = designPath;

    const rel = `.geas/missions/${runState!.current_mission_id}/mission-design-${String(number).padStart(3, '0')}.md`;
    const writes: SuccessResult['writes'] = [{ path: rel, type: 'created' }];

    return { ok: true, command: COMMAND_DESIGN, current, writes, state_changes: [] };
  } catch (e: unknown) {
    // Roll back the design file if the numbered write partially succeeded.
    if (writtenDesignPath) {
      try { rmSync(writtenDesignPath, { force: true }); } catch { /* best-effort */ }
    }
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, command: COMMAND_DESIGN, current, writes: [], error: { code: 'design_record_failed', detail } };
  }
}

export function runMissionTransition(
  toStage: 'specifying' | 'building' | 'consolidating',
  taskId?: string,
  cwd: string = process.cwd(),
): MissionResult {
  const runState = readRunState(cwd);
  const current = runState
    ? { mission_id: runState.current_mission_id, stage: runState.current_stage, task_id: runState.current_task_id, phase: '' }
    : emptyLocation();

  const guard = checkMissionTransition(runState, toStage, taskId, cwd);
  if (!guard.ok) {
    return { ok: false, command: COMMAND_TRANSITION, current, writes: [], error: { code: 'guard_failed', guards: guard.guards } };
  }

  const before = { ...runState! };
  const next = {
    current_mission_id: runState!.current_mission_id,
    current_stage: toStage,
    current_task_id: toStage === 'building' ? taskId! : '',
  };
  runTransaction((tx) => {
    tx.writeYaml(join(geasRoot(cwd), 'run-state.yaml'), next);
  });

  const stateChanges: SuccessResult['state_changes'] = [];
  if (before.current_stage !== next.current_stage) {
    stateChanges.push({ pointer: 'current_stage', from: before.current_stage, to: next.current_stage });
  }
  if (before.current_task_id !== next.current_task_id) {
    stateChanges.push({ pointer: 'current_task_id', from: before.current_task_id, to: next.current_task_id });
  }

  return {
    ok: true,
    command: COMMAND_TRANSITION,
    current: { mission_id: next.current_mission_id, stage: next.current_stage, task_id: next.current_task_id, phase: '' },
    writes: [],
    state_changes: stateChanges,
  };
}

export function runMissionEvidenceRecord(artifact: MarkdownArtifact, cwd: string = process.cwd()): MissionResult {
  const runState = readRunState(cwd);
  const current = runState
    ? { mission_id: runState.current_mission_id, stage: runState.current_stage, task_id: runState.current_task_id, phase: '' }
    : emptyLocation();

  if (artifact.kind !== 'mission-evidence') {
    return { ok: false, command: COMMAND_MISSION_EVIDENCE, current, writes: [], error: { code: 'artifact_kind_mismatch', detail: artifact.kind } };
  }

  const guard = checkMissionEvidenceRecord(runState, artifact, cwd);
  if (!guard.ok) {
    return { ok: false, command: COMMAND_MISSION_EVIDENCE, current, writes: [], error: { code: 'guard_failed', guards: guard.guards } };
  }

  const md = missionDir(runState!.current_mission_id, cwd);
  const spec = readLatestMarkdownArtifact(md, 'mission-spec', 'mission-spec');
  if (spec && frontmatterString(spec.artifact, 'name') !== frontmatterString(artifact, 'name')) {
    return {
      ok: false,
      command: COMMAND_MISSION_EVIDENCE,
      current,
      writes: [],
      error: { code: 'frontmatter_mismatch', detail: 'name does not match current Mission Spec' },
    };
  }
  const evPath = join(md, 'mission-evidence.md');
  const before = { ...runState! };

  const next = { current_mission_id: '', current_stage: '' as const, current_task_id: '' };
  try {
    runTransaction((tx) => {
      tx.writeMarkdown(evPath, artifact);
      tx.writeYaml(join(geasRoot(cwd), 'run-state.yaml'), next);
    });
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, command: COMMAND_MISSION_EVIDENCE, current, writes: [], error: { code: 'mission_evidence_record_failed', detail } };
  }

  const rel = `.geas/missions/${before.current_mission_id}/mission-evidence.md`;
  return {
    ok: true,
    command: COMMAND_MISSION_EVIDENCE,
    current: { mission_id: '', stage: '', task_id: '', phase: '' },
    writes: [{ path: rel, type: 'created' }],
    state_changes: [
      { pointer: 'current_mission_id', from: before.current_mission_id, to: '' },
      { pointer: 'current_stage', from: before.current_stage, to: '' },
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

  const spec = mission.command('spec').description('Mission Spec baseline');
  spec
    .command('record')
    .requiredOption('--from <path>', 'Markdown artifact path or - for stdin')
    .description('Record Mission Spec baseline')
    .action((opts: { from: string }) => {
      const read = readMarkdownArtifact(opts.from, 'mission-spec');
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
      const result = runMissionSpecRecord(read.artifact);
      if (result.ok) success(result);
      else failure(result);
    });

  const design = mission.command('design').description('Mission Design baseline');
  design
    .command('record')
    .requiredOption('--from <path>', 'Markdown artifact path or - for stdin')
    .description('Record Mission Design baseline')
    .action((opts: { from: string }) => {
      const read = readMarkdownArtifact(opts.from, 'mission-design');
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
      const result = runMissionDesignRecord(read.artifact);
      if (result.ok) success(result);
      else failure(result);
    });

  mission
    .command('transition')
    .requiredOption('--to <stage>', 'Target stage: specifying, building, or consolidating')
    .option('--task <task-id>', 'Required when --to=building')
    .description('Transition mission stage')
    .action((opts: { to: 'specifying' | 'building' | 'consolidating'; task?: string }) => {
      const result = runMissionTransition(opts.to, opts.task);
      if (result.ok) success(result);
      else failure(result);
    });

  const evidence = mission.command('evidence').description('Mission Evidence');
  evidence
    .command('record')
    .requiredOption('--from <path>', 'Markdown artifact path or - for stdin')
    .description('Record Mission Evidence (mission closure summary)')
    .action((opts: { from: string }) => {
      const read = readMarkdownArtifact(opts.from, 'mission-evidence');
      if (!read.ok) {
        failure({
          ok: false,
          command: COMMAND_MISSION_EVIDENCE,
          current: emptyLocation(),
          writes: [],
          error: { code: read.code, detail: read.detail },
        });
        return;
      }
      const result = runMissionEvidenceRecord(read.artifact);
      if (result.ok) success(result);
      else failure(result);
    });
}
