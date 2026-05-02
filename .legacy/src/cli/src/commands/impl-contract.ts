/**
 * `geas impl-contract` — implementer-authored plan artifact.
 *
 *   geas impl-contract set --mission <id> --task <id>   (payload via --file or stdin)
 *
 * Writes the task implementation contract to
 * `.geas/missions/{mission_id}/tasks/{task_id}/implementation-contract.json`.
 * Per protocol doc 03, this is the worker's concrete action plan
 * (change_scope, planned_actions, non_goals, alternatives_considered,
 * assumptions, open_questions) written by the implementer during the
 * `implementing` state. Reviewers read it later as a reviewer-visible
 * reference — it is NOT a pre-code concurrence artifact. Amendment is
 * allowed while the implementer still owns the state; the implementer
 * may re-run `impl-contract set` if direction shifts materially, and
 * the full-replace semantics keeps only the current plan on disk.
 *
 * Set semantics: full-replace (not append). The CLI injects
 * mission_id / task_id / created_at / updated_at; everything else
 * comes from the payload and is schema-validated.
 *
 * Guards:
 *   - Valid mission_id + task_id.
 *   - Mission spec exists + user_approved.
 *   - Task contract exists + has approved_by set.
 *   - Task state is `implementing` — the implementer is spawned in
 *     this state and owns the plan artifact throughout. Earlier
 *     (`drafted` / `ready`) and later (`reviewing` / `deciding` /
 *     terminal) states reject the write.
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
  implementationContractPath,
  isValidMissionId,
  isValidTaskId,
  missionSpecPath,
  taskContractPath,
  taskStatePath,
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

/**
 * AC3 (mission-20260427-xIPG1sDY task-006): scalar formatter for
 * `impl-contract set`. Renders the path + a one-line summary header.
 */
function formatImplContractSet(data: unknown): string {
  const d = data as { path?: string; ids?: { mission_id?: string; task_id?: string }; implementation_contract?: { summary?: string; change_scope?: unknown[] } };
  const scopeCount = Array.isArray(d.implementation_contract?.change_scope) ? d.implementation_contract!.change_scope.length : 0;
  return [
    `impl-contract set: ${d.ids?.task_id ?? '<unknown>'} mission=${d.ids?.mission_id ?? '<unknown>'}`,
    `path: ${d.path ?? '<unknown>'}`,
    `change_scope: ${scopeCount} surface(s)`,
  ].join('\n');
}

/**
 * T2.8 path (b) (task-006): structural guard hint folded to single string.
 */
function foldGuardHint(hints: unknown): string | undefined {
  if (hints === undefined || hints === null) return undefined;
  if (typeof hints === 'string') return hints;
  if (typeof hints !== 'object') return String(hints);
  const obj = hints as Record<string, unknown>;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = k.replace(/_/g, ' ');
    if (Array.isArray(v)) {
      parts.push(`${key}: ${v.join(', ')}`);
    } else if (v !== null && typeof v === 'object') {
      parts.push(`${key}: ${JSON.stringify(v)}`);
    } else {
      parts.push(`${key}: ${String(v)}`);
    }
  }
  return parts.length > 0 ? parts.join('; ') : undefined;
}

/**
 * Allowed task states from which the impl-contract may be written.
 * Per protocol doc 03, the implementer is spawned in `implementing` and
 * owns the plan artifact throughout that state. Earlier states
 * (`drafted` / `ready`) have no implementer yet; later states
 * (`reviewing` / `deciding` / `passed`) have moved past the plan, and
 * terminal states (`blocked` / `escalated` / `cancelled`) cannot accept
 * new plans.
 */
const IMPL_CONTRACT_WRITABLE_STATES = new Set(['implementing']);

/** Fields the CLI owns exclusively. Caller-provided values are stripped. */
const ENVELOPE_FIELDS = ['mission_id', 'task_id', 'created_at', 'updated_at'];

