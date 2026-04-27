/**
 * `geas schema` — inspect embedded JSON schemas.
 *
 * Subcommands:
 *   geas schema list              — list schema names
 *   geas schema show <name>       — dump a single schema as JSON
 *   geas schema dump              — dump all schemas as a { name: schema } map
 *   geas schema template <name> --op <op> [--kind <k>]
 *                                  — agent-facing scaffold for a write op.
 *
 * `template` returns three blocks:
 *   - `you_must_fill`: an object skeleton derived from the schema's
 *     `required` list minus CLI-injected envelope fields. Placeholder
 *     values hint types (enums, markdown, numbers, etc.).
 *   - `cli_will_inject`: the envelope fields the CLI stamps for this op.
 *   - `notes`: short meta about schema / op / kind.
 *
 * For `allOf`-based schemas whose required fields depend on a
 * discriminator (evidence's `evidence_kind`), `--kind` selects the
 * variant; omitting it is a hard error with a list of valid kinds.
 */

import type { Command } from 'commander';
import { SCHEMAS, SCHEMA_NAMES } from '../lib/schemas-embedded';
import { emitErr, emitOk, registerFormatter } from '../lib/output';
import { makeError } from '../lib/errors';
import {
  findSpec,
  supportedOpsForSchema,
  supportedSchemas,
} from '../lib/envelope-fields';

/*
 * T2.a (mission-20260427-xIPG1sDY task-002): migrated off the legacy
 * envelope.emit/err/ok bridge to call output.emitOk / output.emitErr +
 * errors.makeError directly. Per AC2, every invalid_argument error
 * site rotates exit code from legacy 1 to category 2 (validation).
 *
 * Note on structured hints: the legacy `err()` accepted a free-form
 * `hints` payload (e.g. {valid_kinds: [...]}) for invalid-kind
 * errors. The new CliErrorV2 shape carries `hint` as a single string,
 * so the structured info is folded into the hint message itself
 * (the message line already contains the same data, so no
 * information is lost — only the JSON consumer's hints object key
 * changes).
 */

// ── Schema-shape helpers ──────────────────────────────────────────────

interface JsonProp {
  type?: string | string[];
  enum?: unknown[];
  format?: string;
  description?: string;
  items?: JsonProp;
  minItems?: number;
  properties?: Record<string, JsonProp>;
  required?: string[];
  $ref?: string;
  oneOf?: JsonProp[];
  anyOf?: JsonProp[];
  allOf?: JsonProp[];
  const?: unknown;
  [k: string]: unknown;
}

interface JsonSchema extends JsonProp {
  $defs?: Record<string, JsonProp>;
}

/**
 * Resolve an in-schema `$ref` like `#/$defs/entry` against the root
 * schema. Returns undefined if the ref target is missing or external.
 */
function resolveRef(root: JsonSchema, ref: string): JsonProp | undefined {
  if (!ref.startsWith('#/')) return undefined;
  const parts = ref.slice(2).split('/');
  let cur: unknown = root;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur as JsonProp | undefined;
}

/**
 * Produce a placeholder value for a property based on its shape.
 * Placeholders are deliberately human-readable hints (e.g. `<enum: ...>`)
 * rather than schema-valid dummies — the agent replaces them before
 * sending the payload back.
 */
