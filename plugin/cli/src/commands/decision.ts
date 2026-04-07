/**
 * Decision command group — decision record read/write.
 */

import type { Command } from 'commander';
import { success } from '../lib/output';

export function registerDecisionCommands(program: Command): void {
  const cmd = program
    .command('decision')
    .description('Decision record read/write');

  cmd
    .command('list')
    .description('List decision records')
    .action(() => {
      success({ stub: true, command: 'decision list' });
    });
}
