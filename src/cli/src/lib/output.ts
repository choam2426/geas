/**
 * CLI output formatter (T2 / mission-20260426-DbFKlpAr).
 *
 * Two-mode emission:
 *
 *   - JSON mode  (--json or T2 default)            single-line envelope
 *                                                  on stdout
 *   - Scalar mode (T3 default once a formatter is  human-readable text on
 *                  registered for the command)     stdout, hint+message
 *                                                  on stderr for errors
 *
 * In T2 the formatter registry is intentionally empty — no command has
 * registered a scalar formatter yet, so even when scalar mode is the
 * "preferred" mode `emitOk()` will fall back to JSON-envelope output.
 * This is what keeps the 147 existing tests green: command stdout shape
 * remains a `{ok:true,data}` JSON envelope until T3 starts registering
 * per-command scalar formatters.
 *
 * Module-level mutable state (the registry and the active mode) is
 * intentional: this module is a lifecycle singleton. main.ts captures
 * global flags pre-subcommand and calls `setOutputMode()` exactly once
 * per process invocation; subcommand action handlers later read the
 * resolved mode via `getOutputMode()`.
 */

import { exitCodeForCategory, type CliErrorV2 } from './errors';

// ── Output mode ───────────────────────────────────────────────────────

/**
 * Resolved output mode for the current process invocation. `default`
 * means "no mode flag was given"; `json` means `--json` was present.
 * The two are kept distinct so T3 can give them different per-command
 * treatments (default may flip to scalar text once a formatter is
 * registered; --json remains a forced JSON-envelope opt-in).
 */
export type OutputMode = 'default' | 'json';

/**
 * Resolved output state captured from the global flag layer. `verbose`
 * and `debug` are independent toggles that compose with mode (e.g.
 * `--json --debug` = pretty-indented JSON envelope, --verbose alone
 * surfaces extra context in scalar mode but does not change shape).
 */
export interface OutputState {
  mode: OutputMode;
  verbose: boolean;
  debug: boolean;
}

let activeState: OutputState = {
  mode: 'default',
  verbose: false,
  debug: false,
};

/**
 * Replace the active output state. Called by main.ts at process startup
 * after the global Commander hook has captured `--json`/`--verbose`/
 * `--debug`. Pure setter — no side effects beyond updating the singleton.
 */
export function setOutputMode(state: Partial<OutputState>): void {
  activeState = {
    mode: state.mode ?? activeState.mode,
    verbose: state.verbose ?? activeState.verbose,
    debug: state.debug ?? activeState.debug,
  };
}

/** Snapshot of the current output state. */
export function getOutputMode(): OutputState {
  return { ...activeState };
}

/**
 * True when the output layer should produce a JSON envelope. In T2 this
 * is always true: `default` is treated as JSON (preserves existing
 * behavior), `json` is explicit JSON. T3 will flip `default` to scalar
 * once per-command formatters are registered.
 *
 * Exported so envelope.ts can route `emit()` through the same decision.
 */
export function getEffectiveJsonMode(): boolean {
  if (activeState.mode === 'json') return true;
  // T2 invariant: default == JSON until T3 registers scalar formatters.
  return true;
}

// ── Formatter registry ────────────────────────────────────────────────

/**
 * Per-command scalar formatter. Receives the success-envelope `data`
 * payload, returns a string suitable for stdout. T3 will register one
 * per command surface.
 */
export type ScalarFormatter = (data: unknown) => string;

const formatterRegistry = new Map<string, ScalarFormatter>();

/**
 * Register a scalar formatter for a command name. The command name is
 * the canonical name string used by Commander (e.g. 'context',
 * 'mission create', 'task transition').
 *
 * Re-registration replaces silently — this is a single-process registry;
 * a duplicate registration in the same process indicates a wiring bug,
 * but the runtime cost of asserting it is higher than the diagnostic
 * value.
 */
export function registerFormatter(commandName: string, fn: ScalarFormatter): void {
  formatterRegistry.set(commandName, fn);
}

/**
 * Look up a formatter for a command. Returns undefined when no formatter
 * is registered, which is the normal case in T2 (registry is empty).
 */
export function lookupFormatter(commandName: string): ScalarFormatter | undefined {
  return formatterRegistry.get(commandName);
}

/**
 * Test-only helper to wipe the registry. Not exported through any public
 * surface other than tests; callers should not rely on it in production
 * code paths.
 */
export function _clearFormatterRegistry(): void {
  formatterRegistry.clear();
}

// ── Emit ──────────────────────────────────────────────────────────────

function jsonStringify(value: unknown, debug: boolean): string {
  return debug ? JSON.stringify(value, null, 2) : JSON.stringify(value);
}

