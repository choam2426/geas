/**
 * `geas gap` — mission-level gap artifact.
 *
 *   geas gap set --mission <id>    (stdin: gap body)
 *
 * Writes `.geas/missions/{mission_id}/consolidation/gap.json`. Consolidating
 * phase produces this once per mission as the Design Authority's scope
 * closure record: what scope actually landed, what did not, and what was
 * unexpectedly added. `set` is full-replace — the full gap body is written
 * byte-equivalent from stdin after CLI injects envelope fields.
 *
 * The CLI owns:
 *   - mission_id (from --mission flag)
 *   - created_at on first write
 *   - updated_at on every write
 *
 * Everything else comes from stdin and is schema-validated before write.
 */

import type { Command } from 'commander';
import * as path from 'path';

import { emit, err, ok, recordEvent } from '../lib/envelope';
import {
  atomicWriteJson,
  ensureDir,
  exists,
  readJsonFile,
} from '../lib/fs-atomic';
import {
  findProjectRoot,
  gapPath,
  isValidMissionId,
  missionSpecPath,
  tmpDir,
} from '../lib/paths';
import { readStdinJson, StdinError } from '../lib/input';
import { validate } from '../lib/schema';

function nowUtc(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function slashPath(p: string): string {
  return p.replace(/\\/g, '/');
}

function needProjectRoot(): string {
  const root = findProjectRoot(process.cwd());
  if (!root) {
    emit(
      err(
        'missing_artifact',
        `.geas/ not found at ${process.cwd().replace(/\\/g, '/')}. Run 'geas setup' first.`,
      ),
    );
  }
  return root as string;
}

export function registerGapCommands(program: Command): void {
  const gap = program
    .command('gap')
    .description(
      'Mission-level gap artifact (missions/{id}/consolidation/gap.json).',
    );

  gap
    .command('set')
    .description(
      'Write gap.json for a mission (full-replace, stdin: gap body). Allowed during consolidating phase.',
    )
    .requiredOption('--mission <id>', 'Mission ID')
    .action((opts: { mission: string }) => {
      if (!isValidMissionId(opts.mission)) {
        emit(err('invalid_argument', `invalid mission id '${opts.mission}'`));
      }
      const root = needProjectRoot();

      if (!exists(missionSpecPath(root, opts.mission))) {
        emit(
          err(
            'missing_artifact',
            `mission spec not found for ${opts.mission}`,
          ),
        );
      }

      let payload: Record<string, unknown>;
      try {
        payload = readStdinJson() as Record<string, unknown>;
      } catch (e) {
        if (e instanceof StdinError) emit(err('invalid_argument', e.message));
        throw e;
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        emit(
          err('invalid_argument', 'gap set expects a JSON object on stdin'),
        );
      }

      // Default arrays so callers can omit empty lists.
      if (payload.fully_delivered === undefined) payload.fully_delivered = [];
      if (payload.partially_delivered === undefined) payload.partially_delivered = [];
      if (payload.not_delivered === undefined) payload.not_delivered = [];
      if (payload.unexpected_additions === undefined) payload.unexpected_additions = [];

      const target = gapPath(root, opts.mission);
      const existing = readJsonFile<{ created_at?: string }>(target);
      const ts = nowUtc();

      payload.mission_id = opts.mission;
      payload.created_at = existing?.created_at ?? ts;
      payload.updated_at = ts;

      const v = validate('gap', payload);
      if (!v.ok) {
        emit(
          err(
            'schema_validation_failed',
            'gap schema validation failed',
            v.errors,
          ),
        );
      }

      ensureDir(path.dirname(target));
      atomicWriteJson(target, payload, tmpDir(root));

      recordEvent(root, {
        kind: 'gap_set',
        actor: 'cli:auto',
        payload: {
          mission_id: opts.mission,
          artifact: slashPath(path.relative(root, target)),
        },
      });

      emit(
        ok({
          path: slashPath(target),
          ids: { mission_id: opts.mission },
          gap: payload,
        }),
      );
    });
}