function placeholderFor(prop: JsonProp, root: JsonSchema): unknown {
  if (prop.$ref) {
    const resolved = resolveRef(root, prop.$ref);
    if (resolved) return placeholderFor(resolved, root);
    return `<ref ${prop.$ref}>`;
  }

  // oneOf / anyOf: pick the first non-null variant.
  if (Array.isArray(prop.oneOf) && prop.oneOf.length > 0) {
    const nonNull = prop.oneOf.find((v) => v.type !== 'null') ?? prop.oneOf[0];
    return placeholderFor(nonNull, root);
  }
  if (Array.isArray(prop.anyOf) && prop.anyOf.length > 0) {
    const nonNull = prop.anyOf.find((v) => v.type !== 'null') ?? prop.anyOf[0];
    return placeholderFor(nonNull, root);
  }

  if (Array.isArray(prop.enum) && prop.enum.length > 0) {
    return `<enum: ${prop.enum.join(' | ')}>`;
  }

  // Array
  if (prop.type === 'array') {
    const hint: string[] = [];
    if (typeof prop.minItems === 'number' && prop.minItems > 0) {
      hint.push(`at least ${prop.minItems} item${prop.minItems === 1 ? '' : 's'}`);
    }
    if (prop.items) {
      // Place one example item so the agent can see the inner shape.
      const exampleItem = placeholderFor(prop.items, root);
      if (hint.length > 0) {
        return [`<${hint.join(', ')}>`, exampleItem];
      }
      return [exampleItem];
    }
    return hint.length > 0 ? [`<${hint.join(', ')}>`] : [];
  }

  // Object
  if (prop.type === 'object' || prop.properties) {
    const out: Record<string, unknown> = {};
    const required = prop.required ?? [];
    if (prop.properties) {
      for (const k of required) {
        const child = prop.properties[k];
        if (!child) continue;
        out[k] = placeholderFor(child, root);
      }
    }
    return out;
  }

  // Scalars
  if (prop.type === 'string') {
    if (prop.format === 'date-time') {
      return '<iso-8601 date-time (CLI may inject)>';
    }
    const desc = typeof prop.description === 'string' ? prop.description : '';
    if (desc.toLowerCase().includes('markdown')) {
      return '<markdown allowed>';
    }
    if (desc.length > 80) {
      return '<REQUIRED: ' + desc.slice(0, 77).replace(/\s+/g, ' ') + '...>';
    }
    if (desc.length > 0) {
      return '<REQUIRED: ' + desc.replace(/\s+/g, ' ') + '>';
    }
    return '<REQUIRED: string>';
  }
  if (prop.type === 'integer' || prop.type === 'number') return 0;
  if (prop.type === 'boolean') return false;
  if (prop.type === 'null') return null;

  return '<unknown>';
}

/**
 * Collect valid `evidence_kind` discriminator values for the evidence
 * entry schema's allOf branches. Returns an empty array when the schema
 * is not allOf-keyed.
 */
function allOfKinds(entryProp: JsonProp | undefined): string[] {
  if (!entryProp || !Array.isArray(entryProp.allOf)) return [];
  const kinds: string[] = [];
  for (const branch of entryProp.allOf) {
    const ifProp = branch['if'] as JsonProp | undefined;
    if (!ifProp || !ifProp.properties) continue;
    const disc = ifProp.properties['evidence_kind'];
    if (disc && disc.const !== undefined) {
      kinds.push(String(disc.const));
    }
  }
  return kinds;
}

/**
 * Find the matching allOf branch for a given evidence_kind. Returns its
 * `then` block (the required + properties narrowing).
 */
function allOfBranch(
  entryProp: JsonProp | undefined,
  kind: string,
): JsonProp | undefined {
  if (!entryProp || !Array.isArray(entryProp.allOf)) return undefined;
  for (const branch of entryProp.allOf) {
    const ifProp = branch['if'] as JsonProp | undefined;
    if (!ifProp || !ifProp.properties) continue;
    const disc = ifProp.properties['evidence_kind'];
    if (disc && disc.const === kind) {
      return branch['then'] as JsonProp | undefined;
    }
  }
  return undefined;
}

/**
 * Build `you_must_fill` for evidence append with a specific kind.
 * Merges the generic entry required list with the kind-specific
 * narrowing from allOf, then strips CLI-injected fields.
 */
function buildEvidenceTemplate(
  root: JsonSchema,
  kind: string,
  envelope: readonly string[],
): { you_must_fill: Record<string, unknown>; valid_kinds: string[] } {
  const defs = root.$defs ?? {};
  const entry = defs['entry'] as JsonProp | undefined;
  if (!entry) return { you_must_fill: {}, valid_kinds: [] };
  const kinds = allOfKinds(entry);
  if (!kinds.includes(kind)) {
    return { you_must_fill: {}, valid_kinds: kinds };
  }

  const branch = allOfBranch(entry, kind);
  const baseRequired = entry.required ?? [];
  const branchRequired = branch?.required ?? [];
  // Deduplicated union.
  const required = [...new Set([...baseRequired, ...branchRequired])];

  const baseProps = entry.properties ?? {};
  const branchProps = branch?.properties ?? {};

  const out: Record<string, unknown> = {};
  for (const k of required) {
    if (envelope.includes(k)) continue;
    // Branch narrowing wins for enum restrictions (e.g. verdict).
    const prop = branchProps[k] ?? baseProps[k];
    if (!prop) continue;
    // Inject the discriminator value rather than a placeholder.
    if (k === 'evidence_kind') {
      out[k] = kind;
      continue;
    }
    out[k] = placeholderFor(prop, root);
  }
  return { you_must_fill: out, valid_kinds: kinds };
}

