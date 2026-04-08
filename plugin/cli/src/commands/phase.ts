/**
 * Phase command group — write phase review JSON to
 * .geas/missions/{mid}/phase-reviews/{phase}_{status}_{timestamp}.json
 */

import * as path from 'path';
import type { Command } from 'commander';
import { writeJsonFile } from '../lib/fs-atomic';
import { resolveGeasDir, resolveMissionDir } from '../lib/paths';
import { validate } from '../lib/schema';
import { validatePhaseTransition } from '../lib/phase-guards';
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
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const missionDir = resolveMissionDir(geasDir, opts.mission);

        // Validate against phase-review schema
        const result = validate('phase-review', data);
        if (!result.valid) {
          validationError('phase-review', result.errors || []);
          return;
        }

        // Phase transition guard: validate gate criteria before writing
        const currentPhase = data.mission_phase as string | undefined;
        const nextPhase = data.next_phase as string | undefined;
        if (currentPhase && nextPhase) {
          const guardResult = validatePhaseTransition(
            geasDir,
            opts.mission,
            currentPhase,
            nextPhase
          );
          if (!guardResult.valid) {
            const errMsg = {
              error: `Phase transition "${currentPhase}" → "${nextPhase}" blocked by unmet criteria`,
              code: 'PHASE_GUARD_ERROR',
              mission_id: opts.mission,
              current_phase: currentPhase,
              next_phase: nextPhase,
              unmet_criteria: guardResult.unmet_criteria,
            };
            process.stderr.write(JSON.stringify(errMsg) + '\n');
            process.exit(1);
            return;
          }
        }

        // Build filename from phase + status + timestamp
        const phase = (data.mission_phase as string) || 'unknown';
        const status = (data.status as string) || 'unknown';
        const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
        const filename = `${phase}_${status}_${timestamp}.json`;

        const filePath = path.resolve(missionDir, 'phase-reviews', filename);
        writeJsonFile(filePath, data, { cwd });

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
