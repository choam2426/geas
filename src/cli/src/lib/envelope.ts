/**
 * Output envelope and events.jsonl auto-append.
 *
 * Every CLI command emits one of two JSON objects on stdout:
 *
 *   { "ok": true,  "data": { ... } }
 *   { "ok": false, "error": { code, message, hints? } }
 *
 * Write-path commands (mutations) additionally append an event to
 * `.geas/events.jsonl` via recordEvent(). Read-only commands do not.
 *
 * Event scope:
 *   Every mutation command that advances the protocol emits an event —
 *   state transitions, approvals, artifact appends, AND single-artifact
 *   set operations (mission-design-set, impl-contract set, memory
 *   shared-set / agent-set, gap set, memory-update set). The authoritative
 *   event-kind table lives in `docs/reference/HOOKS.md §4.2`.
 *
 * Failure policy (best-effort):
 *   `recordEvent()` swallows every error. The primary artifact write is
 *   atomic and runs first; the event append runs after. If the event
 *   append fails (disk full, transient permission error), the command
 *   still returns `ok` — rolling back the already-committed artifact
 *   write would be worse than a missing telemetry line. See CLI.md
 *   §14.6 and HOOKS.md §4.3.
 *
 * Exit codes follow CLI.md §5:
 *   0 success
 *   1 invalid_argument / internal_error
 *   2 schema_validation_failed
 *   3 guard_failed
 *   4 io_error
 *   5 append_only_violation
 */

import * as fs from 'fs';
import * as path from 'path';

import { appendJsonl } from './fs-atomic';
import { writeLegacyErrEnvelope, writeOkEnvelope } from './output';
import { eventsPath } from './paths';

export type ErrorCode =
  | 'schema_validation_failed'
  | 'guard_failed'
  | 'append_only_violation'
  | 'path_collision'
  | 'missing_artifact'
  | 'invalid_argument'
  | 'io_error'
  | 'internal_error';

export interface CliError {
  code: ErrorCode;
  message: string;
  hints?: unknown;
}

export interface OkEnvelope<T = unknown> {
  ok: true;
  data: T;
}

export interface ErrEnvelope {
  ok: false;
  error: CliError;
}

export type Envelope<T = unknown> = OkEnvelope<T> | ErrEnvelope;

const EXIT_CODES: Record<ErrorCode, number> = {
  schema_validation_failed: 2,
  guard_failed: 3,
  append_only_violation: 5,
  path_collision: 1,
  missing_artifact: 1,
  invalid_argument: 1,
  io_error: 4,
  internal_error: 1,
};

export function ok<T>(data: T): OkEnvelope<T> {
  return { ok: true, data };
}

export function err(code: ErrorCode, message: string, hints?: unknown): ErrEnvelope {
  return { ok: false, error: hints !== undefined ? { code, message, hints } : { code, message } };
}

/**
 * Print `envelope` on stdout (JSON, trailing newline) and exit with the
 * appropriate code.
 *
 * T1 bridge (mission-20260427-xIPG1sDY task-001, Option A): the body of
 * this function delegates the stdout write to the unified output layer
 * (`lib/output.ts`) so all 17 unmigrated commands share the same
 * OutputState-aware emission — debug pretty-print, mode handling, and
 * any future formatter dispatch live in one place. The exit code,
 * however, is still picked from the legacy {@link EXIT_CODES} table so
 * external consumers (test fixtures, hook scripts, the bundled launcher)
 * see byte-identical behavior at T1 merge. The new five-category exit
 * codes (`lib/errors.EXIT_CATEGORY_CODE`) only take effect when a
 * command migrates its call sites to `makeError` + `emitErr` directly
 * (T2 batches).
 *
 * The error path still emits the legacy envelope shape
 * `{ok:false, error:{code, message, hints?}}` (note: `hints` plural) —
 * the v2 layer uses `hint` (singular) so we cannot funnel through
 * `output.emitErr` without changing observable JSON. {@link
 * writeLegacyErrEnvelope} is the transitional helper that preserves the
 * legacy field naming while still flowing through the OutputState-aware
 * stdout writer.
 */
export function emit(envelope: Envelope): never {
  if (envelope.ok) {
    // commandName is unused in JSON mode (which is the T2 invariant
    // until per-command scalar formatters land); pass an empty string so
    // formatter lookup misses and the JSON-envelope fallback fires —
    // identical to the pre-bridge behavior.
    writeOkEnvelope('', envelope.data);
    process.exit(0);
  }
  writeLegacyErrEnvelope(envelope);
  process.exit(EXIT_CODES[envelope.error.code] ?? 1);
}

