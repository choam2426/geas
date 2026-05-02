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
import { readPayloadJson, readPayloadText, StdinError } from '../lib/input';
import { validate } from '../lib/schema';

/**
 * AC3 (mission-20260427-xIPG1sDY task-006): scalar formatter for
 * `evidence append`. Renders task + agent/slot + entry id summary.
 */
function formatEvidenceAppend(data: unknown): string {
  const d = data as { ids?: { mission_id?: string; task_id?: string; entry_id?: number }; agent?: string; slot?: string; path?: string };
  return [
    `evidence appended: ${d.agent ?? '<unknown>'}.${d.slot ?? '<unknown>'} entry_id=${d.ids?.entry_id ?? '?'}`,
    `task: ${d.ids?.task_id ?? '<unknown>'} mission=${d.ids?.mission_id ?? '<unknown>'}`,
    `path: ${d.path ?? '<unknown>'}`,
  ].join('\n');
}

/**
 * T2.8 path (b) (task-006): structural guard hint folded to single
 * human-readable string for CliErrorV2.hint. lib/errors.ts is out of
 * surfaces so the carve-out path (a) is unavailable.
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

interface EvidenceAppendInlineOpts {
  mission: string;
  task: string;
  slot: string;
  agent?: string;
  file?: string;
  entryFromFile?: string;
  evidenceKind?: string;
  summary?: string;
  summaryFromFile?: string;
  rationale?: string;
  rationaleFromFile?: string;
  scopeExamined?: string;
  scopeExaminedFromFile?: string;
  verdict?: string;
  concern?: string[];
  methodUsed?: string[];
  scopeExcluded?: string[];
  artifact?: string[];
  memorySuggestion?: string[];
  debtCandidate?: string[];
  gapSignal?: string[];
  revisionRef?: string;
  criterionResult?: string[];
  whatWentWell?: string[];
  whatBroke?: string[];
  whatWasSurprising?: string[];
  nextTimeGuidance?: string[];
}

/**
 * AC1 (task-006 verify-fix iteration 1): build an evidence entry payload
 * from inline flags. Heterogeneous schema (4 evidence_kinds) means many
 * optional fields. Returns null if no inline flags are present.
 */
