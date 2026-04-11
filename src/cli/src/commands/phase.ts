/**
 * Phase command group — write phase review JSON to
 * .geas/missions/{mid}/phase-reviews/{phase}_{status}_{timestamp}.json
 */

import * as path from 'path';
import * as fs from 'fs';
import type { Command } from 'commander';
import { writeJsonFile, readJsonFile } from '../lib/fs-atomic';
import { resolveGeasDir, resolveMissionDir, validateIdentifier } from '../lib/paths';
import { validate } from '../lib/schema';
import { validatePhaseTransition } from '../lib/phase-guards';
import { success, validationError, fileError, noStdinError } from '../lib/output';
import { getCwd } from '../lib/cwd';
import { injectEnvelope } from '../lib/envelope';
import { readInputData } from '../lib/input';

export function registerPhaseCommands(program: Command): void {
  const cmd = program
    .command('phase')
    .description('Phase review read/write');

  // --- write ---
  cmd
    .command('write')
    .description('Write a phase review (JSON via stdin)')
    .requiredOption('--mission <mid>', 'Mission ID')
    .action((opts: { mission: string }, cmd: Command) => {
      try {
        const data = readInputData() as Record<string, unknown>;
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        validateIdentifier(opts.mission, 'mission ID');
        const missionDir = resolveMissionDir(geasDir, opts.mission);

        // Inject envelope fields (version, artifact_type, producer_type, artifact_id)
        injectEnvelope('phase_review', data, { mission_id: opts.mission });

        // Validate against phase-review schema
        const result = validate('phase-review', data);
        if (!result.valid) {
          validationError('phase-review', result.errors || []);
          return;
        }

        // C2: Enforce next_phase for ready_to_exit status (defense in depth)
        if ((data.status as string) === 'ready_to_exit' && !data.next_phase) {
          validationError('phase-review', [
            'next_phase is required when status is "ready_to_exit"',
          ]);
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
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'NO_STDIN') {
          noStdinError('phase write', nodeErr.message);
          return;
        }
        if (nodeErr.code === 'INVALID_JSON') {
          fileError('phase-reviews/', 'parse', nodeErr.message);
          return;
        }
        const msg = err instanceof SyntaxError
          ? 'Invalid JSON on stdin'
          : (err as Error).message;
        fileError('phase-reviews/', 'write', msg);
      }
    });

  // --- read-latest ---
  cmd
    .command('read-latest')
    .description('Read the most recent phase review for a given phase')
    .requiredOption('--mission <mid>', 'Mission ID')
    .requiredOption('--phase <phase>', 'Phase name')
    .action((opts: { mission: string; phase: string }, actionCmd: Command) => {
      try {
        const cwd = getCwd(actionCmd);
        const geasDir = resolveGeasDir(cwd);
        validateIdentifier(opts.mission, 'mission ID');
        const missionDir = resolveMissionDir(geasDir, opts.mission);
        const reviewsDir = path.resolve(missionDir, 'phase-reviews');

        if (!fs.existsSync(reviewsDir)) {
          fileError('phase-reviews/', 'read', 'No phase-reviews directory found');
          return;
        }

        // Find all files matching the phase prefix, pick latest by filename sort (timestamp in name)
        const files = fs.readdirSync(reviewsDir)
          .filter((f: string) => f.startsWith(`${opts.phase}_`) && f.endsWith('.json'))
          .sort()
          .reverse();

        if (files.length === 0) {
          fileError('phase-reviews/', 'read', `No phase review found for phase "${opts.phase}"`);
          return;
        }

        const latestFile = files[0];
        const filePath = path.resolve(reviewsDir, latestFile);
        const data = readJsonFile(filePath);
        if (!data) {
          fileError(latestFile, 'read', 'Failed to parse phase review JSON');
          return;
        }

        success({
          mission_id: opts.mission,
          phase: opts.phase,
          file: latestFile,
          path: filePath,
          data,
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('phase-reviews/', 'read-latest', nodeErr.message);
        } else {
          fileError('phase-reviews/', 'read-latest', (err as Error).message);
        }
      }
    });
}