// ── Event log ─────────────────────────────────────────────────────────

/**
 * Valid actor values for events.jsonl entries:
 *   - kebab-case slot identifiers from the protocol (orchestrator,
 *     decision-maker, design-authority, challenger, implementer,
 *     verifier, risk-assessor, operator, communicator)
 *   - `user` — a human decision reflected into the log
 *   - `cli:auto` — the CLI itself; the `:` is a namespace prefix
 *     exception documented in CLI.md §14.7 because events.jsonl is an
 *     implementation aux log, not a canonical protocol artifact.
 */
const SLOT_ACTORS = [
  'decision-maker',
  'orchestrator',
  'design-authority',
  'challenger',
  'implementer',
  'verifier',
  'risk-assessor',
  'operator',
  'communicator',
];
const SPECIAL_ACTORS = ['user', 'cli:auto'];

/** Loose kebab-case check for slot ids. */
const SLOT_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function isValidActor(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (SPECIAL_ACTORS.includes(value)) return true;
  if (SLOT_ACTORS.includes(value)) return true;
  // Accept any kebab-case slot id (protocol v3 uses kebab-case slot ids).
  return SLOT_RE.test(value);
}

/**
 * Compute the next entry_id by scanning the tail of events.jsonl. The
 * file is append-only so the last valid JSON line carries the highest
 * entry_id. Missing file → starts at 1. Failure to read → starts at 1
 * (best-effort; event logging never rolls back the caller).
 */
function nextEntryId(filePath: string): number {
  try {
    if (!fs.existsSync(filePath)) return 1;
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content) return 1;
    const lines = content.split('\n').filter((l) => l.length > 0);
    let maxId = 0;
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed && typeof parsed.entry_id === 'number' && parsed.entry_id > maxId) {
          maxId = parsed.entry_id;
        }
      } catch {
        // skip malformed lines
      }
    }
    return maxId + 1;
  } catch {
    return 1;
  }
}

export interface RecordEventInput {
  kind: string;
  actor: string;
  /** Optional — mission this event scopes to. */
  mission_id?: string;
  /** Optional — task this event scopes to. */
  task_id?: string;
  /** Optional — implementation-dependent payload. */
  payload?: Record<string, unknown>;
  /** Optional — artifact path the event references (one-way link). */
  ref?: string;
}

/**
 * Append a single event to `.geas/events.jsonl`. Intended for mutation
 * commands that log protocol-level waypoints (state transitions,
 * approvals, artifact appends). The CLI owns:
 *
 *   - `entry_id` — monotonic, 1-based, assigned by scanning the file.
 *   - `created_at` — server-assigned ISO 8601 UTC; any caller-supplied
 *     timestamp is ignored.
 *
 * Never throws — I/O failure is swallowed so that event logging cannot
 * roll back the primary atomic write. Invalid `actor` values are
 * rejected silently (event is dropped, caller continues). This
 * preserves the automation-only guarantee in DESIGN.md.
 */
export function recordEvent(
  projectRoot: string,
  event: RecordEventInput | Record<string, unknown>,
): void {
  try {
    const filePath = eventsPath(projectRoot);
    const kind = typeof (event as RecordEventInput).kind === 'string'
      ? (event as RecordEventInput).kind
      : undefined;
    const actor = (event as RecordEventInput).actor;
    if (!kind) return;
    if (!isValidActor(actor)) return;

    // Assemble deterministic field order; strip any caller timestamp /
    // entry_id so only the CLI can set them.
    const { entry_id: _ignoredId, created_at: _ignoredTs, ...rest } = event as Record<
      string,
      unknown
    >;
    void _ignoredId;
    void _ignoredTs;

    const entry: Record<string, unknown> = {
      entry_id: nextEntryId(filePath),
      kind,
      actor,
      created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      ...rest,
    };
    appendJsonl(filePath, entry);
  } catch {
    // Best-effort: never fail the command for event logging.
  }
}

/**
 * Internal helper exported for tests — returns the absolute path to
 * events.jsonl for a project root. Re-exports the builder so test
 * modules don't need to depend on paths.ts directly.
 */
export function eventsFilePath(projectRoot: string): string {
  return path.resolve(eventsPath(projectRoot));
}
