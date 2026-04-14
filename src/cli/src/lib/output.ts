/**
 * All CLI output goes through these functions.
 * stdout: JSON data (success path)
 * stderr: structured error JSON or warnings
 *
 * No command should write directly to stdout/stderr.
 */

import { getSchemaObject } from './schema';

interface AjvError {
  keyword: string;
  instancePath: string;
  schemaPath: string;
  params: Record<string, unknown>;
  message?: string;
}

interface SchemaNode {
  type?: string;
  description?: string;
  enum?: unknown[];
  required?: string[];
  properties?: Record<string, SchemaNode>;
  additionalProperties?: boolean;
  items?: SchemaNode;
  const?: unknown;
  $ref?: string;
}

interface HintEntry {
  path: string;
  keyword: string;
  message?: string;
  allowed_values?: unknown[];
  allowed_properties?: string[];
  field_type?: string;
  field_description?: string;
  suggested_fix?: string;
}

interface Hints {
  required_fields: string[];
  errors: HintEntry[];
  next_command: string;
}

/**
 * Resolve a property path within a schema to find the sub-schema node.
 * Handles direct properties only (no $ref resolution across files).
 */
function resolvePropertySchema(
  schema: SchemaNode,
  propertyName: string
): SchemaNode | undefined {
  return schema.properties?.[propertyName];
}

/**
 * Navigate the schema tree following an instancePath to find the relevant sub-schema.
 * instancePath format: "/field/nested/deeper"
 */
function navigateSchema(
  schema: SchemaNode,
  instancePath: string
): SchemaNode {
  if (!instancePath || instancePath === '') return schema;

  const parts = instancePath.split('/').filter(Boolean);
  let current: SchemaNode = schema;

  for (const part of parts) {
    if (current.properties?.[part]) {
      current = current.properties[part];
    } else if (current.items && !isNaN(Number(part))) {
      current = current.items;
    } else {
      return current;
    }
  }

  return current;
}

/**
 * Extract contextual hints from Ajv errors and the source schema.
 */
function extractHints(
  schemaName: string,
  errors: unknown[]
): Hints {
  const rawSchema = getSchemaObject(schemaName) as SchemaNode | undefined;
  const topRequired = rawSchema?.required ?? [];

  const hintEntries: HintEntry[] = [];

  // Compute next_command: always points to schema template
  let nextCommand = `geas schema template ${schemaName}`;
  if (schemaName === 'evidence') {
    nextCommand += ' --role <role>';
  }

  if (!rawSchema) {
    return { required_fields: [], errors: hintEntries, next_command: nextCommand };
  }

  for (const err of errors) {
    const e = err as AjvError;
    if (!e || !e.keyword) continue;

    const entry: HintEntry = {
      path: e.instancePath || '/',
      keyword: e.keyword,
      message: e.message,
    };

    switch (e.keyword) {
      case 'enum': {
        // Find the schema node for this path to get allowed values
        const node = navigateSchema(rawSchema, e.instancePath);
        // Ajv params.allowedValues contains the enum values
        const allowedValues = e.params?.allowedValues;
        if (Array.isArray(allowedValues)) {
          entry.allowed_values = allowedValues;
        } else if (node?.enum) {
          entry.allowed_values = node.enum;
        }
        const allowed = entry.allowed_values;
        const actual = e.params?.allowedValues !== undefined
          ? String((e as unknown as { data?: unknown }).data ?? '')
          : '';
        entry.suggested_fix = `Use one of: [${(allowed ?? []).join(', ')}].${actual ? ` You provided: "${actual}".` : ''}`;
        break;
      }

      case 'additionalProperties': {
        // Navigate to the object that has additionalProperties: false
        const containerNode = navigateSchema(rawSchema, e.instancePath);
        const additionalProp = e.params?.additionalProperty as string | undefined;
        if (containerNode?.properties) {
          entry.allowed_properties = Object.keys(containerNode.properties);
        }
        entry.suggested_fix = `Remove unknown property "${additionalProp ?? '?'}". Allowed properties: [${(entry.allowed_properties ?? []).join(', ')}].`;
        break;
      }

      case 'required': {
        // params.missingProperty tells us which field is missing
        const missingProp = e.params?.missingProperty as string | undefined;
        if (missingProp) {
          const containerNode = navigateSchema(rawSchema, e.instancePath);
          const propSchema = resolvePropertySchema(containerNode, missingProp);
          if (propSchema) {
            if (propSchema.type) {
              entry.field_type = propSchema.type;
            }
            if (propSchema.description) {
              entry.field_description = propSchema.description;
            }
          }
          const typeHint = entry.field_type ? ` (${entry.field_type}${entry.field_description ? ': ' + entry.field_description : ''})` : '';
          entry.suggested_fix = `Add missing field "${missingProp}"${typeHint}.`;
        }
        break;
      }

      case 'type': {
        const expected = e.params?.type as string | undefined;
        const actual = e.params?.nullable ? 'null' : typeof (e as unknown as { data?: unknown }).data;
        entry.suggested_fix = `Expected ${expected ?? 'unknown'}, got ${actual ?? 'unknown'}.`;
        break;
      }

      case 'minLength': {
        entry.suggested_fix = 'Value must not be empty.';
        break;
      }

      default: {
        const path = e.instancePath || '/';
        entry.suggested_fix = `${path}: ${e.message ?? 'validation failed'}`;
        break;
      }
    }

    hintEntries.push(entry);
  }

  return {
    required_fields: topRequired,
    errors: hintEntries,
    next_command: nextCommand,
  };
}

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
  const hints = extractHints(schemaName, errors);
  const msg = {
    error: `Validation failed against schema '${schemaName}'`,
    code: 'VALIDATION_ERROR',
    schema: schemaName,
    details: errors,
    hints,
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
 * Write a NO_STDIN error (no JSON on stdin) to stderr and exit 2.
 *
 * Emits a structured JSON object plus a list of example invocations showing
 * how to pipe JSON via heredoc, pipe, or redirection. Used by write-path
 * commands when readInputData() throws with `.code === 'NO_STDIN'`.
 */
export function noStdinError(operation: string, cause: string): void {
  const msg = {
    error: `No JSON on stdin for '${operation}': ${cause}`,
    code: 'NO_STDIN',
    operation,
    examples: [
      "heredoc: geas <cmd> <<'JSON'\\n{\"key\":\"value\"}\\nJSON",
      'pipe:    echo \'{"key":"value"}\' | geas <cmd>',
      'redir:   geas <cmd> < payload.json',
    ],
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
