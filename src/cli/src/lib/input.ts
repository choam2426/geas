/**
 * Input data reading utilities for the Geas CLI.
 *
 * Stdin-only JSON input: write commands take structured data exclusively
 * through piped stdin. Inline --data / file-path --file flags were removed
 * in the stdin-only refactor (mission-20260411-bsNjhUbb task-001).
 *
 * Non-JSON value flags such as `event log --data`, `context write --data`,
 * and `packet create --file/--content` are NOT affected by this module.
 */

import * as fs from 'fs';

/**
 * NO_STDIN error code — thrown when readInputData() cannot obtain JSON
 * from stdin. Callers that support alternate input paths (e.g. `evidence add`
 * with --set) should catch errors whose `.code === 'NO_STDIN'`.
 */
export const NO_STDIN = 'NO_STDIN' as const;

/**
 * stderr-ready examples for how to pipe JSON into a geas CLI write command.
 */
const NO_STDIN_EXAMPLES: readonly string[] = [
  "heredoc:      geas <cmd> <<'JSON'\n                {\"key\": \"value\"}\n                JSON",
  'pipe:         echo \'{"key":"value"}\' | geas <cmd>',
  'redirection:  geas <cmd> < payload.json',
];

/**
 * Build a NO_STDIN error. The message is structured so the top-level CLI
 * handler can print it verbatim and exit non-zero without hanging.
 */
function noStdinError(reason: string): NodeJS.ErrnoException {
  const lines = [
    `No JSON on stdin: ${reason}`,
    'Write commands require JSON piped via stdin. Examples:',
    ...NO_STDIN_EXAMPLES.map((e) => `  ${e}`),
  ];
  const err = new Error(lines.join('\n')) as NodeJS.ErrnoException;
  err.code = NO_STDIN;
  return err;
}

/**
 * Best-effort line/column hint extraction from a V8 JSON SyntaxError message.
 * V8 formats: "Unexpected token X in JSON at position N".
 * If the regex fails (non-V8 engine or altered message), returns an empty
 * hint and the caller will surface the raw parser message instead.
 */
