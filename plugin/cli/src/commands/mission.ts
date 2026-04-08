/**
 * Mission command group — create mission directory, write spec.json,
 * write design-brief.json, read mission artifacts.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Command } from 'commander';
import { resolveGeasDir, normalizePath } from '../lib/paths';
import { readJsonFile, writeJsonFile, ensureDir } from '../lib/fs-atomic';
import { validate } from '../lib/schema';
import { success, validationError, fileError } from '../lib/output';
import { getCwd } from '../lib/cwd';

/** Read JSON from --data flag or piped stdin. */
function readInputData(dataArg: string | undefined): unknown {
  let raw: string | undefined = dataArg;

  if (!raw) {
    // Try reading from stdin (piped, non-TTY)
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

/** Subdirectories that must exist inside a mission directory. */
const MISSION_SUBDIRS = [
  'tasks',
  'evidence',
  'contracts',
  'packets',
  'decisions/pending',
  'evolution',
  'phase-reviews',
];

export function registerMissionCommands(program: Command): void {
  const cmd = program
    .command('mission')
    .description('Mission CRUD (spec, design-brief, directory)');

  // ── geas mission create --id <mission-id> ─────────────────────────
  cmd
    .command('create')
    .description('Create a mission directory with full subdirectory structure')
    .requiredOption('--id <mission-id>', 'Mission identifier')
    .action((opts: { id: string }) => {
      try {
        const geasDir = resolveGeasDir(getCwd(cmd));
        const missionDir = path.resolve(geasDir, 'missions', opts.id);
        const normalized = normalizePath(missionDir);

        if (fs.existsSync(missionDir)) {
          fileError(normalized, 'create', `Mission directory already exists: ${normalized}`);
          return;
        }

        // Create the mission root and all subdirectories
        ensureDir(missionDir);
        for (const sub of MISSION_SUBDIRS) {
          ensureDir(path.resolve(missionDir, sub));
        }

        success({
          created: normalized,
          subdirectories: MISSION_SUBDIRS,
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'create', nodeErr.message);
        } else {
          throw err;
        }
      }
    });

  // ── geas mission write-spec --id <mission-id> --data <json> ───────
  cmd
    .command('write-spec')
    .description('Write spec.json with schema validation')
    .requiredOption('--id <mission-id>', 'Mission identifier')
    .option('--data <json>', 'JSON data (or pipe via stdin)')
    .action((opts: { id: string; data?: string }) => {
      try {
        const geasDir = resolveGeasDir(getCwd(cmd));
        const missionDir = path.resolve(geasDir, 'missions', opts.id);

        if (!fs.existsSync(missionDir)) {
          fileError(
            normalizePath(missionDir),
            'write',
            `Mission directory not found: ${normalizePath(missionDir)}. Run 'geas mission create --id ${opts.id}' first.`
          );
          return;
        }

        const data = readInputData(opts.data);

        // Validate against mission-spec schema
        const result = validate('mission-spec', data);
        if (!result.valid) {
          validationError('mission-spec', result.errors!);
          return;
        }

        const specPath = path.resolve(missionDir, 'spec.json');
        writeJsonFile(specPath, data);

        success({
          written: normalizePath(specPath),
          mission_id: opts.id,
          artifact_type: 'mission_spec',
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'write', nodeErr.message);
        } else {
          throw err;
        }
      }
    });

  // ── geas mission write-brief --id <mission-id> --data <json> ──────
  cmd
    .command('write-brief')
    .description('Write design-brief.json with schema validation')
    .requiredOption('--id <mission-id>', 'Mission identifier')
    .option('--data <json>', 'JSON data (or pipe via stdin)')
    .action((opts: { id: string; data?: string }) => {
      try {
        const geasDir = resolveGeasDir(getCwd(cmd));
        const missionDir = path.resolve(geasDir, 'missions', opts.id);

        if (!fs.existsSync(missionDir)) {
          fileError(
            normalizePath(missionDir),
            'write',
            `Mission directory not found: ${normalizePath(missionDir)}. Run 'geas mission create --id ${opts.id}' first.`
          );
          return;
        }

        const data = readInputData(opts.data);

        // Validate against design-brief schema
        const result = validate('design-brief', data);
        if (!result.valid) {
          validationError('design-brief', result.errors!);
          return;
        }

        const briefPath = path.resolve(missionDir, 'design-brief.json');
        writeJsonFile(briefPath, data);

        success({
          written: normalizePath(briefPath),
          mission_id: opts.id,
          artifact_type: 'design_brief',
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'write', nodeErr.message);
        } else {
          throw err;
        }
      }
    });

  // ── geas mission read --id <mission-id> [--artifact spec|brief] ───
  cmd
    .command('read')
    .description('Read mission artifacts (spec.json, design-brief.json, or both)')
    .requiredOption('--id <mission-id>', 'Mission identifier')
    .option('--artifact <type>', 'Artifact to read: spec, brief, or omit for both')
    .action((opts: { id: string; artifact?: string }) => {
      try {
        const geasDir = resolveGeasDir(getCwd(cmd));
        const missionDir = path.resolve(geasDir, 'missions', opts.id);

        if (!fs.existsSync(missionDir)) {
          fileError(
            normalizePath(missionDir),
            'read',
            `Mission directory not found: ${normalizePath(missionDir)}`
          );
          return;
        }

        const artifactType = opts.artifact;

        if (artifactType && !['spec', 'brief'].includes(artifactType)) {
          fileError('', 'read', `Unknown artifact type '${artifactType}'. Use 'spec' or 'brief'.`);
          return;
        }

        const result: Record<string, unknown> = { mission_id: opts.id };

        if (!artifactType || artifactType === 'spec') {
          const specPath = path.resolve(missionDir, 'spec.json');
          const spec = readJsonFile(specPath);
          if (spec) {
            result.spec = spec;
          } else if (artifactType === 'spec') {
            fileError(normalizePath(specPath), 'read', 'spec.json not found');
            return;
          }
        }

        if (!artifactType || artifactType === 'brief') {
          const briefPath = path.resolve(missionDir, 'design-brief.json');
          const brief = readJsonFile(briefPath);
          if (brief) {
            result.brief = brief;
          } else if (artifactType === 'brief') {
            fileError(normalizePath(briefPath), 'read', 'design-brief.json not found');
            return;
          }
        }

        success(result);
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'read', nodeErr.message);
        } else {
          throw err;
        }
      }
    });
}
