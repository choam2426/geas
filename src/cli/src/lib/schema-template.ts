/**
 * Schema template generation — produces fill-in JSON templates from
 * embedded JSON Schemas. Required fields only, $ref resolved inline.
 *
 * Deliberately avoids importing Ajv or anything from schema.ts.
 */

import { SCHEMAS, DEFS_SCHEMA } from './schemas-embedded';

const MAX_DEPTH = 10;
const ISO_PATTERN = '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$';

/* ── Public API ─────────────────────────────────────────────────────── */

/**
 * Return sorted list of available schema names.
 */
export function listSchemas(): string[] {
  return Object.keys(SCHEMAS).sort();
}

/**
 * Generate a fill-in JSON template for the given schema.
 * Only required fields are included at every nesting level.
 *
 * For evidence schema, pass options.role to merge conditional requirements.
 */
/**
 * Fields auto-injected by the CLI envelope or timestamp logic.
 * Stripped by default when generating pipe-ready templates.
 */
const ENVELOPE_FIELDS = new Set([
  'version', 'artifact_type', 'producer_type', 'artifact_id',
  'created_at', 'updated_at',
]);

/**
 * Fields that are force-set from CLI flags (not from stdin JSON).
 * Stripped by default so pipe templates don't include them.
 */
const CLI_FLAG_FIELDS = new Set([
  'agent', 'task_id', 'role',
]);

export interface TemplateOptions {
  role?: string;
  stripEnvelope?: boolean;
  section?: string;
  pretty?: boolean;
}

/**
 * List valid record section names by inspecting the record schema properties.
 * Sections are top-level properties that are objects (not envelope fields).
 */
export function listRecordSections(): string[] {
  const schema = SCHEMAS['record'] as SchemaNode | undefined;
  if (!schema?.properties) return [];
  const props = schema.properties as Record<string, SchemaNode>;
  return Object.keys(props)
    .filter(k => !ENVELOPE_FIELDS.has(k) && !CLI_FLAG_FIELDS.has(k))
    .sort();
}

export function generateTemplate(
  schemaName: string,
  options?: TemplateOptions,
): object {
  const schema = SCHEMAS[schemaName] as SchemaNode | undefined;
  if (!schema) {
    const available = listSchemas();
    throw new Error(
      `Unknown schema type '${schemaName}'. Available: ${available.join(', ')}`,
    );
  }

  // --section: extract a sub-schema from record
  if (options?.section) {
    if (schemaName !== 'record') {
      throw new Error(
        `--section is only valid for 'record' schema, not '${schemaName}'`,
      );
    }
    const props = schema.properties as Record<string, SchemaNode> | undefined;
    const sectionSchema = props?.[options.section];
    if (!sectionSchema) {
      const validSections = listRecordSections();
      throw new Error(
        `Unknown record section '${options.section}'. Valid sections: ${validSections.join(', ')}`,
      );
    }
    // Generate template for just this section sub-schema
    const resolved = resolveRef(sectionSchema, schema);
    if (resolved.type === 'object' || resolved.properties) {
      const sectionRequired = new Set<string>((resolved.required as string[]) || []);
      return generateObject(resolved, sectionRequired, schema, 0);
    }
    return {};
  }

  const rootSchema = schema;
  const requiredSet = resolveRequired(rootSchema, options?.role);

  const result = generateObject(rootSchema, requiredSet, rootSchema, 0) as Record<string, unknown>;

  // Override role field with the provided --role value
  if (options?.role && 'role' in result) {
    result.role = options.role;
  }

  // Strip envelope + CLI-flag fields by default (opt out with stripEnvelope=false)
  const shouldStrip = options?.stripEnvelope !== false;
  if (shouldStrip) {
    for (const field of ENVELOPE_FIELDS) delete result[field];
    for (const field of CLI_FLAG_FIELDS) delete result[field];
  }

  return result;
}

/* ── Internal types ─────────────────────────────────────────────────── */

interface SchemaNode {
  [key: string]: unknown;
}

/* ── $ref resolution ────────────────────────────────────────────────── */

