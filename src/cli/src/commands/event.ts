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
 *   geas event log   (stdin: event body)
 *
 * Event body (JSON object on stdin):
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
 */

import type { Command } from 'commander';

import { emit, err, isValidActor, ok, recordEvent } from '../lib/envelope';
import { findProjectRoot } from '../lib/paths';
import { readStdinJson, StdinError } from '../lib/input';

function needProjectRoot(): string {
  const root = findProjectRoot(process.cwd());
  if (!root) {
    emit(
      err(
        'missing_artifact',
        `.geas/ not found at ${process.cwd().replace(/\\/g, '/')}. Run 'geas setup' first.`,
      ),
    );
  }
  return root as string;
}

export function registerEventCommands(program: Command): void {
  const event = program
    .command('event')
    .description('Append entries to .geas/events.jsonl (automation-only audit log).');

  event
    .command('log')
    .description(
      'Append a single event (stdin: JSON object with kind + actor, optional mission_id, task_id, ref, payload). CLI assigns entry_id and created_at.',
    )
    .action(() => {
      const root = needProjectRoot();

      let payload: Record<string, unknown>;
      try {
        payload = readStdinJson() as Record<string, unknown>;
      } catch (e) {
        if (e instanceof StdinError) emit(err('invalid_argument', e.message));
        throw e;
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        emit(err('invalid_argument', 'event log expects a JSON object on stdin'));
      }

      if (typeof payload.kind !== 'string' || payload.kind.length === 0) {
        emit(err('invalid_argument', 'event.kind is required (non-empty string)'));
      }
      if (!isValidActor(payload.actor)) {
        emit(
          err(
            'invalid_argument',
            `event.actor must be a slot id (kebab-case), 'user', or 'cli:auto'; got ${JSON.stringify(payload.actor)}`,
          ),
        );
      }

      // recordEvent strips caller-provided entry_id / created_at and
      // assigns both server-side. It is best-effort; if append fails,
      // the command still returns ok. That matches the automation-only
      // audit-log contract (main mutation already succeeded).
      recordEvent(root, payload);

      emit(
        ok({
          path: '.geas/events.jsonl',
          kind: payload.kind,
          actor: payload.actor,
        }),
      );
    });
}
