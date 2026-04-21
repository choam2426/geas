/**
 * `geas mission ...` — mission-level artifact commands.
 *
 * Subcommands:
 *   geas mission create                (stdin: mission spec fields)
 *   geas mission approve    --mission <id>
 *   geas mission design-set --mission <id>                 (stdin: markdown)
 *   geas mission state      --mission <id>                 (read-only)
 *   geas mission-state update --mission <id> --phase <p>   (phase transition)
 *   geas phase-review append  --mission <id>               (stdin entry)
 *   geas mission-verdict append --mission <id>             (stdin entry)
 *
 * Names follow `docs/ko/architecture/CLI.md` §3 (command table) and §14.2
 * (phase transition). Phase-guard details live in `lib/transition-guards.ts`.
 *
 * The mission spec is immutable after the user approves it (protocol 02).
 * `geas mission create` refuses to overwrite an existing spec; `geas
 * mission approve` refuses to flip an already-approved spec back.
 */

import type { Command } from 'commander';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { emit, err, ok, recordEvent } from '../lib/envelope';
import {
  atomicWrite,
  atomicWriteJson,
  ensureDir,
  exists,
  readJsonFile,
} from '../lib/fs-atomic';
import {
  consolidationDir,
  findProjectRoot,
  isValidMissionId,
  missionDeliberationsPath,
  missionDesignPath,
  missionDir,
  missionSpecPath,
  missionStatePath,
  missionVerdictsPath,
  phaseReviewsPath,
  tasksDir,
  tmpDir,
} from '../lib/paths';
import { readStdinJson, readStdinText, StdinError } from '../lib/input';
import { validate } from '../lib/schema';
import {
  canAdvanceMissionPhase,
  isValidMissionPhase,
  type MissionPhase,
  type MissionPhaseHints,
} from '../lib/transition-guards';

