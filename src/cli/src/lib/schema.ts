/**
 * Schema validation via Ajv.
 *
 * Schemas are embedded at build time — no filesystem reads at runtime.
 * Ajv is lazily initialized to save ~40ms on --help and read-only commands.
 */

import type Ajv from 'ajv';
import type { ValidateFunction } from 'ajv';
import { DEFS_SCHEMA, SCHEMAS } from './schemas-embedded';

export interface ValidationResult {
  valid: boolean;
  errors: unknown[] | null;
}

let ajvInstance: Ajv | null = null;
const validatorCache = new Map<string, ValidateFunction>();

function getAjv(): Ajv {
  if (ajvInstance) return ajvInstance;

  const AjvClass = require('ajv').default || require('ajv');
  ajvInstance = new AjvClass({
    allErrors: true,
    strict: false,
    allowUnionTypes: true,
    validateSchema: false,
  }) as Ajv;

  ajvInstance.addSchema(DEFS_SCHEMA, '_defs.schema.json');
  return ajvInstance;
}

export function getValidator(schemaName: string): ValidateFunction {
  const cached = validatorCache.get(schemaName);
  if (cached) return cached;

  const ajv = getAjv();
  const schema = SCHEMAS[schemaName];

  if (!schema) {
    throw new Error(`Schema not found: ${schemaName} (available: ${Object.keys(SCHEMAS).join(', ')})`);
  }

  const validator = ajv.compile(schema);
  validatorCache.set(schemaName, validator);
  return validator;
}

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
