/**
 * `geas impl-contract` — pre-implementation agreement artifact.
 *
 *   geas impl-contract set --mission <id> --task <id>   (stdin: body)
 *
 * Writes the task implementation contract to
 * `.geas/missions/{mission_id}/tasks/{task_id}/implementation-contract.json`.
 * This is the worker's concrete action plan (change_scope, planned_actions,
 * non_goals, alternatives_considered, assumptions, open_questions) agreed
 * upon by design-authority and quality-specialist before implementation
 * begins — preventing wasted implementation cycles from misunderstood
 * requirements (protocol 03, CLI.md §3 + §71).
 *
 * Set semantics: full-replace (not append). The CLI injects
 * mission_id / task_id / created_at / updated_at; everything else
 * comes from stdin and is schema-validated.
 *
 * Guards:
 *   - Valid mission_id + task_id.
 *   - Mission spec exists + user_approved.
 *   - Task contract exists + has approved_by set.
 *   - Task state is `ready` or `implementing` (impl-contract is a
 *     pre-implementation agreement; later-stage or terminal states
 *     reject the write).
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
  implementationContractPath,
  isValidMissionId,
  isValidTaskId,
  missionSpecPath,
  taskContractPath,
  taskStatePath,
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

/**
 * Allowed task states from which the impl-contract may be written.
 * Pre-implementation agreement is only meaningful before implementation
 * ends; later states (reviewed/verified/passed) have already moved past
 * the plan, and terminal states (cancelled/escalated) cannot accept new
 * plans.
 */
const IMPL_CONTRACT_WRITABLE_STATES = new Set(['ready', 'implementing']);

/** Fields the CLI owns exclusively. Caller-provided values are stripped. */
const ENVELOPE_FIELDS = ['mission_id', 'task_id', 'created_at', 'updated_at'];

export function registerImplContractCommands(program: Command): void {
  const ic = program
    .command('impl-contract')
    .description(
      'Pre-implementation agreement (implementation-contract.json) commands.',
    );

  ic.command('set')
    .description(
      'Write implementation-contract.json for a task (full-replace, stdin: body). CLI injects mission_id / task_id / timestamps.',
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

      // Mission must exist and be user-approved.
      const spec = readJsonFile<{ user_approved?: boolean }>(
        missionSpecPath(root, opts.mission),
      );
      if (!spec) {
        emit(
          err(
            'missing_artifact',
            `mission spec not found for ${opts.mission}`,
          ),
        );
      }
      if (spec && spec.user_approved !== true) {
        emit(
          err(
            'guard_failed',
            `mission spec for ${opts.mission} is not user-approved; run 'geas mission approve' first`,
          ),
        );
      }

      // Task contract must exist and be approved.
      const contract = readJsonFile<{ approved_by?: unknown }>(
        taskContractPath(root, opts.mission, opts.task),
      );
      if (!contract) {
        emit(
          err(
            'missing_artifact',
            `task contract not found for ${opts.task}`,
          ),
        );
      }
      if (contract && contract.approved_by == null) {
        emit(
          err(
            'guard_failed',
            `task ${opts.task} is not approved; run 'geas task approve' first`,
          ),
        );
      }

      // Task state must be ready or implementing.
      const state = readJsonFile<{ status?: string }>(
        taskStatePath(root, opts.mission, opts.task),
      );
      if (!state) {
        emit(
          err(
            'missing_artifact',
            `task-state.json not found for ${opts.task}`,
          ),
        );
      }
      const status = (state as { status?: string }).status ?? '';
      if (!IMPL_CONTRACT_WRITABLE_STATES.has(status)) {
        emit(
          err(
            'guard_failed',
            `impl-contract set requires task state ready or implementing (current: ${status || 'unknown'})`,
            { current_status: status, allowed: [...IMPL_CONTRACT_WRITABLE_STATES] },
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
            'impl-contract set expects a JSON object on stdin',
          ),
        );
      }

      // Strip envelope fields — CLI owns them. Any client-provided values
      // for mission_id / task_id / created_at / updated_at are ignored.
      for (const k of ENVELOPE_FIELDS) delete payload[k];

      // Sensible defaults for optional arrays so callers can omit them.
      if (payload.non_goals === undefined) payload.non_goals = [];
      if (payload.alternatives_considered === undefined) {
        payload.alternatives_considered = [];
      }
      if (payload.assumptions === undefined) payload.assumptions = [];
      if (payload.open_questions === undefined) payload.open_questions = [];

      const target = implementationContractPath(
        root,
        opts.mission,
        opts.task,
      );
      const existing = readJsonFile<{ created_at?: string }>(target);
      const ts = nowUtc();

      payload.mission_id = opts.mission;
      payload.task_id = opts.task;
      payload.created_at = existing?.created_at ?? ts;
      payload.updated_at = ts;

      const v = validate('implementation-contract', payload);
      if (!v.ok) {
        emit(
          err(
            'schema_validation_failed',
            'implementation-contract schema validation failed',
            v.errors,
          ),
        );
      }

      ensureDir(path.dirname(target));
      atomicWriteJson(target, payload, tmpDir(root));

      recordEvent(root, {
        kind: 'impl_contract_set',
        actor: 'cli:auto',
        payload: {
          mission_id: opts.mission,
          task_id: opts.task,
          artifact: slashPath(path.relative(root, target)),
        },
      });

      emit(
        ok({
          path: slashPath(target),
          ids: { mission_id: opts.mission, task_id: opts.task },
          implementation_contract: payload,
        }),
      );
    });
}
