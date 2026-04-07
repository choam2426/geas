/**
 * Event command group — ledger append (JSONL), event read/query.
 */

import type { Command } from 'commander';
import { success } from '../lib/output';

export function registerEventCommands(program: Command): void {
  const cmd = program
    .command('event')
    .description('Event ledger append and query (JSONL)');

  cmd
    .command('list')
    .description('List events from the ledger')
    .action(() => {
      success({ stub: true, command: 'event list' });
    });
}
