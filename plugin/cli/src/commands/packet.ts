/**
 * Packet command group — create context packets for agent briefing.
 *
 * Paths: .geas/missions/{mid}/tasks/{tid}/packets/{agent}.md
 *
 * Context packets are markdown files containing the briefing content
 * composed by the orchestrator for each agent. No schema validation
 * (markdown is freeform). Value is in existence (traceability) and
 * content (briefing quality).
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Command } from 'commander';
import { success, fileError } from '../lib/output';
import { resolveGeasDir, normalizePath } from '../lib/paths';
import { readJsonFile, ensureDir } from '../lib/fs-atomic';
import { enrichTimestamp, writeCheckpointPending } from '../lib/post-write-checks';
import { getCwd } from '../lib/cwd';

/**
 * Resolve mission ID from --mission flag or run.json.
 */
function resolveMissionId(geasDir: string, missionOpt?: string): string {
  if (missionOpt) return missionOpt;
  const runPath = path.resolve(geasDir, 'state', 'run.json');
  const run = readJsonFile<Record<string, unknown>>(runPath);
  if (run?.mission_id && typeof run.mission_id === 'string') {
    return run.mission_id;
  }
  const err = new Error('No --mission provided and no mission_id in run.json');
  (err as NodeJS.ErrnoException).code = 'FILE_ERROR';
  throw err;
}

export function registerPacketCommands(program: Command): void {
  const cmd = program
    .command('packet')
    .description('Context packet creation and reading');

  // --- packet create ---
  cmd
    .command('create')
    .description('Create a context packet markdown file')
    .option('--mission <mid>', 'Mission identifier (auto-resolved from run.json)')
    .requiredOption('--task <tid>', 'Task identifier')
    .requiredOption('--agent <name>', 'Agent name (used as filename)')
    .option('--content <text>', 'Markdown content (inline)')
    .option('--file <path>', 'Read content from markdown file')
    .action((opts: {
      mission?: string;
      task: string;
      agent: string;
      content?: string;
      file?: string;
    }) => {
      try {
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const missionId = resolveMissionId(geasDir, opts.mission);
        const missionDir = path.resolve(geasDir, 'missions', missionId);

        // Sanitize agent name
        const agentName = opts.agent.replace(/[^a-zA-Z0-9_-]/g, '');
        if (!agentName) {
          fileError(opts.agent, 'validate', 'Agent name is empty after sanitization');
          return;
        }

        // Get content from --content, --file, or stdin
        let content: string | undefined;

        if (opts.file) {
          try {
            content = fs.readFileSync(opts.file, 'utf-8');
          } catch (err: unknown) {
            const nodeErr = err as NodeJS.ErrnoException;
            fileError(opts.file, 'read', `Cannot read file: ${nodeErr.code || 'unknown'}`);
            return;
          }
        } else if (opts.content) {
          content = opts.content;
        } else {
          // Try stdin
          try {
            if (!process.stdin.isTTY) {
              content = fs.readFileSync(0, 'utf-8').trim();
            }
          } catch {
            // stdin not available
          }
        }

        if (!content) {
          fileError('', 'packet create', 'No content provided. Use --content, --file, or pipe via stdin.');
          return;
        }

        // Write to tasks/{tid}/packets/{agent}.md
        const packetsDir = path.resolve(missionDir, 'tasks', opts.task, 'packets');
        ensureDir(packetsDir);

        const filePath = path.resolve(packetsDir, `${agentName}.md`);

        // Checkpoint pending
        writeCheckpointPending(filePath, cwd);

        fs.writeFileSync(filePath, content, 'utf-8');

        success({
          written: normalizePath(filePath),
          mission_id: missionId,
          task_id: opts.task,
          agent: agentName,
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'packet create', nodeErr.message);
        } else {
          throw err;
        }
      }
    });

  // --- packet read ---
  cmd
    .command('read')
    .description('Read a context packet')
    .option('--mission <mid>', 'Mission identifier (auto-resolved from run.json)')
    .requiredOption('--task <tid>', 'Task identifier')
    .requiredOption('--agent <name>', 'Agent name')
    .action((opts: { mission?: string; task: string; agent: string }) => {
      try {
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const missionId = resolveMissionId(geasDir, opts.mission);
        const missionDir = path.resolve(geasDir, 'missions', missionId);

        const agentName = opts.agent.replace(/[^a-zA-Z0-9_-]/g, '');
        const filePath = path.resolve(missionDir, 'tasks', opts.task, 'packets', `${agentName}.md`);

        if (!fs.existsSync(filePath)) {
          fileError(normalizePath(filePath), 'read', 'Packet not found');
          return;
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        success({
          mission_id: missionId,
          task_id: opts.task,
          agent: agentName,
          content,
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        fileError('', 'packet read', nodeErr.message || String(err));
      }
    });
}
