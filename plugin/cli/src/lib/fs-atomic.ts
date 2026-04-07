/**
 * Atomic file I/O utilities for the Geas CLI.
 * All file reads/writes go through these functions.
 *
 * Encoding: utf-8 everywhere.
 * Atomicity: writeJsonFile uses direct write; atomicWriteJsonFile uses temp+rename.
 */

import * as fs from 'fs';
import * as path from 'path';
import { WriteOptions } from './types';
import { normalizePath } from './paths';

/**
 * Ensure a directory exists, creating it recursively if needed.
 * Idempotent.
 */
export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Read and parse a JSON file.
 *
 * @returns Parsed JSON, or null if the file does not exist (ENOENT).
 * @throws On JSON parse errors (with file path in the message).
 */
export function readJsonFile<T>(filePath: string): T | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (err: unknown) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === 'ENOENT') {
      return null;
    }
    if (err instanceof SyntaxError) {
      throw new Error(
        `Failed to parse JSON at ${normalizePath(filePath)}: ${err.message}`
      );
    }
    throw err;
  }
}

/**
 * Write data as JSON to a file.
 * Creates parent directories if they do not exist.
 * Uses 2-space indent and trailing newline.
 *
 * @param filePath - Absolute path to the file.
 * @param data - Data to serialize as JSON.
 * @param _options - Write options (schema validation and post-write checks deferred to later tasks).
 */
export function writeJsonFile(
  filePath: string,
  data: unknown,
  _options?: WriteOptions
): void {
  ensureDir(path.dirname(filePath));
  const content = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Append a single JSON line to a JSONL file.
 * Creates parent directories and the file if they do not exist.
 * Used for ledger/event log entries.
 */
export function appendJsonlFile(filePath: string, entry: unknown): void {
  ensureDir(path.dirname(filePath));
  const line = JSON.stringify(entry) + '\n';
  fs.appendFileSync(filePath, line, 'utf-8');
}

/**
 * Write data as JSON atomically: write to a .tmp sibling file, then rename.
 * Falls back to direct write if rename fails (e.g. cross-device move on Windows).
 *
 * @param filePath - Absolute path to the target file.
 * @param data - Data to serialize as JSON.
 * @param _options - Write options (schema validation and post-write checks deferred to later tasks).
 */
export function atomicWriteJsonFile(
  filePath: string,
  data: unknown,
  _options?: WriteOptions
): void {
  ensureDir(path.dirname(filePath));
  const content = JSON.stringify(data, null, 2) + '\n';
  const tmpPath = filePath + '.tmp';

  try {
    fs.writeFileSync(tmpPath, content, 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch (err: unknown) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === 'EXDEV') {
      // Cross-device rename (e.g. temp dir on different mount): fall back to direct write.
      fs.writeFileSync(filePath, content, 'utf-8');
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // Ignore cleanup errors.
      }
    } else {
      // Re-throw real errors (ENOSPC, EACCES, etc.) — do not silently swallow.
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // Best-effort cleanup of temp file.
      }
      throw err;
    }
  }
}
