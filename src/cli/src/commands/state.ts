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
 *   geas state mission-set  --mission <id>  [--payload-from-file <p> | --file <p> | stdin]
 *   geas state task-get     --mission <id> --task <id>
 *   geas state task-set     --mission <id> --task <id>  [--payload-from-file <p> | --file <p> | stdin]
 *
 * T2.a (mission-20260427-xIPG1sDY task-002): migrated off the legacy
 * envelope.emit/err/ok bridge to call output.emitOk / output.emitErr +
 * errors.makeError directly. Per AC1 the set subcommands gain
 * --payload-from-file as the explicit free-body inline-flag fallback;
 * the historical --file option is preserved as a functional alias so
 * existing scripts and skills keep working through T2/T3. Per AC2 the
 * error category mapping rotates exit codes:
 *   - missing_artifact: legacy 1 → category 4
 *   - invalid_argument: legacy 1 → category 2 (validation)
 *   - schema_validation_failed: legacy 2 → category 2 (validation, value unchanged)
 */

import type { Command } from 'commander';
import { emitErr, emitOk, registerFormatter } from '../lib/output';
import { makeError } from '../lib/errors';
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
import { readPayloadJson, StdinError } from '../lib/input';
import { validate } from '../lib/schema';

function needProjectRoot(): string {
  const root = findProjectRoot(process.cwd());
  if (!root) {
    emitErr(
      makeError(
        'missing_artifact',
        `.geas/ not found at ${process.cwd().replace(/\\/g, '/')}.`,
        {
          hint: "run 'geas setup' to bootstrap the .geas/ tree",
          exit_category: 'missing_artifact',
        },
      ),
    );
  }
  return root as string;
}

