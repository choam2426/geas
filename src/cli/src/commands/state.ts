/**
 * `geas state` — low-level read/write for mission-state.json and
 * task-state.json.
 *
 * G1 exposes a thin primitive: get/set the raw artifact. Phase- and
 * lifecycle-aware transitions live on the `mission` and `task` commands
 * (added in G2 and G3); this command does not enforce them.
 *
 * Subcommands:
 *   geas state mission-get  --mission <id>
 *   geas state mission-set  --mission <id>      (stdin JSON)
 *   geas state task-get     --mission <id> --task <id>
 *   geas state task-set     --mission <id> --task <id>  (stdin JSON)
 */

import type { Command } from 'commander';
import { emit, err, ok } from '../lib/envelope';
import { readJsonFile, atomicWriteJson, ensureDir } from '../lib/fs-atomic';
import * as path from 'path';
import {
  findProjectRoot,
  isValidMissionId,
  isValidTaskId,
  missionStatePath,
  taskStatePath,
  tmpDir,
} from '../lib/paths';
import { readStdinJson, StdinError } from '../lib/input';
import { validate } from '../lib/schema';

function needProjectRoot(): string {
  const root = findProjectRoot(process.cwd());
  if (!root) {
    emit(err('missing_artifact', `.geas/ not found at ${process.cwd().replace(/\\/g, '/')}. Run 'geas setup' first.`));
  }
  return root as string;
}

function nowUtc(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function registerStateCommands(program: Command): void {
  const state = program.command('state').description('Low-level mission/task state read and write');

  state
    .command('mission-get')
    .description('Print mission-state.json for a mission')
    .requiredOption('--mission <id>', 'Mission ID')
    .action((opts: { mission: string }) => {
      if (!isValidMissionId(opts.mission)) {
        emit(err('invalid_argument', `invalid mission id '${opts.mission}'`));
      }
      const root = needProjectRoot();
      const p = missionStatePath(root, opts.mission);
      const data = readJsonFile<Record<string, unknown>>(p);
      if (!data) emit(err('missing_artifact', `mission-state.json not found for ${opts.mission}`));
      emit(ok({ path: p.replace(/\\/g, '/'), state: data }));
    });

  state
    .command('mission-set')
    .description('Replace mission-state.json (stdin JSON; validated against mission-state schema)')
    .requiredOption('--mission <id>', 'Mission ID')
    .action((opts: { mission: string }) => {
      if (!isValidMissionId(opts.mission)) {
        emit(err('invalid_argument', `invalid mission id '${opts.mission}'`));
      }
      const root = needProjectRoot();
      let payload: Record<string, unknown>;
      try {
        payload = readStdinJson() as Record<string, unknown>;
      } catch (e) {
        if (e instanceof StdinError) emit(err('invalid_argument', e.message));
        throw e;
      }
      // Inject bookkeeping timestamps and mission_id.
      const p = missionStatePath(root, opts.mission);
      const existing = readJsonFile<Record<string, unknown>>(p);
      const ts = nowUtc();
      payload.mission_id = opts.mission;
      payload.updated_at = ts;
      payload.created_at = (existing?.created_at as string | undefined) ?? ts;

      const v = validate('mission-state', payload);
      if (!v.ok) {
        emit(err('schema_validation_failed', 'mission-state schema validation failed', v.errors));
      }
      ensureDir(path.dirname(p));
      atomicWriteJson(p, payload, tmpDir(root));
      // Automation-scope discipline: raw state-set is a low-level
      // primitive; protocol-level transitions (e.g. mission phase
      // advance) emit their own event. No event here.
      emit(ok({ path: p.replace(/\\/g, '/'), state: payload }));
    });

  state
    .command('task-get')
    .description('Print task-state.json for a task')
    .requiredOption('--mission <id>', 'Mission ID')
    .requiredOption('--task <id>', 'Task ID')
    .action((opts: { mission: string; task: string }) => {
      if (!isValidMissionId(opts.mission)) emit(err('invalid_argument', `invalid mission id '${opts.mission}'`));
      if (!isValidTaskId(opts.task)) emit(err('invalid_argument', `invalid task id '${opts.task}'`));
      const root = needProjectRoot();
      const p = taskStatePath(root, opts.mission, opts.task);
      const data = readJsonFile<Record<string, unknown>>(p);
      if (!data) emit(err('missing_artifact', `task-state.json not found for ${opts.task}`));
      emit(ok({ path: p.replace(/\\/g, '/'), state: data }));
    });

  state
    .command('task-set')
    .description('Replace task-state.json (stdin JSON; validated against task-state schema)')
    .requiredOption('--mission <id>', 'Mission ID')
    .requiredOption('--task <id>', 'Task ID')
    .action((opts: { mission: string; task: string }) => {
      if (!isValidMissionId(opts.mission)) emit(err('invalid_argument', `invalid mission id '${opts.mission}'`));
      if (!isValidTaskId(opts.task)) emit(err('invalid_argument', `invalid task id '${opts.task}'`));
      const root = needProjectRoot();
      let payload: Record<string, unknown>;
      try {
        payload = readStdinJson() as Record<string, unknown>;
      } catch (e) {
        if (e instanceof StdinError) emit(err('invalid_argument', e.message));
        throw e;
      }
      const p = taskStatePath(root, opts.mission, opts.task);
      const existing = readJsonFile<Record<string, unknown>>(p);
      const ts = nowUtc();
      payload.mission_id = opts.mission;
      payload.task_id = opts.task;
      payload.updated_at = ts;
      payload.created_at = (existing?.created_at as string | undefined) ?? ts;

      const v = validate('task-state', payload);
      if (!v.ok) {
        emit(err('schema_validation_failed', 'task-state schema validation failed', v.errors));
      }
      ensureDir(path.dirname(p));
      atomicWriteJson(p, payload, tmpDir(root));
      // Automation-scope discipline: raw state-set is a low-level
      // primitive; lifecycle transitions (e.g. task state transition)
      // emit their own event. No event here.
      emit(ok({ path: p.replace(/\\/g, '/'), state: payload }));
    });
}
