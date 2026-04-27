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
 * Emit a successful response. In JSON mode (T2 default) writes a
 * `{ok:true,data}` envelope on stdout and exits 0. In scalar mode looks
 * up a formatter for `commandName`; if none is registered, falls back
 * to the JSON envelope (T2 invariant — keeps existing tests green).
 *
 * Always exits the process. Callers should not place code after this
 * call expecting it to run.
 */
export function emitOk(commandName: string, data: unknown): never {
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
  process.exit(0);
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
  const state = getOutputMode();
  const exitCode = exitCodeForCategory(error.exit_category);
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
  process.exit(exitCode);
}
