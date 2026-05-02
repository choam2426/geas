/**
 * `geas event` — explicit event log write.
 *
 * The bulk of events.jsonl entries are auto-appended by the CLI itself
 * when protocol-level waypoints occur (mission phase advance, task
 * transition, evidence append, etc.). This command covers the manual /
 * external case: orchestrators or operators that need to mark a
 * waypoint the CLI does not observe directly.
 *
 * Subcommand:
 *
 *   geas event log   [--payload-from-file <p> | --file <p> | stdin]
 *
 * Event body (JSON object):
 *
 *   {
 *     "kind": "<string>",
 *     "actor": "<slot id> | user | cli:auto",
 *     "mission_id": "<optional>",
 *     "task_id": "<optional>",
 *     "ref": "<optional artifact path>",
 *     "payload": { ... }            // optional
 *   }
 *
 * The CLI owns `entry_id` (monotonic, 1-based) and `created_at` (ISO
 * 8601 UTC). Any caller-supplied values for these fields are stripped
 * before append. Event-write failures are best-effort per CLI.md §14.7:
 * if the log can not be written, the command still returns ok so
 * callers' mainline logic never blocks on audit-log I/O.
 *
 * Writes to `.geas/events.jsonl`.
 *
 * T2.a (mission-20260427-xIPG1sDY task-002): migrated off the legacy
 * envelope.emit/err/ok bridge to call output.emitOk / output.emitErr +
 * errors.makeError directly. Per AC1 the explicit
 * `--payload-from-file` flag is added alongside the historical
 * `--file` alias. Per AC2 every error site rotates exit code through
 * EXIT_CATEGORY_CODE: missing_artifact 1→4, invalid_argument 1→2.
 * `recordEvent` and `isValidActor` are imported directly from the
 * envelope module (these helpers are not part of the error/output
 * surface migration — they remain in envelope.ts as event-log
 * utilities until T5 splits them into a dedicated lib/events module).
 */

import type { Command } from 'commander';

import { isValidActor, recordEvent } from '../lib/envelope';
import { emitErr, emitOk, registerFormatter } from '../lib/output';
import { makeError } from '../lib/errors';
import { findProjectRoot } from '../lib/paths';
import { readPayloadJson, StdinError } from '../lib/input';

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
 * AC1 inline-flag precedence: --payload-from-file (explicit, AC1-named)
 * wins over --file (legacy alias kept for back-compat through T2/T3).
 * Returns undefined when neither was provided so readPayloadJson falls
 * back to stdin.
 */
function resolvePayloadFile(opts: { payloadFromFile?: string; file?: string }): string | undefined {
  return opts.payloadFromFile ?? opts.file;
}

/**
 * AC3 (mission-20260427-xIPG1sDY task-006): scalar formatter for the
 * event log subcommand. Single-line summary of the appended event.
 */
function formatEventLog(data: unknown): string {
  const d = data as { path?: string; kind?: string; actor?: string };
  return `event logged: kind=${d.kind ?? '<unknown>'} actor=${d.actor ?? '<unknown>'} path=${d.path ?? '<unknown>'}`;
}

export function registerEventCommands(program: Command): void {
  registerFormatter('event log', formatEventLog);
  const event = program
    .command('event')
    .description('Append entries to .geas/events.jsonl (automation-only audit log).');

  event
    .command('log')
    .description(
      'Append a single event (payload via --payload-from-file, --file, or stdin: JSON object with kind + actor, optional mission_id, task_id, ref, payload). CLI assigns entry_id and created_at.',
    )
    .option(
      '--payload-from-file <path>',
      'Read JSON payload from file (preferred per AC1; takes precedence over --file)',
    )
    .option('--file <path>', 'Legacy alias for --payload-from-file (kept for back-compat)')
    .action((opts: { payloadFromFile?: string; file?: string }) => {
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
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        emitErr(
          makeError('invalid_argument', 'event log expects a JSON object payload', {
            hint: 'wrap the event fields in a single JSON object: {"kind": "...", "actor": "..."}',
            exit_category: 'validation',
          }),
        );
      }

      if (typeof payload.kind !== 'string' || payload.kind.length === 0) {
        emitErr(
          makeError('invalid_argument', 'event.kind is required (non-empty string)', {
            hint: "set kind to a short snake_case identifier such as 'mission_created' or 'manual_note'",
            exit_category: 'validation',
          }),
        );
      }
      if (!isValidActor(payload.actor)) {
        emitErr(
          makeError(
            'invalid_argument',
            `event.actor must be a slot id (kebab-case), 'user', or 'cli:auto'; got ${JSON.stringify(payload.actor)}`,
            {
              hint: "valid actors include 'orchestrator', 'implementer', 'user', 'cli:auto'",
              exit_category: 'validation',
            },
          ),
        );
      }

      // recordEvent strips caller-provided entry_id / created_at and
      // assigns both server-side. It is best-effort; if append fails,
      // the command still returns ok. That matches the automation-only
      // audit-log contract (main mutation already succeeded).
      recordEvent(root, payload);

      emitOk('event log', {
        path: '.geas/events.jsonl',
        kind: payload.kind,
        actor: payload.actor,
      });
    });
}
