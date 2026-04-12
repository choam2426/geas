/**
 * Dry-run validation utility for write-path CLI commands.
 *
 * When --dry-run is active, validates the fully-assembled payload
 * (after envelope injection + --set merge) against the target schema,
 * outputs a structured JSON result to stdout, and exits.
 *
 * Exit codes: 0 = valid, 1 = invalid.
 */

import { validate } from './schema';

export interface DryRunResult {
  dry_run: true;
  valid: boolean;
  schema: string | null;
  errors?: unknown[];
  note?: string;
}

/**
 * If dryRun is true, validate data against schemaName and exit.
 * If dryRun is false, returns immediately (noop).
 *
 * For commands with no schema (e.g. decision write), pass schemaName = null
 * to perform only a JSON-object check.
 *
 * @param dryRun  - Whether --dry-run was passed
 * @param data    - The fully-assembled payload to validate
 * @param schemaName - Schema name to validate against, or null for no-schema commands
 */
export function dryRunGuard(
  dryRun: boolean,
  data: unknown,
  schemaName: string | null,
): void {
  if (!dryRun) return;

  if (schemaName === null) {
    // No-schema mode: just confirm the data is a non-null, non-array object
    const result: DryRunResult = {
      dry_run: true,
      valid: true,
      schema: null,
      note: 'no schema validation for this command',
    };
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exit(0);
    return;
  }

  const validation = validate(schemaName, data);

  if (validation.valid) {
    const result: DryRunResult = {
      dry_run: true,
      valid: true,
      schema: schemaName,
    };
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exit(0);
  } else {
    const result: DryRunResult = {
      dry_run: true,
      valid: false,
      schema: schemaName,
      errors: validation.errors || [],
    };
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exit(1);
  }
}

/**
 * Output a dry-run parse error (invalid JSON or other pre-validation failure).
 * Writes structured JSON to stdout and exits with code 1.
 */
export function dryRunParseError(errorMessage: string): void {
  const result = {
    dry_run: true,
    valid: false,
    error: errorMessage,
  };
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exit(1);
}
