/**
 * Schema command group — list available schemas, generate fill-in templates.
 */

import type { Command } from 'commander';
import { listSchemas, generateTemplate } from '../lib/schema-template';
import { success } from '../lib/output';

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
    .action((type: string, opts: { role?: string }) => {
      try {
        const template = generateTemplate(type, { role: opts.role });
        success(template);
      } catch (err) {
        const msg = {
          error: (err as Error).message,
          code: 'SCHEMA_ERROR',
        };
        process.stderr.write(JSON.stringify(msg) + '\n');
        process.exit(1);
      }
    });
}