function nowUtc(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Resolve the source path for a JSON write payload. Per AC1 inline-flag
 * precedence: --payload-from-file (the explicit, AC1-named option) wins
 * over --file (the legacy alias kept for back-compat through T2/T3).
 * Returns undefined when neither was provided, so readPayloadJson falls
 * back to stdin.
 */
function resolvePayloadFile(opts: { payloadFromFile?: string; file?: string }): string | undefined {
  return opts.payloadFromFile ?? opts.file;
}

/**
 * AC3 (mission-20260427-xIPG1sDY task-006): scalar formatters for the
 * four state subcommands. Each renders path + a one-line summary of the
 * state body so default-mode stdout stays compact.
 */
function formatStateGet(data: unknown): string {
  const d = data as { path?: string; state?: Record<string, unknown> };
  const lines: string[] = [];
  lines.push(`path: ${d.path ?? '<unknown>'}`);
  if (d.state && typeof d.state === 'object') {
    if (typeof d.state.phase === 'string') lines.push(`phase: ${d.state.phase}`);
    if (typeof d.state.status === 'string') lines.push(`status: ${d.state.status}`);
    if (typeof d.state.mission_id === 'string') lines.push(`mission_id: ${d.state.mission_id}`);
    if (typeof d.state.task_id === 'string') lines.push(`task_id: ${d.state.task_id}`);
  }
  return lines.join('\n');
}
function formatStateSet(data: unknown): string {
  const d = data as { path?: string; state?: Record<string, unknown> };
  const lines: string[] = [];
  lines.push(`written: ${d.path ?? '<unknown>'}`);
  if (d.state && typeof d.state === 'object') {
    if (typeof d.state.phase === 'string') lines.push(`phase: ${d.state.phase}`);
    if (typeof d.state.status === 'string') lines.push(`status: ${d.state.status}`);
  }
  return lines.join('\n');
}

export function registerStateCommands(program: Command): void {
  registerFormatter('state mission-get', formatStateGet);
  registerFormatter('state task-get', formatStateGet);
  registerFormatter('state mission-set', formatStateSet);
  registerFormatter('state task-set', formatStateSet);
  const state = program.command('state').description('Low-level mission/task state read and write');

  state
    .command('mission-get')
    .description('Print mission-state.json for a mission')
    .requiredOption('--mission <id>', 'Mission ID')
    .action((opts: { mission: string }) => {
      if (!isValidMissionId(opts.mission)) {
        emitErr(
          makeError('invalid_argument', `invalid mission id '${opts.mission}'`, {
            hint: "mission ids look like 'mission-YYYYMMDD-XXXXXXXX' (8 alphanumerics)",
            exit_category: 'validation',
          }),
        );
      }
      const root = needProjectRoot();
      const p = missionStatePath(root, opts.mission);
      const data = readJsonFile<Record<string, unknown>>(p);
      if (!data) {
        emitErr(
          makeError('missing_artifact', `mission-state.json not found for ${opts.mission}`, {
            hint: "run 'geas mission create' to create the mission, or check the --mission id",
            exit_category: 'missing_artifact',
          }),
        );
      }
      emitOk('state mission-get', { path: p.replace(/\\/g, '/'), state: data });
    });

  state
    .command('mission-set')
    .description(
      'Replace mission-state.json (payload via --payload-from-file, --file, or stdin; validated against mission-state schema)',
    )
    .requiredOption('--mission <id>', 'Mission ID')
    .option(
      '--payload-from-file <path>',
      'Read JSON payload from file (preferred per AC1; takes precedence over --file)',
    )
    .option('--file <path>', 'Legacy alias for --payload-from-file (kept for back-compat)')
    .action((opts: { mission: string; payloadFromFile?: string; file?: string }) => {
      if (!isValidMissionId(opts.mission)) {
        emitErr(
          makeError('invalid_argument', `invalid mission id '${opts.mission}'`, {
            hint: "mission ids look like 'mission-YYYYMMDD-XXXXXXXX' (8 alphanumerics)",
            exit_category: 'validation',
          }),
        );
      }
      const root = needProjectRoot();
      let payload: Record<string, unknown>;
      try {
        payload = readPayloadJson(resolvePayloadFile(opts)) as Record<string, unknown>;
      } catch (e) {
        if (e instanceof StdinError) {
          emitErr(
            makeError('invalid_argument', e.message, {
              hint: 'pass the JSON via --payload-from-file <path>, --file <path>, or pipe through stdin',
              exit_category: 'validation',
            }),
          );
        }
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
        emitErr(
          makeError(
            'schema_validation_failed',
            'mission-state schema validation failed',
            {
              hint: 'inspect ajv errors to fix the payload, then retry',
              exit_category: 'validation',
            },
          ),
        );
      }
      ensureDir(path.dirname(p));
      atomicWriteJson(p, payload, tmpDir(root));
      // Automation-scope discipline: raw state-set is a low-level
      // primitive; protocol-level transitions (e.g. mission phase
      // advance) emit their own event. No event here.
      emitOk('state mission-set', { path: p.replace(/\\/g, '/'), state: payload });
    });

  state
    .command('task-get')
    .description('Print task-state.json for a task')
    .requiredOption('--mission <id>', 'Mission ID')
    .requiredOption('--task <id>', 'Task ID')
    .action((opts: { mission: string; task: string }) => {
      if (!isValidMissionId(opts.mission)) {
        emitErr(
          makeError('invalid_argument', `invalid mission id '${opts.mission}'`, {
            hint: "mission ids look like 'mission-YYYYMMDD-XXXXXXXX' (8 alphanumerics)",
            exit_category: 'validation',
          }),
        );
      }
      if (!isValidTaskId(opts.task)) {
        emitErr(
          makeError('invalid_argument', `invalid task id '${opts.task}'`, {
            hint: "task ids look like 'task-NNN' (3+ digits)",
            exit_category: 'validation',
          }),
        );
      }
      const root = needProjectRoot();
      const p = taskStatePath(root, opts.mission, opts.task);
      const data = readJsonFile<Record<string, unknown>>(p);
      if (!data) {
        emitErr(
          makeError('missing_artifact', `task-state.json not found for ${opts.task}`, {
            hint: "run 'geas task draft' to create the task, or check the --task id",
            exit_category: 'missing_artifact',
          }),
        );
      }
      emitOk('state task-get', { path: p.replace(/\\/g, '/'), state: data });
    });

  state
    .command('task-set')
    .description(
      'Replace task-state.json (payload via --payload-from-file, --file, or stdin; validated against task-state schema)',
    )
    .requiredOption('--mission <id>', 'Mission ID')
    .requiredOption('--task <id>', 'Task ID')
    .option(
      '--payload-from-file <path>',
      'Read JSON payload from file (preferred per AC1; takes precedence over --file)',
    )
    .option('--file <path>', 'Legacy alias for --payload-from-file (kept for back-compat)')
    .action(
      (opts: { mission: string; task: string; payloadFromFile?: string; file?: string }) => {
        if (!isValidMissionId(opts.mission)) {
          emitErr(
            makeError('invalid_argument', `invalid mission id '${opts.mission}'`, {
              hint: "mission ids look like 'mission-YYYYMMDD-XXXXXXXX' (8 alphanumerics)",
              exit_category: 'validation',
            }),
          );
        }
        if (!isValidTaskId(opts.task)) {
          emitErr(
            makeError('invalid_argument', `invalid task id '${opts.task}'`, {
              hint: "task ids look like 'task-NNN' (3+ digits)",
              exit_category: 'validation',
            }),
          );
        }
        const root = needProjectRoot();
        let payload: Record<string, unknown>;
        try {
          payload = readPayloadJson(resolvePayloadFile(opts)) as Record<string, unknown>;
        } catch (e) {
          if (e instanceof StdinError) {
            emitErr(
              makeError('invalid_argument', e.message, {
                hint: 'pass the JSON via --payload-from-file <path>, --file <path>, or pipe through stdin',
                exit_category: 'validation',
              }),
            );
          }
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
          emitErr(
            makeError('schema_validation_failed', 'task-state schema validation failed', {
              hint: 'inspect ajv errors to fix the payload, then retry',
              exit_category: 'validation',
            }),
          );
        }
        ensureDir(path.dirname(p));
        atomicWriteJson(p, payload, tmpDir(root));
        // Automation-scope discipline: raw state-set is a low-level
        // primitive; lifecycle transitions (e.g. task state transition)
        // emit their own event. No event here.
        emitOk('state task-set', { path: p.replace(/\\/g, '/'), state: payload });
      },
    );
}
