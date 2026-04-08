/**
 * Evolution command group — write gap-assessment JSON to
 * .geas/missions/{mid}/evolution/gap-assessment-{phase}.json
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Command } from 'commander';
import { writeJsonFile, ensureDir } from '../lib/fs-atomic';
import { resolveGeasDir, resolveMissionDir, normalizePath } from '../lib/paths';
import { validate } from '../lib/schema';
import { success, validationError, fileError } from '../lib/output';
import { getCwd } from '../lib/cwd';

/** Read JSON from --data flag or piped stdin. */
function readInputData(dataArg: string | undefined): unknown {
  let raw: string | undefined = dataArg;

  if (!raw) {
    try {
      if (!process.stdin.isTTY) {
        raw = fs.readFileSync(0, 'utf-8').trim();
      }
    } catch {
      // stdin not available or empty
    }
  }

  if (!raw) {
    const err = new Error('No data provided. Use --data <json> or pipe JSON to stdin.');
    (err as NodeJS.ErrnoException).code = 'FILE_ERROR';
    throw err;
  }

  try {
    return JSON.parse(raw);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const err = new Error(`Invalid JSON in --data: ${msg}`);
    (err as NodeJS.ErrnoException).code = 'FILE_ERROR';
    throw err;
  }
}

export function registerEvolutionCommands(program: Command): void {
  const cmd = program
    .command('evolution')
    .description('Evolution phase artifacts (gap-assessment)');

  // --- gap-assessment ---
  cmd
    .command('gap-assessment')
    .description('Write a gap assessment for a mission phase')
    .requiredOption('--mission <mid>', 'Mission identifier')
    .requiredOption('--phase <phase>', 'Mission phase (e.g. building, polishing, evolving)')
    .option('--data <json>', 'JSON data (or pipe via stdin)')
    .action((opts: { mission: string; phase: string; data?: string }, actionCmd: Command) => {
      try {
        const data = readInputData(opts.data) as Record<string, unknown>;
        const geasDir = resolveGeasDir(getCwd(actionCmd));
        const missionDir = resolveMissionDir(geasDir, opts.mission);

        const result = validate('gap-assessment', data);
        if (!result.valid) {
          validationError('gap-assessment', result.errors || []);
          return;
        }

        const evolutionDir = path.resolve(missionDir, 'evolution');
        ensureDir(evolutionDir);
        const filePath = path.resolve(evolutionDir, `gap-assessment-${opts.phase}.json`);
        writeJsonFile(filePath, data);

        success({
          written: normalizePath(filePath),
          mission_id: opts.mission,
          phase: opts.phase,
          artifact_type: 'gap_assessment',
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'gap-assessment', nodeErr.message);
        } else {
          const msg = err instanceof SyntaxError
            ? 'Invalid JSON in --data'
            : (err as Error).message;
          fileError('', 'gap-assessment', msg);
        }
      }
    });
}
