/**
 * Schema validation via Ajv.
 *
 * CRITICAL: Ajv is lazily initialized — the instance is NOT created at
 * import time. This saves ~40ms on --help and read-only commands.
 *
 * _defs.schema.json is pre-registered so $ref resolution works across schemas.
 */

import * as path from 'path';
import * as fs from 'fs';

// Ajv types — imported only for type annotations.
// The actual require() happens lazily inside getAjv().
import type Ajv from 'ajv';
import type { ValidateFunction } from 'ajv';

export interface ValidationResult {
  valid: boolean;
  errors: unknown[] | null;
}

const SCHEMAS_DIR = path.resolve(__dirname, '..', '..', 'schemas');

let ajvInstance: Ajv | null = null;
const validatorCache = new Map<string, ValidateFunction>();

/**
 * Lazily create and return the singleton Ajv instance.
 * _defs.schema.json is pre-registered on first call.
 */
function getAjv(): Ajv {
  if (ajvInstance) return ajvInstance;

  // Dynamic require to avoid loading Ajv at import time.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const AjvClass = require('ajv').default || require('ajv');
  ajvInstance = new AjvClass({
    allErrors: true,
    strict: false,
    allowUnionTypes: true,
    validateSchema: false,
  }) as Ajv;

  // Pre-register _defs.schema.json so $ref resolution works.
  const defsPath = path.join(SCHEMAS_DIR, '_defs.schema.json');
  const defsSchema = JSON.parse(fs.readFileSync(defsPath, 'utf-8'));
  ajvInstance.addSchema(defsSchema, '_defs.schema.json');

  return ajvInstance;
}

/**
 * Get a compiled validator for the given schema name.
 * Schema name maps to filename: 'task-contract' -> 'task-contract.schema.json'.
 * Validators are cached after first compilation.
 */
export function getValidator(schemaName: string): ValidateFunction {
  const cached = validatorCache.get(schemaName);
  if (cached) return cached;

  const ajv = getAjv();
  const schemaPath = path.join(SCHEMAS_DIR, `${schemaName}.schema.json`);

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema not found: ${schemaName} (expected at ${schemaPath})`);
  }

  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
  const validator = ajv.compile(schema);
  validatorCache.set(schemaName, validator);
  return validator;
}

/**
 * Validate data against a named schema.
 *
 * @param schemaName - Schema name without .schema.json suffix (e.g. 'task-contract')
 * @param data - The data to validate
 * @returns ValidationResult with valid flag and any errors
 */
export function validate(
  schemaName: string,
  data: unknown
): ValidationResult {
  const validator = getValidator(schemaName);
  const valid = validator(data) as boolean;
  return {
    valid,
    errors: valid ? null : (validator.errors ?? null),
  };
}
