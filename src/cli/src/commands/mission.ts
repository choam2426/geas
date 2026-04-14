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
import { success, validationError, fileError, noStdinError } from '../lib/output';
import { getCwd } from '../lib/cwd';
import { readInputData, parseSetFlags, deepMergeSetOverrides } from '../lib/input';
import { injectEnvelope } from '../lib/envelope';
import { dryRunGuard, dryRunParseError } from '../lib/dry-run';

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
  'decisions/pending',
  'polishing',
  'evolution',
  'phase-reviews',
];

export function registerMissionCommands(program: Command): void {
  const cmd = program
    .command('mission')
    .description('Mission CRUD (spec, design-brief, directory)');

  // ── geas mission create [TITLE] [--id <mission-id>] [--done-when DESC] ─
  cmd
    .command('create [title]')
    .description('Create a mission directory (and spec.json when TITLE + --done-when given). Auto-generates ID if --id is omitted.')
    .option('--id <mission-id>', 'Mission identifier (auto-generated if omitted)')
    .option('--done-when <description>', 'Done-when description (requires TITLE; writes spec.json)')
    .option('--set <key=value...>', 'Set additional spec fields', collectSet, [])
    .option('--dry-run', 'Validate input without writing files')
    .action((title: string | undefined, opts: { id?: string; doneWhen?: string; set: string[]; dryRun?: boolean }) => {
      try {
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const missionsDir = path.resolve(geasDir, 'missions');

        // Validate: --done-when requires TITLE
        if (opts.doneWhen && !title) {
          fileError('', 'create', '--done-when requires a TITLE positional argument.');
          return;
        }

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

        // --dry-run: validate and exit without writing
        if (opts.dryRun) {
          const dryData: Record<string, unknown> = { mission_id: missionId };
          if (title && opts.doneWhen) {
            dryData.mission = title;
            dryData.done_when = opts.doneWhen;
          }
          dryRunGuard(true, dryData, 'mission-create');
          return;
        }

        // Create the mission root and all subdirectories
        ensureDir(missionDir);
        for (const sub of MISSION_SUBDIRS) {
          ensureDir(path.resolve(missionDir, sub));
        }

        // If TITLE and --done-when provided, also write spec.json
        if (title && opts.doneWhen) {
          const specData: Record<string, unknown> = {
            mission_id: missionId,
            mission: title,
            done_when: opts.doneWhen,
          };

          // Apply --set overrides
          if (opts.set.length > 0) {
            const overrides = parseSetFlags(opts.set);
            deepMergeSetOverrides(specData, overrides);
          }

          // Inject envelope fields
          injectEnvelope('mission_spec', specData, { mission_id: missionId });

          // Validate against mission-spec schema
          const result = validate('mission-spec', specData);
          if (!result.valid) {
            validationError('mission-spec', result.errors!);
            return;
          }

          const specPath = path.resolve(missionDir, 'spec.json');
          writeJsonFile(specPath, specData, { cwd });

          success({
            created: normalized,
            mission_id: missionId,
            subdirectories: MISSION_SUBDIRS,
            spec_written: normalizePath(specPath),
          });
        } else {
          success({
            created: normalized,
            mission_id: missionId,
            subdirectories: MISSION_SUBDIRS,
          });
        }
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'create', nodeErr.message);
        } else {
          throw err;
        }
      }
    });

  // ── geas mission write-spec --id <mission-id> (JSON via stdin) ────
  cmd
    .command('write-spec')
    .description('Write spec.json with schema validation (JSON via stdin)')
    .requiredOption('--id <mission-id>', 'Mission identifier')
    .option('--dry-run', 'Validate input without writing files')
    .action((opts: { id: string; dryRun?: boolean }) => {
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

        const data = readInputData() as Record<string, unknown>;

        // Inject envelope fields (version, artifact_type, producer_type, artifact_id)
        injectEnvelope('mission_spec', data, { mission_id: opts.id });

        // --dry-run: validate and exit without writing
        if (opts.dryRun) {
          dryRunGuard(true, data, 'mission-spec');
          return;
        }

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
        if (nodeErr.code === 'NO_STDIN') {
          noStdinError('mission write', nodeErr.message);
        } else if (nodeErr.code === 'INVALID_JSON') {
          if (opts.dryRun) { dryRunParseError(nodeErr.message); return; }
          fileError('', 'parse', nodeErr.message);
        } else if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'write', nodeErr.message);
        } else {
          throw err;
        }
      }
    });

  // ── geas mission write-brief --id <mission-id> (JSON via stdin) ───
  cmd
    .command('write-brief')
    .description('Write design-brief.json with schema validation (JSON via stdin)')
    .requiredOption('--id <mission-id>', 'Mission identifier')
    .option('--dry-run', 'Validate input without writing files')
    .action((opts: { id: string; dryRun?: boolean }) => {
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

        const data = readInputData() as Record<string, unknown>;

        // Inject envelope fields (version, artifact_type, producer_type, artifact_id)
        injectEnvelope('design_brief', data, { mission_id: opts.id });

        // --dry-run: validate and exit without writing
        if (opts.dryRun) {
          dryRunGuard(true, data, 'design-brief');
          return;
        }

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
        if (nodeErr.code === 'NO_STDIN') {
          noStdinError('mission write', nodeErr.message);
        } else if (nodeErr.code === 'INVALID_JSON') {
          if (opts.dryRun) { dryRunParseError(nodeErr.message); return; }
          fileError('', 'parse', nodeErr.message);
        } else if (nodeErr.code === 'FILE_ERROR') {
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

/** Commander variadic option collector for --set. */
function collectSet(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}
