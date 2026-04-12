/**
 * Schema command group — list available schemas, generate fill-in templates.
 */

import type { Command } from 'commander';
import { listSchemas, generateTemplate, listRecordSections } from '../lib/schema-template';
import { success } from '../lib/output';
import type { TemplateOptions } from '../lib/schema-template';

export function registerSchemaCommands(program: Command): void {
  const schema = program.command('schema').description('Schema inspection utilities');

  schema
    .command('list')
    .description('List all available schema types')
    .action(() => {
      success(listSchemas());
    });

  schema
    .command('template <type>')
    .description('Generate a fill-in JSON template for a schema type')
    .option('--role <role>', 'Role variant (for evidence schema)')
    .option('--strip-envelope', 'Remove auto-injected envelope/CLI fields (default: true)')
    .option('--no-strip-envelope', 'Keep auto-injected envelope/CLI fields')
    .option('--section <name>', 'Extract a record section sub-schema')
    .option('--pretty', 'Pretty-print JSON output (default: false)')
    .action((type: string, opts: { role?: string; stripEnvelope?: boolean; section?: string; pretty?: boolean }) => {
      try {
        const templateOpts: TemplateOptions = {
          role: opts.role,
          stripEnvelope: opts.stripEnvelope,
          section: opts.section,
          pretty: opts.pretty,
        };
        const template = generateTemplate(type, templateOpts);
        if (opts.pretty) {
          process.stdout.write(JSON.stringify(template, null, 2) + '\n');
          process.exit(0);
        } else {
          success(template);
        }
      } catch (err) {
        const msg = {
          error: (err as Error).message,
          code: 'SCHEMA_ERROR',
        };
        process.stderr.write(JSON.stringify(msg) + '\n');
        process.exit(1);
      }
    });

  schema
    .command('sections')
    .description('List valid record section names')
    .action(() => {
      success(listRecordSections());
    });
}
