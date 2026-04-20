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

import { emit, err, ok, recordEvent } from '../lib/envelope';
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
  taskDir,
  taskStatePath,
  tasksDir,
  tmpDir,
} from '../lib/paths';
import { readStdinJson, StdinError } from '../lib/input';
import { validate } from '../lib/schema';
import {
  canTransitionTaskState,
  isValidTaskState,
  type TaskState,
  type TaskStateHints,
} from '../lib/transition-guards';

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

function needMissionSpec(
  root: string,
  missionId: string,
): Record<string, unknown> {
  const spec = readJsonFile<Record<string, unknown>>(
    missionSpecPath(root, missionId),
  );
  if (!spec) {
    emit(
      err(
        'missing_artifact',
        `mission spec not found for ${missionId}; run 'geas mission create' first`,
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

function registerTaskDraft(task: Command): void {
  task
    .command('draft')
    .description(
      'Create a task contract under a mission (stdin: contract content). Writes contract.json + task-state.json (drafted).',
    )
    .requiredOption('--mission <id>', 'Mission ID')
    .action((opts: { mission: string }) => {
      if (!isValidMissionId(opts.mission)) {
        emit(err('invalid_argument', `invalid mission id '${opts.mission}'`));
      }
      const root = needProjectRoot();
      const spec = needMissionSpec(root, opts.mission);
      // Drafting is allowed even if the mission spec is not yet approved;
      // the approve transition (drafted -> ready) is what requires both
      // contract approval AND mission approval by downstream phase guards.
      void spec;

      let payload: Record<string, unknown>;
      try {
        payload = readStdinJson() as Record<string, unknown>;
      } catch (e) {
        if (e instanceof StdinError) emit(err('invalid_argument', e.message));
        throw e;
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        emit(err('invalid_argument', 'task draft expects a JSON object on stdin'));
      }

      const providedId = typeof payload.task_id === 'string' ? payload.task_id : undefined;
      const taskId = providedId ?? generateTaskId(root, opts.mission);
      if (!isValidTaskId(taskId)) {
        emit(err('invalid_argument', `invalid task id '${taskId}'`));
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
        emit(
          err(
            'path_collision',
            `task contract already exists at ${slashPath(contractPath)}`,
          ),
        );
      }

      const v = validate('task-contract', payload);
      if (!v.ok) {
        emit(
          err(
            'schema_validation_failed',
            'task-contract schema validation failed',
            v.errors,
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
        emit(
          err(
            'schema_validation_failed',
            'task-state schema validation failed on initialization',
            vs.errors,
          ),
        );
      }
      atomicWriteJson(
        taskStatePath(root, opts.mission, taskId),
        state,
        tmpDir(root),
      );

      recordEvent(root, {
        kind: 'task_drafted',
        actor: 'cli:auto',
        payload: {
          mission_id: opts.mission,
          task_id: taskId,
          artifact: slashPath(path.relative(root, contractPath)),
        },
      });

      emit(
        ok({
          path: slashPath(contractPath),
          ids: { mission_id: opts.mission, task_id: taskId },
          contract: payload,
          state,
        }),
      );
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
        emit(err('invalid_argument', `invalid mission id '${opts.mission}'`));
      }
      if (!isValidTaskId(opts.task)) {
        emit(err('invalid_argument', `invalid task id '${opts.task}'`));
      }
      if (opts.by !== 'user' && opts.by !== 'decision-maker') {
        emit(
          err(
            'invalid_argument',
            `--by must be 'user' or 'decision-maker' (got '${opts.by}')`,
          ),
        );
      }

      const root = needProjectRoot();
      const cPath = taskContractPath(root, opts.mission, opts.task);
      const contract = readJsonFile<Record<string, unknown>>(cPath);
      if (!contract) {
        emit(
          err(
            'missing_artifact',
            `task contract not found at ${slashPath(cPath)}`,
          ),
        );
        return;
      }

      const sPath = taskStatePath(root, opts.mission, opts.task);
      const state = readJsonFile<Record<string, unknown>>(sPath);
      if (!state) {
        emit(
          err('missing_artifact', `task-state.json not found for ${opts.task}`),
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
        emit(
          err(
            'schema_validation_failed',
            'task-contract schema validation failed after setting approved_by',
            vC.errors,
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
          emit(err('guard_failed', guard.reason, guard.hints));
        }
        state.status = 'ready' as TaskState;
        state.updated_at = ts;
        if (!state.created_at) state.created_at = ts;
        const vS = validate('task-state', state);
        if (!vS.ok) {
          emit(
            err(
              'schema_validation_failed',
              'task-state schema validation failed after approve transition',
              vS.errors,
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

      emit(
        ok({
          path: slashPath(cPath),
          ids: { mission_id: opts.mission, task_id: opts.task },
          already_approved: wasAlreadyApproved && wasAlreadyReady,
          contract,
          state,
        }),
      );
    });
}

function makeApproveHints(): TaskStateHints {
  // drafted -> ready requires only contractApproved, which we just set.
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
  };
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
        emit(err('invalid_argument', `invalid mission id '${opts.mission}'`));
      }
      if (!isValidTaskId(opts.task)) {
        emit(err('invalid_argument', `invalid task id '${opts.task}'`));
      }
      if (!isValidTaskState(opts.to)) {
        emit(err('invalid_argument', `unknown task state '${opts.to}'`));
      }

      const root = needProjectRoot();
      const cPath = taskContractPath(root, opts.mission, opts.task);
      const contract = readJsonFile<Record<string, unknown>>(cPath);
      if (!contract) {
        emit(
          err(
            'missing_artifact',
            `task contract not found for ${opts.task}`,
          ),
        );
        return;
      }
      const sPath = taskStatePath(root, opts.mission, opts.task);
      const state = readJsonFile<Record<string, unknown>>(sPath);
      if (!state) {
        emit(err('missing_artifact', `task-state.json not found for ${opts.task}`));
        return;
      }

      const from = String(state.status);
      const to = opts.to as TaskState;

      const hints = collectTaskStateHints(
        root,
        opts.mission,
        opts.task,
        contract,
      );

      const guard = canTransitionTaskState(from, to, hints);
      if (!guard.ok) {
        emit(err('guard_failed', guard.reason, guard.hints));
      }

      const ts = nowUtc();
      state.status = to;
      state.updated_at = ts;
      if (!state.created_at) state.created_at = ts;
      state.mission_id = opts.mission;
      state.task_id = opts.task;

      // reviewed -> implementing is the changes_requested loop. Bump
      // verify_fix_iterations on entry into implementing from reviewed.
      if (from === 'reviewed' && to === 'implementing') {
        const current = typeof state.verify_fix_iterations === 'number'
          ? state.verify_fix_iterations
          : 0;
        state.verify_fix_iterations = current + 1;
      }

      const vS = validate('task-state', state);
      if (!vS.ok) {
        emit(
          err(
            'schema_validation_failed',
            'task-state schema validation failed after transition',
            vS.errors,
          ),
        );
      }
      atomicWriteJson(sPath, state, tmpDir(root));

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

      emit(
        ok({
          path: slashPath(sPath),
          ids: { mission_id: opts.mission, task_id: opts.task },
          transition: { from, to },
          state,
        }),
      );
    });
}

/**
 * Build TaskStateHints by inspecting the on-disk artifact tree.
 *
 * G3 uses file-presence checks for evidence-driven fields. G4 tightens
 * them into verdict-aware inspection.
 */
function collectTaskStateHints(
  root: string,
  missionId: string,
  taskId: string,
  contract: Record<string, unknown>,
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

  // G4: verdict-aware self-check — file must exist AND validate.
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
  // is what `gate run` computes and the `reviewed -> verified` transition
  // consults (gate verdict = pass). We do not reject `implementing ->
  // reviewed` just because a reviewer said `changes_requested` — that's
  // recorded, and the orchestrator later re-enters implementing via the
  // `reviewed -> implementing` loop.
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

  // Verification evidence: gate-results.json last run must have
  // verdict=pass AND tier_2 status=pass. Verifier evidence file existence
  // alone is no longer enough.
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
  };
}

// ── `geas task deps add` ──────────────────────────────────────────────

function registerTaskDepsAdd(task: Command): void {
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
        emit(err('invalid_argument', `invalid mission id '${opts.mission}'`));
      }
      if (!isValidTaskId(opts.task)) {
        emit(err('invalid_argument', `invalid task id '${opts.task}'`));
      }
      const parts = opts.deps.split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length === 0) {
        emit(err('invalid_argument', '--deps requires at least one task id'));
      }
      for (const p of parts) {
        if (!isValidTaskId(p)) {
          emit(err('invalid_argument', `invalid task id in --deps: '${p}'`));
        }
        if (p === opts.task) {
          emit(
            err(
              'invalid_argument',
              `task '${opts.task}' cannot depend on itself`,
            ),
          );
        }
      }

      const root = needProjectRoot();
      const cPath = taskContractPath(root, opts.mission, opts.task);
      const contract = readJsonFile<Record<string, unknown>>(cPath);
      if (!contract) {
        emit(
          err(
            'missing_artifact',
            `task contract not found for ${opts.task}`,
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
        emit(
          err(
            'schema_validation_failed',
            'task-contract schema validation failed after dependency merge',
            v.errors,
          ),
        );
      }
      atomicWriteJson(cPath, contract, tmpDir(root));

      recordEvent(root, {
        kind: 'task_deps_added',
        actor: 'cli:auto',
        payload: {
          mission_id: opts.mission,
          task_id: opts.task,
          artifact: slashPath(cPath),
          added,
          dependencies: next,
        },
      });

      emit(
        ok({
          path: slashPath(cPath),
          ids: { mission_id: opts.mission, task_id: opts.task },
          added,
          dependencies: next,
        }),
      );
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
        emit(err('invalid_argument', `invalid mission id '${opts.mission}'`));
      }
      if (!isValidTaskId(opts.task)) {
        emit(err('invalid_argument', `invalid task id '${opts.task}'`));
      }
      const root = needProjectRoot();
      const contract = readJsonFile<Record<string, unknown>>(
        taskContractPath(root, opts.mission, opts.task),
      );
      if (!contract) {
        emit(
          err('missing_artifact', `task contract not found for ${opts.task}`),
        );
        return;
      }
      const state = readJsonFile<Record<string, unknown>>(
        taskStatePath(root, opts.mission, opts.task),
      );
      emit(
        ok({
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
        }),
      );
      // Preserve linter reference so missionStatePath is considered used;
      // future subcommands will read mission-state alongside task-state.
      void missionStatePath;
    });
}

// ── Entry point ──────────────────────────────────────────────────────

export function registerTaskCommands(program: Command): void {
  const task = program
    .command('task')
    .description(
      'Task-level artifact commands (draft, approve, transition, deps, state)',
    );

  registerTaskDraft(task);
  registerTaskApprove(task);
  registerTaskTransition(task);
  registerTaskDepsAdd(task);
  registerTaskStateRead(task);
}
