/**
 * Lock command group — lock manifest read/write, acquire/release/query.
 */

import type { Command } from 'commander';
import { success } from '../lib/output';

export function registerLockCommands(program: Command): void {
  const cmd = program
    .command('lock')
    .description('Lock manifest management (acquire, release, query)');

  cmd
    .command('list')
    .description('List active locks')
    .action(() => {
      success({ stub: true, command: 'lock list' });
    });
}
