/**
 * Path normalization and resolution for the Geas CLI.
 * Every path that enters the CLI gets normalized here.
 *
 * Windows backslashes are converted to forward slashes for consistency.
 * Paths are always resolved to absolute before use.
 */

import * as path from 'path';
import * as fs from 'fs';

/**
 * Normalize a path: resolve to absolute, convert backslashes to forward slashes.
 */
export function normalizePath(p: string): string {
  return path.resolve(p).replace(/\\/g, '/');
}

/**
 * Resolve the .geas/ directory from the given cwd (or process.cwd()).
 * Verifies the directory exists.
 *
 * @throws Error with FILE_ERROR code if .geas/ does not exist.
 */
export function resolveGeasDir(cwd?: string): string {
  const base = cwd ?? process.cwd();
  const geasDir = path.resolve(base, '.geas');
  if (!fs.existsSync(geasDir)) {
    const err = new Error(
      `.geas/ directory not found at ${normalizePath(geasDir)}`
    );
    (err as NodeJS.ErrnoException).code = 'FILE_ERROR';
    throw err;
  }
  return normalizePath(geasDir);
}

/**
 * Resolve a mission directory: .geas/missions/<missionId>/
 * Verifies the directory exists.
 *
 * @throws Error with FILE_ERROR code if mission directory does not exist.
 */
export function resolveMissionDir(
  geasDir: string,
  missionId: string
): string {
  const missionDir = path.resolve(geasDir, 'missions', missionId);
  if (!fs.existsSync(missionDir)) {
    const err = new Error(
      `Mission directory not found: ${normalizePath(missionDir)}`
    );
    (err as NodeJS.ErrnoException).code = 'FILE_ERROR';
    throw err;
  }
  return normalizePath(missionDir);
}

/**
 * Compute a relative path from cwd, with forward slashes.
 * Matches geas-hooks.js relPath behavior.
 */
export function relPath(filePath: string, cwd: string): string {
  return path.relative(cwd, filePath).replace(/\\/g, '/');
}

/**
 * Validate that an identifier (missionId, taskId) contains only safe characters.
 * Rejects path traversal attempts like "../" or special characters.
 */
const SAFE_ID_RE = /^[A-Za-z0-9_-]+$/;

export function validateIdentifier(id: string, label: string): void {
  if (!SAFE_ID_RE.test(id)) {
    const err = new Error(
      `Invalid ${label}: "${id}". Only alphanumeric, underscore, and hyphen are allowed.`,
    );
    (err as NodeJS.ErrnoException).code = 'FILE_ERROR';
    throw err;
  }
}

/**
 * Verify that a resolved path is contained within the expected base directory.
 * Prevents path traversal attacks.
 */
export function assertContainedIn(resolvedPath: string, baseDir: string): void {
  const normalizedBase = path.resolve(baseDir) + path.sep;
  const normalizedPath = path.resolve(resolvedPath);
  if (!normalizedPath.startsWith(normalizedBase) && normalizedPath !== path.resolve(baseDir)) {
    const err = new Error(
      `Path "${resolvedPath}" escapes base directory "${baseDir}"`,
    );
    (err as NodeJS.ErrnoException).code = 'FILE_ERROR';
    throw err;
  }
}
