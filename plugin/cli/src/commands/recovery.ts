/**
 * Recovery command group — recovery packet read/write, session-latest.md management.
 */

import type { Command } from 'commander';
import { success } from '../lib/output';

export function registerRecoveryCommands(program: Command): void {
  const cmd = program
    .command('recovery')
    .description('Recovery packet and session management');

  cmd
    .command('get')
    .description('Read the current recovery packet')
    .action(() => {
      success({ stub: true, command: 'recovery get' });
    });
}
