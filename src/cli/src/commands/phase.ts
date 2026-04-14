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
import { readInputData, parseSetFlags, deepMergeSetOverrides } from '../lib/input';
import { dryRunGuard, dryRunParseError } from '../lib/dry-run';

export function registerPhaseCommands(program: Command): void {
  const cmd = program
    .command('phase')
    .description('Phase review read/write');

  // --- write [PHASE] [STATUS] ---
  cmd
    .command('write [phase] [status]')
    .description('Write a phase review (positional: PHASE STATUS, or JSON via stdin)')
    .requiredOption('--mission <mid>', 'Mission ID')
    .option('--summary <text>', 'Phase review summary')
    .option('--set <key=value...>', 'Set additional fields', collectSet, [])
    .option('--dry-run', 'Validate input without writing files')
    .action((phase: string | undefined, status: string | undefined, opts: { mission: string; summary?: string; set: string[]; dryRun?: boolean }, cmd: Command) => {
      try {
        let data: Record<string, unknown>;

        // Try stdin first; if no stdin and positional args provided, build from args
        let stdinData: Record<string, unknown> | undefined;
        try {
          stdinData = readInputData() as Record<string, unknown>;
        } catch (readErr: unknown) {
          const rnErr = readErr as NodeJS.ErrnoException;
          if (rnErr.code === 'NO_STDIN') {
            stdinData = undefined;
          } else if (rnErr.code === 'INVALID_JSON') {
            if (opts.dryRun) { dryRunParseError(rnErr.message); return; }
            fileError('phase-reviews/', 'parse', rnErr.message);
            return;
          } else {
            throw readErr;
          }
        }

        if (stdinData) {
          data = stdinData;
          // Apply --set overrides on top of stdin
          if (opts.set.length > 0) {
            const overrides = parseSetFlags(opts.set);
            deepMergeSetOverrides(data, overrides);
          }
        } else if (phase && status) {
          // Build from positional args
          data = {
            mission_phase: phase,
            status: status,
          };
          if (opts.summary) {
            data.summary = opts.summary;
          }
          // Apply --set overrides
          if (opts.set.length > 0) {
            const overrides = parseSetFlags(opts.set);
            deepMergeSetOverrides(data, overrides);
          }
        } else {
          noStdinError('phase write', 'No data provided. Pipe JSON to stdin, or use positional args: geas phase write PHASE STATUS --summary TEXT');
          return;
        }

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

        // --dry-run: validate and exit without writing
        if (opts.dryRun) {
          dryRunGuard(true, data, 'phase-review');
          return;
        }

        // Build filename from phase + status + timestamp
        const phaseVal = (data.mission_phase as string) || 'unknown';
        const statusVal = (data.status as string) || 'unknown';
        const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
        const filename = `${phaseVal}_${statusVal}_${timestamp}.json`;

        const filePath = path.resolve(missionDir, 'phase-reviews', filename);
        writeJsonFile(filePath, data, { cwd });

        success({
          ok: true,
          mission_id: opts.mission,
          phase: phaseVal,
          status: statusVal,
          path: filePath,
        });
      } catch (err: unknown) {
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

/** Commander variadic option collector for --set. */
function collectSet(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}
