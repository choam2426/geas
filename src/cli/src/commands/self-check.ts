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
import { readPayloadJson, readPayloadText, StdinError } from '../lib/input';
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

interface SelfCheckAppendInlineOpts {
  mission: string;
  task: string;
  file?: string;
  entryFromFile?: string;
  completedWork?: string;
  completedWorkFromFile?: string;
  reviewerFocus?: string[];
  knownRisk?: string[];
  deviationFromPlan?: string[];
  gapSignal?: string[];
  revisionRef?: string;
}

/**
 * AC1 (task-006 verify-fix iteration 1): build a self-check entry
 * payload from inline flags. Returns null if no inline flag is present.
 */
function buildSelfCheckPayloadFromFlags(
  opts: SelfCheckAppendInlineOpts,
): Record<string, unknown> | null {
  const inlineFlagPresent =
    opts.completedWork !== undefined ||
    opts.completedWorkFromFile !== undefined ||
    (Array.isArray(opts.reviewerFocus) && opts.reviewerFocus.length > 0) ||
    (Array.isArray(opts.knownRisk) && opts.knownRisk.length > 0) ||
    (Array.isArray(opts.deviationFromPlan) && opts.deviationFromPlan.length > 0) ||
    (Array.isArray(opts.gapSignal) && opts.gapSignal.length > 0) ||
    opts.revisionRef !== undefined;
  if (!inlineFlagPresent) return null;

  const payload: Record<string, unknown> = {};
  if (opts.completedWorkFromFile !== undefined) {
    try {
      payload.completed_work = readPayloadText(opts.completedWorkFromFile);
    } catch (e) {
      if (e instanceof StdinError) {
        emitErr(
          makeError('invalid_argument', e.message, {
            hint: 'pass --completed-work <text> inline or --completed-work-from-file <path>',
            exit_category: 'validation',
          }),
        );
      }
      throw e;
    }
  } else if (opts.completedWork !== undefined) {
    payload.completed_work = opts.completedWork;
  }
  if (Array.isArray(opts.reviewerFocus)) payload.reviewer_focus = opts.reviewerFocus;
  if (Array.isArray(opts.knownRisk)) payload.known_risks = opts.knownRisk;
  if (Array.isArray(opts.deviationFromPlan)) payload.deviations_from_plan = opts.deviationFromPlan;
  if (Array.isArray(opts.gapSignal)) payload.gap_signals = opts.gapSignal;
  if (opts.revisionRef !== undefined) {
    if (opts.revisionRef === 'null' || opts.revisionRef === '') {
      payload.revision_ref = null;
    } else {
      const n = parseInt(opts.revisionRef, 10);
      if (!Number.isFinite(n) || n < 1) {
        emitErr(
          makeError(
            'invalid_argument',
            `--revision-ref must be a positive integer or 'null' (got '${opts.revisionRef}')`,
            { hint: 'pass --revision-ref <int> with a value ≥1, or omit for null', exit_category: 'validation' },
          ),
        );
      }
      payload.revision_ref = n;
    }
  }
  return payload;
}

export function registerSelfCheckCommands(program: Command): void {
  registerFormatter('self-check append', formatSelfCheckAppend);
  const sc = program
    .command('self-check')
    .description('Implementer self-check artifact (self-check.json) commands.');

  sc.command('append')
    .description(
      'Append a self-check entry for a task. Accepts inline flags (--completed-work, --reviewer-focus..., --known-risk..., --deviation-from-plan..., --gap-signal..., --revision-ref) or full JSON via --file/stdin/--entry-from-file. Free-body --completed-work also accepts --completed-work-from-file. Creates the file on first append; subsequent appends push new entries. One entry per implementer pass.',
    )
    .requiredOption('--mission <id>', 'Mission ID')
    .requiredOption('--task <id>', 'Task ID')
    .option('--file <path>', 'Read full JSON entry from file (overrides inline flags) instead of stdin')
    .option('--entry-from-file <path>', 'Named alias for --file (free-body entry payload)')
    .option('--completed-work <text>', 'What was completed in this pass (free-body — short prose)')
    .option('--completed-work-from-file <path>', 'Read completed_work text from file')
    .option('--reviewer-focus <text...>', 'Area reviewers should inspect first (repeatable)')
    .option('--known-risk <text...>', 'Forward-looking risk that remains after this pass (repeatable)')
    .option('--deviation-from-plan <text...>', 'Deviation between plan and what happened (repeatable)')
    .option('--gap-signal <text...>', 'Early scope or expectation gap signal (repeatable)')
    .option('--revision-ref <int>', "Prior entry_id this revises, or 'null' for first/non-revision")
    .action((opts: SelfCheckAppendInlineOpts) => {
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
      const payloadSrcFile = opts.file ?? opts.entryFromFile;
      if (payloadSrcFile !== undefined) {
        try {
          payload = readPayloadJson(payloadSrcFile) as Record<string, unknown>;
        } catch (e) {
          if (e instanceof StdinError) {
            emitErr(
              makeError('invalid_argument', e.message, {
                hint: 'pass JSON via --file/--entry-from-file <path> or use inline flags (--completed-work, ...)',
                exit_category: 'validation',
              }),
            );
          }
          throw e;
        }
      } else {
        const inline = buildSelfCheckPayloadFromFlags(opts);
        if (inline !== null) {
          payload = inline;
        } else {
          try {
            payload = readPayloadJson(undefined) as Record<string, unknown>;
          } catch (e) {
            if (e instanceof StdinError) {
              emitErr(
                makeError('invalid_argument', e.message, {
                  hint: 'use inline flags (--completed-work, ...) or pass JSON via --file/--entry-from-file <path> or stdin',
                  exit_category: 'validation',
                }),
              );
            }
            throw e;
          }
        }
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        emitErr(
          makeError(
            'invalid_argument',
            'self-check append expects a JSON object payload',
            {
              hint: 'wrap the entry fields in a single JSON object, or use inline flags',
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
