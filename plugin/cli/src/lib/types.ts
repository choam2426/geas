/**
 * Shared TypeScript interfaces for the Geas CLI.
 * No runtime code — types only.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'FILE_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'STATE_ERROR';

export interface CliError {
  error: string;
  code: ErrorCode;
  details?: unknown;
}

export type CliResult<T> =
  | { success: true; data: T }
  | { success: false; error: CliError };

export interface WriteOptions {
  /** Schema name to validate against before writing */
  schema?: string;
  /** Run post-write checks after writing (default true for .geas/ paths) */
  runChecks?: boolean;
  /** Use atomic write (temp file + rename) */
  atomic?: boolean;
}
