/**
 * Phase command group — phase review read/write.
 */

import type { Command } from 'commander';
import { success } from '../lib/output';

export function registerPhaseCommands(program: Command): void {
  const cmd = program
    .command('phase')
    .description('Phase review read/write');

  cmd
    .command('get')
    .description('Read the current phase review')
    .action(() => {
      success({ stub: true, command: 'phase get' });
    });
}
