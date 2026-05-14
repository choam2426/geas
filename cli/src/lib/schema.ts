import Ajv, { type ValidateFunction } from 'ajv';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export type SchemaId =
  | 'mission-spec'
  | 'mission-design'
  | 'task-contract'
  | 'task-state'
  | 'run-state'
  | 'implementation-evidence'
  | 'verification-evidence'
  | 'review-evidence'
  | 'challenger-evidence'
  | 'task-evidence'
  | 'mission-evidence'
  | 'user-judgment'
  | 'debt-item'
  | 'debt-ledger'
  | 'memory-file'
  | 'memory-item';

const ALL_SCHEMA_IDS: SchemaId[] = [
  'mission-spec',
  'mission-design',
  'task-contract',
  'task-state',
  'run-state',
  'implementation-evidence',
  'verification-evidence',
  'review-evidence',
  'challenger-evidence',
  'task-evidence',
  'mission-evidence',
  'user-judgment',
  'debt-item',
  'debt-ledger',
  'memory-file',
  'memory-item',
];

let ajvInstance: Ajv | null = null;
const validators = new Map<SchemaId, ValidateFunction>();

function loadSchemas(): Record<string, unknown> {
  // In bundled output, esbuild plugin injects virtual:schemas. In dev (tsx),
  // load from disk.
  try {
    return require('virtual:schemas');
  } catch (e: unknown) {
    const code = (e as NodeJS.ErrnoException)?.code;
    if (code !== 'MODULE_NOT_FOUND') throw e;
    const schemasDir = join(__dirname, '..', '..', 'schemas');
    const out: Record<string, unknown> = {};
    for (const file of readdirSync(schemasDir)) {
      if (file.endsWith('.json')) {
        const id = file.replace(/\.json$/, '');
        out[id] = JSON.parse(readFileSync(join(schemasDir, file), 'utf8'));
      }
    }
    return out;
  }
}

function ensureInitialized(): Ajv {
  if (ajvInstance) return ajvInstance;
  const ajv = new Ajv({ allErrors: true, strict: false });
  const schemas = loadSchemas();
  for (const id of ALL_SCHEMA_IDS) {
    const schema = schemas[id];
    if (!schema) {
      throw new Error(`schema not loaded: ${id}`);
    }
    validators.set(id, ajv.compile(schema as object));
  }
  ajvInstance = ajv;
  return ajv;
}

export type ValidateOk = { valid: true };
export type ValidateErr = { valid: false; errors: string[] };

export function validate(id: SchemaId, payload: unknown): ValidateOk | ValidateErr {
  ensureInitialized();
  const v = validators.get(id);
  if (!v) {
    throw new Error(`unknown schema id: ${id}`);
  }
  const ok = v(payload);
  if (ok) return { valid: true };
  const errors = (v.errors ?? []).map((e) => {
    const path = e.instancePath || '/';
    const extra = e.keyword === 'additionalProperties'
      ? ` (${(e.params as { additionalProperty?: string }).additionalProperty})`
      : '';
    return `${path} ${e.message ?? 'invalid'}${extra}`;
  });
  return { valid: false, errors };
}
