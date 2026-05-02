/**
 * Payload reader for write commands.
 *
 * Write commands accept payload from one of two channels (CLI.md §4.3):
 *   --file <path>   preferred for large or prose-heavy content
 *   stdin           safe only when produced by a clean pipe (cat file |)
 *
 * `readPayloadJson` / `readPayloadText` are the modern entry points; they
 * pick --file over stdin when both are available. `readStdinJson` /
 * `readStdinText` are kept as stdin-only shims for callers that don't
 * take a file option yet.
 *
 * All functions throw StdinError (code: invalid_argument) on empty
 * payload, unreadable file, TTY stdin, or JSON parse failure.
 */

import * as fs from 'fs';

export class StdinError extends Error {
  code: 'invalid_argument';
  constructor(message: string) {
    super(message);
    this.code = 'invalid_argument';
  }
}

// ── Internal helpers ──────────────────────────────────────────────────

function stripBom(raw: string): string {
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
}

function readFileUtf8(filePath: string): string {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    throw new StdinError(
      `failed to read --file '${filePath}': ${e.code ?? 'unknown'}`,
    );
  }
  return stripBom(raw);
}

function readStdinUtf8(): string {
  if (process.stdin.isTTY === true) {
    throw new StdinError('stdin is an interactive terminal (no content provided)');
  }
  let raw: string;
  try {
    raw = fs.readFileSync(0, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    throw new StdinError(`failed to read stdin: ${e.code ?? 'unknown'}`);
  }
  return stripBom(raw);
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Read JSON payload from `--file <path>` if provided, otherwise stdin.
 * Throws StdinError on empty content, file unreadable, TTY stdin, or
 * invalid JSON. If both `--file` and stdin are provided, `--file` wins.
 */
export function readPayloadJson(filePath?: string): unknown {
  let raw: string;
  if (filePath !== undefined && filePath !== '') {
    raw = readFileUtf8(filePath);
  } else {
    raw = readStdinUtf8();
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    const src = filePath ? `--file '${filePath}'` : 'stdin';
    throw new StdinError(`${src} was empty`);
  }
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const src = filePath ? `--file '${filePath}'` : 'stdin';
    throw new StdinError(`invalid JSON on ${src}: ${msg}`);
  }
}

/**
 * Read raw UTF-8 text payload from `--file <path>` if provided, otherwise
 * stdin. Preserves whitespace and newlines (no trim). Strips a leading
 * BOM. Throws StdinError on empty content, file unreadable, or TTY stdin.
 */
export function readPayloadText(filePath?: string): string {
  let raw: string;
  if (filePath !== undefined && filePath !== '') {
    raw = readFileUtf8(filePath);
  } else {
    raw = readStdinUtf8();
  }
  if (raw.length === 0) {
    const src = filePath ? `--file '${filePath}'` : 'stdin';
    throw new StdinError(`${src} was empty`);
  }
  return raw;
}

/**
 * Stdin-only JSON reader, retained for backward compatibility with
 * callers that don't expose a `--file` option. New code should use
 * `readPayloadJson` instead.
 */
export function readStdinJson(): unknown {
  return readPayloadJson(undefined);
}

/**
 * Stdin-only text reader, retained for backward compatibility. New code
 * should use `readPayloadText` instead.
 */
export function readStdinText(): string {
  return readPayloadText(undefined);
}
