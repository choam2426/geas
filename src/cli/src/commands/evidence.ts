/**
 * `geas evidence` — append-only task evidence.
 *
 *   geas evidence append --mission <id> --task <id> --agent <agent> --slot <slot>
 *                                        (stdin: entry content fields)
 *
 * Writes to `.geas/missions/{mission_id}/tasks/{task_id}/evidence/{agent}.{slot}.json`.
 *
 * The file holds `{ mission_id, task_id, agent, slot, entries, created_at,
 * updated_at }` with an append-only `entries` array. The CLI handles:
 *
 *   - entry_id auto-injection (monotonic from 1).
 *   - mission_id / task_id / agent / slot header fields.
 *   - created_at / updated_at timestamps.
 *   - agent-slot independence guards (protocol 03 §107):
 *       * The concrete agent that holds `implementer` on a task may not
 *         write evidence under any other slot on the same task.
 *       * An agent that has already written a non-implementer slot (review
 *         or verifier etc.) may not then claim `implementer` on the same
 *         task.
 *   - Full schema validation after entry append.
 *
 * Closure evidence lives in the `orchestrator.orchestrator.json` file (slot
 * is `orchestrator`, evidence_kind is `closure`). There is no separate
 * `closure` subcommand — callers pass `evidence_kind=closure` in the entry
 * body.
 */

