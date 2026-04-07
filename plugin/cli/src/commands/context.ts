/**
 * Context command group — context packet write.
 *
 * Context packets are role-specific briefings written as .md or .json files
 * to .geas/missions/{mid}/packets/{tid}/{agent}.{ext}.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Command } from 'commander';
import { ensureDir } from '../lib/fs-atomic';
import { resolveGeasDir, resolveMissionDir } from '../lib/paths';
import { success, fileError } from '../lib/output';

export function registerContextCommands(program: Command): void {
  const cmd = program
    .command('context')
    .description('Context packet read/write');

  // --- write ---
  cmd
    .command('write')
    .description('Write a context packet file')
    .requiredOption('--mission <mid>', 'Mission ID')
    .requiredOption('--task <tid>', 'Task ID')
    .requiredOption('--agent <name>', 'Agent type name (used as filename stem)')
    .requiredOption('--data <content>', 'Packet content (string or JSON)')
    .action((opts: { mission: string; task: string; agent: string; data: string }) => {
      try {
        const geasDir = resolveGeasDir();
        const missionDir = resolveMissionDir(geasDir, opts.mission);
        const packetsDir = path.resolve(missionDir, 'packets', opts.task);
        ensureDir(packetsDir);

        // Detect if content is JSON or markdown
        let ext: string;
        let content: string;
        try {
          // Try parsing as JSON to determine format
          const parsed = JSON.parse(opts.data);
          content = JSON.stringify(parsed, null, 2) + '\n';
          ext = '.json';
        } catch {
          // Not valid JSON, treat as markdown/text
          content = opts.data;
          ext = '.md';
        }

        const filePath = path.resolve(packetsDir, `${opts.agent}${ext}`);
        ensureDir(path.dirname(filePath));
        fs.writeFileSync(filePath, content, 'utf-8');

        success({
          ok: true,
          mission_id: opts.mission,
          task_id: opts.task,
          agent: opts.agent,
          format: ext === '.json' ? 'json' : 'markdown',
          path: filePath,
        });
      } catch (err: unknown) {
        fileError(
          `packets/${opts.task}/${opts.agent}`,
          'write',
          (err as Error).message
        );
      }
    });
}
