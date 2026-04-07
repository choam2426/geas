/**
 * State command group — run.json read/write, checkpoint management.
 */

import type { Command } from 'commander';
import { success } from '../lib/output';

export function registerStateCommands(program: Command): void {
  const cmd = program
    .command('state')
    .description('Run state management (run.json, checkpoints)');

  cmd
    .command('get')
    .description('Read current run state')
    .action(() => {
      success({ stub: true, command: 'state get' });
    });
}
