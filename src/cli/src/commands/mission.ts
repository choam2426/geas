/**
 * Mission command group — create mission directory, write spec.json,
 * write design-brief.json, read mission artifacts.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { Command } from 'commander';
import { resolveGeasDir, normalizePath, validateIdentifier } from '../lib/paths';
import { readJsonFile, writeJsonFile, ensureDir } from '../lib/fs-atomic';
import { validate } from '../lib/schema';
import { success, validationError, fileError } from '../lib/output';
import { getCwd } from '../lib/cwd';
import { readInputData } from '../lib/input';

/** Generate a mission ID in the format mission-{YYYYMMDD}-{8alphanumeric}. */
function generateMissionId(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const date = `${y}${m}${d}`;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(8);
  let rand = '';
  for (let i = 0; i < 8; i++) {
    rand += chars[bytes[i] % chars.length];
  }
  return `mission-${date}-${rand}`;
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

  // ── geas mission create [--id <mission-id>] ───────────────────────
  cmd
    .command('create')
    .description('Create a mission directory with full subdirectory structure. Auto-generates ID if --id is omitted.')
    .option('--id <mission-id>', 'Mission identifier (auto-generated if omitted)')
    .action((opts: { id?: string }) => {
      try {
        const geasDir = resolveGeasDir(getCwd(cmd));
        const missionsDir = path.resolve(geasDir, 'missions');

        let missionId: string;
        if (opts.id) {
          validateIdentifier(opts.id, 'mission ID');
          missionId = opts.id;
        } else {
          // Auto-generate with uniqueness check
          let attempts = 0;
          do {
            missionId = generateMissionId();
            attempts++;
            if (attempts > 10) {
              fileError('', 'create', 'Failed to generate unique mission ID after 10 attempts');
              return;
            }
          } while (fs.existsSync(path.resolve(missionsDir, missionId)));
        }

        const missionDir = path.resolve(missionsDir, missionId);
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
          mission_id: missionId,
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
        validateIdentifier(opts.id, 'mission ID');
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const missionDir = path.resolve(geasDir, 'missions', opts.id);

        if (!fs.existsSync(missionDir)) {
          fileError(
            normalizePath(missionDir),
            'write',
            `Mission directory not found: ${normalizePath(missionDir)}. Run 'geas mission create --id ${opts.id}' first.`
          );
          return;
        }

        const data = readInputData(opts.data, undefined);

        // Validate against mission-spec schema
        const result = validate('mission-spec', data);
        if (!result.valid) {
          validationError('mission-spec', result.errors!);
          return;
        }

        const specPath = path.resolve(missionDir, 'spec.json');
        writeJsonFile(specPath, data, { cwd });

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
        validateIdentifier(opts.id, 'mission ID');
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const missionDir = path.resolve(geasDir, 'missions', opts.id);

        if (!fs.existsSync(missionDir)) {
          fileError(
            normalizePath(missionDir),
            'write',
            `Mission directory not found: ${normalizePath(missionDir)}. Run 'geas mission create --id ${opts.id}' first.`
          );
          return;
        }

        const data = readInputData(opts.data, undefined);

        // Validate against design-brief schema
        const result = validate('design-brief', data);
        if (!result.valid) {
          validationError('design-brief', result.errors!);
          return;
        }

        const briefPath = path.resolve(missionDir, 'design-brief.json');
        writeJsonFile(briefPath, data, { cwd });

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
        validateIdentifier(opts.id, 'mission ID');
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