function computeJsonLineHint(raw: string, err: SyntaxError): string {
  const msg = err.message;
  const posMatch = /position\s+(\d+)/.exec(msg);
  if (!posMatch) {
    // Fallback: no position info — just rethrow parser message as-is.
    return msg;
  }
  const pos = parseInt(posMatch[1], 10);
  if (!Number.isFinite(pos) || pos < 0) {
    return msg;
  }
  // Compute 1-indexed line and column by scanning raw[0..pos).
  let line = 1;
  let col = 1;
  const scanEnd = Math.min(pos, raw.length);
  for (let i = 0; i < scanEnd; i++) {
    if (raw.charCodeAt(i) === 0x0a /* \n */) {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return `${msg} (line ${line}, column ${col})`;
}

/**
 * Read JSON input from piped stdin and return the parsed value.
 *
 * Behavior:
 *  - If `process.stdin.isTTY === true` (interactive terminal), throws a
 *    NO_STDIN error immediately; never blocks waiting for input.
 *  - If `isTTY` is `false` or `undefined` (pipe, redirection, or environments
 *    such as Claude Code's Bash tool / CI runners where isTTY is unset),
 *    reads stdin synchronously via `fs.readFileSync(0, 'utf-8')`.
 *  - Strips a leading UTF-8 BOM and trims whitespace.
 *  - 0-byte stdin throws NO_STDIN (empty input).
 *  - Windows `fs.readFileSync(0)` failure modes (EAGAIN / EOF / errno -4095)
 *    are normalized to the same empty-stdin NO_STDIN error.
 *  - Invalid JSON throws with a best-effort line/column hint.
 *
 * @throws Error with `.code === 'NO_STDIN'` when no stdin is available.
 * @throws Error with `.code === 'INVALID_JSON'` when stdin is not valid JSON.
 */
export function readInputData(): unknown {
  // TTY guard: only trigger when isTTY is explicitly true. `undefined` is
  // common in CI, Claude Code's Bash tool, and detached processes — we must
  // not false-positive there.
  if (process.stdin.isTTY === true) {
    throw noStdinError('stdin is an interactive terminal (TTY)');
  }

  let raw: string;
  try {
    raw = fs.readFileSync(0, 'utf-8');
  } catch (err: unknown) {
    const nodeErr = err as NodeJS.ErrnoException;
    const code = nodeErr.code;
    const errno = (nodeErr as NodeJS.ErrnoException & { errno?: number }).errno;
    // Windows / some Node versions surface: EAGAIN, EOF, errno -4095 (UV_EOF).
    if (
      code === 'EAGAIN' ||
      code === 'EOF' ||
      code === 'ENOENT' ||
      errno === -4095
    ) {
      throw noStdinError('stdin is empty or unavailable');
    }
    // Unknown read failure — rethrow with NO_STDIN framing so callers can
    // uniformly detect "no input" regardless of OS quirks.
    throw noStdinError(`failed to read stdin (${code || 'unknown'})`);
  }

  // Strip leading UTF-8 BOM if present, then trim surrounding whitespace.
  if (raw.charCodeAt(0) === 0xfeff) {
    raw = raw.slice(1);
  }
  raw = raw.trim();

  if (raw.length === 0) {
    throw noStdinError('stdin was empty (0 bytes after trim)');
  }

  try {
    return JSON.parse(raw);
  } catch (e: unknown) {
    if (e instanceof SyntaxError) {
      const hint = computeJsonLineHint(raw, e);
      const err = new Error(`Invalid JSON on stdin: ${hint}`) as NodeJS.ErrnoException;
      err.code = 'INVALID_JSON';
      throw err;
    }
    const msg = e instanceof Error ? e.message : String(e);
    const err = new Error(`Invalid JSON on stdin: ${msg}`) as NodeJS.ErrnoException;
    err.code = 'INVALID_JSON';
    throw err;
  }
}

// Block prototype pollution keys
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Maximum allowed depth for dot-path --set keys. */
const MAX_SET_DEPTH = 10;

/**
 * A single segment of a dot-path key.
 * - `type: 'key'`   → bare object key, e.g. `foo`
 * - `type: 'index'` → array bracket, e.g. `foo[2]` → name='foo', idx=2
 */
type Segment =
  | { type: 'key'; name: string }
  | { type: 'index'; name: string; idx: number };

/**
 * Split a dot-path key string into typed segments.
 *
 * Examples:
 *   'a.b.c'       → [{key,'a'},{key,'b'},{key,'c'}]
 *   'a.b[0].c'    → [{key,'a'},{index,'b',0},{key,'c'}]
 *   'items[2]'    → [{index,'items',2}]
 *
 * Rejects empty segments (leading/trailing/consecutive dots).
 * Rejects depth > MAX_SET_DEPTH.
 * Returns null if any segment name is in DANGEROUS_KEYS (silent skip).
 */
function parseSegments(key: string): Segment[] | null {
  const parts = key.split('.');

  if (parts.length > MAX_SET_DEPTH) {
    throw new Error(
      `--set key "${key}" exceeds maximum depth of ${MAX_SET_DEPTH} segments`,
    );
  }

  const segments: Segment[] = [];

  for (const part of parts) {
    if (part === '') {
      throw new Error(
        `--set key "${key}" contains an empty segment (leading, trailing, or consecutive dots)`,
      );
    }

    // Check for bracket notation: name[digits]
    const bracketMatch = part.match(/^(.+?)\[(\d+)\]$/);
    if (bracketMatch) {
      const name = bracketMatch[1];
      if (DANGEROUS_KEYS.has(name)) return null;
      const idx = parseInt(bracketMatch[2], 10);
      segments.push({ type: 'index', name, idx });
    } else {
      if (DANGEROUS_KEYS.has(part)) return null;
      segments.push({ type: 'key', name: part });
    }
  }

  return segments;
}

/**
 * Walk/create a nested object/array tree along `segments` and assign `value`
 * at the leaf.
 */
function setNestedValue(
  root: Record<string, unknown>,
  segments: Segment[],
  value: unknown,
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = root;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;

    if (seg.type === 'index') {
      // Ensure parent[seg.name] is an array
      if (!Array.isArray(current[seg.name])) {
        current[seg.name] = [];
      }
      if (isLast) {
        (current[seg.name] as unknown[])[seg.idx] = value;
      } else {
        // Need to descend into the array element
        const arr = current[seg.name] as unknown[];
        const next = segments[i + 1];
        if (arr[seg.idx] == null || typeof arr[seg.idx] !== 'object') {
          // Create the right container type for the next segment
          arr[seg.idx] =
            next.type === 'index'
              ? {}
              : {};
        }
        current = arr[seg.idx];
        // Skip to the next segment — we've already descended into the array element
        // The for-loop will advance i, so the next iteration handles the segment after this one
      }
    } else {
      // type === 'key'
      if (isLast) {
        current[seg.name] = value;
      } else {
        // Need to descend; ensure an object container exists
        const next = segments[i + 1];
        if (current[seg.name] == null || typeof current[seg.name] !== 'object' || Array.isArray(current[seg.name])) {
          current[seg.name] =
            next.type === 'index'
              ? {}
              : {};
        }
        current = current[seg.name];
      }
    }
  }
}

/**
 * Parse --set flags into a (possibly nested) key-value object.
 * Supports simple keys, array notation, and dot-path nesting:
 *   --set confidence=4
 *   --set "summary=Build passed"
 *   --set "known_risks[0]=FTS5 issue"
 *   --set "self_check.confidence=4"
 *   --set "a.b[0].c=value"
 *
 * @param setArgs - Array of "key=value" strings
 * @returns Object with parsed values (numbers auto-detected)
 */
export function parseSetFlags(setArgs: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {} as Record<string, unknown>;

  for (const arg of setArgs) {
    const eqIdx = arg.indexOf('=');
    if (eqIdx === -1) continue;

    const key = arg.substring(0, eqIdx).trim();
    const rawValue = arg.substring(eqIdx + 1);

    // Auto-detect types
    const value = coerceValue(rawValue);

    // Parse dot-path segments; null means a dangerous key was found (skip silently)
    const segments = parseSegments(key);
    if (segments === null) continue;

    setNestedValue(result, segments, value);
  }

  return result;
}

/**
 * Deep-merge `overrides` into `base`, returning the mutated `base`.
 *
 * - Plain objects are recursively merged (override keys win).
 * - Arrays and non-object values in overrides overwrite base entirely.
 * - This replaces Object.assign for --set merging so that nested dot-path
 *   fields don't clobber sibling keys in the base object.
 */
export function deepMergeSetOverrides(
  base: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  for (const key of Object.keys(overrides)) {
    const ov = overrides[key];
    const bv = base[key];

    if (
      ov != null &&
      typeof ov === 'object' &&
      !Array.isArray(ov) &&
      bv != null &&
      typeof bv === 'object' &&
      !Array.isArray(bv)
    ) {
      // Both sides are plain objects — recurse
      deepMergeSetOverrides(
        bv as Record<string, unknown>,
        ov as Record<string, unknown>,
      );
    } else {
      base[key] = ov;
    }
  }
  return base;
}

/** Auto-coerce string values to appropriate types. */
function coerceValue(raw: string): unknown {
  // Boolean
  if (raw === 'true') return true;
  if (raw === 'false') return false;

  // Integer — but NOT zero-padded like "001" or "0100"
  if (raw === '0' || /^-?[1-9]\d*$/.test(raw)) return parseInt(raw, 10);

  // JSON array or object
  if ((raw.startsWith('[') && raw.endsWith(']')) ||
      (raw.startsWith('{') && raw.endsWith('}'))) {
    try {
      return JSON.parse(raw);
    } catch {
      // Fall through to string
    }
  }

  return raw;
}
