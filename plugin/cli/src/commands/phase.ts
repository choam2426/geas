/**
 * Phase command group — write phase review JSON to
 * .geas/missions/{mid}/phase-reviews/{phase}_{status}_{timestamp}.json
 */

import * as path from 'path';
import type { Command } from 'commander';
import { writeJsonFile } from '../lib/fs-atomic';
import { resolveGeasDir, resolveMissionDir } from '../lib/paths';
import { validate } from '../lib/schema';
import { success, validationError, fileError } from '../lib/output';
import { getCwd } from '../lib/cwd';

export function registerPhaseCommands(program: Command): void {
  const cmd = program
    .command('phase')
    .description('Phase review read/write');

  // --- write ---
  cmd
    .command('write')
    .description('Write a phase review')
    .requiredOption('--mission <mid>', 'Mission ID')
    .requiredOption('--data <json>', 'JSON phase review object')
    .action((opts: { mission: string; data: string }, cmd: Command) => {
      try {
        const data = JSON.parse(opts.data) as Record<string, unknown>;
        const geasDir = resolveGeasDir(getCwd(cmd));
        const missionDir = resolveMissionDir(geasDir, opts.mission);

        // Validate against phase-review schema
        const result = validate('phase-review', data);
        if (!result.valid) {
          validationError('phase-review', result.errors || []);
          return;
        }

        // Build filename from phase + status + timestamp
        const phase = (data.mission_phase as string) || 'unknown';
        const status = (data.status as string) || 'unknown';
        const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
        const filename = `${phase}_${status}_${timestamp}.json`;

        const filePath = path.resolve(missionDir, 'phase-reviews', filename);
        writeJsonFile(filePath, data);

        success({
          ok: true,
          mission_id: opts.mission,
          phase,
          status,
          path: filePath,
        });
      } catch (err: unknown) {
        const msg = err instanceof SyntaxError
          ? 'Invalid JSON in --data'
          : (err as Error).message;
        fileError('phase-reviews/', 'write', msg);
      }
    });
}
