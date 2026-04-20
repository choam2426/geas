/**
 * `geas self-check` — write the worker self-check artifact for a task.
 *
 *   geas self-check set --mission <id> --task <id>    (stdin: self-check body)
 *
 * Writes `.geas/missions/{mission_id}/tasks/{task_id}/self-check.json`.
 * Self-check is written once by the implementer after finishing implementation
 * and before independent review. Overwrite is rejected — if the implementer
 * needs to revise, they should open a `reviewed -> implementing` loop and
 * land a new self-check as part of the next pass.
 *
 * The CLI owns mission_id / task_id / created_at / updated_at; other
 * content fields come from stdin.
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
  isValidTaskId,
  missionSpecPath,
  selfCheckPath,
  taskContractPath,
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

export function registerSelfCheckCommands(program: Command): void {
  const sc = program
    .command('self-check')
    .description('Implementer self-check artifact (self-check.json) commands.');

  sc.command('set')
    .description(
      'Write self-check.json for a task (stdin: content fields). Rejects overwrite — self-check is written once.',
    )
    .requiredOption('--mission <id>', 'Mission ID')
    .requiredOption('--task <id>', 'Task ID')
    .action((opts: { mission: string; task: string }) => {
      if (!isValidMissionId(opts.mission)) {
        emit(err('invalid_argument', `invalid mission id '${opts.mission}'`));
      }
      if (!isValidTaskId(opts.task)) {
        emit(err('invalid_argument', `invalid task id '${opts.task}'`));
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
      if (!exists(taskContractPath(root, opts.mission, opts.task))) {
        emit(
          err(
            'missing_artifact',
            `task contract not found for ${opts.task}`,
          ),
        );
      }

      const p = selfCheckPath(root, opts.mission, opts.task);
      if (exists(p)) {
        emit(
          err(
            'path_collision',
            `self-check.json already exists at ${slashPath(p)} — self-check is written once`,
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
          err(
            'invalid_argument',
            'self-check set expects a JSON object on stdin',
          ),
        );
      }

      // Default arrays so callers can omit empty lists.
      if (payload.reviewer_focus === undefined) payload.reviewer_focus = [];
      if (payload.known_risks === undefined) payload.known_risks = [];
      if (payload.deviations_from_plan === undefined) {
        payload.deviations_from_plan = [];
      }
      if (payload.gap_signals === undefined) payload.gap_signals = [];

      const ts = nowUtc();
      payload.mission_id = opts.mission;
      payload.task_id = opts.task;
      payload.created_at = ts;
      payload.updated_at = ts;

      const v = validate('self-check', payload);
      if (!v.ok) {
        emit(
          err(
            'schema_validation_failed',
            'self-check schema validation failed',
            v.errors,
          ),
        );
      }

      ensureDir(path.dirname(p));
      // Pre-check already rejected existing path; existing-raced writes
      // surface via atomicWrite's temp + rename semantics.
      const existing = readJsonFile<Record<string, unknown>>(p);
      if (existing) {
        emit(
          err(
            'path_collision',
            `self-check.json already exists at ${slashPath(p)}`,
          ),
        );
      }
      atomicWriteJson(p, payload, tmpDir(root));

      recordEvent(root, {
        kind: 'self_check_set',
        actor: 'cli:auto',
        payload: {
          mission_id: opts.mission,
          task_id: opts.task,
          artifact: slashPath(path.relative(root, p)),
        },
      });

      emit(
        ok({
          path: slashPath(p),
          ids: { mission_id: opts.mission, task_id: opts.task },
          self_check: payload,
        }),
      );
    });
}
