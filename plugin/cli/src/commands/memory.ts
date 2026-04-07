/**
 * Memory command group — memory entry CRUD, index updates, candidate/promotion operations.
 */

import type { Command } from 'commander';
import { success } from '../lib/output';

export function registerMemoryCommands(program: Command): void {
  const cmd = program
    .command('memory')
    .description('Memory entry CRUD (candidates, promotion, index)');

  cmd
    .command('list')
    .description('List memory entries')
    .action(() => {
      success({ stub: true, command: 'memory list' });
    });
}
