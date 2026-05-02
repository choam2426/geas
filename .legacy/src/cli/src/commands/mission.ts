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
 *
 * T2.b (mission-20260427-xIPG1sDY task-006): migrated off the legacy
 * envelope.emit/err/ok bridge to call output.emitOk / output.emitErr +
 * errors.makeError directly. Per AC2 every error site rotates exit code
 * through EXIT_CATEGORY_CODE: invalid_argument 1→2, missing_artifact 1→4,
 * schema_validation_failed 2 unchanged, guard_failed 3 unchanged,
 * path_collision 1→2. Guard hint structures from canAdvanceMissionPhase
 * are folded to single-line hint strings via foldGuardHint (T2.8 path b).
 * Per AC3 each emitOk site has a registered ScalarFormatter so default
 * mode produces human-readable text.
 */

import type { Command } from 'commander';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { recordEvent } from '../lib/envelope';
import { emitErr, emitOk, registerFormatter } from '../lib/output';
import { makeError } from '../lib/errors';
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
import { readPayloadJson, readPayloadText, StdinError } from '../lib/input';
import { validate } from '../lib/schema';
import {
  canAdvanceMissionPhase,
  isValidMissionPhase,
  type MissionPhase,
  type MissionPhaseHints,
} from '../lib/transition-guards';

/**
 * Fold a structured guard hint object (e.g. { allowed_transitions: [...]
 * } or { open_task_count: 3 }) into a single human-readable string for
 * the v2 CliErrorV2 hint field. T2.8 path (b): the lib/errors.ts
 * CliErrorV2 type carries `hint` as a single string, so structured
 * guard data is encoded as `key: value; key: value` pairs. Arrays are
 * comma-joined; objects are JSON-stringified as a fallback.
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
 * AC3 scalar formatters for the seven `mission` / `mission-state` /
 * `phase-review` / `mission-verdict` subcommands. Each renders a short
 * human-readable summary; full body via --json.
 */
function formatMissionCreate(data: unknown): string {
  const d = data as { path?: string; ids?: { mission_id?: string }; spec?: { name?: string; mode?: string } };
  return [
    `mission created: ${d.ids?.mission_id ?? '<unknown>'}`,
    `path: ${d.path ?? '<unknown>'}`,
    `name: ${d.spec?.name ?? '<unknown>'} mode: ${d.spec?.mode ?? '<unknown>'}`,
  ].join('\n');
}
function formatMissionApprove(data: unknown): string {
  const d = data as { ids?: { mission_id?: string }; already_approved?: boolean };
  return `mission approved: ${d.ids?.mission_id ?? '<unknown>'} already_approved=${Boolean(d.already_approved)}`;
}
function formatMissionDesignSet(data: unknown): string {
  const d = data as { path?: string; replaced?: boolean; bytes?: number };
  return `mission-design ${d.replaced ? 'replaced' : 'written'}: ${d.path ?? '<unknown>'} (${d.bytes ?? 0} bytes)`;
}
function formatMissionState(data: unknown): string {
  const d = data as {
    mission_id?: string;
    phase?: string | null;
    user_approved?: boolean;
    mode?: string | null;
    name?: string | null;
    approved_task_count?: number;
    open_task_count?: number;
    active_tasks?: string[];
  };
  const lines: string[] = [];
  lines.push(`mission: ${d.mission_id ?? '<unknown>'} phase=${d.phase ?? 'unknown'} mode=${d.mode ?? 'unknown'}`);
  lines.push(`name: ${d.name ?? '<unknown>'}`);
  lines.push(`approved: ${d.user_approved === true} approved_tasks=${d.approved_task_count ?? 0} open_tasks=${d.open_task_count ?? 0}`);
  const active = Array.isArray(d.active_tasks) ? d.active_tasks : [];
  lines.push(`active_tasks: ${active.length === 0 ? '(none)' : active.join(', ')}`);
  return lines.join('\n');
}
function formatMissionStateUpdate(data: unknown): string {
  const d = data as { ids?: { mission_id?: string }; phase?: { from?: string; to?: string } };
  return `mission phase: ${d.ids?.mission_id ?? '<unknown>'} ${d.phase?.from ?? '?'} -> ${d.phase?.to ?? '?'}`;
}
function formatPhaseReviewAppend(data: unknown): string {
  const d = data as { path?: string; ids?: { mission_id?: string; entry_index?: number }; entry?: { mission_phase?: string; status?: string; next_phase?: string } };
  return `phase-review appended: ${d.ids?.mission_id ?? '<unknown>'} index=${d.ids?.entry_index ?? '?'} phase=${d.entry?.mission_phase ?? '?'} status=${d.entry?.status ?? '?'} next=${d.entry?.next_phase ?? '?'}`;
}
function formatMissionVerdictAppend(data: unknown): string {
  const d = data as { path?: string; ids?: { mission_id?: string; entry_index?: number }; entry?: { verdict?: string } };
  return `mission-verdict appended: ${d.ids?.mission_id ?? '<unknown>'} index=${d.ids?.entry_index ?? '?'} verdict=${d.entry?.verdict ?? '?'}`;
}

