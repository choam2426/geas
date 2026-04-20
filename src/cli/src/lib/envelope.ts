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
 * Exit codes follow CLI.md §5:
 *   0 success
 *   1 invalid_argument / internal_error
 *   2 schema_validation_failed
 *   3 guard_failed
 *   4 io_error
 *   5 append_only_violation
 */

import { appendJsonl } from './fs-atomic';
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
 */
export function emit(envelope: Envelope): never {
  process.stdout.write(JSON.stringify(envelope) + '\n');
  if (envelope.ok) process.exit(0);
  process.exit(EXIT_CODES[envelope.error.code] ?? 1);
}

/**
 * Append a single event to `.geas/events.jsonl`. Intended for mutation
 * commands that want to log an automation-scope event. Never throws —
 * I/O failure is swallowed so that event logging cannot roll back the
 * primary write (protocol 08 / CLI.md §14.7).
 */
export function recordEvent(
  projectRoot: string,
  event: Record<string, unknown>,
): void {
  const enriched = {
    created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    ...event,
  };
  try {
    appendJsonl(eventsPath(projectRoot), enriched);
  } catch {
    // Best-effort: never fail the command for event logging.
  }
}