/**
 * Build `you_must_fill` for a non-variant schema write. Walks the top
 * level `required` list and produces a placeholder for each field that
 * isn't in the envelope.
 *
 * For `append` ops that write into a `entries` array (deliberation,
 * phase-reviews, mission-verdicts, gate-results), the CLI wraps each
 * entry in an `entries[]` under the file's envelope. The agent-facing
 * payload for those ops is a single entry body, not the whole file —
 * so we walk $defs.entry / $defs.review / $defs.verdict / $defs.gateRun
 * when that is the shape the command writes.
 */
function buildPlainTemplate(
  root: JsonSchema,
  schemaName: string,
  op: string,
  envelope: readonly string[],
): Record<string, unknown> {
  // Ops that write per-entry payloads into an `entries` array use the
  // inner entry shape for the agent template. Plain file-level ops use
  // the root shape.
  const entryShapeByAppend: Record<string, string> = {
    deliberation: 'entry',
    'phase-reviews': 'review',
    'mission-verdicts': 'verdict',
    'gate-results': 'gateRun',
    debts: 'debtItem',
  };

  let target: JsonProp = root;
  if ((op === 'append' || op === 'run' || op === 'register') &&
      entryShapeByAppend[schemaName]) {
    const defName = entryShapeByAppend[schemaName];
    const defs = root.$defs ?? {};
    const inner = defs[defName];
    if (inner) target = inner;
  }

  const required = target.required ?? [];
  const properties = target.properties ?? {};

  const out: Record<string, unknown> = {};
  for (const k of required) {
    if (envelope.includes(k)) continue;
    const prop = properties[k];
    if (!prop) continue;
    out[k] = placeholderFor(prop, root);
  }
  return out;
}

/**
 * AC3 (mission-20260427-xIPG1sDY task-006): scalar formatters for the
 * four schema subcommands. Each renders a compact summary instead of
 * dumping the full schema body — `--json` gives the full envelope.
 */
function formatSchemaList(data: unknown): string {
  const d = data as { schemas?: string[] };
  const names = Array.isArray(d.schemas) ? d.schemas : [];
  return `schemas (${names.length}): ${names.join(', ')}`;
}
function formatSchemaShow(data: unknown): string {
  const d = data as { name?: string; schema?: { title?: string; properties?: Record<string, unknown>; required?: string[] } };
  const props = d.schema?.properties ? Object.keys(d.schema.properties).length : 0;
  const required = d.schema?.required ?? [];
  return `schema ${d.name ?? '<unknown>'}: title=${d.schema?.title ?? '<none>'} props=${props} required=[${required.join(', ')}]`;
}
function formatSchemaDump(data: unknown): string {
  const d = data as { schemas?: Record<string, unknown> };
  const names = d.schemas ? Object.keys(d.schemas) : [];
  return `schemas dump (${names.length}): ${names.join(', ')}`;
}
function formatSchemaTemplate(data: unknown): string {
  const d = data as { you_must_fill?: Record<string, unknown>; cli_will_inject?: string[]; notes?: { schema?: string; op?: string; kind?: string | null } };
  const fillKeys = d.you_must_fill ? Object.keys(d.you_must_fill) : [];
  const inject = Array.isArray(d.cli_will_inject) ? d.cli_will_inject : [];
  const lines: string[] = [];
  lines.push(`schema template: ${d.notes?.schema ?? '<schema>'} --op ${d.notes?.op ?? '<op>'}${d.notes?.kind ? ` --kind ${d.notes.kind}` : ''}`);
  lines.push(`you_must_fill: ${fillKeys.join(', ')}`);
  lines.push(`cli_will_inject: ${inject.join(', ')}`);
  return lines.join('\n');
}