function nowUtc(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
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

interface MissionCreateInlineOpts {
  file?: string;
  id?: string;
  name?: string;
  mode?: string;
  description?: string;
  descriptionFromFile?: string;
  definitionOfDone?: string;
  definitionOfDoneFromFile?: string;
  scopeIn?: string[];
  scopeOut?: string[];
  acceptanceCriterion?: string[];
  constraint?: string[];
  affectedSurface?: string[];
  risk?: string[];
  userApproved?: boolean;
}

/**
 * AC1 (task-006 verify-fix iteration 1): build a mission-spec payload
 * from inline Commander flags. Free-body fields (description,
 * definition-of-done) accept both --<field> inline and
 * --<field>-from-file path per AC1 wording. Returns null when no inline
 * flags are present, signaling the caller should fall back to --file or
 * stdin.
 */
function buildMissionCreatePayloadFromFlags(
  opts: MissionCreateInlineOpts,
): Record<string, unknown> | null {
  const inlineFlagPresent =
    opts.id !== undefined ||
    opts.name !== undefined ||
    opts.mode !== undefined ||
    opts.description !== undefined ||
    opts.descriptionFromFile !== undefined ||
    opts.definitionOfDone !== undefined ||
    opts.definitionOfDoneFromFile !== undefined ||
    (Array.isArray(opts.scopeIn) && opts.scopeIn.length > 0) ||
    (Array.isArray(opts.scopeOut) && opts.scopeOut.length > 0) ||
    (Array.isArray(opts.acceptanceCriterion) && opts.acceptanceCriterion.length > 0) ||
    (Array.isArray(opts.constraint) && opts.constraint.length > 0) ||
    (Array.isArray(opts.affectedSurface) && opts.affectedSurface.length > 0) ||
    (Array.isArray(opts.risk) && opts.risk.length > 0) ||
    opts.userApproved !== undefined;
  if (!inlineFlagPresent) return null;

  const payload: Record<string, unknown> = {};
  if (opts.id !== undefined) payload.id = opts.id;
  if (opts.name !== undefined) payload.name = opts.name;
  if (opts.mode !== undefined) payload.mode = opts.mode;
  if (opts.descriptionFromFile !== undefined) {
    try {
      payload.description = readPayloadText(opts.descriptionFromFile);
    } catch (e) {
      if (e instanceof StdinError) {
        emitErr(
          makeError('invalid_argument', e.message, {
            hint: 'pass --description <text> inline or --description-from-file <path>',
            exit_category: 'validation',
          }),
        );
      }
      throw e;
    }
  } else if (opts.description !== undefined) {
    payload.description = opts.description;
  }
  if (opts.definitionOfDoneFromFile !== undefined) {
    try {
      payload.definition_of_done = readPayloadText(opts.definitionOfDoneFromFile);
    } catch (e) {
      if (e instanceof StdinError) {
        emitErr(
          makeError('invalid_argument', e.message, {
            hint: 'pass --definition-of-done <text> inline or --definition-of-done-from-file <path>',
            exit_category: 'validation',
          }),
        );
      }
      throw e;
    }
  } else if (opts.definitionOfDone !== undefined) {
    payload.definition_of_done = opts.definitionOfDone;
  }
  // scope is required by schema; fill in/out if either provided.
  if (
    (Array.isArray(opts.scopeIn) && opts.scopeIn.length > 0) ||
    (Array.isArray(opts.scopeOut) && opts.scopeOut.length > 0)
  ) {
    payload.scope = {
      in: Array.isArray(opts.scopeIn) ? opts.scopeIn : [],
      out: Array.isArray(opts.scopeOut) ? opts.scopeOut : [],
    };
  }
  if (Array.isArray(opts.acceptanceCriterion) && opts.acceptanceCriterion.length > 0) {
    payload.acceptance_criteria = opts.acceptanceCriterion;
  }
  if (Array.isArray(opts.constraint)) payload.constraints = opts.constraint;
  if (Array.isArray(opts.affectedSurface)) payload.affected_surfaces = opts.affectedSurface;
  if (Array.isArray(opts.risk)) payload.risks = opts.risk;
  if (opts.userApproved !== undefined) payload.user_approved = opts.userApproved;
  return payload;
}

function registerMissionCreate(mission: Command): void {
  mission
    .command('create')
    .description(
      'Create a new mission from inline flags or JSON payload (--file or stdin). With inline flags only, builds the spec from --name/--mode/--description/--definition-of-done/--scope-in/--scope-out/--acceptance-criterion/etc. Use --description-from-file/--definition-of-done-from-file for prose-heavy free-body fields.',
    )
    .option('--id <id>', 'Mission id (auto-generated if absent)')
    .option('--name <name>', 'Short human-readable mission name')
    .option('--mode <mode>', 'Operating mode: lightweight, standard, or full_depth')
    .option('--description <text>', 'Mission description (free-body — short prose)')
    .option('--description-from-file <path>', 'Read description markdown/text from file (preferred for prose-heavy free-body)')
    .option('--definition-of-done <text>', 'Definition of done (free-body — short prose)')
    .option('--definition-of-done-from-file <path>', 'Read definition_of_done markdown/text from file')
    .option('--scope-in <surface...>', 'In-scope surfaces (repeatable)')
    .option('--scope-out <surface...>', 'Out-of-scope surfaces (repeatable)')
    .option('--acceptance-criterion <text...>', 'Acceptance criterion (repeatable)')
    .option('--constraint <text...>', 'Constraint (repeatable)')
    .option('--affected-surface <text...>', 'Affected surface (repeatable)')
    .option('--risk <text...>', 'Mission risk (repeatable)')
    .option('--user-approved', 'Mark spec as user_approved on create (defaults to false)')
    .option('--file <path>', 'Read full JSON payload from file (overrides inline flags) instead of stdin')
    .action((opts: MissionCreateInlineOpts) => {
      const root = needProjectRoot();

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
                hint: 'pass the JSON via --file <path> or use inline flags (--name, --mode, --description, ...)',
                exit_category: 'validation',
              }),
            );
          }
          throw e;
        }
      } else {
        const inline = buildMissionCreatePayloadFromFlags(opts);
        if (inline !== null) {
          payload = inline;
        } else {
          try {
            payload = readPayloadJson(undefined) as Record<string, unknown>;
          } catch (e) {
            if (e instanceof StdinError) {
              emitErr(
                makeError('invalid_argument', e.message, {
                  hint: 'use inline flags (--name, --mode, --description, ...) or pass the JSON via --file <path> or stdin',
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
          makeError('invalid_argument', 'mission create expects a JSON object payload', {
            hint: 'pass a single JSON object containing the mission spec fields, or use inline flags',
            exit_category: 'validation',
          }),
        );
      }

      // id is caller-supplied or CLI-generated.
      const providedId = typeof payload.id === 'string' ? payload.id : undefined;
      const missionId = providedId ?? generateMissionId();
      if (!isValidMissionId(missionId)) {
        emitErr(
          makeError('invalid_argument', `invalid mission id '${missionId}'`, {
            hint: "mission ids look like 'mission-YYYYMMDD-XXXXXXXX' (8 alphanumerics)",
            exit_category: 'validation',
          }),
        );
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
        emitErr(
          makeError(
            'path_collision',
            `mission spec already exists at ${slashPath(specPath)}`,
            {
              hint: `inspect the existing spec or pick a different mission id`,
              exit_category: 'validation',
            },
          ),
        );
      }

      const v = validate('mission-spec', payload);
      if (!v.ok) {
        emitErr(
          makeError(
            'schema_validation_failed',
            'mission-spec schema validation failed',
            {
              hint: 'inspect ajv errors to fix the payload, then retry',
              exit_category: 'validation',
            },
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

      emitOk('mission create', {
        path: slashPath(specPath),
        ids: { mission_id: missionId },
        spec: payload,
        state,
      });
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
        emitErr(
          makeError('invalid_argument', `invalid mission id '${opts.mission}'`, {
            hint: "mission ids look like 'mission-YYYYMMDD-XXXXXXXX' (8 alphanumerics)",
            exit_category: 'validation',
          }),
        );
      }
      const root = needProjectRoot();
      const specPath = missionSpecPath(root, opts.mission);
      const spec = readJsonFile<Record<string, unknown>>(specPath);
      if (!spec) {
        emitErr(
          makeError(
            'missing_artifact',
            `mission spec not found for ${opts.mission} at ${slashPath(specPath)}`,
            {
              hint: "run 'geas mission create' first or check the --mission id",
              exit_category: 'missing_artifact',
            },
          ),
        );
        return;
      }
      if (spec.user_approved === true) {
        emitOk('mission approve', {
          path: slashPath(specPath),
          ids: { mission_id: opts.mission },
          already_approved: true,
        });
        return;
      }
      spec.user_approved = true;
      spec.updated_at = nowUtc();

      const v = validate('mission-spec', spec);
      if (!v.ok) {
        emitErr(
          makeError(
            'schema_validation_failed',
            'mission-spec schema validation failed after setting user_approved',
            {
              hint: 'fix the spec body and re-run mission create, or restore from a prior version',
              exit_category: 'validation',
            },
          ),
        );
      }
      atomicWriteJson(specPath, spec, tmpDir(root));

      recordEvent(root, {
        kind: 'mission_approved',
        actor: 'user',
        payload: { mission_id: opts.mission, artifact: slashPath(specPath) },
      });

      emitOk('mission approve', {
        path: slashPath(specPath),
        ids: { mission_id: opts.mission },
        already_approved: false,
        spec,
      });
    });
}

// ── `geas mission design-set` ──────────────────────────────────────────

function registerMissionDesignSet(mission: Command): void {
  mission
    .command('design-set')
    .description(
      'Write mission-design.md from --file or stdin (atomic full-replace). Allowed only during specifying phase, after the spec is user_approved.',
    )
    .requiredOption('--mission <id>', 'Mission ID')
    .option('--file <path>', 'Read markdown from file instead of stdin (preferred for prose-heavy payloads)')
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

      const specPath = missionSpecPath(root, opts.mission);
      const spec = readJsonFile<Record<string, unknown>>(specPath);
      if (!spec) {
        emitErr(
          makeError(
            'missing_artifact',
            `mission spec not found for ${opts.mission} at ${slashPath(specPath)}`,
            {
              hint: "run 'geas mission create' first or check the --mission id",
              exit_category: 'missing_artifact',
            },
          ),
        );
        return;
      }
      if (spec.user_approved !== true) {
        emitErr(
          makeError(
            'guard_failed',
            `mission spec is not user_approved`,
            {
              hint: `run 'geas mission approve --mission ${opts.mission}' first`,
              exit_category: 'guard',
            },
          ),
        );
        return;
      }

      const statePath = missionStatePath(root, opts.mission);
      const state = readJsonFile<Record<string, unknown>>(statePath);
      if (!state) {
        emitErr(
          makeError(
            'missing_artifact',
            `mission-state not found for ${opts.mission} at ${slashPath(statePath)}`,
            {
              hint: 'mission-state is created automatically by mission create; check the --mission id or restore the artifact',
              exit_category: 'missing_artifact',
            },
          ),
        );
        return;
      }
      const phase = typeof state.phase === 'string' ? state.phase : null;
      if (phase !== 'specifying') {
        emitErr(
          makeError(
            'guard_failed',
            `mission-design is immutable after specifying phase; current phase is '${phase ?? 'unknown'}'`,
            {
              hint: 'roll the mission back to specifying via a passed phase-review if a design rewrite is required',
              exit_category: 'guard',
            },
          ),
        );
        return;
      }

      let content: string;
      try {
        content = readPayloadText(opts.file);
      } catch (e) {
        if (e instanceof StdinError) {
          emitErr(
            makeError('invalid_argument', e.message, {
              hint: 'pass the markdown via --file <path> or pipe through stdin',
              exit_category: 'validation',
            }),
          );
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

      emitOk('mission design-set', {
        path: slashPath(designPath),
        ids: { mission_id: opts.mission },
        replaced: wasPresent,
        bytes: Buffer.byteLength(content, 'utf-8'),
      });
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
        emitErr(
          makeError('invalid_argument', `invalid mission id '${opts.mission}'`, {
            hint: "mission ids look like 'mission-YYYYMMDD-XXXXXXXX' (8 alphanumerics)",
            exit_category: 'validation',
          }),
        );
      }
      const root = needProjectRoot();
      const spec = readJsonFile<Record<string, unknown>>(
        missionSpecPath(root, opts.mission),
      );
      if (!spec) {
        emitErr(
          makeError('missing_artifact', `mission spec not found for ${opts.mission}`, {
            hint: "run 'geas mission create' first or check the --mission id",
            exit_category: 'missing_artifact',
          }),
        );
        return;
      }
      const state = readJsonFile<Record<string, unknown>>(
        missionStatePath(root, opts.mission),
      );
      const approvedTasks = countApprovedTasks(root, opts.mission);
      const openTasks = countOpenTasks(root, opts.mission);

      emitOk('mission state', {
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
      });
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
        emitErr(
          makeError('invalid_argument', `invalid mission id '${opts.mission}'`, {
            hint: "mission ids look like 'mission-YYYYMMDD-XXXXXXXX' (8 alphanumerics)",
            exit_category: 'validation',
          }),
        );
      }
      if (!opts.phase) {
        emitErr(
          makeError(
            'invalid_argument',
            'mission-state update requires --phase <phase>',
            {
              hint: 'pass --phase with one of: specifying, building, polishing, consolidating, complete',
              exit_category: 'validation',
            },
          ),
        );
        return;
      }
      if (!isValidMissionPhase(opts.phase)) {
        emitErr(
          makeError('invalid_argument', `unknown phase '${opts.phase}'`, {
            hint: 'valid phases: specifying, building, polishing, consolidating, complete',
            exit_category: 'validation',
          }),
        );
      }

      const root = needProjectRoot();
      const statePath = missionStatePath(root, opts.mission);
      const state = readJsonFile<Record<string, unknown>>(statePath);
      if (!state) {
        emitErr(
          makeError(
            'missing_artifact',
            `mission-state.json not found for ${opts.mission}`,
            {
              hint: 'mission-state is created automatically by mission create; check the --mission id',
              exit_category: 'missing_artifact',
            },
          ),
        );
        return;
      }
      const spec = readJsonFile<Record<string, unknown>>(
        missionSpecPath(root, opts.mission),
      );
      if (!spec) {
        emitErr(
          makeError('missing_artifact', `mission spec not found for ${opts.mission}`, {
            hint: "run 'geas mission create' first or check the --mission id",
            exit_category: 'missing_artifact',
          }),
        );
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
        emitErr(
          makeError('guard_failed', guard.reason, {
            hint: foldGuardHint(guard.hints) ?? 'check the mission spec, prior phase-review, and open task count',
            exit_category: 'guard',
          }),
        );
      }

      const ts = nowUtc();
      state.phase = to;
      state.updated_at = ts;
      if (!state.created_at) state.created_at = ts;
      state.mission_id = opts.mission;

      const v = validate('mission-state', state);
      if (!v.ok) {
        emitErr(
          makeError(
            'schema_validation_failed',
            'mission-state schema validation failed',
            {
              hint: 'inspect ajv errors and reconcile the on-disk state with the schema',
              exit_category: 'validation',
            },
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

      emitOk('mission-state update', {
        path: slashPath(statePath),
        ids: { mission_id: opts.mission },
        phase: { from, to },
        state,
      });
    });
}

// ── `geas phase-review append` ─────────────────────────────────────────

function registerPhaseReviewAppend(program: Command): void {
  const pr = program
    .command('phase-review')
    .description('phase-reviews.json append operation (mission phase gate records)');

  pr
    .command('append')
    .description('Append a phase-review entry (JSON via --file or stdin). Mission-scoped.')
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

      let entry: Record<string, unknown>;
      try {
        entry = readPayloadJson(opts.file) as Record<string, unknown>;
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
        emitErr(
          makeError(
            'schema_validation_failed',
            'phase-reviews schema validation failed',
            {
              hint: 'inspect ajv errors and fix the entry body, then retry',
              exit_category: 'validation',
            },
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

      emitOk('phase-review append', {
        path: slashPath(p),
        ids: { mission_id: opts.mission, entry_index: updated.reviews.length - 1 },
        entry,
      });
    });
}

// ── `geas mission-verdict append` ──────────────────────────────────────

function registerMissionVerdictAppend(program: Command): void {
  const mv = program
    .command('mission-verdict')
    .description('mission-verdicts.json append operation (Decision Maker closure)');

  mv
    .command('append')
    .description('Append a mission-verdict entry (JSON via --file or stdin).')
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

      let entry: Record<string, unknown>;
      try {
        entry = readPayloadJson(opts.file) as Record<string, unknown>;
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
        emitErr(
          makeError(
            'schema_validation_failed',
            'mission-verdicts schema validation failed',
            {
              hint: 'inspect ajv errors and fix the entry body, then retry',
              exit_category: 'validation',
            },
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

      emitOk('mission-verdict append', {
        path: slashPath(p),
        ids: {
          mission_id: opts.mission,
          entry_index: updated.verdicts.length - 1,
        },
        entry,
      });
    });
}

// ── Entry point ────────────────────────────────────────────────────────

export function registerMissionCommands(program: Command): void {
  registerFormatter('mission create', formatMissionCreate);
  registerFormatter('mission approve', formatMissionApprove);
  registerFormatter('mission design-set', formatMissionDesignSet);
  registerFormatter('mission state', formatMissionState);
  registerFormatter('mission-state update', formatMissionStateUpdate);
  registerFormatter('phase-review append', formatPhaseReviewAppend);
  registerFormatter('mission-verdict append', formatMissionVerdictAppend);

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