function buildEvidencePayloadFromFlags(
  opts: EvidenceAppendInlineOpts,
): Record<string, unknown> | null {
  const inlineFlagPresent =
    opts.evidenceKind !== undefined ||
    opts.summary !== undefined ||
    opts.summaryFromFile !== undefined ||
    opts.rationale !== undefined ||
    opts.rationaleFromFile !== undefined ||
    opts.scopeExamined !== undefined ||
    opts.scopeExaminedFromFile !== undefined ||
    opts.verdict !== undefined ||
    (Array.isArray(opts.concern) && opts.concern.length > 0) ||
    (Array.isArray(opts.methodUsed) && opts.methodUsed.length > 0) ||
    (Array.isArray(opts.scopeExcluded) && opts.scopeExcluded.length > 0) ||
    (Array.isArray(opts.artifact) && opts.artifact.length > 0) ||
    (Array.isArray(opts.memorySuggestion) && opts.memorySuggestion.length > 0) ||
    (Array.isArray(opts.debtCandidate) && opts.debtCandidate.length > 0) ||
    (Array.isArray(opts.gapSignal) && opts.gapSignal.length > 0) ||
    opts.revisionRef !== undefined ||
    (Array.isArray(opts.criterionResult) && opts.criterionResult.length > 0) ||
    (Array.isArray(opts.whatWentWell) && opts.whatWentWell.length > 0) ||
    (Array.isArray(opts.whatBroke) && opts.whatBroke.length > 0) ||
    (Array.isArray(opts.whatWasSurprising) && opts.whatWasSurprising.length > 0) ||
    (Array.isArray(opts.nextTimeGuidance) && opts.nextTimeGuidance.length > 0);
  if (!inlineFlagPresent) return null;

  const payload: Record<string, unknown> = {};
  if (opts.evidenceKind !== undefined) payload.evidence_kind = opts.evidenceKind;
  if (opts.summaryFromFile !== undefined) {
    payload.summary = readFreeBodyOrEmit(opts.summaryFromFile, '--summary <text> or --summary-from-file <path>');
  } else if (opts.summary !== undefined) {
    payload.summary = opts.summary;
  }
  if (opts.rationaleFromFile !== undefined) {
    payload.rationale = readFreeBodyOrEmit(opts.rationaleFromFile, '--rationale <text> or --rationale-from-file <path>');
  } else if (opts.rationale !== undefined) {
    payload.rationale = opts.rationale;
  }
  if (opts.scopeExaminedFromFile !== undefined) {
    payload.scope_examined = readFreeBodyOrEmit(opts.scopeExaminedFromFile, '--scope-examined <text> or --scope-examined-from-file <path>');
  } else if (opts.scopeExamined !== undefined) {
    payload.scope_examined = opts.scopeExamined;
  }
  if (opts.verdict !== undefined) payload.verdict = opts.verdict;
  if (Array.isArray(opts.concern)) payload.concerns = opts.concern;
  if (Array.isArray(opts.methodUsed) && opts.methodUsed.length > 0) {
    payload.methods_used = opts.methodUsed;
  }
  if (Array.isArray(opts.scopeExcluded)) payload.scope_excluded = opts.scopeExcluded;
  if (Array.isArray(opts.artifact)) payload.artifacts = opts.artifact;
  if (Array.isArray(opts.memorySuggestion)) payload.memory_suggestions = opts.memorySuggestion;
  if (Array.isArray(opts.debtCandidate) && opts.debtCandidate.length > 0) {
    payload.debt_candidates = opts.debtCandidate.map((s) => parseInlineJson(s, '--debt-candidate'));
  }
  if (Array.isArray(opts.gapSignal) && opts.gapSignal.length > 0) {
    payload.gap_signals = opts.gapSignal.map((s) => parseInlineJson(s, '--gap-signal'));
  }
  if (opts.revisionRef !== undefined) {
    if (opts.revisionRef === 'null' || opts.revisionRef === '') {
      payload.revision_ref = null;
    } else {
      const n = parseInt(opts.revisionRef, 10);
      if (!Number.isFinite(n) || n < 1) {
        emitErr(
          makeError(
            'invalid_argument',
            `--revision-ref must be a positive integer or 'null' (got '${opts.revisionRef}')`,
            { hint: 'pass --revision-ref <int> with a value ≥1, or omit for null', exit_category: 'validation' },
          ),
        );
      }
      payload.revision_ref = n;
    }
  }
  if (Array.isArray(opts.criterionResult) && opts.criterionResult.length > 0) {
    payload.criteria_results = opts.criterionResult.map((s) => parseInlineJson(s, '--criterion-result'));
  }
  if (Array.isArray(opts.whatWentWell)) payload.what_went_well = opts.whatWentWell;
  if (Array.isArray(opts.whatBroke)) payload.what_broke = opts.whatBroke;
  if (Array.isArray(opts.whatWasSurprising)) payload.what_was_surprising = opts.whatWasSurprising;
  if (Array.isArray(opts.nextTimeGuidance)) payload.next_time_guidance = opts.nextTimeGuidance;
  return payload;
}

function readFreeBodyOrEmit(filePath: string, flagPair: string): string {
  try {
    return readPayloadText(filePath);
  } catch (e) {
    if (e instanceof StdinError) {
      emitErr(
        makeError('invalid_argument', e.message, {
          hint: `pass ${flagPair}`,
          exit_category: 'validation',
        }),
      );
    }
    throw e;
  }
}

function parseInlineJson(raw: string, flagName: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    emitErr(
      makeError(
        'invalid_argument',
        `${flagName} expects a JSON object string (parse failed: ${msg})`,
        {
          hint: `pass ${flagName} with a valid JSON object value (e.g. '{"kind":"learning_gain","summary":"..."}')`,
          exit_category: 'validation',
        },
      ),
    );
    return null; // unreachable after emitErr exits
  }
}

