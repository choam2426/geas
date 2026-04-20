/**
 * `geas schema` — inspect embedded JSON schemas.
 *
 * Subcommands:
 *   geas schema list              — list schema names
 *   geas schema show <name>       — dump a single schema as JSON
 *   geas schema dump              — dump all schemas as a { name: schema } map
 */

import type { Command } from 'commander';
import { SCHEMAS, SCHEMA_NAMES } from '../lib/schemas-embedded';
import { emit, err, ok } from '../lib/envelope';

export function registerSchemaCommands(program: Command): void {
  const schema = program.command('schema').description('Inspect embedded JSON schemas');

  schema
    .command('list')
    .description('List embedded schema names')
    .action(() => {
      emit(ok({ schemas: [...SCHEMA_NAMES].sort() }));
    });

  schema
    .command('show <name>')
    .description('Print a single embedded schema as JSON')
    .action((name: string) => {
      const s = SCHEMAS[name];
      if (!s) {
        emit(
          err(
            'invalid_argument',
            `unknown schema '${name}'. Available: ${SCHEMA_NAMES.join(', ')}`,
          ),
        );
      }
      emit(ok({ name, schema: s }));
    });

  schema
    .command('dump')
    .description('Dump every embedded schema as {name: schema}')
    .action(() => {
      emit(ok({ schemas: SCHEMAS }));
    });
}
