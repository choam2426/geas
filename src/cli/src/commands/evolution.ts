/**
 * Evolution command group — write evolution artifacts to
 * .geas/missions/{mid}/evolution/
 */

import * as path from 'path';
import type { Command } from 'commander';
import { writeJsonFile, ensureDir } from '../lib/fs-atomic';
import { resolveGeasDir, resolveMissionDir, normalizePath, validateIdentifier, assertContainedIn } from '../lib/paths';
import { validate } from '../lib/schema';
import { success, validationError, fileError, noStdinError } from '../lib/output';
import { getCwd } from '../lib/cwd';
import { readInputData } from '../lib/input';
import { dryRunGuard, dryRunParseError } from '../lib/dry-run';

const VALID_PHASES = ['specifying', 'building', 'polishing', 'evolving'];

export function registerEvolutionCommands(program: Command): void {
  const cmd = program
    .command('evolution')
    .description('Evolution phase artifacts (gap-assessment, rules-update)');

  // --- gap-assessment ---
  cmd
    .command('gap-assessment')
    .description('Write a gap assessment for a mission phase (JSON via stdin)')
    .requiredOption('--mission <mid>', 'Mission identifier')
    .requiredOption('--phase <phase>', 'Mission phase (e.g. building, polishing, evolving)')
    .option('--dry-run', 'Validate input without writing files')
    .action((opts: { mission: string; phase: string; dryRun?: boolean }, actionCmd: Command) => {
      try {
        const data = readInputData() as Record<string, unknown>;
        const cwd = getCwd(actionCmd);
        const geasDir = resolveGeasDir(cwd);
        validateIdentifier(opts.mission, 'mission');

        if (!VALID_PHASES.includes(opts.phase)) {
          fileError('', 'validate', `Invalid phase '${opts.phase}'. Must be one of: ${VALID_PHASES.join(', ')}`);
          return;
        }

        const missionDir = resolveMissionDir(geasDir, opts.mission);

        // --dry-run: validate and exit without writing
        if (opts.dryRun) {
          dryRunGuard(true, data, 'gap-assessment');
          return;
        }

        const result = validate('gap-assessment', data);
        if (!result.valid) {
          validationError('gap-assessment', result.errors || []);
          return;
        }

        const evolutionDir = path.resolve(missionDir, 'evolution');
        ensureDir(evolutionDir);
        const filePath = path.resolve(evolutionDir, `gap-assessment-${opts.phase}.json`);
        assertContainedIn(filePath, missionDir);
        writeJsonFile(filePath, data, { cwd });

        success({
          written: normalizePath(filePath),
          mission_id: opts.mission,
          phase: opts.phase,
          artifact_type: 'gap_assessment',
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'NO_STDIN') {
          noStdinError('gap-assessment', nodeErr.message);
        } else if (nodeErr.code === 'INVALID_JSON') {
          if (opts.dryRun) { dryRunParseError(nodeErr.message); return; }
          fileError('', 'parse', nodeErr.message);
        } else if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'gap-assessment', nodeErr.message);
        } else {
          const msg = err instanceof SyntaxError
            ? 'Invalid JSON on stdin'
            : (err as Error).message;
          fileError('', 'gap-assessment', msg);
        }
      }
    });

  // --- rules-update ---
  cmd
    .command('rules-update')
    .description('Write a rules update artifact for a mission (JSON via stdin)')
    .requiredOption('--mission <mid>', 'Mission identifier')
    .option('--dry-run', 'Validate input without writing files')
    .action((opts: { mission: string; dryRun?: boolean }, actionCmd: Command) => {
      try {
        const data = readInputData() as Record<string, unknown>;
        const cwd = getCwd(actionCmd);
        const geasDir = resolveGeasDir(cwd);
        validateIdentifier(opts.mission, 'mission');
        const missionDir = resolveMissionDir(geasDir, opts.mission);

        // --dry-run: validate and exit without writing
        if (opts.dryRun) {
          dryRunGuard(true, data, 'rules-update');
          return;
        }

        const result = validate('rules-update', data);
        if (!result.valid) {
          validationError('rules-update', result.errors || []);
          return;
        }

        const evolutionDir = path.resolve(missionDir, 'evolution');
        ensureDir(evolutionDir);
        const filePath = path.resolve(evolutionDir, 'rules-update.json');
        assertContainedIn(filePath, missionDir);
        writeJsonFile(filePath, data, { cwd });

        success({
          written: normalizePath(filePath),
          mission_id: opts.mission,
          artifact_type: 'rules_update',
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'NO_STDIN') {
          noStdinError('rules-update', nodeErr.message);
        } else if (nodeErr.code === 'INVALID_JSON') {
          if (opts.dryRun) { dryRunParseError(nodeErr.message); return; }
          fileError('', 'parse', nodeErr.message);
        } else if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'rules-update', nodeErr.message);
        } else {
          const msg = err instanceof SyntaxError
            ? 'Invalid JSON on stdin'
            : (err as Error).message;
          fileError('', 'rules-update', msg);
        }
      }
    });
}