export function registerImplContractCommands(program: Command): void {
  registerFormatter('impl-contract set', formatImplContractSet);
  const ic = program
    .command('impl-contract')
    .description(
      'Pre-implementation agreement (implementation-contract.json) commands.',
    );

  ic.command('set')
    .description(
      'Write implementation-contract.json for a task (full-replace; payload via --file or stdin). CLI injects mission_id / task_id / timestamps.',
    )
    .requiredOption('--mission <id>', 'Mission ID')
    .requiredOption('--task <id>', 'Task ID')
    .option('--file <path>', 'Read JSON payload from file instead of stdin')
    .action((opts: { mission: string; task: string; file?: string }) => {
      if (!isValidMissionId(opts.mission)) {
        emitErr(
          makeError('invalid_argument', `invalid mission id '${opts.mission}'`, {
            hint: "mission ids look like 'mission-YYYYMMDD-XXXXXXXX' (8 alphanumerics)",
            exit_category: 'validation',
          }),
        );
      }
      if (!isValidTaskId(opts.task)) {
        emitErr(
          makeError('invalid_argument', `invalid task id '${opts.task}'`, {
            hint: "task ids look like 'task-NNN' (3+ digits)",
            exit_category: 'validation',
          }),
        );
      }
      const root = needProjectRoot();

      // Mission must exist and be user-approved.
      const spec = readJsonFile<{ user_approved?: boolean }>(
        missionSpecPath(root, opts.mission),
      );
      if (!spec) {
        emitErr(
          makeError('missing_artifact', `mission spec not found for ${opts.mission}`, {
            hint: "run 'geas mission create' to bootstrap the mission first",
            exit_category: 'missing_artifact',
          }),
        );
      }
      if (spec && spec.user_approved !== true) {
        emitErr(
          makeError(
            'guard_failed',
            `mission spec for ${opts.mission} is not user-approved`,
            {
              hint: `run 'geas mission approve --mission ${opts.mission}' first`,
              exit_category: 'guard',
            },
          ),
        );
      }

      // Task contract must exist and be approved.
      const contract = readJsonFile<{ approved_by?: unknown }>(
        taskContractPath(root, opts.mission, opts.task),
      );
      if (!contract) {
        emitErr(
          makeError('missing_artifact', `task contract not found for ${opts.task}`, {
            hint: "run 'geas task draft' to create the contract first",
            exit_category: 'missing_artifact',
          }),
        );
      }
      if (contract && contract.approved_by == null) {
        emitErr(
          makeError(
            'guard_failed',
            `task ${opts.task} is not approved`,
            {
              hint: `run 'geas task approve --mission ${opts.mission} --task ${opts.task}' first`,
              exit_category: 'guard',
            },
          ),
        );
      }

      // Task state must be implementing.
      const state = readJsonFile<{ status?: string }>(
        taskStatePath(root, opts.mission, opts.task),
      );
      if (!state) {
        emitErr(
          makeError('missing_artifact', `task-state.json not found for ${opts.task}`, {
            hint: 'task-state is created automatically by task draft; check the --task id',
            exit_category: 'missing_artifact',
          }),
        );
      }
      const status = (state as { status?: string }).status ?? '';
      if (!IMPL_CONTRACT_WRITABLE_STATES.has(status)) {
        emitErr(
          makeError(
            'guard_failed',
            `impl-contract set requires task state implementing (current: ${status || 'unknown'})`,
            {
              hint: foldGuardHint({ current_status: status, allowed: [...IMPL_CONTRACT_WRITABLE_STATES] }) ?? 'task must be in implementing state to write impl-contract',
              exit_category: 'guard',
            },
          ),
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
          makeError(
            'invalid_argument',
            'impl-contract set expects a JSON object on stdin',
            {
              hint: 'wrap the contract fields in a single JSON object',
              exit_category: 'validation',
            },
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
        emitErr(
          makeError(
            'schema_validation_failed',
            'implementation-contract schema validation failed',
            {
              hint: 'inspect ajv errors and fix the contract body, then retry',
              exit_category: 'validation',
            },
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

      emitOk('impl-contract set', {
        path: slashPath(target),
        ids: { mission_id: opts.mission, task_id: opts.task },
        implementation_contract: payload,
      });
    });
}
