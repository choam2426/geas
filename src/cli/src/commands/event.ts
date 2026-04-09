/**
 * Event command group — append structured events to events.jsonl.
 */

import * as path from 'path';
import type { Command } from 'commander';
import { resolveGeasDir } from '../lib/paths';
import { appendJsonlFile } from '../lib/fs-atomic';
import { success, fileError } from '../lib/output';
import { getCwd } from '../lib/cwd';

export function registerEventCommands(program: Command): void {
  const cmd = program
    .command('event')
    .description('Event ledger append and query (JSONL)');

  // --- event log ---
  cmd
    .command('log')
    .description('Append an event to events.jsonl')
    .requiredOption('--type <type>', 'Event type (e.g., step_complete, task_start)')
    .option('--task <id>', 'Associated task ID')
    .option('--agent <agent>', 'Agent that produced the event')
    .option('--data <json>', 'Additional data as JSON string')
    .option('--message <text>', 'Human-readable message')
    .action(
      (opts: {
        type: string;
        task?: string;
        agent?: string;
        data?: string;
        message?: string;
      }) => {
        try {
          const geas = resolveGeasDir(getCwd(cmd));
          const eventsPath = path.join(geas, 'state', 'events.jsonl');

          const entry: Record<string, unknown> = {
            timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
            event_type: opts.type,
          };

          if (opts.task) {
            entry.task_id = opts.task;
          }
          if (opts.agent) {
            entry.agent = opts.agent;
          }
          if (opts.message) {
            entry.message = opts.message;
          }

          // Parse --data as JSON, fall back to raw string
          if (opts.data) {
            try {
              entry.data = JSON.parse(opts.data);
            } catch {
              entry.data = opts.data;
            }
          }

          appendJsonlFile(eventsPath, entry);
          success({ appended: true, event: entry });
        } catch (err: unknown) {
          const e = err as NodeJS.ErrnoException;
          fileError('.geas/state/events.jsonl', 'append', e.message);
        }
      }
    );
}
