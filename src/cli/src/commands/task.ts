/**
 * `geas task ...` — task-level artifact commands.
 *
 * Subcommands follow `docs/ko/architecture/CLI.md` §3 (command table) and
 * §8 (transition guards). Names are adapted from CLI.md:
 *
 *   geas task draft        (stdin: task-contract content fields)
 *     Writes `tasks/{task_id}/contract.json` and
 *     `tasks/{task_id}/task-state.json` (status=drafted).
 *   geas task approve      --mission <id> --task <id>
 *                          [--by user|decision-maker]
 *     Flips contract.approved_by and moves task-state drafted -> ready.
 *   geas task transition   --mission <id> --task <id> --to <state>
 *     9-state FSM transition, guarded.
 *   geas task deps add     --mission <id> --task <id> --deps <id[,id...]>
 *     Adds dependency task ids to contract.dependencies (merge+dedupe).
 *   geas task deps remove  --mission <id> --task <id> --deps <id[,id...]>
 *     Removes dependency task ids from contract.dependencies (missing ignored).
 *   geas task base-snapshot set
 *                          --mission <id> --task <id> --base <40-hex sha>
 *     Sets contract.base_snapshot to the supplied SHA (format-only check).
 *   geas task state        --mission <id> --task <id>
 *     Read-only summary.
 *
 * The G3 `transition` command implements the 9-state FSM defined in
 * lib/transition-guards (canTransitionTaskState). Evidence-driven
 * guard hints (self-check exists, review evidence exists, closure
 * approved) use simple file-presence checks in G3; G4 tightens them.
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
  findProjectRoot,
  isValidMissionId,
  isValidTaskId,
  missionSpecPath,
  missionStatePath,
  selfCheckPath,
  taskContractPath,
  taskDeliberationsPath,
  taskDir,
  taskStatePath,
  tasksDir,
  tmpDir,
} from '../lib/paths';
import { readPayloadJson, readPayloadText, StdinError } from '../lib/input';
import { validate } from '../lib/schema';
import {
  canTransitionTaskState,
  isValidTaskState,
  type TaskState,
  type TaskStateHints,
} from '../lib/transition-guards';

/**
 * T2.8 path (b) (mission-20260427-xIPG1sDY task-006): fold a structured
 * guard hint object (e.g. {unsatisfied_dependencies: ['task-001']} or
 * {conflicting_surfaces: ['shared-surface']}) into a single human-readable
 * string for the CliErrorV2 hint field. lib/errors.ts CliErrorV2 carries
 * `hint` as a single string and is out of contract.surfaces, so the
 * carve-out path (a) — extending CliErrorV2.hint to support a guard
 * category object — is unavailable. The structural data (array members,
 * counts) is still discoverable in human-readable form by parsing the
 * folded string. The 2 g3-task.test.js assertions that previously read
 * res.json.error.hints.unsatisfied_dependencies and
 * res.json.error.hints.conflicting_surfaces are updated atomically in
 * this commit to assert hint substring matches.
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
 * AC3 scalar formatters for the eight task subcommands (draft, approve,
 * transition, deps add, deps remove, base-snapshot set, state).
 */
function formatTaskDraft(data: unknown): string {
  const d = data as { ids?: { mission_id?: string; task_id?: string }; path?: string; contract?: { title?: string; risk_level?: string } };
  return [
    `task drafted: ${d.ids?.task_id ?? '<unknown>'} mission=${d.ids?.mission_id ?? '<unknown>'}`,
    `path: ${d.path ?? '<unknown>'}`,
    `title: ${d.contract?.title ?? '<unknown>'} risk=${d.contract?.risk_level ?? '<unknown>'}`,
  ].join('\n');
}
function formatTaskApprove(data: unknown): string {
  const d = data as { ids?: { mission_id?: string; task_id?: string }; already_approved?: boolean; state?: { status?: string } };
  return `task approved: ${d.ids?.task_id ?? '<unknown>'} status=${d.state?.status ?? '<unknown>'} already_approved=${Boolean(d.already_approved)}`;
}
function formatTaskTransition(data: unknown): string {
  const d = data as { ids?: { mission_id?: string; task_id?: string }; transition?: { from?: string; to?: string }; state?: { verify_fix_iterations?: number } };
  const iter = d.state?.verify_fix_iterations;
  return `task transition: ${d.ids?.task_id ?? '<unknown>'} ${d.transition?.from ?? '?'} -> ${d.transition?.to ?? '?'}${typeof iter === 'number' ? ` verify_fix=${iter}` : ''}`;
}
function formatTaskDepsAdd(data: unknown): string {
  const d = data as { ids?: { task_id?: string }; added?: string[]; dependencies?: string[] };
  return `task deps add: ${d.ids?.task_id ?? '<unknown>'} added=[${(d.added ?? []).join(', ')}] dependencies=[${(d.dependencies ?? []).join(', ')}]`;
}
function formatTaskDepsRemove(data: unknown): string {
  const d = data as { ids?: { task_id?: string }; removed?: string[]; not_present?: string[]; dependencies?: string[] };
  return `task deps remove: ${d.ids?.task_id ?? '<unknown>'} removed=[${(d.removed ?? []).join(', ')}] not_present=[${(d.not_present ?? []).join(', ')}] dependencies=[${(d.dependencies ?? []).join(', ')}]`;
}
function formatTaskBaseSnapshot(data: unknown): string {
  const d = data as { ids?: { task_id?: string }; base_snapshot?: string };
  return `task base-snapshot set: ${d.ids?.task_id ?? '<unknown>'} base=${d.base_snapshot ?? '<unknown>'}`;
}
function formatTaskState(data: unknown): string {
  const d = data as {
    mission_id?: string;
    task_id?: string;
    status?: string | null;
    verify_fix_iterations?: number;
    approved_by?: string | null;
    risk_level?: string | null;
    primary_worker_type?: string | null;
    surfaces?: string[];
    dependencies?: string[];
  };
  const lines: string[] = [];
  lines.push(`task: ${d.task_id ?? '<unknown>'} mission=${d.mission_id ?? '<unknown>'} status=${d.status ?? 'unknown'}`);
  lines.push(`approved_by: ${d.approved_by ?? '(none)'} risk=${d.risk_level ?? 'unknown'} worker=${d.primary_worker_type ?? 'unknown'}`);
  lines.push(`verify_fix_iterations: ${d.verify_fix_iterations ?? 0}`);
  const deps = Array.isArray(d.dependencies) ? d.dependencies : [];
  const surf = Array.isArray(d.surfaces) ? d.surfaces : [];
  lines.push(`dependencies: ${deps.length === 0 ? '(none)' : deps.join(', ')}`);
  lines.push(`surfaces: ${surf.length === 0 ? '(none)' : `${surf.length} listed`}`);
  return lines.join('\n');
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

function needMissionSpec(
  root: string,
  missionId: string,
): Record<string, unknown> {
  const spec = readJsonFile<Record<string, unknown>>(
    missionSpecPath(root, missionId),
  );
  if (!spec) {
    emitErr(
      makeError(
        'missing_artifact',
        `mission spec not found for ${missionId}`,
        {
          hint: "run 'geas mission create' first or check the --mission id",
          exit_category: 'missing_artifact',
        },
      ),
    );
  }
  return spec as Record<string, unknown>;
}

/**
 * Assign the next sequential task id under a mission (`task-NNN`).
 * Counts existing directories under tasks/ and picks max+1.
 * `GEAS_MOCK_TASK_ID` overrides for deterministic tests.
 */
function generateTaskId(root: string, missionId: string): string {
  const override = process.env.GEAS_MOCK_TASK_ID;
  if (override && /^task-[0-9]{3}$/.test(override)) {
    return override;
  }
  const tDir = tasksDir(root, missionId);
  let maxN = 0;
  if (exists(tDir)) {
    for (const entry of fs.readdirSync(tDir)) {
      const m = /^task-([0-9]{3})$/.exec(entry);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxN) maxN = n;
      }
    }
  }
  const next = (maxN + 1).toString().padStart(3, '0');
  return `task-${next}`;
}