function registerEvidenceAppend(ev: Command): void {
  ev
    .command('append')
    .description(
      'Append an entry to `evidence/{agent}.{slot}.json` for a task. Accepts inline flags (--evidence-kind, --summary, --rationale, --scope-examined, --verdict, --concern..., --method-used..., --scope-excluded..., --artifact..., --debt-candidate <json>..., --gap-signal <json>..., --criterion-result <json>..., --revision-ref, closure-only --what-went-well... etc.) or full JSON via --file/stdin/--entry-from-file. Free-body fields (--summary, --rationale, --scope-examined) also accept --<field>-from-file. entry_id is auto-assigned.',
    )
    .requiredOption('--mission <id>', 'Mission ID')
    .requiredOption('--task <id>', 'Task ID')
    .requiredOption('--slot <slot>', 'Protocol slot (e.g. implementer, verifier, risk-assessor, orchestrator, challenger, operator, communicator, design-authority, decision-maker)')
    .option(
      '--agent <agent>',
      'Concrete agent type (defaults to routing.primary_worker_type when slot=implementer)',
    )
    .option('--file <path>', 'Read full JSON entry from file (overrides inline flags) instead of stdin')
    .option('--entry-from-file <path>', 'Named alias for --file (free-body entry payload)')
    .option('--evidence-kind <kind>', 'evidence_kind: implementation, review, verification, or closure')
    .option('--summary <text>', 'Entry summary (free-body — short prose)')
    .option('--summary-from-file <path>', 'Read summary text from file')
    .option('--rationale <text>', 'Reasoning (free-body — short prose; required for review/verification/closure)')
    .option('--rationale-from-file <path>', 'Read rationale text from file')
    .option('--scope-examined <text>', 'Scope examined (free-body; required for review/verification)')
    .option('--scope-examined-from-file <path>', 'Read scope_examined text from file')
    .option('--verdict <verdict>', 'Verdict: approved, changes_requested, blocked, escalated, or cancelled')
    .option('--concern <text...>', 'Concern (repeatable)')
    .option('--method-used <text...>', 'Method, tool, or procedure used (repeatable)')
    .option('--scope-excluded <text...>', 'Scope intentionally left out (repeatable)')
    .option('--artifact <text...>', 'Artifact path or id (repeatable)')
    .option('--memory-suggestion <text...>', 'Candidate memory entry (repeatable)')
    .option('--debt-candidate <json...>', 'Debt candidate JSON object (repeatable; e.g. {"title":"...","kind":"process","severity":"normal","summary":"..."})')
    .option('--gap-signal <json...>', 'Gap signal JSON object (repeatable; e.g. {"kind":"learning_gain","summary":"..."})')
    .option('--criterion-result <json...>', 'Criterion result JSON object (verification entries; e.g. {"criterion":"...","passed":true,"details":"..."})')
    .option('--revision-ref <int>', "Prior entry_id this revises, or 'null' for first/non-revision")
    .option('--what-went-well <text...>', 'Closure-only: aspect that worked (repeatable)')
    .option('--what-broke <text...>', 'Closure-only: failure or unplanned effort (repeatable)')
    .option('--what-was-surprising <text...>', 'Closure-only: unexpected outcome (repeatable)')
    .option('--next-time-guidance <text...>', 'Closure-only: advice for next time (repeatable)')
    .action(
      (opts: EvidenceAppendInlineOpts) => {
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
        if (!SLOT_ENUM.has(opts.slot)) {
          emitErr(
            makeError(
              'invalid_argument',
              `unknown slot '${opts.slot}' (allowed: ${[...SLOT_ENUM].join(', ')})`,
              {
                hint: `valid --slot values: ${[...SLOT_ENUM].join(', ')}`,
                exit_category: 'validation',
              },
            ),
          );
        }
        const root = needProjectRoot();

        // Check the mission spec exists as a sanity signal (no content check).
        if (!exists(missionSpecPath(root, opts.mission))) {
          emitErr(
            makeError(
              'missing_artifact',
              `mission spec not found for ${opts.mission}`,
              {
                hint: "run 'geas mission create' to bootstrap the mission first",
                exit_category: 'missing_artifact',
              },
            ),
          );
        }
        if (!exists(taskContractPath(root, opts.mission, opts.task))) {
          emitErr(
            makeError(
              'missing_artifact',
              `task contract not found for ${opts.task}`,
              {
                hint: "run 'geas task draft' to create the contract first",
                exit_category: 'missing_artifact',
              },
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
          emitErr(
            makeError(
              'invalid_argument',
              `--agent is required for slot '${opts.slot}' (could not infer from task contract)`,
              {
                hint: 'pass --agent <concrete-agent-type> explicitly; only implementer slot infers from routing.primary_worker_type',
                exit_category: 'validation',
              },
            ),
          );
        }
        if (!isValidAgentOrSlot(agent as string)) {
          emitErr(
            makeError(
              'invalid_argument',
              `invalid agent identifier '${agent}' (expected kebab-case)`,
              {
                hint: 'agent ids must match ^[a-z0-9][a-z0-9-]*$',
                exit_category: 'validation',
              },
            ),
          );
        }

        let payload: Record<string, unknown>;
        // --file or --entry-from-file always wins (full-payload bypass).
        // Otherwise prefer inline flags when any inline flag is present;
        // else fall back to stdin.
        const payloadSrcFile = opts.file ?? opts.entryFromFile;
        if (payloadSrcFile !== undefined) {
          try {
            payload = readPayloadJson(payloadSrcFile) as Record<string, unknown>;
          } catch (e) {
            if (e instanceof StdinError) {
              emitErr(
                makeError('invalid_argument', e.message, {
                  hint: 'pass the JSON via --file/--entry-from-file <path> or use inline flags (--evidence-kind, --summary, ...)',
                  exit_category: 'validation',
                }),
              );
            }
            throw e;
          }
        } else {
          const inline = buildEvidencePayloadFromFlags(opts);
          if (inline !== null) {
            payload = inline;
          } else {
            try {
              payload = readPayloadJson(undefined) as Record<string, unknown>;
            } catch (e) {
              if (e instanceof StdinError) {
                emitErr(
                  makeError('invalid_argument', e.message, {
                    hint: 'use inline flags (--evidence-kind, --summary, ...) or pass JSON via --file/--entry-from-file <path> or stdin',
                    exit_category: 'validation',
                  }),
                );
              }
              throw e;
            }
          }
        }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          emitErr(
            makeError(
              'invalid_argument',
              'evidence append expects a JSON object payload (one entry body)',
              {
                hint: 'wrap the entry fields in a single JSON object, or use inline flags',
                exit_category: 'validation',
              },
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
          emitErr(
            makeError('guard_failed', clash.reason, {
              hint: foldGuardHint(clash.hints) ?? 'pick a different agent for this slot or use the existing slot for this agent',
              exit_category: 'guard',
            }),
          );
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
          emitErr(
            makeError(
              'schema_validation_failed',
              'evidence schema validation failed',
              {
                hint: 'inspect ajv errors and fix the entry body, then retry',
                exit_category: 'validation',
              },
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

        emitOk('evidence append', {
          path: slashPath(filePath),
          ids: {
            mission_id: opts.mission,
            task_id: opts.task,
            entry_id: nextId,
          },
          agent,
          slot: opts.slot,
          file: merged,
        });
      },
    );
}

export function registerEvidenceCommands(program: Command): void {
  registerFormatter('evidence append', formatEvidenceAppend);
  const ev = program
    .command('evidence')
    .description('Append-only task evidence (evidence/{agent}.{slot}.json).');
  registerEvidenceAppend(ev);
}
