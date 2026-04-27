/**
 * `geas self-check` — append a worker self-check entry for a task.
 *
 *   geas self-check append --mission <id> --task <id>    (stdin: entry body)
 *
 * Writes `.geas/missions/{mission_id}/tasks/{task_id}/self-check.json`.
 * The file is append-only: every implementer pass (initial or verify-fix
 * re-entry) adds a new entry to `entries[]`. Prior entries are preserved
 * so reviewers can trace iteration history.
 *
 * The CLI owns the file envelope (mission_id / task_id / created_at /
 * updated_at) and per-entry entry_id + created_at. Content fields
 * (completed_work, reviewer_focus, known_risks, deviations_from_plan,
 * gap_signals, revision_ref) come from stdin.
 */

import type { Command } from 'commander';
import * as path from 'path';

import { recordEvent } from '../lib/envelope';
import { emitErr, emitOk, registerFormatter } from '../lib/output';
import { makeError } from '../lib/errors';
import {
  atomicWriteJson,
  ensureDir,
  exists,
  readJsonFile,
} from '../lib/fs-atomic';
import {
  findProjectRoot,
  isValidMissionId,
  isValidTaskId,
  missionSpecPath,
  selfCheckPath,
  taskContractPath,
  tmpDir,
} from '../lib/paths';
import { readPayloadJson, StdinError } from '../lib/input';
import { validate } from '../lib/schema';

function nowUtc(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function slashPath(p: string): string {
  return p.replace(/\\/g, '/');
}

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

/**
 * AC3 (mission-20260427-xIPG1sDY task-006): scalar formatter for
 * `self-check append`. Renders task + entry id summary.
 */
function formatSelfCheckAppend(data: unknown): string {
  const d = data as { ids?: { mission_id?: string; task_id?: string; entry_id?: number }; path?: string };
  return [
    `self-check appended: ${d.ids?.task_id ?? '<unknown>'} entry_id=${d.ids?.entry_id ?? '?'}`,
    `path: ${d.path ?? '<unknown>'}`,
  ].join('\n');
}

interface SelfCheckFile {
  mission_id: string;
  task_id: string;
  entries: Array<Record<string, unknown>>;
  created_at: string;
  updated_at: string;
}

export function registerSelfCheckCommands(program: Command): void {
  registerFormatter('self-check append', formatSelfCheckAppend);
  const sc = program
    .command('self-check')
    .description('Implementer self-check artifact (self-check.json) commands.');

  sc.command('append')
    .description(
      'Append a self-check entry for a task (payload via --file or stdin: entry content fields). Creates the file on first append; subsequent appends push new entries to entries[]. One entry per implementer pass.',
    )
    .requiredOption('--mission <id>', 'Mission ID')
    .requiredOption('--task <id>', 'Task ID')
    .option('--file <path>', 'Read JSON payload from file instead of stdin')
    .action((opts: { mission: string; task: string; file?: string }) => {
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

      if (!exists(missionSpecPath(root, opts.mission))) {
        emitErr(
          makeError('missing_artifact', `mission spec not found for ${opts.mission}`, {
            hint: "run 'geas mission create' to bootstrap the mission first",
            exit_category: 'missing_artifact',
          }),
        );
      }
      if (!exists(taskContractPath(root, opts.mission, opts.task))) {
        emitErr(
          makeError('missing_artifact', `task contract not found for ${opts.task}`, {
            hint: "run 'geas task draft' to create the contract first",
            exit_category: 'missing_artifact',
          }),
        );
      }

      let payload: Record<string, unknown>;
      try {
        payload = readPayloadJson(opts.file) as Record<string, unknown>;
      } catch (e) {
        if (e instanceof StdinError) {
          emitErr(
            makeError('invalid_argument', e.message, {
              hint: 'pass the JSON via --file <path> or pipe through stdin',
              exit_category: 'validation',
            }),
          );
        }
        throw e;
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        emitErr(
          makeError(
            'invalid_argument',
            'self-check append expects a JSON object on stdin',
            {
              hint: 'wrap the entry fields in a single JSON object',
              exit_category: 'validation',
            },
          ),
        );
      }

      // Default arrays so callers can omit empty lists.
      if (payload.reviewer_focus === undefined) payload.reviewer_focus = [];
      if (payload.known_risks === undefined) payload.known_risks = [];
      if (payload.deviations_from_plan === undefined) {
        payload.deviations_from_plan = [];
      }
      if (payload.gap_signals === undefined) payload.gap_signals = [];
      if (payload.revision_ref === undefined) payload.revision_ref = null;

      // CLI owns per-entry envelope (entry_id, created_at). Strip any
      // caller-supplied values to prevent tampering.
      delete payload.entry_id;
      delete payload.created_at;

      const p = selfCheckPath(root, opts.mission, opts.task);
      const ts = nowUtc();

      // Read existing file (if any) to compute next entry_id and
      // preserve prior entries.
      const existing = readJsonFile<SelfCheckFile>(p);
      const nextEntryId = existing && Array.isArray(existing.entries)
        ? existing.entries.length + 1
        : 1;

      const entry: Record<string, unknown> = {
        entry_id: nextEntryId,
        ...payload,
        created_at: ts,
      };

      const merged: SelfCheckFile = {
        mission_id: opts.mission,
        task_id: opts.task,
        entries:
          existing && Array.isArray(existing.entries)
            ? [...existing.entries, entry]
            : [entry],
        created_at: existing?.created_at ?? ts,
        updated_at: ts,
      };

      const v = validate('self-check', merged);
      if (!v.ok) {
        emitErr(
          makeError(
            'schema_validation_failed',
            'self-check schema validation failed',
            {
              hint: 'inspect ajv errors and fix the entry body, then retry',
              exit_category: 'validation',
            },
          ),
        );
      }

      ensureDir(path.dirname(p));
      atomicWriteJson(p, merged, tmpDir(root));

      recordEvent(root, {
        kind: 'self_check_appended',
        actor: 'cli:auto',
        payload: {
          mission_id: opts.mission,
          task_id: opts.task,
          artifact: slashPath(path.relative(root, p)),
          entry_id: nextEntryId,
        },
      });

      emitOk('self-check append', {
        path: slashPath(p),
        ids: {
          mission_id: opts.mission,
          task_id: opts.task,
          entry_id: nextEntryId,
        },
        self_check: merged,
      });
    });
}
