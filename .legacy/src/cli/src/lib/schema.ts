/**
 * JSON Schema validation helpers using Ajv (draft 2020-12).
 *
 * Schemas are loaded from schemas-embedded.ts (regenerated from
 * docs/schemas). Ajv and validators are lazily constructed to keep
 * --help and read-only commands fast.
 */

import type Ajv from 'ajv/dist/2020';
import type { ErrorObject, ValidateFunction } from 'ajv';
import { SCHEMAS } from './schemas-embedded';

export interface ValidationResult {
  ok: boolean;
  errors: ErrorObject[] | null;
}

let ajvInstance: Ajv | null = null;
const validatorCache = new Map<string, ValidateFunction>();

function getAjv(): Ajv {
  if (ajvInstance) return ajvInstance;
  /* eslint-disable @typescript-eslint/no-require-imports */
  const AjvClass = require('ajv/dist/2020').default || require('ajv/dist/2020');
  const addFormatsMod = require('ajv-formats');
  const addFormats = addFormatsMod.default || addFormatsMod;
  /* eslint-enable */
  ajvInstance = new AjvClass({
    allErrors: true,
    strict: false,
    allowUnionTypes: true,
  }) as Ajv;
  try {
    addFormats(ajvInstance);
  } catch {
    // ajv-formats may be absent in some environments; ignore — the
    // `format` keyword is advisory in draft 2020-12 when no format
    // implementations are registered.
  }
  return ajvInstance;
}

export function getSchema(name: string): unknown | undefined {
  return SCHEMAS[name];
}

export function listSchemas(): string[] {
  return Object.keys(SCHEMAS).sort();
}

function getValidator(name: string): ValidateFunction {
  const cached = validatorCache.get(name);
  if (cached) return cached;
  const schema = SCHEMAS[name];
  if (!schema) {
    throw new Error(
      `Unknown schema: ${name} (available: ${Object.keys(SCHEMAS).join(', ')})`,
    );
  }
  const ajv = getAjv();
  const validator = ajv.compile(schema);
  validatorCache.set(name, validator);
  return validator;
}

export function validate(name: string, data: unknown): ValidationResult {
  const validator = getValidator(name);
  const ok = validator(data) as boolean;
  return { ok, errors: ok ? null : (validator.errors ?? null) };
}