import type { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

import { emit, err, ok, recordEvent } from '../lib/envelope';
import {
  atomicWriteJson,
  ensureDir,
  exists,
  readJsonFile,
} from '../lib/fs-atomic';
import {
  evidenceDir,
  evidenceFilePath,
  findProjectRoot,
  isValidAgentOrSlot,
  isValidMissionId,
  isValidTaskId,
  missionSpecPath,
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

/** Protocol slots recognized in evidence filenames. */
const SLOT_ENUM = new Set([
  'orchestrator',
  'decision-maker',
  'design-authority',
  'challenger',
  'implementer',
  'verifier',
  'risk-assessor',
  'operator',
  'communicator',
]);

interface EvidenceFile {
  mission_id: string;
  task_id: string;
  agent: string;
  slot: string;
  entries: Array<Record<string, unknown>>;
  created_at: string;
  updated_at: string;
}

/**
 * Walk the task's evidence/ directory and enforce agent-slot independence
 * (protocol 03 §107). Returns GuardFail on violation, else null.
 *
 * Rules:
 *   - If `slot == implementer`, no other evidence file for this agent may
 *     exist on the same task.
 *   - If `slot != implementer`, no existing `{agent}.implementer.json` may
 *     exist on the same task.
 *   - Same (agent, slot) combination is allowed (that's what append means).
 */
function enforceAgentSlotIndependence(
  projectRoot: string,
  missionId: string,
  taskId: string,
  agent: string,
  slot: string,
): { ok: false; reason: string; hints?: unknown } | null {
  const dir = evidenceDir(projectRoot, missionId, taskId);
  if (!exists(dir)) return null;
  const targetBasename = `${agent}.${slot}.json`;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    if (file === targetBasename) continue;
    // Filename shape `{agent}.{slot}.json`. agent may itself contain dots
    // only if users chose such names; protocol naming is kebab-case, so a
    // single dot split is safe: split at the LAST dot before .json.
    const stripped = file.slice(0, -'.json'.length);
    const lastDot = stripped.lastIndexOf('.');
    if (lastDot < 0) continue;
    const otherAgent = stripped.slice(0, lastDot);
    const otherSlot = stripped.slice(lastDot + 1);
    if (otherAgent !== agent) continue;
    // Different slot under same concrete agent.
    if (slot === 'implementer' || otherSlot === 'implementer') {
      return {
        ok: false,
        reason:
          'agent-slot independence: implementer slot is exclusive — the same concrete agent may not hold implementer alongside any other slot on the same task (protocol 03 §107)',
        hints: { existing_file: file, requested_slot: slot, agent },
      };
    }
    // reviewer/verifier/etc combinations are permitted.
  }
  return null;
}

/**
 * If `--agent` was omitted, try to infer it from the task contract's
 * `routing.primary_worker_type` when slot=implementer. For non-implementer
 * slots we cannot infer without a concrete assignment; the caller must
 * pass --agent.
 */
function resolveAgent(
  projectRoot: string,
  missionId: string,
  taskId: string,
  slot: string,
  explicitAgent: string | undefined,
): string | null {
  if (explicitAgent) return explicitAgent;
  if (slot !== 'implementer') return null;
  const contract = readJsonFile<Record<string, unknown>>(
    taskContractPath(projectRoot, missionId, taskId),
  );
  if (!contract) return null;
  const routing = contract.routing as Record<string, unknown> | undefined;
  if (!routing) return null;
  const pwt = routing.primary_worker_type;
  return typeof pwt === 'string' && pwt.length > 0 ? pwt : null;
}

function registerEvidenceAppend(ev: Command): void {
  ev
    .command('append')
    .description(
      'Append an entry to `evidence/{agent}.{slot}.json` for a task. stdin: entry body (entry_id auto-assigned).',
    )
    .requiredOption('--mission <id>', 'Mission ID')
    .requiredOption('--task <id>', 'Task ID')
    .requiredOption('--slot <slot>', 'Protocol slot (e.g. implementer, verifier, risk-assessor, orchestrator, challenger, operator, communicator, design-authority, decision-maker)')
    .option(
      '--agent <agent>',
      'Concrete agent type (defaults to routing.primary_worker_type when slot=implementer)',
    )
    .action(
      (opts: {
        mission: string;
        task: string;
        slot: string;
        agent?: string;
      }) => {
        if (!isValidMissionId(opts.mission)) {
          emit(err('invalid_argument', `invalid mission id '${opts.mission}'`));
        }
        if (!isValidTaskId(opts.task)) {
          emit(err('invalid_argument', `invalid task id '${opts.task}'`));
        }
        if (!SLOT_ENUM.has(opts.slot)) {
          emit(
            err(
              'invalid_argument',
              `unknown slot '${opts.slot}' (allowed: ${[...SLOT_ENUM].join(', ')})`,
            ),
          );
        }
        const root = needProjectRoot();

        // Check the mission spec exists as a sanity signal (no content check).
        if (!exists(missionSpecPath(root, opts.mission))) {
          emit(
            err(
              'missing_artifact',
              `mission spec not found for ${opts.mission}; run 'geas mission create'`,
            ),
          );
        }
        if (!exists(taskContractPath(root, opts.mission, opts.task))) {
          emit(
            err(
              'missing_artifact',
              `task contract not found for ${opts.task}; run 'geas task draft'`,
            ),
          );
        }

        const agent = resolveAgent(
          root,
          opts.mission,
          opts.task,
          opts.slot,
          opts.agent,
        );
        if (!agent) {
          emit(
            err(
              'invalid_argument',
              `--agent is required for slot '${opts.slot}' (could not infer from task contract)`,
            ),
          );
        }
        if (!isValidAgentOrSlot(agent as string)) {
          emit(
            err(
              'invalid_argument',
              `invalid agent identifier '${agent}' (expected kebab-case)`,
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
              'evidence append expects a JSON object on stdin (one entry body)',
            ),
          );
        }

        // Enforce agent-slot independence before touching the file.
        const clash = enforceAgentSlotIndependence(
          root,
          opts.mission,
          opts.task,
          agent as string,
          opts.slot,
        );
        if (clash) {
          emit(err('guard_failed', clash.reason, clash.hints));
        }

        const filePath = evidenceFilePath(
          root,
          opts.mission,
          opts.task,
          agent as string,
          opts.slot,
        );
        const existing = readJsonFile<EvidenceFile>(filePath);
        const ts = nowUtc();

        // Build entry. The client-provided entry_id (if any) is ignored —
        // the CLI authoritatively assigns it. `created_at` is also injected.
        const entry: Record<string, unknown> = { ...payload };
        // Strip any caller-provided envelope fields; they are owned by the CLI.
        delete entry.entry_id;
        delete entry.created_at;
        // Default array / revision_ref if absent so the schema passes.
        if (entry.artifacts === undefined) entry.artifacts = [];
        if (entry.memory_suggestions === undefined) entry.memory_suggestions = [];
        if (entry.debt_candidates === undefined) entry.debt_candidates = [];
        if (entry.gap_signals === undefined) entry.gap_signals = [];
        if (entry.revision_ref === undefined) entry.revision_ref = null;

        const nextId =
          existing && Array.isArray(existing.entries)
            ? existing.entries.length + 1
            : 1;
        entry.entry_id = nextId;
        entry.created_at = ts;

        const merged: EvidenceFile = {
          mission_id: opts.mission,
          task_id: opts.task,
          agent: agent as string,
          slot: opts.slot,
          entries: existing && Array.isArray(existing.entries)
            ? [...existing.entries, entry]
            : [entry],
          created_at: existing?.created_at ?? ts,
          updated_at: ts,
        };

        const v = validate('evidence', merged);
        if (!v.ok) {
          emit(
            err(
              'schema_validation_failed',
              'evidence schema validation failed',
              v.errors,
            ),
          );
        }

        ensureDir(path.dirname(filePath));
        atomicWriteJson(filePath, merged, tmpDir(root));

        recordEvent(root, {
          kind: 'evidence_appended',
          actor: 'cli:auto',
          payload: {
            mission_id: opts.mission,
            task_id: opts.task,
            artifact: slashPath(path.relative(root, filePath)),
            agent,
            slot: opts.slot,
            entry_id: nextId,
            evidence_kind: entry.evidence_kind,
          },
        });

        emit(
          ok({
            path: slashPath(filePath),
            ids: {
              mission_id: opts.mission,
              task_id: opts.task,
              entry_id: nextId,
            },
            agent,
            slot: opts.slot,
            file: merged,
          }),
        );
      },
    );
}

export function registerEvidenceCommands(program: Command): void {
  const ev = program
    .command('evidence')
    .description('Append-only task evidence (evidence/{agent}.{slot}.json).');
  registerEvidenceAppend(ev);
}
