/**
 * Input data reading utilities for the Geas CLI.
 * Supports --data (inline JSON), --file (JSON file path), and piped stdin.
 */

import * as fs from 'fs';

/**
 * Read JSON input from --data flag, --file flag, or piped stdin.
 *
 * Priority: --file > --data > stdin
 *
 * @param dataArg - Value of --data flag (inline JSON string)
 * @param fileArg - Value of --file flag (path to JSON file)
 * @returns Parsed JSON object
 * @throws Error with FILE_ERROR code if no input or invalid JSON
 */
export function readInputData(
  dataArg: string | undefined,
  fileArg?: string | undefined,
): unknown {
  let raw: string | undefined;

  // --file takes priority
  if (fileArg) {
    try {
      raw = fs.readFileSync(fileArg, 'utf-8').trim();
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException;
      const e = new Error(`Cannot read file: ${fileArg} (${nodeErr.code || 'unknown'})`);
      (e as NodeJS.ErrnoException).code = 'FILE_ERROR';
      throw e;
    }
  }

  // --data
  if (!raw && dataArg) {
    raw = dataArg;
  }

  // stdin (piped, non-TTY)
  if (!raw) {
    try {
      if (!process.stdin.isTTY) {
        raw = fs.readFileSync(0, 'utf-8').trim();
      }
    } catch {
      // stdin not available or empty
    }
  }

  if (!raw) {
    const err = new Error('No data provided. Use --data <json>, --file <path>, or pipe JSON to stdin.');
    (err as NodeJS.ErrnoException).code = 'FILE_ERROR';
    throw err;
  }

  try {
    return JSON.parse(raw);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const err = new Error(`Invalid JSON: ${msg}`);
    (err as NodeJS.ErrnoException).code = 'FILE_ERROR';
    throw err;
  }
}

/**
 * Parse --set flags into a flat key-value object.
 * Supports simple keys and array notation:
 *   --set confidence=4
 *   --set "summary=Build passed"
 *   --set "known_risks[0]=FTS5 issue"
 *
 * @param setArgs - Array of "key=value" strings
 * @returns Object with parsed values (numbers auto-detected)
 */
export function parseSetFlags(setArgs: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const arg of setArgs) {
    const eqIdx = arg.indexOf('=');
    if (eqIdx === -1) continue;

    const key = arg.substring(0, eqIdx).trim();
    const rawValue = arg.substring(eqIdx + 1);

    // Auto-detect types
    const value = coerceValue(rawValue);

    // Handle array notation: key[0] = val
    const arrMatch = key.match(/^(.+?)\[(\d+)\]$/);
    if (arrMatch) {
      const arrKey = arrMatch[1];
      const idx = parseInt(arrMatch[2], 10);
      if (!Array.isArray(result[arrKey])) {
        result[arrKey] = [];
      }
      (result[arrKey] as unknown[])[idx] = value;
    } else {
      result[key] = value;
    }
  }

  return result;
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