// ── `geas task draft` (create) ────────────────────────────────────────

interface TaskDraftInlineOpts {
  mission: string;
  file?: string;
  taskId?: string;
  title?: string;
  goal?: string;
  goalFromFile?: string;
  riskLevel?: string;
  verificationPlan?: string;
  verificationPlanFromFile?: string;
  surface?: string[];
  dependency?: string[];
  reviewer?: string[];
  primaryWorkerType?: string;
  acceptanceCriterion?: string[];
  supersedes?: string;
  baseSnapshot?: string;
  approvedBy?: string;
}

/**
 * AC1 (task-006 verify-fix iteration 1): build a task-contract payload
 * from inline Commander flags. Free-body fields (goal, verification-plan)
 * accept both --<field> inline and --<field>-from-file path. Returns null
 * when no inline flags are present, signaling the caller should fall back
 * to --file or stdin.
 */
function buildTaskDraftPayloadFromFlags(
  opts: TaskDraftInlineOpts,
): Record<string, unknown> | null {
  const inlineFlagPresent =
    opts.taskId !== undefined ||
    opts.title !== undefined ||
    opts.goal !== undefined ||
    opts.goalFromFile !== undefined ||
    opts.riskLevel !== undefined ||
    opts.verificationPlan !== undefined ||
    opts.verificationPlanFromFile !== undefined ||
    (Array.isArray(opts.surface) && opts.surface.length > 0) ||
    (Array.isArray(opts.dependency) && opts.dependency.length > 0) ||
    (Array.isArray(opts.reviewer) && opts.reviewer.length > 0) ||
    opts.primaryWorkerType !== undefined ||
    (Array.isArray(opts.acceptanceCriterion) && opts.acceptanceCriterion.length > 0) ||
    opts.supersedes !== undefined ||
    opts.baseSnapshot !== undefined ||
    opts.approvedBy !== undefined;
  if (!inlineFlagPresent) return null;

  const payload: Record<string, unknown> = {};
  if (opts.taskId !== undefined) payload.task_id = opts.taskId;
  if (opts.title !== undefined) payload.title = opts.title;
  if (opts.goalFromFile !== undefined) {
    try {
      payload.goal = readPayloadText(opts.goalFromFile);
    } catch (e) {
      if (e instanceof StdinError) {
        emitErr(
          makeError('invalid_argument', e.message, {
            hint: 'pass --goal <text> inline or --goal-from-file <path>',
            exit_category: 'validation',
          }),
        );
      }
      throw e;
    }
  } else if (opts.goal !== undefined) {
    payload.goal = opts.goal;
  }
  if (opts.riskLevel !== undefined) payload.risk_level = opts.riskLevel;
  if (opts.verificationPlanFromFile !== undefined) {
    try {
      payload.verification_plan = readPayloadText(opts.verificationPlanFromFile);
    } catch (e) {
      if (e instanceof StdinError) {
        emitErr(
          makeError('invalid_argument', e.message, {
            hint: 'pass --verification-plan <text> inline or --verification-plan-from-file <path>',
            exit_category: 'validation',
          }),
        );
      }
      throw e;
    }
  } else if (opts.verificationPlan !== undefined) {
    payload.verification_plan = opts.verificationPlan;
  }
  if (Array.isArray(opts.surface)) payload.surfaces = opts.surface;
  if (Array.isArray(opts.dependency)) payload.dependencies = opts.dependency;
  if (Array.isArray(opts.acceptanceCriterion) && opts.acceptanceCriterion.length > 0) {
    payload.acceptance_criteria = opts.acceptanceCriterion;
  }
  if (opts.supersedes !== undefined) payload.supersedes = opts.supersedes;
  if (opts.baseSnapshot !== undefined) payload.base_snapshot = opts.baseSnapshot;
  if (opts.approvedBy !== undefined) payload.approved_by = opts.approvedBy;
  // routing is required by schema; assemble when primary-worker-type or
  // any reviewer is supplied.
  if (
    opts.primaryWorkerType !== undefined ||
    (Array.isArray(opts.reviewer) && opts.reviewer.length > 0)
  ) {
    payload.routing = {
      primary_worker_type: opts.primaryWorkerType ?? 'software-engineer',
      required_reviewers:
        Array.isArray(opts.reviewer) && opts.reviewer.length > 0
          ? opts.reviewer
          : ['challenger'],
    };
  }
  return payload;
}

