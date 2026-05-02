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

import { recordEvent } from '../lib/envelope';
import { emitErr, emitOk, registerFormatter } from '../lib/output';
import { makeError } from '../lib/errors';
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
    emitErr(
      makeError(
        'missing_artifact',
        `.geas/ not found at ${process.cwd().replace(/\\/g, '/')}.`,
        {
          hint: "run 'geas setup' to bootstrap the .geas/ tree",
          exit_category: 'missing_artifact',
        },
      ),
    );
  }
  return root as string;
}

/** AC3: scalar formatter for gap set. */
function formatGapSet(data: unknown): string {
  const d = data as { ids?: { mission_id?: string }; path?: string; gap?: { fully_delivered?: unknown[]; partially_delivered?: unknown[]; not_delivered?: unknown[]; unexpected_additions?: unknown[] } };
  const fd = Array.isArray(d.gap?.fully_delivered) ? d.gap!.fully_delivered.length : 0;
  const pd = Array.isArray(d.gap?.partially_delivered) ? d.gap!.partially_delivered.length : 0;
  const nd = Array.isArray(d.gap?.not_delivered) ? d.gap!.not_delivered.length : 0;
  const ua = Array.isArray(d.gap?.unexpected_additions) ? d.gap!.unexpected_additions.length : 0;
  return [
    `gap set: ${d.ids?.mission_id ?? '<unknown>'} → ${d.path ?? '<unknown>'}`,
    `fully=${fd} partial=${pd} not_delivered=${nd} unexpected=${ua}`,
  ].join('\n');
}

export function registerGapCommands(program: Command): void {
  registerFormatter('gap set', formatGapSet);
  const gap = program
    .command('gap')
    .description(
      'Mission-level gap artifact (missions/{id}/consolidation/gap.json).',
    );

  gap
    .command('set')
    .description(
      'Write gap.json for a mission (full-replace; payload via --file or stdin). Allowed during consolidating phase.',
    )
    .requiredOption('--mission <id>', 'Mission ID')
    .option('--file <path>', 'Read JSON payload from file instead of stdin')
    .action((opts: { mission: string; file?: string }) => {
      if (!isValidMissionId(opts.mission)) {
        emitErr(
          makeError('invalid_argument', `invalid mission id '${opts.mission}'`, {
            hint: "mission ids look like 'mission-YYYYMMDD-XXXXXXXX' (8 alphanumerics)",
            exit_category: 'validation',
          }),
        );
      }
      const root = needProjectRoot();

      if (!exists(missionSpecPath(root, opts.mission))) {
        emitErr(
          makeError('missing_artifact', `mission spec not found for ${opts.mission}`, {
            hint: "run 'geas mission create' to bootstrap the mission first",
            exit_category: 'missing_artifact',
          }),
        );
      }

      let payload: Record<string, unknown>;
      try {
        payload = readPayloadJson(opts.file) as Record<string, unknown>;
      } catch (e) {
        if (e instanceof StdinError) {
          emitErr(
            makeError('invalid_argument', e.message, {
              hint: 'pass the JSON via --file <path> or pipe through stdin',
              exit_category: 'validation',
            }),
          );
        }
        throw e;
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        emitErr(
          makeError('invalid_argument', 'gap set expects a JSON object payload', {
            hint: 'wrap the gap fields in a single JSON object',
            exit_category: 'validation',
          }),
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
        emitErr(
          makeError(
            'schema_validation_failed',
            'gap schema validation failed',
            {
              hint: 'inspect ajv errors and fix the gap body, then retry',
              exit_category: 'validation',
            },
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

      emitOk('gap set', {
        path: slashPath(target),
        ids: { mission_id: opts.mission },
        gap: payload,
      });
    });
}
