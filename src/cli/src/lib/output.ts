/**
 * All CLI output goes through these functions.
 * stdout: JSON data (success path)
 * stderr: structured error JSON or warnings
 *
 * No command should write directly to stdout/stderr.
 */

/**
 * Write successful result as JSON to stdout and exit 0.
 */
export function success(data: unknown): void {
  process.stdout.write(JSON.stringify(data) + '\n');
  process.exit(0);
}

/**
 * Write validation error to stderr and exit 1.
 */
export function validationError(
  schemaName: string,
  errors: unknown[]
): void {
  const msg = {
    error: `Validation failed against schema '${schemaName}'`,
    code: 'VALIDATION_ERROR',
    schema: schemaName,
    details: errors,
  };
  process.stderr.write(JSON.stringify(msg) + '\n');
  process.exit(1);
}

/**
 * Write file I/O error to stderr and exit 2.
 */
export function fileError(
  filePath: string,
  operation: string,
  cause: string
): void {
  const msg = {
    error: `File ${operation} failed: ${cause}`,
    code: 'FILE_ERROR',
    path: filePath,
    operation,
  };
  process.stderr.write(JSON.stringify(msg) + '\n');
  process.exit(2);
}

/**
 * Write a warning to stderr. Does NOT exit.
 * Matches hook warning format: [Geas] WARNING: <message>
 */
export function warn(message: string): void {
  process.stderr.write(`[Geas] WARNING: ${message}\n`);
}
