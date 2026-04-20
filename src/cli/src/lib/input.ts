/**
 * Stdin JSON payload reader.
 *
 * Write commands receive payload exclusively via stdin (CLI.md §4).
 * If stdin is a TTY or empty, this throws with code `invalid_argument`.
 */

import * as fs from 'fs';

export class StdinError extends Error {
  code: 'invalid_argument';
  constructor(message: string) {
    super(message);
    this.code = 'invalid_argument';
  }
}

/**
 * Read JSON from stdin. Throws StdinError if stdin is interactive,
 * empty, or not valid JSON.
 */
export function readStdinJson(): unknown {
  if (process.stdin.isTTY === true) {
    throw new StdinError('stdin is an interactive terminal (no JSON provided)');
  }
  let raw: string;
  try {
    raw = fs.readFileSync(0, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    throw new StdinError(`failed to read stdin: ${e.code ?? 'unknown'}`);
  }
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  raw = raw.trim();
  if (raw.length === 0) {
    throw new StdinError('stdin was empty');
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new StdinError(`invalid JSON on stdin: ${msg}`);
  }
}

/**
 * Read raw UTF-8 text from stdin, preserving whitespace and newlines.
 * Strips a leading BOM if present. Throws StdinError if stdin is
 * interactive or the payload is empty after BOM removal.
 *
 * Used by write commands whose payload is free-form markdown (e.g.
 * `geas memory shared-set`, `geas memory agent-set`) rather than JSON.
 * Content is written to disk byte-equivalent to the input (no trim).
 */
export function readStdinText(): string {
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
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  if (raw.length === 0) {
    throw new StdinError('stdin was empty');
  }
  return raw;
}