export function registerSchemaCommands(program: Command): void {
  registerFormatter('schema list', formatSchemaList);
  registerFormatter('schema show', formatSchemaShow);
  registerFormatter('schema dump', formatSchemaDump);
  registerFormatter('schema template', formatSchemaTemplate);
  const schema = program.command('schema').description('Inspect embedded JSON schemas');

  schema
    .command('list')
    .description('List embedded schema names')
    .action(() => {
      emitOk('schema list', { schemas: [...SCHEMA_NAMES].sort() });
    });

  schema
    .command('show <name>')
    .description('Print a single embedded schema as JSON')
    .action((name: string) => {
      const s = SCHEMAS[name];
      if (!s) {
        emitErr(
          makeError(
            'invalid_argument',
            `unknown schema '${name}'. Available: ${SCHEMA_NAMES.join(', ')}`,
            {
              hint: `pick one of: ${SCHEMA_NAMES.join(', ')}`,
              exit_category: 'validation',
            },
          ),
        );
      }
      emitOk('schema show', { name, schema: s });
    });

  schema
    .command('dump')
    .description('Dump every embedded schema as {name: schema}')
    .action(() => {
      emitOk('schema dump', { schemas: SCHEMAS });
    });

  schema
    .command('template <name>')
    .description(
      'Emit an agent-facing write scaffold: { you_must_fill, cli_will_inject, notes }. --op selects the operation; --kind selects allOf variants (e.g. evidence_kind).',
    )
    .requiredOption('--op <op>', 'Operation (create|set|append|update|draft|register|update-status|run)')
    .option('--kind <kind>', 'Discriminator (e.g. review, verification, closure, implementation for evidence)')
    .action((name: string, opts: { op: string; kind?: string }) => {
      if (!SCHEMAS[name]) {
        emitErr(
          makeError(
            'invalid_argument',
            `unknown schema '${name}'. Available: ${SCHEMA_NAMES.join(', ')}`,
            {
              hint: `pick one of: ${SCHEMA_NAMES.join(', ')}`,
              exit_category: 'validation',
            },
          ),
        );
      }
      const spec = findSpec(name, opts.op);
      if (!spec) {
        const validOps = supportedOpsForSchema(name);
        const msg = validOps.length === 0
          ? `schema '${name}' has no registered template ops. Supported schemas: ${supportedSchemas().join(', ')}`
          : `op '${opts.op}' is not registered for schema '${name}'. Valid ops: ${validOps.join(', ')}`;
        const hint = validOps.length === 0
          ? `try one of these schemas instead: ${supportedSchemas().join(', ')}`
          : `valid ops for '${name}': ${validOps.join(', ')}`;
        emitErr(
          makeError('invalid_argument', msg, {
            hint,
            exit_category: 'validation',
          }),
        );
      }

      const root = SCHEMAS[name] as JsonSchema;

      // Evidence append is the only allOf-keyed schema we template.
      let you_must_fill: Record<string, unknown>;
      let valid_kinds: string[] = [];

      if (name === 'evidence' && opts.op === 'append') {
        const defs = root.$defs ?? {};
        const entry = defs['entry'] as JsonProp | undefined;
        valid_kinds = allOfKinds(entry);
        if (!opts.kind) {
          emitErr(
            makeError(
              'invalid_argument',
              `schema 'evidence' requires --kind (evidence_kind discriminator). Valid kinds: ${valid_kinds.join(', ')}`,
              {
                hint: `re-run with --kind <one of: ${valid_kinds.join(', ')}>`,
                exit_category: 'validation',
              },
            ),
          );
        }
        if (!valid_kinds.includes(opts.kind as string)) {
          emitErr(
            makeError(
              'invalid_argument',
              `unknown kind '${opts.kind}' for schema 'evidence'. Valid kinds: ${valid_kinds.join(', ')}`,
              {
                hint: `--kind must be one of: ${valid_kinds.join(', ')}`,
                exit_category: 'validation',
              },
            ),
          );
        }
        const built = buildEvidenceTemplate(
          root,
          opts.kind as string,
          (spec as { envelope: readonly string[] }).envelope,
        );
        you_must_fill = built.you_must_fill;
      } else {
        // --kind on non-variant schemas is a warning-level no-op; we
        // surface it in notes rather than erroring.
        you_must_fill = buildPlainTemplate(
          root,
          name,
          opts.op,
          (spec as { envelope: readonly string[] }).envelope,
        );
      }

      emitOk('schema template', {
        you_must_fill,
        cli_will_inject: [...(spec as { envelope: readonly string[] }).envelope],
        notes: {
          schema: name,
          op: opts.op,
          kind: opts.kind ?? null,
          valid_kinds: valid_kinds.length > 0 ? valid_kinds : undefined,
          example_hint: (spec as { hint?: string }).hint ?? '',
        },
      });
    });
}