function registerTaskDraft(task: Command): void {
  task
    .command('draft')
    .description(
      'Create a task contract under a mission. Accepts inline flags (--title, --goal, --risk-level, --verification-plan, --surface..., --dependency..., --primary-worker-type, --reviewer..., --acceptance-criterion..., --base-snapshot, --supersedes, --approved-by) or a full JSON payload via --file/stdin. Free-body fields (--goal, --verification-plan) also accept --<field>-from-file. Writes contract.json + task-state.json (drafted).',
    )
    .requiredOption('--mission <id>', 'Mission ID')
    .option('--task-id <id>', 'Task id (auto-generated if absent)')
    .option('--title <text>', 'Short human-readable label for the task')
    .option('--goal <text>', 'Concrete outcome the task is expected to achieve (free-body — short prose)')
    .option('--goal-from-file <path>', 'Read goal markdown/text from file (preferred for prose-heavy free-body)')
    .option('--risk-level <level>', 'Risk level: low, normal, high, or critical')
    .option('--verification-plan <text>', 'Verification plan (free-body — short prose)')
    .option('--verification-plan-from-file <path>', 'Read verification_plan markdown/text from file')
    .option('--surface <s...>', 'Impact surface (repeatable)')
    .option('--dependency <id...>', 'Task id dependency (repeatable, task-NNN)')
    .option('--reviewer <slot...>', 'Required reviewer slot (repeatable; challenger, risk-assessor, operator, communicator)')
    .option('--primary-worker-type <type>', 'Concrete primary worker type (kebab-case; default software-engineer)')
    .option('--acceptance-criterion <text...>', 'Acceptance criterion (repeatable)')
    .option('--supersedes <id>', 'Task id this contract replaces (task-NNN)')
    .option('--base-snapshot <sha>', 'Shared baseline snapshot (e.g. git sha)')
    .option('--approved-by <actor>', 'Approver identity (user, decision-maker, or omit for null/drafted)')
    .option('--file <path>', 'Read full JSON payload from file (overrides inline flags) instead of stdin')
    .action((opts: TaskDraftInlineOpts) => {
      if (!isValidMissionId(opts.mission)) {
        emitErr(
          makeError('invalid_argument', `invalid mission id '${opts.mission}'`, {
            hint: "mission ids look like 'mission-YYYYMMDD-XXXXXXXX' (8 alphanumerics)",
            exit_category: 'validation',
          }),
        );
      }
      const root = needProjectRoot();
      const spec = needMissionSpec(root, opts.mission);
      // Drafting is allowed even if the mission spec is not yet approved;
      // the approve transition (drafted -> ready) is what requires both
      // contract approval AND mission approval by downstream phase guards.
      void spec;

      let payload: Record<string, unknown>;
      // --file always wins (full-payload bypass). Otherwise prefer inline
      // flags when any inline flag is present; else fall back to stdin.
      if (opts.file !== undefined) {
        try {
          payload = readPayloadJson(opts.file) as Record<string, unknown>;
        } catch (e) {
          if (e instanceof StdinError) {
            emitErr(
              makeError('invalid_argument', e.message, {
                hint: 'pass the JSON via --file <path> or use inline flags (--title, --goal, --risk-level, ...)',
                exit_category: 'validation',
              }),
            );
          }
          throw e;
        }
      } else {
        const inline = buildTaskDraftPayloadFromFlags(opts);
        if (inline !== null) {
          payload = inline;
        } else {
          try {
            payload = readPayloadJson(undefined) as Record<string, unknown>;
          } catch (e) {
            if (e instanceof StdinError) {
              emitErr(
                makeError('invalid_argument', e.message, {
                  hint: 'use inline flags (--title, --goal, --risk-level, ...) or pass JSON via --file <path> or stdin',
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
          makeError('invalid_argument', 'task draft expects a JSON object payload', {
            hint: 'pass a single JSON object containing the task contract fields, or use inline flags',
            exit_category: 'validation',
          }),
        );
      }

      const providedId = typeof payload.task_id === 'string' ? payload.task_id : undefined;
      const taskId = providedId ?? generateTaskId(root, opts.mission);
      if (!isValidTaskId(taskId)) {
        emitErr(
          makeError('invalid_argument', `invalid task id '${taskId}'`, {
            hint: "task ids look like 'task-NNN' (3+ digits)",
            exit_category: 'validation',
          }),
        );
      }
      payload.task_id = taskId;
      payload.mission_id = opts.mission;

      // Defaults before validation: approved_by null means "not yet
      // approved" (status stays drafted). supersedes null is common.
      if (payload.approved_by === undefined) payload.approved_by = null;
      if (payload.supersedes === undefined) payload.supersedes = null;
      if (payload.dependencies === undefined) payload.dependencies = [];
      if (payload.surfaces === undefined) payload.surfaces = [];

      const ts = nowUtc();
      payload.created_at = ts;
      payload.updated_at = ts;

      const contractPath = taskContractPath(root, opts.mission, taskId);
      if (exists(contractPath)) {
        emitErr(
          makeError(
            'path_collision',
            `task contract already exists at ${slashPath(contractPath)}`,
            {
              hint: 'inspect the existing contract or pick a different task id',
              exit_category: 'validation',
            },
          ),
        );
      }

      const v = validate('task-contract', payload);
      if (!v.ok) {
        emitErr(
          makeError(
            'schema_validation_failed',
            'task-contract schema validation failed',
            {
              hint: 'inspect ajv errors and fix the contract body, then retry',
              exit_category: 'validation',
            },
          ),
        );
      }

      ensureDir(taskDir(root, opts.mission, taskId));
      ensureDir(evidenceDir(root, opts.mission, taskId));
      atomicWriteJson(contractPath, payload, tmpDir(root));

      // Initial task-state: drafted, no active agent, zero iterations.
      const state = {
        mission_id: opts.mission,
        task_id: taskId,
        status: 'drafted' as TaskState,
        active_agent: null,
        verify_fix_iterations: 0,
        created_at: ts,
        updated_at: ts,
      };
      const vs = validate('task-state', state);
      if (!vs.ok) {
        emitErr(
          makeError(
            'schema_validation_failed',
            'task-state schema validation failed on initialization',
            {
              hint: 'inspect ajv errors and fix the contract body to match the task-state schema',
              exit_category: 'validation',
            },
          ),
        );
      }
      atomicWriteJson(
        taskStatePath(root, opts.mission, taskId),
        state,
        tmpDir(root),
      );

      // Initialise empty task-level deliberations wrapper per CLI.md §14.1.
      const delibPath = taskDeliberationsPath(root, opts.mission, taskId);
      if (!exists(delibPath)) {
        atomicWriteJson(
          delibPath,
          {
            mission_id: opts.mission,
            task_id: taskId,
            level: 'task',
            entries: [],
            created_at: ts,
            updated_at: ts,
          },
          tmpDir(root),
        );
      }

      recordEvent(root, {
        kind: 'task_drafted',
        actor: 'cli:auto',
        payload: {
          mission_id: opts.mission,
          task_id: taskId,
          artifact: slashPath(path.relative(root, contractPath)),
        },
      });

      emitOk('task draft', {
        path: slashPath(contractPath),
        ids: { mission_id: opts.mission, task_id: taskId },
        contract: payload,
        state,
      });
    });
}

// ── `geas task approve` ───────────────────────────────────────────────

function registerTaskApprove(task: Command): void {
  task
    .command('approve')
    .description(
      'Approve a task contract (sets approved_by) and move task-state drafted -> ready.',
    )
    .requiredOption('--mission <id>', 'Mission ID')
    .requiredOption('--task <id>', 'Task ID')
    .option(
      '--by <actor>',
      'Approver identity: "user" (default) or "decision-maker"',
      'user',
    )
    .action((opts: { mission: string; task: string; by: string }) => {
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
      if (opts.by !== 'user' && opts.by !== 'decision-maker') {
        emitErr(
          makeError(
            'invalid_argument',
            `--by must be 'user' or 'decision-maker' (got '${opts.by}')`,
            {
              hint: "valid --by values: 'user' or 'decision-maker'",
              exit_category: 'validation',
            },
          ),
        );
      }

      const root = needProjectRoot();
      const cPath = taskContractPath(root, opts.mission, opts.task);
      const contract = readJsonFile<Record<string, unknown>>(cPath);
      if (!contract) {
        emitErr(
          makeError(
            'missing_artifact',
            `task contract not found at ${slashPath(cPath)}`,
            {
              hint: "run 'geas task draft' to create the contract first",
              exit_category: 'missing_artifact',
            },
          ),
        );
        return;
      }

      const sPath = taskStatePath(root, opts.mission, opts.task);
      const state = readJsonFile<Record<string, unknown>>(sPath);
      if (!state) {
        emitErr(
          makeError('missing_artifact', `task-state.json not found for ${opts.task}`, {
            hint: 'task-state is created automatically by task draft; check the --task id or restore the artifact',
            exit_category: 'missing_artifact',
          }),
        );
        return;
      }

      const wasAlreadyApproved =
        contract.approved_by !== null && contract.approved_by !== undefined;
      const wasAlreadyReady = state.status === 'ready';

      const ts = nowUtc();
      contract.approved_by = opts.by;
      contract.updated_at = ts;

      const vC = validate('task-contract', contract);
      if (!vC.ok) {
        emitErr(
          makeError(
            'schema_validation_failed',
            'task-contract schema validation failed after setting approved_by',
            {
              hint: 'inspect ajv errors and fix the contract body, then retry',
              exit_category: 'validation',
            },
          ),
        );
      }

      // Guard the state transition via the task FSM. Allowed only from
      // drafted. If already ready (or beyond), we preserve state and
      // return idempotent success for the contract flip.
      let stateChanged = false;
      if (state.status === 'drafted') {
        const guardHints: TaskStateHints = makeApproveHints();
        const guard = canTransitionTaskState('drafted', 'ready', guardHints);
        if (!guard.ok) {
          emitErr(
            makeError('guard_failed', guard.reason, {
              hint: foldGuardHint(guard.hints) ?? 'check the contract approval status and dependencies',
              exit_category: 'guard',
            }),
          );
        }
        state.status = 'ready' as TaskState;
        state.updated_at = ts;
        if (!state.created_at) state.created_at = ts;
        const vS = validate('task-state', state);
        if (!vS.ok) {
          emitErr(
            makeError(
              'schema_validation_failed',
              'task-state schema validation failed after approve transition',
              {
                hint: 'inspect ajv errors and reconcile the on-disk state with the schema',
                exit_category: 'validation',
              },
            ),
          );
        }
        stateChanged = true;
      }

      atomicWriteJson(cPath, contract, tmpDir(root));
      if (stateChanged) {
        atomicWriteJson(sPath, state, tmpDir(root));
      }

      recordEvent(root, {
        kind: 'task_approved',
        actor: opts.by,
        payload: {
          mission_id: opts.mission,
          task_id: opts.task,
          artifact: slashPath(cPath),
          already_approved: wasAlreadyApproved && wasAlreadyReady,
        },
      });

      emitOk('task approve', {
        path: slashPath(cPath),
        ids: { mission_id: opts.mission, task_id: opts.task },
        already_approved: wasAlreadyApproved && wasAlreadyReady,
        contract,
        state,
      });
    });
}

function makeApproveHints(): TaskStateHints {
  // drafted -> ready requires only contractApproved, which we just set.
  // task-004: risk-tiered retry-budget hints are not consulted on this
  // edge, but populated with safe defaults for type completeness.
  return {
    contractApproved: true,
    dependenciesSatisfied: true,
    unsatisfiedDependencies: [],
    noSurfaceConflict: true,
    conflictingSurfaces: [],
    selfCheckExists: false,
    reviewEvidenceExists: false,
    missingReviewSlots: [],
    verificationEvidenceExists: false,
    closureApproved: false,
    riskLevel: null,
    verifyFixIterations: 0,
  };
}

// ── mission-state.active_tasks recompute ─────────────────────────────

/**
 * Recompute mission-state.active_tasks by scanning every task-state.json
 * under missions/{mid}/tasks/ and collecting task_ids whose status is in
 * {implementing, reviewing, deciding}. Per mission-state.schema.json,
 * active_tasks lists tasks "not yet terminated as passed/cancelled/escalated
 * and not paused as blocked" — these three live states are the canonical
 * set. Writes back atomically and bumps updated_at.
 *
 * Best-effort: if mission-state.json is missing or unreadable, this is a
 * no-op (the transition itself has already succeeded). Schema validation
 * is enforced; on failure the write is skipped and the error is swallowed
 * so the primary transition response still returns ok.
 */
function recomputeActiveTasks(root: string, missionId: string): void {
  const msPath = missionStatePath(root, missionId);
  const ms = readJsonFile<Record<string, unknown>>(msPath);
  if (!ms) return;

  const dir = tasksDir(root, missionId);
  if (!exists(dir)) return;

  const LIVE = new Set(['implementing', 'reviewing', 'deciding']);
  const active: string[] = [];
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const tPath = path.join(dir, name, 'task-state.json');
    if (!exists(tPath)) continue;
    const ts = readJsonFile<Record<string, unknown>>(tPath);
    if (!ts || typeof ts.status !== 'string') continue;
    if (LIVE.has(ts.status as string)) {
      const tid = typeof ts.task_id === 'string' ? ts.task_id : name;
      active.push(tid);
    }
  }
  active.sort();

  ms.active_tasks = active;
  ms.updated_at = nowUtc();

  const v = validate('mission-state', ms);
  if (!v.ok) return;
  try {
    atomicWriteJson(msPath, ms, tmpDir(root));
  } catch {
    // Best-effort: do not fail the transition because a secondary index
    // write failed. The task-state.json is authoritative; active_tasks
    // is a derived convenience field.
  }
}

// ── `geas task transition --to <state>` ──────────────────────────────

function registerTaskTransition(task: Command): void {
  task
    .command('transition')
    .description(
      'Transition a task through the 9-state FSM. Guards per protocol doc 03.',
    )
    .requiredOption('--mission <id>', 'Mission ID')
    .requiredOption('--task <id>', 'Task ID')
    .requiredOption('--to <state>', 'Target task-state status')
    .action((opts: { mission: string; task: string; to: string }) => {
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
      if (!isValidTaskState(opts.to)) {
        emitErr(
          makeError('invalid_argument', `unknown task state '${opts.to}'`, {
            hint: 'valid states: drafted, ready, implementing, reviewing, deciding, passed, blocked, escalated, cancelled',
            exit_category: 'validation',
          }),
        );
      }

      const root = needProjectRoot();
      const cPath = taskContractPath(root, opts.mission, opts.task);
      const contract = readJsonFile<Record<string, unknown>>(cPath);
      if (!contract) {
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
        return;
      }
      const sPath = taskStatePath(root, opts.mission, opts.task);
      const state = readJsonFile<Record<string, unknown>>(sPath);
      if (!state) {
        emitErr(
          makeError('missing_artifact', `task-state.json not found for ${opts.task}`, {
            hint: 'task-state is created automatically by task draft; check the --task id',
            exit_category: 'missing_artifact',
          }),
        );
        return;
      }

      const from = String(state.status);
      const to = opts.to as TaskState;

      const hints = collectTaskStateHints(
        root,
        opts.mission,
        opts.task,
        contract,
        state,
      );

      const guard = canTransitionTaskState(from, to, hints);
      if (!guard.ok) {
        // T2.8 path (b): structural guard hints folded to a string.
        emitErr(
          makeError('guard_failed', guard.reason, {
            hint: foldGuardHint(guard.hints) ?? 'check the task-state, dependencies, and surface conflicts',
            exit_category: 'guard',
          }),
        );
      }

      const ts = nowUtc();
      state.status = to;
      state.updated_at = ts;
      if (!state.created_at) state.created_at = ts;
      state.mission_id = opts.mission;
      state.task_id = opts.task;

      // reviewing -> implementing is the verify-fix loop. Bump
      // verify_fix_iterations on entry into implementing from reviewing.
      if (from === 'reviewing' && to === 'implementing') {
        const current = typeof state.verify_fix_iterations === 'number'
          ? state.verify_fix_iterations
          : 0;
        state.verify_fix_iterations = current + 1;
      }

      const vS = validate('task-state', state);
      if (!vS.ok) {
        emitErr(
          makeError(
            'schema_validation_failed',
            'task-state schema validation failed after transition',
            {
              hint: 'inspect ajv errors and reconcile the on-disk state with the schema',
              exit_category: 'validation',
            },
          ),
        );
      }
      atomicWriteJson(sPath, state, tmpDir(root));

      // After writing task-state, recompute mission-state.active_tasks from
      // the updated task directory. The schema defines active_tasks as the
      // set of tasks in lifecycle status ∈ {implementing, reviewing,
      // deciding} — i.e. not yet terminated (passed/cancelled/escalated)
      // and not paused (blocked). See mission-state.schema.json. This is
      // the sole writer; the field was never updated pre-transition and
      // dashboards read it for "currently in flight" views.
      recomputeActiveTasks(root, opts.mission);

      recordEvent(root, {
        kind: 'task_state_changed',
        actor: 'cli:auto',
        payload: {
          mission_id: opts.mission,
          task_id: opts.task,
          artifact: slashPath(sPath),
          from,
          to,
          verify_fix_iterations: state.verify_fix_iterations,
        },
      });

      emitOk('task transition', {
        path: slashPath(sPath),
        ids: { mission_id: opts.mission, task_id: opts.task },
        transition: { from, to },
        state,
      });
    });
}

/**
 * Build TaskStateHints by inspecting the on-disk artifact tree.
 *
 * G3 uses file-presence checks for evidence-driven fields. G4 tightens
 * them into verdict-aware inspection.
 *
 * task-004: also threads `risk_level` (from contract) and
 * `verify_fix_iterations` (from task-state) into the hints so the
 * reviewing -> implementing edge can enforce the risk-tiered retry-budget
 * (low=1, normal=2, high=2, critical=3) defined in lib/transition-guards.
 */
function collectTaskStateHints(
  root: string,
  missionId: string,
  taskId: string,
  contract: Record<string, unknown>,
  state?: Record<string, unknown> | null,
): TaskStateHints {
  const deps = Array.isArray(contract.dependencies)
    ? (contract.dependencies as string[])
    : [];
  const surfaces = Array.isArray(contract.surfaces)
    ? (contract.surfaces as string[])
    : [];
  const routing =
    (contract.routing as { required_reviewers?: string[] } | undefined) ?? {};
  const requiredReviewers = Array.isArray(routing.required_reviewers)
    ? routing.required_reviewers
    : [];

  // Dependencies satisfied: every dep task-state.status === 'passed'.
  const unsatisfied: string[] = [];
  for (const depId of deps) {
    const depState = readJsonFile<Record<string, unknown>>(
      taskStatePath(root, missionId, depId),
    );
    const status = depState && typeof depState.status === 'string' ? depState.status : null;
    if (status !== 'passed') {
      unsatisfied.push(depId);
    }
  }

  // Surface conflict: any other task in this mission whose status is
  // implementing and whose surfaces overlap ours.
  const conflictingSurfaces: string[] = [];
  const tDir = tasksDir(root, missionId);
  if (exists(tDir) && surfaces.length > 0) {
    const mySurf = new Set(surfaces);
    for (const entry of fs.readdirSync(tDir)) {
      if (entry === taskId) continue;
      const otherState = readJsonFile<Record<string, unknown>>(
        taskStatePath(root, missionId, entry),
      );
      if (!otherState || otherState.status !== 'implementing') continue;
      const otherContract = readJsonFile<Record<string, unknown>>(
        taskContractPath(root, missionId, entry),
      );
      const otherSurf = Array.isArray(otherContract?.surfaces)
        ? (otherContract!.surfaces as string[])
        : [];
      for (const s of otherSurf) {
        if (mySurf.has(s) && !conflictingSurfaces.includes(s)) {
          conflictingSurfaces.push(s);
        }
      }
    }
  }

  // G4: verdict-aware self-check — file must exist AND validate against
  // the self-check envelope schema. The schema enforces entries minItems=1,
  // so an empty entries array is rejected here automatically.
  const selfCheckFilePath = selfCheckPath(root, missionId, taskId);
  let selfCheckExists = false;
  if (exists(selfCheckFilePath)) {
    const selfCheckContent = readJsonFile<Record<string, unknown>>(selfCheckFilePath);
    if (selfCheckContent) {
      const v = validate('self-check', selfCheckContent);
      selfCheckExists = v.ok;
    }
  }

  // Review evidence: for each required review slot, there must be at least
  // one `*.{slot}.json` file AND the latest entry in that file must be a
  // `review`-kind entry with a verdict (approved / changes_requested /
  // blocked). Presence of the file alone is no longer sufficient.
  //
  // Note: this guard only checks that the REQUIRED review slots have at
  // least one valid review entry present. The gate verdict (pass/fail/block)
  // is what `gate run` computes and the `reviewing -> deciding` transition
  // consults (gate verdict = pass). We do not reject `implementing ->
  // reviewing` just because a reviewer said `changes_requested` — that's
  // recorded, and the orchestrator later re-enters implementing via the
  // `reviewing -> implementing` loop.
  const evDir = evidenceDir(root, missionId, taskId);
  const evidenceFiles = exists(evDir) ? fs.readdirSync(evDir) : [];
  const missingReviewSlots: string[] = [];
  for (const slot of requiredReviewers) {
    const match = evidenceFiles.find((f) => f.endsWith(`.${slot}.json`));
    if (!match) {
      missingReviewSlots.push(slot);
      continue;
    }
    const file = readJsonFile<{ entries?: Array<Record<string, unknown>> }>(
      path.join(evDir, match),
    );
    const hasReview =
      !!file &&
      Array.isArray(file.entries) &&
      file.entries.some(
        (e) =>
          e &&
          e.evidence_kind === 'review' &&
          typeof e.verdict === 'string' &&
          ['approved', 'changes_requested', 'blocked'].includes(e.verdict as string),
      );
    if (!hasReview) missingReviewSlots.push(slot);
  }
  const reviewEvidenceExists = missingReviewSlots.length === 0;

  // Verification evidence: the `reviewing -> deciding` guard reads the
  // last gate run verdict. The gate itself (see commands/gate.ts) now
  // reads impl-contract, self-check, reviewer evidence, and verifier
  // evidence directly and computes tier statuses — so a gate verdict of
  // `pass` is authoritative proof that every artifact the gate consumes
  // is present and consistent. This guard therefore checks only the gate
  // run; the gate is the enforcer.
  const gateResultsFile = readJsonFile<{
    runs?: Array<{
      verdict?: string;
      tier_results?: { tier_2?: { status?: string } };
    }>;
  }>(path.join(taskDir(root, missionId, taskId), 'gate-results.json'));
  let verificationEvidenceExists = false;
  if (
    gateResultsFile &&
    Array.isArray(gateResultsFile.runs) &&
    gateResultsFile.runs.length > 0
  ) {
    const lastRun = gateResultsFile.runs[gateResultsFile.runs.length - 1];
    if (
      lastRun &&
      lastRun.verdict === 'pass' &&
      lastRun.tier_results?.tier_2?.status === 'pass'
    ) {
      verificationEvidenceExists = true;
    }
  }

  // Closure: orchestrator.orchestrator.json with its LAST entry a closure
  // entry with verdict=approved, AND the file must validate against the
  // evidence schema (G4 tightening).
  const orchClosurePath = path.join(evDir, 'orchestrator.orchestrator.json');
  const closureFile = readJsonFile<{
    entries?: Array<Record<string, unknown>>;
  }>(orchClosurePath);
  let closureApproved = false;
  if (
    closureFile &&
    Array.isArray(closureFile.entries) &&
    closureFile.entries.length > 0
  ) {
    const last = closureFile.entries[closureFile.entries.length - 1];
    if (
      last &&
      last.evidence_kind === 'closure' &&
      last.verdict === 'approved'
    ) {
      // Full schema validation of the closure evidence file.
      const vEv = validate('evidence', closureFile);
      closureApproved = vEv.ok;
    }
  }

  const contractApproved =
    contract.approved_by !== null && contract.approved_by !== undefined;

  // task-004: risk-tiered retry-budget inputs. risk_level comes from the
  // contract; verify_fix_iterations comes from task-state. The guard in
  // canTransitionTaskState reads these to refuse reviewing -> implementing
  // once the budget for the contract's risk_level is reached.
  const riskLevel =
    typeof contract.risk_level === 'string' ? (contract.risk_level as string) : null;
  const verifyFixIterations =
    state && typeof state.verify_fix_iterations === 'number'
      ? (state.verify_fix_iterations as number)
      : 0;

  return {
    contractApproved,
    dependenciesSatisfied: unsatisfied.length === 0,
    unsatisfiedDependencies: unsatisfied,
    noSurfaceConflict: conflictingSurfaces.length === 0,
    conflictingSurfaces,
    selfCheckExists,
    reviewEvidenceExists,
    missingReviewSlots,
    verificationEvidenceExists,
    closureApproved,
    riskLevel,
    verifyFixIterations,
  };
}

// ── `geas task deps {add,remove}` ────────────────────────────────────

function registerTaskDeps(task: Command): void {
  const deps = task
    .command('deps')
    .description('Dependency manipulation for a task contract');

  deps
    .command('add')
    .description(
      'Append dependency task ids to contract.dependencies (duplicates ignored).',
    )
    .requiredOption('--mission <id>', 'Mission ID')
    .requiredOption('--task <id>', 'Task ID')
    .requiredOption('--deps <ids>', 'Comma-separated task ids to add')
    .action((opts: { mission: string; task: string; deps: string }) => {
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
      const parts = opts.deps.split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length === 0) {
        emitErr(
          makeError('invalid_argument', '--deps requires at least one task id', {
            hint: 'pass --deps as a comma-separated list of task ids',
            exit_category: 'validation',
          }),
        );
      }
      for (const p of parts) {
        if (!isValidTaskId(p)) {
          emitErr(
            makeError('invalid_argument', `invalid task id in --deps: '${p}'`, {
              hint: "task ids look like 'task-NNN' (3+ digits)",
              exit_category: 'validation',
            }),
          );
        }
        if (p === opts.task) {
          emitErr(
            makeError(
              'invalid_argument',
              `task '${opts.task}' cannot depend on itself`,
              {
                hint: 'remove the self-reference from --deps',
                exit_category: 'validation',
              },
            ),
          );
        }
      }

      const root = needProjectRoot();
      const cPath = taskContractPath(root, opts.mission, opts.task);
      const contract = readJsonFile<Record<string, unknown>>(cPath);
      if (!contract) {
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
        return;
      }
      const existing = Array.isArray(contract.dependencies)
        ? (contract.dependencies as string[])
        : [];
      const seen = new Set(existing);
      const added: string[] = [];
      for (const p of parts) {
        if (!seen.has(p)) {
          seen.add(p);
          added.push(p);
        }
      }
      const next = [...existing, ...added];
      contract.dependencies = next;
      contract.updated_at = nowUtc();

      const v = validate('task-contract', contract);
      if (!v.ok) {
        emitErr(
          makeError(
            'schema_validation_failed',
            'task-contract schema validation failed after dependency merge',
            {
              hint: 'inspect ajv errors and verify the dependencies array shape',
              exit_category: 'validation',
            },
          ),
        );
      }
      atomicWriteJson(cPath, contract, tmpDir(root));
      // Automation-scope discipline: appending deps is a single-field
      // mutation on an existing artifact — tracked via contract.json
      // updated_at. Protocol waypoints (task_drafted, task_approved,
      // task_state_changed) cover the lifecycle signals.

      emitOk('task deps add', {
        path: slashPath(cPath),
        ids: { mission_id: opts.mission, task_id: opts.task },
        added,
        dependencies: next,
      });
    });

  deps
    .command('remove')
    .description(
      'Remove dependency task ids from contract.dependencies (missing ids ignored).',
    )
    .requiredOption('--mission <id>', 'Mission ID')
    .requiredOption('--task <id>', 'Task ID')
    .requiredOption('--deps <ids>', 'Comma-separated task ids to remove')
    .action((opts: { mission: string; task: string; deps: string }) => {
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
      const parts = opts.deps.split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length === 0) {
        emitErr(
          makeError('invalid_argument', '--deps requires at least one task id', {
            hint: 'pass --deps as a comma-separated list of task ids to remove',
            exit_category: 'validation',
          }),
        );
      }
      for (const p of parts) {
        if (!isValidTaskId(p)) {
          emitErr(
            makeError('invalid_argument', `invalid task id in --deps: '${p}'`, {
              hint: "task ids look like 'task-NNN' (3+ digits)",
              exit_category: 'validation',
            }),
          );
        }
      }

      const root = needProjectRoot();
      const cPath = taskContractPath(root, opts.mission, opts.task);
      const contract = readJsonFile<Record<string, unknown>>(cPath);
      if (!contract) {
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
        return;
      }
      const existing = Array.isArray(contract.dependencies)
        ? (contract.dependencies as string[])
        : [];
      const toRemove = new Set(parts);
      const removed: string[] = [];
      const notPresent: string[] = [];
      for (const p of parts) {
        if (existing.includes(p)) removed.push(p);
        else notPresent.push(p);
      }
      const next = existing.filter((d) => !toRemove.has(d));
      contract.dependencies = next;
      contract.updated_at = nowUtc();

      const v = validate('task-contract', contract);
      if (!v.ok) {
        emitErr(
          makeError(
            'schema_validation_failed',
            'task-contract schema validation failed after dependency removal',
            {
              hint: 'inspect ajv errors and verify the dependencies array shape',
              exit_category: 'validation',
            },
          ),
        );
      }
      atomicWriteJson(cPath, contract, tmpDir(root));

      emitOk('task deps remove', {
        path: slashPath(cPath),
        ids: { mission_id: opts.mission, task_id: opts.task },
        removed,
        not_present: notPresent,
        dependencies: next,
      });
    });
}

// ── `geas task state` (read-only) ────────────────────────────────────

function registerTaskStateRead(task: Command): void {
  task
    .command('state')
    .description('Summarize task contract + task-state (read-only).')
    .requiredOption('--mission <id>', 'Mission ID')
    .requiredOption('--task <id>', 'Task ID')
    .action((opts: { mission: string; task: string }) => {
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
      const contract = readJsonFile<Record<string, unknown>>(
        taskContractPath(root, opts.mission, opts.task),
      );
      if (!contract) {
        emitErr(
          makeError('missing_artifact', `task contract not found for ${opts.task}`, {
            hint: "run 'geas task draft' to create the contract first",
            exit_category: 'missing_artifact',
          }),
        );
        return;
      }
      const state = readJsonFile<Record<string, unknown>>(
        taskStatePath(root, opts.mission, opts.task),
      );
      emitOk('task state', {
        mission_id: opts.mission,
        task_id: opts.task,
        status: typeof state?.status === 'string' ? state.status : null,
        verify_fix_iterations:
          typeof state?.verify_fix_iterations === 'number'
            ? state.verify_fix_iterations
            : 0,
        approved_by:
          contract.approved_by === null || contract.approved_by === undefined
            ? null
            : String(contract.approved_by),
        dependencies: Array.isArray(contract.dependencies)
          ? (contract.dependencies as string[])
          : [],
        surfaces: Array.isArray(contract.surfaces)
          ? (contract.surfaces as string[])
          : [],
        risk_level:
          typeof contract.risk_level === 'string' ? contract.risk_level : null,
        primary_worker_type:
          contract.routing &&
          typeof (contract.routing as Record<string, unknown>).primary_worker_type === 'string'
            ? (contract.routing as Record<string, string>).primary_worker_type
            : null,
      });
      // Preserve linter reference so missionStatePath is considered used;
      // future subcommands will read mission-state alongside task-state.
      void missionStatePath;
    });
}

// ── `geas task base-snapshot set` ────────────────────────────────────

/**
 * 40-character hex SHA validator. Accepts upper or lower case. Format-only —
 * mission-design B2.2 explicitly excludes any git rev-list verification
 * (offline policy, C5). Real existence of the SHA is the orchestrator /
 * design-authority's responsibility at contract-review time.
 */
const SHA40_HEX = /^[0-9a-fA-F]{40}$/;

function registerTaskBaseSnapshot(task: Command): void {
  const baseSnapshot = task
    .command('base-snapshot')
    .description('Manipulate task contract.base_snapshot');

  baseSnapshot
    .command('set')
    .description(
      'Set contract.base_snapshot to a 40-character hex SHA (format-only check).',
    )
    .requiredOption('--mission <id>', 'Mission ID')
    .requiredOption('--task <id>', 'Task ID')
    .requiredOption('--base <sha>', '40-character hex SHA (upper or lower case)')
    .action((opts: { mission: string; task: string; base: string }) => {
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
      if (typeof opts.base !== 'string' || !SHA40_HEX.test(opts.base)) {
        emitErr(
          makeError(
            'invalid_argument',
            `--base must be a 40-character hex SHA (got '${opts.base}')`,
            {
              hint: 'pass the full 40-character commit SHA (use git rev-parse HEAD)',
              exit_category: 'validation',
            },
          ),
        );
      }

      const root = needProjectRoot();
      const cPath = taskContractPath(root, opts.mission, opts.task);
      const contract = readJsonFile<Record<string, unknown>>(cPath);
      if (!contract) {
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
        return;
      }

      contract.base_snapshot = opts.base;
      contract.updated_at = nowUtc();

      const v = validate('task-contract', contract);
      if (!v.ok) {
        emitErr(
          makeError(
            'schema_validation_failed',
            'task-contract schema validation failed after base-snapshot set',
            {
              hint: 'inspect ajv errors and verify the SHA format and surrounding fields',
              exit_category: 'validation',
            },
          ),
        );
      }
      atomicWriteJson(cPath, contract, tmpDir(root));
      // Single-field-mutation policy mirrors `task deps add/remove`
      // (mission-design B2.1): contract.updated_at is the protocol
      // signal. Lifecycle waypoints (task_drafted, task_approved,
      // task_state_changed) cover real state changes; rotating a
      // base-snapshot is an environment-alignment step, not a
      // lifecycle event.

      emitOk('task base-snapshot set', {
        path: slashPath(cPath),
        ids: { mission_id: opts.mission, task_id: opts.task },
        base_snapshot: opts.base,
        contract,
      });
    });
}

// ── Entry point ──────────────────────────────────────────────────────

export function registerTaskCommands(program: Command): void {
  registerFormatter('task draft', formatTaskDraft);
  registerFormatter('task approve', formatTaskApprove);
  registerFormatter('task transition', formatTaskTransition);
  registerFormatter('task deps add', formatTaskDepsAdd);
  registerFormatter('task deps remove', formatTaskDepsRemove);
  registerFormatter('task base-snapshot set', formatTaskBaseSnapshot);
  registerFormatter('task state', formatTaskState);

  const task = program
    .command('task')
    .description(
      'Task-level artifact commands (draft, approve, transition, deps, state)',
    );

  registerTaskDraft(task);
  registerTaskApprove(task);
  registerTaskTransition(task);
  registerTaskDeps(task);
  registerTaskStateRead(task);
  registerTaskBaseSnapshot(task);
}
