/**
 * Debt command group — debt register read/write, item add/update.
 */

import type { Command } from 'commander';
import { success } from '../lib/output';

export function registerDebtCommands(program: Command): void {
  const cmd = program
    .command('debt')
    .description('Debt register management (add, update, list)');

  cmd
    .command('list')
    .description('List debt register items')
    .action(() => {
      success({ stub: true, command: 'debt list' });
    });
}
