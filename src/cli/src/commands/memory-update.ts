/**
 * `geas memory-update` — structured consolidation change-log for memory.
 *
 *   geas memory-update set --mission <id>    (stdin: memory-update body)
 *
 * Writes `.geas/missions/{mission_id}/consolidation/memory-update.json`.
 * This is the per-mission audit trail of what the consolidating phase did
 * to `memory/shared.md` and `memory/agents/{agent}.md` — `added`,
 * `modified`, and `removed` lists per scope with `memory_id`, `reason`,
 * and `evidence_refs`.
 *
 * The canonical markdown files are written separately by
 * `geas memory shared-set` and `geas memory agent-set`. This command
 * records the semantic change log that pairs with those writes. The CLI
 * does NOT synchronize the two — the orchestrator / memorizing skill
 * owns that pairing (protocol 06 §Memory Update).
 *
 * `set` is full-replace (stdin is the complete body). The CLI injects
 * `mission_id`, `created_at`, and `updated_at`; everything else comes
 * from stdin and is schema-validated.
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
  isValidMissionId,
  memoryUpdatePath,
  missionSpecPath,
  tmpDir,
} from '../lib/paths';
import { readPayloadJson, StdinError } from '../lib/input';
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

/** Default empty shared block when the caller omits it. */
function emptySharedBlock(): Record<string, unknown> {
  return { added: [], modified: [], removed: [] };
}

export function registerMemoryUpdateCommands(program: Command): void {
  const mu = program
    .command('memory-update')
    .description(
      'Mission consolidation memory change log (missions/{id}/consolidation/memory-update.json).',
    );

  mu
    .command('set')
    .description(
      'Write memory-update.json for a mission (full-replace; payload via --file or stdin). Records what shared + agent memory changed this mission.',
    )
    .requiredOption('--mission <id>', 'Mission ID')
    .option('--file <path>', 'Read JSON payload from file instead of stdin')
    .action((opts: { mission: string; file?: string }) => {
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
        payload = readPayloadJson(opts.file) as Record<string, unknown>;
      } catch (e) {
        if (e instanceof StdinError) emit(err('invalid_argument', e.message));
        throw e;
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        emit(
          err(
            'invalid_argument',
            'memory-update set expects a JSON object payload',
          ),
        );
      }

      // Shape defaults — `shared` and `agents` are required, but let the
      // caller omit them when no change occurred. They must still be the
      // right shape to pass the schema.
      if (payload.shared === undefined) payload.shared = emptySharedBlock();
      if (payload.agents === undefined) payload.agents = [];

      const target = memoryUpdatePath(root, opts.mission);
      const existing = readJsonFile<{ created_at?: string }>(target);
      const ts = nowUtc();

      payload.mission_id = opts.mission;
      payload.created_at = existing?.created_at ?? ts;
      payload.updated_at = ts;

      const v = validate('memory-update', payload);
      if (!v.ok) {
        emit(
          err(
            'schema_validation_failed',
            'memory-update schema validation failed',
            v.errors,
          ),
        );
      }

      ensureDir(path.dirname(target));
      atomicWriteJson(target, payload, tmpDir(root));

      recordEvent(root, {
        kind: 'memory_update_set',
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
          memory_update: payload,
        }),
      );
    });
}
