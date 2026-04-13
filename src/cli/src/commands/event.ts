/**
 * Event command group — append structured events to events.jsonl.
 */

import * as path from 'path';
import type { Command } from 'commander';
import { resolveGeasDir } from '../lib/paths';
import { appendJsonlFile, readJsonFile, atomicWriteJsonFile } from '../lib/fs-atomic';
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
    .option('--update-checkpoint', 'Also update run.json checkpoint (only for step_complete)')
    .action(
      (opts: {
        type: string;
        task?: string;
        agent?: string;
        data?: string;
        message?: string;
        updateCheckpoint?: boolean;
      }) => {
        try {
          // Validate: --update-checkpoint requires --agent
          if (opts.updateCheckpoint && !opts.agent) {
            fileError('.geas/state/run.json', 'checkpoint', '--update-checkpoint requires --agent');
            return;
          }

          const cwd = getCwd(cmd);
          const geas = resolveGeasDir(cwd);
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
          let parsedData: unknown = undefined;
          if (opts.data) {
            try {
              parsedData = JSON.parse(opts.data);
            } catch {
              parsedData = opts.data;
            }
            entry.data = parsedData;
          }

          appendJsonlFile(eventsPath, entry);

          // Update checkpoint in run.json when --update-checkpoint is used with step_complete
          // Must run BEFORE success() which calls process.exit(0)
          let checkpointUpdated = false;
          if (opts.updateCheckpoint && opts.type === 'step_complete') {
            try {
              const runPath = path.join(geas, 'state', 'run.json');
              const runData = readJsonFile<Record<string, unknown>>(runPath);
              if (runData === null) {
                fileError('.geas/state/run.json', 'read', 'run.json not found (event was logged successfully)');
                return;
              }

              // Extract step name from --data JSON's "step" field, fallback to --type
              let stepName = opts.type;
              if (parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData)) {
                const dataObj = parsedData as Record<string, unknown>;
                if (typeof dataObj.step === 'string') {
                  stepName = dataObj.step;
                }
              }

              const existing = (runData.checkpoint as Record<string, unknown>) || {};
              const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

              runData.checkpoint = {
                ...existing,
                pipeline_step: stepName,
                agent_in_flight: opts.agent,
                last_updated: now,
                checkpoint_phase: 'committed',
              };

              atomicWriteJsonFile(runPath, runData, { cwd });
              checkpointUpdated = true;
            } catch (cpErr: unknown) {
              const ce = cpErr as NodeJS.ErrnoException;
              fileError('.geas/state/run.json', 'checkpoint update', ce.message);
            }
          }

          success({ appended: true, event: entry, checkpoint_updated: checkpointUpdated });
        } catch (err: unknown) {
          const e = err as NodeJS.ErrnoException;
          fileError('.geas/state/events.jsonl', 'append', e.message);
        }
      }
    );
}
