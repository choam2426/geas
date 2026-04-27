/**
 * CLI error framework (T2 / mission-20260426-DbFKlpAr).
 *
 * This module introduces the v2 error shape that command surfaces will
 * migrate to in T3:
 *
 *   { code, message, hint, exit_category }
 *
 * `code` stays a free-form string tag (e.g. 'guard_failed',
 * 'missing_artifact', 'task_not_found') so commands can pick descriptive
 * tags without growing a central union every time. `exit_category` is the
 * structured routing field that maps to a process exit code:
 *
 *   validation       -> 2
 *   guard            -> 3
 *   missing_artifact -> 4
 *   io               -> 5
 *   internal         -> 1
 *
 * The legacy `ErrorCode` union and `EXIT_CODES` map in `envelope.ts` are
 * preserved unchanged — every command currently using them keeps the same
 * exit codes and JSON shape. Commands migrating to the new shape will
 * import from this module instead.
 *
 * Nothing in this module performs I/O or calls process.exit. The output
 * layer (lib/output.ts) is what consumes these values to actually emit
 * an error envelope and exit.
 */

/**
 * Routing category for any error surfaced to the user. Maps 1:1 onto a
 * process exit code via {@link EXIT_CATEGORY_CODE}.
 */
export type ExitCategory =
  | 'validation'
  | 'guard'
  | 'missing_artifact'
  | 'io'
  | 'internal';

/**
 * Mapping from {@link ExitCategory} to process exit code. Locked in by the
 * mission spec acceptance criterion AC3.
 *
 * The values are intentionally distinct from the legacy `EXIT_CODES`
 * table in envelope.ts (which is keyed on the legacy ErrorCode union)
 * because they encode the new five-category routing model rather than
 * the historical eight-code one. Concretely the only mismatch is
 * io=5 here vs append_only_violation=5 + io_error=4 in the legacy
 * table — T3 will reconcile per command as it migrates.
 */
export const EXIT_CATEGORY_CODE: Record<ExitCategory, number> = {
  validation: 2,
  guard: 3,
  missing_artifact: 4,
  io: 5,
  internal: 1,
};

/**
 * Resolve a process exit code for a given category. Unknown categories
 * fall through to `internal` (= 1) — chosen so any unexpected value
 * surfaces as a generic internal failure rather than silently mapping to
 * "success".
 */
export function exitCodeForCategory(category: ExitCategory | string): number {
  if (Object.prototype.hasOwnProperty.call(EXIT_CATEGORY_CODE, category)) {
    return EXIT_CATEGORY_CODE[category as ExitCategory];
  }
  return EXIT_CATEGORY_CODE.internal;
}

/**
 * The new error envelope payload. `hint` is REQUIRED at the protocol level
 * (mission AC3 — "every error must include a one-line next-action hint"),
 * but the type marks it optional so call sites can omit it during the T3
 * migration sweep where the verifier will catch missing hints separately.
 */
export interface CliErrorV2 {
  code: string;
  message: string;
  hint?: string;
  exit_category: ExitCategory;
}

/**
 * Optional fields for {@link makeError}. `code` and `message` are positional
 * required arguments; everything else lives here.
 */
export interface MakeErrorOptions {
  hint?: string;
  exit_category?: ExitCategory;
}

/**
 * Construct a {@link CliErrorV2}. Defaults `exit_category` to `internal`
 * when omitted — call sites that don't know which category they are in
 * should not be silently downgraded to a softer exit code.
 */
export function makeError(
  code: string,
  message: string,
  options: MakeErrorOptions = {},
): CliErrorV2 {
  const error: CliErrorV2 = {
    code,
    message,
    exit_category: options.exit_category ?? 'internal',
  };
  if (options.hint !== undefined) {
    error.hint = options.hint;
  }
  return error;
}

/**
 * Throwable carrier for the v2 error shape. T3 will use this to flow
 * errors out of nested command logic via `throw` instead of explicit
 * `emit(err(...))` chains, then catch at the command boundary and feed
 * into the output layer.
 *
 * Carries the same fields as {@link CliErrorV2} so call sites can rethrow
 * or unwrap to a plain object via {@link cliErrorFromException}.
 */
export class CliErrorWithExit extends Error {
  readonly code: string;
  readonly hint?: string;
  readonly exit_category: ExitCategory;

  constructor(payload: CliErrorV2) {
    super(payload.message);
    this.name = 'CliErrorWithExit';
    this.code = payload.code;
    this.exit_category = payload.exit_category;
    if (payload.hint !== undefined) {
      this.hint = payload.hint;
    }
    // Preserve prototype chain across transpilation targets that drop it.
    Object.setPrototypeOf(this, CliErrorWithExit.prototype);
  }

  /** Plain-object form, suitable for direct emission. */
  toEnvelope(): CliErrorV2 {
    return makeError(this.code, this.message, {
      hint: this.hint,
      exit_category: this.exit_category,
    });
  }
}

/**
 * Type guard for {@link CliErrorWithExit} that survives `instanceof`
 * brittleness across module boundaries (esbuild bundling can produce
 * multiple Error subclass instances if a module is duplicated). Falls
 * back to a structural check on the carrier fields.
 */
export function isCliErrorWithExit(value: unknown): value is CliErrorWithExit {
  if (value instanceof CliErrorWithExit) return true;
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.code === 'string' &&
    typeof v.message === 'string' &&
    typeof v.exit_category === 'string'
  );
}

/**
 * Best-effort unwrap from an arbitrary thrown value into the v2 shape.
 * Anything that already looks like a {@link CliErrorV2} is normalized;
 * vanilla `Error` instances become `internal`-category errors with the
 * Error.message as the surfaced message. Useful at the command boundary
 * so unexpected throws still fall through the unified output path.
 */
export function cliErrorFromException(value: unknown): CliErrorV2 {
  if (isCliErrorWithExit(value)) {
    const carrier = value as CliErrorWithExit;
    return makeError(carrier.code, carrier.message, {
      hint: carrier.hint,
      exit_category: carrier.exit_category,
    });
  }
  if (value instanceof Error) {
    return makeError('internal_error', value.message, {
      exit_category: 'internal',
    });
  }
  return makeError('internal_error', String(value), {
    exit_category: 'internal',
  });
}