/**
 * Non-exiting variant of {@link emitOk}'s output write. Performs the
 * stdout emission step (formatter lookup + JSON-fallback + trailing
 * newline) but does NOT call process.exit. Exposed so the legacy
 * envelope.ts bridge can route success-path emission through the same
 * OutputState-aware logic without losing control of the exit step.
 *
 * Callers that just want the standard "emit + exit 0" semantics should
 * prefer {@link emitOk}. The split exists for the bridge layer only.
 */
export function writeOkEnvelope(commandName: string, data: unknown): void {
  const state = getOutputMode();
  const useJson = state.mode === 'json' || !lookupFormatter(commandName);
  if (useJson) {
    process.stdout.write(jsonStringify({ ok: true, data }, state.debug) + '\n');
  } else {
    const fmt = lookupFormatter(commandName);
    // The lookupFormatter check above guarantees fmt is defined here, but
    // narrow defensively to keep TypeScript happy under strict mode.
    const text = fmt ? fmt(data) : jsonStringify({ ok: true, data }, state.debug);
    process.stdout.write(text.endsWith('\n') ? text : text + '\n');
  }
}

/**
 * Emit a successful response. In JSON mode (T2 default) writes a
 * `{ok:true,data}` envelope on stdout and exits 0. In scalar mode looks
 * up a formatter for `commandName`; if none is registered, falls back
 * to the JSON envelope (T2 invariant — keeps existing tests green).
 *
 * Always exits the process. Callers should not place code after this
 * call expecting it to run.
 */
export function emitOk(commandName: string, data: unknown): never {
  writeOkEnvelope(commandName, data);
  process.exit(0);
}

/**
 * Non-exiting variant of {@link emitErr}'s output write. Performs the
 * mode-aware stdout (JSON envelope) or stderr (scalar) emission but does
 * NOT call process.exit. Exposed so the legacy envelope.ts bridge can
 * decide its own exit code (legacy {@link
 * import('./envelope').EXIT_CODES} integer) while still routing the
 * stdout shape through the unified output layer's debug + mode logic.
 *
 * Callers that just want the standard "emit + exit per category"
 * semantics should prefer {@link emitErr}.
 */
export function writeErrEnvelope(error: CliErrorV2): void {
  const state = getOutputMode();
  if (state.mode === 'json' || state.mode === 'default') {
    // T2: default also goes through JSON for back-compat. T3 will
    // switch the default branch to scalar stderr+stdout once the
    // command surfaces are migrated.
    const payload: { ok: false; error: { code: string; message: string; hint?: string } } = {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
      },
    };
    if (error.hint !== undefined) {
      payload.error.hint = error.hint;
    }
    process.stdout.write(jsonStringify(payload, state.debug) + '\n');
  } else {
    process.stderr.write(`error: ${error.message}\n`);
    if (error.hint !== undefined) {
      process.stderr.write(`hint: ${error.hint}\n`);
    }
  }
}

/**
 * Emit an error response. In JSON mode writes a
 * `{ok:false,error:{code,message,hint?}}` envelope on stdout and exits
 * with the per-category exit code. In scalar mode writes a one-line
 * `error: <message>` plus optional `hint: <hint>` on stderr.
 *
 * Always exits the process. The exit code is derived from
 * `error.exit_category` via `exitCodeForCategory()` — callers cannot
 * override it.
 */
export function emitErr(error: CliErrorV2): never {
  writeErrEnvelope(error);
  process.exit(exitCodeForCategory(error.exit_category));
}

/**
 * Write a legacy-shaped error envelope. Distinct from
 * {@link writeErrEnvelope} because the legacy envelope (envelope.ts
 * `err()`) carries a `hints` (plural, free-form) field rather than the
 * v2 `hint` (singular string) field, and emits the legacy `ErrorCode`
 * tag verbatim. The bridge in envelope.ts calls this so 17 unmigrated
 * commands continue to produce byte-identical stdout — it only routes
 * the OutputState debug-mode pretty-print through this layer.
 *
 * Does NOT call process.exit. The bridge picks the legacy
 * `EXIT_CODES[code]` integer itself, preserving the T1 invariant
 * "external exit code values unchanged at T1 merge" (mission-design
 * Decision 1, Option A).
 *
 * Wider note: this writer is a transitional artifact. Once all 17
 * commands migrate to `makeError` + `emitErr` (T2 batches), this writer
 * loses its caller and is removed in T5 alongside legacy `EXIT_CODES`
 * (mission-design Decision 12, A3 binary verification fixture).
 */
export function writeLegacyErrEnvelope(envelope: {
  ok: false;
  error: { code: string; message: string; hints?: unknown };
}): void {
  const state = getOutputMode();
  process.stdout.write(jsonStringify(envelope, state.debug) + '\n');
}