function nowUtc(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
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

function slashPath(p: string): string {
  return p.replace(/\\/g, '/');
}

/**
 * Generate a fresh mission id of the form `mission-YYYYMMDD-xxxxxxxx`
 * where the suffix is 8 url-safe alphanumerics derived from crypto
 * random bytes. Deterministic seeds come from env (`GEAS_MOCK_MISSION_ID`)
 * for test reproducibility.
 */
function generateMissionId(): string {
  const override = process.env.GEAS_MOCK_MISSION_ID;
  if (override && /^mission-[0-9]{8}-[a-zA-Z0-9]{8}$/.test(override)) {
    return override;
  }
  const d = new Date();
  const yyyy = d.getUTCFullYear().toString().padStart(4, '0');
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = d.getUTCDate().toString().padStart(2, '0');
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(8);
  let suffix = '';
  for (let i = 0; i < 8; i++) {
    suffix += alphabet[bytes[i] % alphabet.length];
  }
  return `mission-${yyyy}${mm}${dd}-${suffix}`;
}

/** How many task-contract files under this mission have `approved_by` non-null. */
function countApprovedTasks(projectRoot: string, missionId: string): number {
  const tDir = tasksDir(projectRoot, missionId);
  if (!exists(tDir)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(tDir)) {
    const contractPath = path.join(tDir, entry, 'contract.json');
    if (!exists(contractPath)) continue;
    const contract = readJsonFile<Record<string, unknown>>(contractPath);
    if (contract && contract.approved_by != null && contract.approved_by !== '') {
      count++;
    }
  }
  return count;
}

/**
 * Count tasks that are NOT terminated. A task-state is considered open
 * unless its `status` is one of passed/cancelled/escalated. Blocked is
 * treated as open here so that G2 can gate the building->polishing
 * transition on blocked tasks too (protocol 02 building phase gate).
 */
function countOpenTasks(projectRoot: string, missionId: string): number {
  const tDir = tasksDir(projectRoot, missionId);
  if (!exists(tDir)) return 0;
  const TERMINATED = new Set(['passed', 'cancelled', 'escalated']);
  let count = 0;
  for (const entry of fs.readdirSync(tDir)) {
    const statePath = path.join(tDir, entry, 'task-state.json');
    if (!exists(statePath)) {
      // contract without state: treat as open (hasn't terminated).
      if (exists(path.join(tDir, entry, 'contract.json'))) count++;
      continue;
    }
    const state = readJsonFile<Record<string, unknown>>(statePath);
    const status = typeof state?.status === 'string' ? state.status : null;
    if (!status || !TERMINATED.has(status)) count++;
  }
  return count;
}

/** Return the latest phase-review whose status === 'passed', or null. */
function latestPassedPhaseReview(
  projectRoot: string,
  missionId: string,
): { mission_phase: string; next_phase?: string } | null {
  const p = phaseReviewsPath(projectRoot, missionId);
  const data = readJsonFile<{ reviews?: Array<Record<string, unknown>> }>(p);
  if (!data || !Array.isArray(data.reviews)) return null;
  for (let i = data.reviews.length - 1; i >= 0; i--) {
    const r = data.reviews[i];
    if (r.status === 'passed') {
      return {
        mission_phase: String(r.mission_phase),
        next_phase: typeof r.next_phase === 'string' ? r.next_phase : undefined,
      };
    }
  }
  return null;
}

function missionVerdictExists(projectRoot: string, missionId: string): boolean {
  const p = missionVerdictsPath(projectRoot, missionId);
  const data = readJsonFile<{ verdicts?: unknown[] }>(p);
  return !!data && Array.isArray(data.verdicts) && data.verdicts.length > 0;
}

// ── `geas mission create` ───────────────────────────────────────────────

function registerMissionCreate(mission: Command): void {
  mission
    .command('create')
    .description(
      'Create a new mission from stdin JSON (spec fields); scaffolds the mission tree.',
    )
    .action(() => {
      const root = needProjectRoot();

      let payload: Record<string, unknown>;
      try {
        payload = readStdinJson() as Record<string, unknown>;
      } catch (e) {
        if (e instanceof StdinError) emit(err('invalid_argument', e.message));
        throw e;
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        emit(err('invalid_argument', 'mission create expects a JSON object on stdin'));
      }

      // id is caller-supplied or CLI-generated.
      const providedId = typeof payload.id === 'string' ? payload.id : undefined;
      const missionId = providedId ?? generateMissionId();
      if (!isValidMissionId(missionId)) {
        emit(err('invalid_argument', `invalid mission id '${missionId}'`));
      }
      payload.id = missionId;

      // Default user_approved to false when not provided. Mission spec
      // becomes immutable only after `geas mission approve`.
      if (payload.user_approved === undefined) payload.user_approved = false;

      const ts = nowUtc();
      payload.created_at = ts;
      payload.updated_at = ts;

      // Main artifact collision check.
      const specPath = missionSpecPath(root, missionId);
      if (exists(specPath)) {
        emit(
          err(
            'path_collision',
            `mission spec already exists at ${slashPath(specPath)}`,
          ),
        );
      }

      const v = validate('mission-spec', payload);
      if (!v.ok) {
        emit(
          err(
            'schema_validation_failed',
            'mission-spec schema validation failed',
            v.errors,
          ),
        );
      }

      // Write primary spec.
      ensureDir(missionDir(root, missionId));
      atomicWriteJson(specPath, payload, tmpDir(root));

      // Initialize mission-state (drafted = specifying, no active tasks).
      const statePath = missionStatePath(root, missionId);
      const state = {
        mission_id: missionId,
        phase: 'specifying' as MissionPhase,
        active_tasks: [] as string[],
        created_at: ts,
        updated_at: ts,
      };
      atomicWriteJson(statePath, state, tmpDir(root));

      // Empty wrappers (§14.1 scaffold).
      const prPath = phaseReviewsPath(root, missionId);
      if (!exists(prPath)) {
        atomicWriteJson(
          prPath,
          { mission_id: missionId, reviews: [], created_at: ts, updated_at: ts },
          tmpDir(root),
        );
      }
      const mvPath = missionVerdictsPath(root, missionId);
      if (!exists(mvPath)) {
        atomicWriteJson(
          mvPath,
          { mission_id: missionId, verdicts: [], created_at: ts, updated_at: ts },
          tmpDir(root),
        );
      }
      const delibPath = missionDeliberationsPath(root, missionId);
      if (!exists(delibPath)) {
        atomicWriteJson(
          delibPath,
          {
            mission_id: missionId,
            level: 'mission',
            entries: [],
            created_at: ts,
            updated_at: ts,
          },
          tmpDir(root),
        );
      }
      ensureDir(tasksDir(root, missionId));
      ensureDir(consolidationDir(root, missionId));

      recordEvent(root, {
        kind: 'mission_created',
        actor: 'cli:auto',
        payload: {
          mission_id: missionId,
          artifact: slashPath(path.relative(root, specPath)),
          user_approved: Boolean(payload.user_approved),
        },
      });

      emit(
        ok({
          path: slashPath(specPath),
          ids: { mission_id: missionId },
          spec: payload,
          state,
        }),
      );
    });
}

// ── `geas mission approve` ──────────────────────────────────────────────

function registerMissionApprove(mission: Command): void {
  mission
    .command('approve')
    .description('Mark the mission spec as user_approved. Idempotent no-op if already approved.')
    .requiredOption('--mission <id>', 'Mission ID')
    .action((opts: { mission: string }) => {
      if (!isValidMissionId(opts.mission)) {
        emit(err('invalid_argument', `invalid mission id '${opts.mission}'`));
      }
      const root = needProjectRoot();
      const specPath = missionSpecPath(root, opts.mission);
      const spec = readJsonFile<Record<string, unknown>>(specPath);
      if (!spec) {
        emit(
          err(
            'missing_artifact',
            `mission spec not found for ${opts.mission} at ${slashPath(specPath)}`,
          ),
        );
        return;
      }
      if (spec.user_approved === true) {
        emit(
          ok({
            path: slashPath(specPath),
            ids: { mission_id: opts.mission },
            already_approved: true,
          }),
        );
        return;
      }
      spec.user_approved = true;
      spec.updated_at = nowUtc();

      const v = validate('mission-spec', spec);
      if (!v.ok) {
        emit(
          err(
            'schema_validation_failed',
            'mission-spec schema validation failed after setting user_approved',
            v.errors,
          ),
        );
      }
      atomicWriteJson(specPath, spec, tmpDir(root));

      recordEvent(root, {
        kind: 'mission_approved',
        actor: 'user',
        payload: { mission_id: opts.mission, artifact: slashPath(specPath) },
      });

      emit(
        ok({
          path: slashPath(specPath),
          ids: { mission_id: opts.mission },
          already_approved: false,
          spec,
        }),
      );
    });
}

// ── `geas mission design-set` ──────────────────────────────────────────

function registerMissionDesignSet(mission: Command): void {
  mission
    .command('design-set')
    .description(
      'Write mission-design.md from stdin (atomic full-replace). Allowed only during specifying phase, after the spec is user_approved.',
    )
    .requiredOption('--mission <id>', 'Mission ID')
    .action((opts: { mission: string }) => {
      if (!isValidMissionId(opts.mission)) {
        emit(err('invalid_argument', `invalid mission id '${opts.mission}'`));
      }
      const root = needProjectRoot();

      const specPath = missionSpecPath(root, opts.mission);
      const spec = readJsonFile<Record<string, unknown>>(specPath);
      if (!spec) {
        emit(
          err(
            'missing_artifact',
            `mission spec not found for ${opts.mission} at ${slashPath(specPath)}`,
          ),
        );
        return;
      }
      if (spec.user_approved !== true) {
        emit(
          err(
            'guard_failed',
            `mission spec is not user_approved; run 'geas mission approve --mission ${opts.mission}' first`,
          ),
        );
        return;
      }

      const statePath = missionStatePath(root, opts.mission);
      const state = readJsonFile<Record<string, unknown>>(statePath);
      if (!state) {
        emit(
          err(
            'missing_artifact',
            `mission-state not found for ${opts.mission} at ${slashPath(statePath)}`,
          ),
        );
        return;
      }
      const phase = typeof state.phase === 'string' ? state.phase : null;
      if (phase !== 'specifying') {
        emit(
          err(
            'guard_failed',
            `mission-design is immutable after specifying phase; current phase is '${phase ?? 'unknown'}'`,
          ),
        );
        return;
      }

      let content: string;
      try {
        content = readStdinText();
      } catch (e) {
        if (e instanceof StdinError) {
          emit(err('invalid_argument', e.message));
          return;
        }
        throw e;
      }
      if (!content.endsWith('\n')) content = content + '\n';

      const designPath = missionDesignPath(root, opts.mission);
      const wasPresent = exists(designPath);
      atomicWrite(designPath, content, tmpDir(root));

      recordEvent(root, {
        kind: 'mission_design_set',
        actor: 'cli:auto',
        payload: {
          mission_id: opts.mission,
          artifact: slashPath(designPath),
          replaced: wasPresent,
          bytes: Buffer.byteLength(content, 'utf-8'),
        },
      });

      emit(
        ok({
          path: slashPath(designPath),
          ids: { mission_id: opts.mission },
          replaced: wasPresent,
          bytes: Buffer.byteLength(content, 'utf-8'),
        }),
      );
    });
}

// ── `geas mission state` (read-only) ───────────────────────────────────

function registerMissionStateRead(mission: Command): void {
  mission
    .command('state')
    .description('Summarize mission spec + phase + task counts (read-only).')
    .requiredOption('--mission <id>', 'Mission ID')
    .action((opts: { mission: string }) => {
      if (!isValidMissionId(opts.mission)) {
        emit(err('invalid_argument', `invalid mission id '${opts.mission}'`));
      }
      const root = needProjectRoot();
      const spec = readJsonFile<Record<string, unknown>>(
        missionSpecPath(root, opts.mission),
      );
      if (!spec) {
        emit(err('missing_artifact', `mission spec not found for ${opts.mission}`));
        return;
      }
      const state = readJsonFile<Record<string, unknown>>(
        missionStatePath(root, opts.mission),
      );
      const approvedTasks = countApprovedTasks(root, opts.mission);
      const openTasks = countOpenTasks(root, opts.mission);

      emit(
        ok({
          mission_id: opts.mission,
          phase: typeof state?.phase === 'string' ? state.phase : null,
          user_approved: spec.user_approved === true,
          mode: typeof spec.mode === 'string' ? spec.mode : null,
          name: typeof spec.name === 'string' ? spec.name : null,
          approved_task_count: approvedTasks,
          open_task_count: openTasks,
          active_tasks: Array.isArray(state?.active_tasks)
            ? (state!.active_tasks as string[])
            : [],
        }),
      );
    });
}

// ── `geas mission-state update --phase <p>` ────────────────────────────

function registerMissionStateUpdatePhase(program: Command): void {
  const msu = program
    .command('mission-state')
    .description('mission-state.json update operations (phase transitions, bookkeeping)');

  msu
    .command('update')
    .description(
      'Update the mission-state (phase transition). Phase-guards live in lib/transition-guards.',
    )
    .requiredOption('--mission <id>', 'Mission ID')
    .option('--phase <phase>', 'Target mission phase')
    .action((opts: { mission: string; phase?: string }) => {
      if (!isValidMissionId(opts.mission)) {
        emit(err('invalid_argument', `invalid mission id '${opts.mission}'`));
      }
      if (!opts.phase) {
        emit(
          err(
            'invalid_argument',
            'mission-state update requires --phase <phase>',
          ),
        );
        return;
      }
      if (!isValidMissionPhase(opts.phase)) {
        emit(err('invalid_argument', `unknown phase '${opts.phase}'`));
      }

      const root = needProjectRoot();
      const statePath = missionStatePath(root, opts.mission);
      const state = readJsonFile<Record<string, unknown>>(statePath);
      if (!state) {
        emit(
          err(
            'missing_artifact',
            `mission-state.json not found for ${opts.mission}`,
          ),
        );
        return;
      }
      const spec = readJsonFile<Record<string, unknown>>(
        missionSpecPath(root, opts.mission),
      );
      if (!spec) {
        emit(err('missing_artifact', `mission spec not found for ${opts.mission}`));
        return;
      }

      const from = String(state.phase);
      const to = opts.phase as MissionPhase;

      const latestReview = latestPassedPhaseReview(root, opts.mission);
      const priorPhaseReviewPassedToTarget =
        latestReview !== null &&
        latestReview.mission_phase === from &&
        latestReview.next_phase === to;

      const hints: MissionPhaseHints = {
        specApproved: spec.user_approved === true,
        approvedTaskCount: countApprovedTasks(root, opts.mission),
        openTaskCount: countOpenTasks(root, opts.mission),
        priorPhaseReviewPassedToTarget,
        missionVerdictExists: missionVerdictExists(root, opts.mission),
      };

      const guard = canAdvanceMissionPhase(from, to, hints);
      if (!guard.ok) {
        emit(err('guard_failed', guard.reason, guard.hints));
      }

      const ts = nowUtc();
      state.phase = to;
      state.updated_at = ts;
      if (!state.created_at) state.created_at = ts;
      state.mission_id = opts.mission;

      const v = validate('mission-state', state);
      if (!v.ok) {
        emit(
          err(
            'schema_validation_failed',
            'mission-state schema validation failed',
            v.errors,
          ),
        );
      }
      atomicWriteJson(statePath, state, tmpDir(root));

      recordEvent(root, {
        kind: 'mission_phase_advanced',
        actor: 'cli:auto',
        payload: {
          mission_id: opts.mission,
          artifact: slashPath(statePath),
          from,
          to,
        },
      });

      emit(
        ok({
          path: slashPath(statePath),
          ids: { mission_id: opts.mission },
          phase: { from, to },
          state,
        }),
      );
    });
}

// ── `geas phase-review append` ─────────────────────────────────────────

function registerPhaseReviewAppend(program: Command): void {
  const pr = program
    .command('phase-review')
    .description('phase-reviews.json append operation (mission phase gate records)');

  pr
    .command('append')
    .description('Append a phase-review entry (stdin JSON). Mission-scoped.')
    .requiredOption('--mission <id>', 'Mission ID')
    .action((opts: { mission: string }) => {
      if (!isValidMissionId(opts.mission)) {
        emit(err('invalid_argument', `invalid mission id '${opts.mission}'`));
      }
      const root = needProjectRoot();

      let entry: Record<string, unknown>;
      try {
        entry = readStdinJson() as Record<string, unknown>;
      } catch (e) {
        if (e instanceof StdinError) emit(err('invalid_argument', e.message));
        throw e;
      }

      const ts = nowUtc();
      entry.created_at = ts;

      const p = phaseReviewsPath(root, opts.mission);
      const wrapper = readJsonFile<{
        mission_id?: string;
        reviews?: unknown[];
        created_at?: string;
        updated_at?: string;
      }>(p) ?? {
        mission_id: opts.mission,
        reviews: [],
        created_at: ts,
        updated_at: ts,
      };
      if (!Array.isArray(wrapper.reviews)) wrapper.reviews = [];

      const updated = {
        mission_id: opts.mission,
        reviews: [...(wrapper.reviews as Record<string, unknown>[]), entry],
        created_at: wrapper.created_at ?? ts,
        updated_at: ts,
      };

      const v = validate('phase-reviews', updated);
      if (!v.ok) {
        emit(
          err(
            'schema_validation_failed',
            'phase-reviews schema validation failed',
            v.errors,
          ),
        );
      }
      atomicWriteJson(p, updated, tmpDir(root));

      recordEvent(root, {
        kind: 'phase_review_appended',
        actor: 'cli:auto',
        payload: {
          mission_id: opts.mission,
          artifact: slashPath(p),
          mission_phase: entry.mission_phase,
          status: entry.status,
          next_phase: entry.next_phase,
        },
      });

      emit(
        ok({
          path: slashPath(p),
          ids: { mission_id: opts.mission, entry_index: updated.reviews.length - 1 },
          entry,
        }),
      );
    });
}

// ── `geas mission-verdict append` ──────────────────────────────────────

function registerMissionVerdictAppend(program: Command): void {
  const mv = program
    .command('mission-verdict')
    .description('mission-verdicts.json append operation (Decision Maker closure)');

  mv
    .command('append')
    .description('Append a mission-verdict entry (stdin JSON).')
    .requiredOption('--mission <id>', 'Mission ID')
    .action((opts: { mission: string }) => {
      if (!isValidMissionId(opts.mission)) {
        emit(err('invalid_argument', `invalid mission id '${opts.mission}'`));
      }
      const root = needProjectRoot();

      let entry: Record<string, unknown>;
      try {
        entry = readStdinJson() as Record<string, unknown>;
      } catch (e) {
        if (e instanceof StdinError) emit(err('invalid_argument', e.message));
        throw e;
      }

      const ts = nowUtc();
      entry.created_at = ts;

      const p = missionVerdictsPath(root, opts.mission);
      const wrapper = readJsonFile<{
        mission_id?: string;
        verdicts?: unknown[];
        created_at?: string;
      }>(p) ?? {
        mission_id: opts.mission,
        verdicts: [],
        created_at: ts,
      };
      if (!Array.isArray(wrapper.verdicts)) wrapper.verdicts = [];

      const updated = {
        mission_id: opts.mission,
        verdicts: [...(wrapper.verdicts as Record<string, unknown>[]), entry],
        created_at: wrapper.created_at ?? ts,
        updated_at: ts,
      };

      const v = validate('mission-verdicts', updated);
      if (!v.ok) {
        emit(
          err(
            'schema_validation_failed',
            'mission-verdicts schema validation failed',
            v.errors,
          ),
        );
      }
      atomicWriteJson(p, updated, tmpDir(root));

      recordEvent(root, {
        kind: 'mission_verdict_appended',
        actor: 'decision-maker',
        payload: {
          mission_id: opts.mission,
          artifact: slashPath(p),
          verdict: entry.verdict,
        },
      });

      emit(
        ok({
          path: slashPath(p),
          ids: {
            mission_id: opts.mission,
            entry_index: updated.verdicts.length - 1,
          },
          entry,
        }),
      );
    });
}

// ── Entry point ────────────────────────────────────────────────────────

export function registerMissionCommands(program: Command): void {
  const mission = program
    .command('mission')
    .description('Mission-level artifact commands (spec, approve, state summary)');

  registerMissionCreate(mission);
  registerMissionApprove(mission);
  registerMissionDesignSet(mission);
  registerMissionStateRead(mission);

  registerMissionStateUpdatePhase(program);
  registerPhaseReviewAppend(program);
  registerMissionVerdictAppend(program);
}