function resolveRef(
  node: SchemaNode,
  rootSchema: SchemaNode,
): SchemaNode {
  const ref = node.$ref as string | undefined;
  if (!ref) return node;

  // External ref: _defs.schema.json#/$defs/X
  const extMatch = ref.match(/^_defs\.schema\.json#\/\$defs\/(.+)$/);
  if (extMatch) {
    const defName = extMatch[1];
    const defs = (DEFS_SCHEMA as SchemaNode).$defs as Record<string, SchemaNode> | undefined;
    if (defs && defs[defName]) return defs[defName];
    return node;
  }

  // Self ref: #/$defs/X
  const selfMatch = ref.match(/^#\/\$defs\/(.+)$/);
  if (selfMatch) {
    const defName = selfMatch[1];
    const defs = rootSchema.$defs as Record<string, SchemaNode> | undefined;
    if (defs && defs[defName]) return defs[defName];
    return node;
  }

  return node;
}

/* ── Required field resolution (with conditional merge) ─────────────── */

function resolveRequired(
  schema: SchemaNode,
  role?: string,
): Set<string> {
  const base = (schema.required as string[]) || [];
  const result = new Set<string>(base);

  if (!role) return result;

  const allOf = schema.allOf as SchemaNode[] | undefined;
  if (!allOf) return result;

  for (const entry of allOf) {
    const ifClause = entry.if as SchemaNode | undefined;
    const thenClause = entry.then as SchemaNode | undefined;
    if (!ifClause || !thenClause) continue;

    // Check if this if/then matches the given role
    const props = ifClause.properties as Record<string, SchemaNode> | undefined;
    if (!props?.role) continue;

    const constVal = props.role.const as string | undefined;
    if (constVal === role) {
      const thenRequired = thenClause.required as string[] | undefined;
      if (thenRequired) {
        for (const r of thenRequired) result.add(r);
      }
    }
  }

  return result;
}

/* ── Template generation ────────────────────────────────────────────── */

function generateValue(
  node: SchemaNode,
  rootSchema: SchemaNode,
  depth: number,
): unknown {
  if (depth > MAX_DEPTH) return null;

  // Resolve $ref first
  const resolved = resolveRef(node, rootSchema);

  // const
  if (resolved.const !== undefined) return resolved.const;

  // enum
  if (Array.isArray(resolved.enum) && resolved.enum.length > 0) {
    return resolved.enum[0];
  }

  const type = resolved.type;

  // type is an array (e.g. ["string", "null"]) -> null
  if (Array.isArray(type)) return null;

  switch (type) {
    case 'string': {
      // Check for isoUtcTimestamp pattern
      if (resolved.pattern === ISO_PATTERN) return '<iso-utc-timestamp>';
      return '<string>';
    }
    case 'integer':
    case 'number': {
      if (typeof resolved.minimum === 'number') return resolved.minimum;
      return 0;
    }
    case 'boolean':
      return false;
    case 'array':
      return generateArray(resolved, rootSchema, depth);
    case 'object':
      return generateObjectFromSchema(resolved, rootSchema, depth);
    default:
      // No type specified but has properties -> treat as object
      if (resolved.properties) {
        return generateObjectFromSchema(resolved, rootSchema, depth);
      }
      return null;
  }
}

function generateArray(
  schema: SchemaNode,
  rootSchema: SchemaNode,
  depth: number,
): unknown[] {
  const minItems = (schema.minItems as number) || 0;
  if (minItems < 1) return [];

  const items = schema.items as SchemaNode | undefined;
  if (!items) return [null];

  // oneOf in items -> pick first variant
  if (Array.isArray(items.oneOf) && items.oneOf.length > 0) {
    const firstVariant = items.oneOf[0] as SchemaNode;
    return [generateValue(firstVariant, rootSchema, depth + 1)];
  }

  return [generateValue(items, rootSchema, depth + 1)];
}

function generateObjectFromSchema(
  schema: SchemaNode,
  rootSchema: SchemaNode,
  depth: number,
): object {
  const required = new Set<string>((schema.required as string[]) || []);
  return generateObject(schema, required, rootSchema, depth);
}

function generateObject(
  schema: SchemaNode,
  requiredFields: Set<string>,
  rootSchema: SchemaNode,
  depth: number,
): object {
  if (depth > MAX_DEPTH) return {};

  const properties = schema.properties as Record<string, SchemaNode> | undefined;
  if (!properties) return {};

  const result: Record<string, unknown> = {};

  for (const key of Object.keys(properties)) {
    if (!requiredFields.has(key)) continue;
    result[key] = generateValue(properties[key], rootSchema, depth + 1);
  }

  return result;
}
