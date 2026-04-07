/**
 * State command group — run.json read/write, checkpoint management,
 * session-latest.md, task-focus updates.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Command } from 'commander';
import { resolveGeasDir } from '../lib/paths';
import { readJsonFile, atomicWriteJsonFile, ensureDir } from '../lib/fs-atomic';
import { success, fileError } from '../lib/output';

/** Resolve cwd from the --cwd global option or process.cwd(). */
function getCwd(cmd: Command): string {
  const root = cmd.parent;
  const opts = root ? root.opts() : {};
  return (opts.cwd as string) || process.cwd();
}

/** Resolve the run.json path from the .geas/state directory. */
function runJsonPath(geasDir: string): string {
  return path.join(geasDir, 'state', 'run.json');
}

export function registerStateCommands(program: Command): void {
  const cmd = program
    .command('state')
    .description('Run state management (run.json, checkpoints)');

  // --- state read ---
  cmd
    .command('read')
    .description('Read current run state')
    .action(() => {
      try {
        const geas = resolveGeasDir(getCwd(cmd));
        const filePath = runJsonPath(geas);
        const data = readJsonFile(filePath);
        if (data === null) {
          fileError(filePath, 'read', 'run.json not found');
          return;
        }
        success(data);
      } catch (err: unknown) {
        const e = err as NodeJS.ErrnoException;
        fileError('.geas/state/run.json', 'read', e.message);
      }
    });

  // --- state update ---
  cmd
    .command('update')
    .description('Update a field in run.json atomically')
    .requiredOption('--field <field>', 'Field name to update')
    .requiredOption('--value <value>', 'New value (JSON-parsed if possible)')
    .action((opts: { field: string; value: string }) => {
      try {
        const geas = resolveGeasDir(getCwd(cmd));
        const filePath = runJsonPath(geas);
        const data = readJsonFile<Record<string, unknown>>(filePath);
        if (data === null) {
          fileError(filePath, 'read', 'run.json not found');
          return;
        }

        // Parse the value: try JSON first, fall back to string
        let parsedValue: unknown;
        try {
          parsedValue = JSON.parse(opts.value);
        } catch {
          parsedValue = opts.value;
        }

        data[opts.field] = parsedValue;
        atomicWriteJsonFile(filePath, data);
        success({ updated: opts.field, value: parsedValue });
      } catch (err: unknown) {
        const e = err as NodeJS.ErrnoException;
        fileError('.geas/state/run.json', 'update', e.message);
      }
    });

  // --- state checkpoint ---
  const checkpoint = cmd
    .command('checkpoint')
    .description('Checkpoint management in run.json');

  checkpoint
    .command('set')
    .description('Set checkpoint in run.json')
    .requiredOption('--step <step>', 'Pipeline step name')
    .requiredOption('--agent <agent>', 'Agent currently in flight')
    .option('--retry-count <n>', 'Retry count', '0')
    .option('--batch <tasks>', 'Parallel batch task IDs (comma-separated)')
    .action(
      (opts: {
        step: string;
        agent: string;
        retryCount: string;
        batch?: string;
      }) => {
        try {
          const geas = resolveGeasDir(getCwd(cmd));
          const filePath = runJsonPath(geas);
          const data = readJsonFile<Record<string, unknown>>(filePath);
          if (data === null) {
            fileError(filePath, 'read', 'run.json not found');
            return;
          }

          const existing =
            (data.checkpoint as Record<string, unknown>) || {};
          const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

          data.checkpoint = {
            ...existing,
            pipeline_step: opts.step,
            agent_in_flight: opts.agent,
            retry_count: parseInt(opts.retryCount, 10) || 0,
            last_updated: now,
            checkpoint_phase: 'committed',
            ...(opts.batch !== undefined
              ? {
                  parallel_batch: opts.batch
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                }
              : {}),
          };

          atomicWriteJsonFile(filePath, data);
          success({ checkpoint: data.checkpoint });
        } catch (err: unknown) {
          const e = err as NodeJS.ErrnoException;
          fileError('.geas/state/run.json', 'checkpoint set', e.message);
        }
      }
    );

  checkpoint
    .command('clear')
    .description('Clear checkpoint in run.json')
    .action(() => {
      try {
        const geas = resolveGeasDir(getCwd(cmd));
        const filePath = runJsonPath(geas);
        const data = readJsonFile<Record<string, unknown>>(filePath);
        if (data === null) {
          fileError(filePath, 'read', 'run.json not found');
          return;
        }

        data.checkpoint = {
          pipeline_step: null,
          agent_in_flight: null,
          pending_evidence: [],
          retry_count: 0,
          parallel_batch: null,
          completed_in_batch: [],
          remaining_steps: [],
          last_updated: new Date()
            .toISOString()
            .replace(/\.\d{3}Z$/, 'Z'),
          checkpoint_phase: 'committed',
        };

        atomicWriteJsonFile(filePath, data);
        success({ checkpoint: data.checkpoint });
      } catch (err: unknown) {
        const e = err as NodeJS.ErrnoException;
        fileError('.geas/state/run.json', 'checkpoint clear', e.message);
      }
    });

  // --- state session-update ---
  cmd
    .command('session-update')
    .description(
      'Write session-latest.md (reads JSON from stdin with phase, task, step info)'
    )
    .option('--phase <phase>', 'Current phase')
    .option('--task <task>', 'Current task ID')
    .option('--step <step>', 'Current pipeline step')
    .option('--summary <text>', 'Summary text')
    .action(
      (opts: {
        phase?: string;
        task?: string;
        step?: string;
        summary?: string;
      }) => {
        try {
          const geas = resolveGeasDir(getCwd(cmd));
          const sessionPath = path.join(geas, 'state', 'session-latest.md');

          // Build session-latest.md content
          const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
          const lines: string[] = [
            '# Session Latest',
            '',
            `**Updated**: ${now}`,
          ];

          if (opts.phase) {
            lines.push(`**Phase**: ${opts.phase}`);
          }
          if (opts.task) {
            lines.push(`**Current Task**: ${opts.task}`);
          }
          if (opts.step) {
            lines.push(`**Pipeline Step**: ${opts.step}`);
          }
          if (opts.summary) {
            lines.push('', '## Summary', '', opts.summary);
          }

          lines.push('');

          ensureDir(path.dirname(sessionPath));
          fs.writeFileSync(sessionPath, lines.join('\n'), 'utf-8');

          success({
            written: 'session-latest.md',
            path: sessionPath.replace(/\\/g, '/'),
          });
        } catch (err: unknown) {
          const e = err as NodeJS.ErrnoException;
          fileError(
            '.geas/state/session-latest.md',
            'write',
            e.message
          );
        }
      }
    );

  // --- state task-focus ---
  cmd
    .command('task-focus')
    .description('Write/update task-focus/<id>.md')
    .requiredOption('--id <id>', 'Task ID')
    .option('--status <status>', 'Task status')
    .option('--step <step>', 'Current pipeline step')
    .option('--summary <text>', 'Summary text')
    .option('--blockers <text>', 'Blockers description')
    .action(
      (opts: {
        id: string;
        status?: string;
        step?: string;
        summary?: string;
        blockers?: string;
      }) => {
        try {
          const geas = resolveGeasDir(getCwd(cmd));
          const focusDir = path.join(geas, 'state', 'task-focus');
          const focusPath = path.join(focusDir, `${opts.id}.md`);

          const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
          const lines: string[] = [
            `# Task Focus: ${opts.id}`,
            '',
            `**Updated**: ${now}`,
          ];

          if (opts.status) {
            lines.push(`**Status**: ${opts.status}`);
          }
          if (opts.step) {
            lines.push(`**Pipeline Step**: ${opts.step}`);
          }
          if (opts.summary) {
            lines.push('', '## Summary', '', opts.summary);
          }
          if (opts.blockers) {
            lines.push('', '## Blockers', '', opts.blockers);
          }

          lines.push('');

          ensureDir(focusDir);
          fs.writeFileSync(focusPath, lines.join('\n'), 'utf-8');

          success({
            written: `task-focus/${opts.id}.md`,
            path: focusPath.replace(/\\/g, '/'),
          });
        } catch (err: unknown) {
          const e = err as NodeJS.ErrnoException;
          fileError(
            `task-focus/${opts.id}.md`,
            'write',
            e.message
          );
        }
      }
    );
}
