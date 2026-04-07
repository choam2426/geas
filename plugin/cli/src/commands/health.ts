/**
 * Health command group — health check read/write.
 */

import type { Command } from 'commander';
import { success } from '../lib/output';

export function registerHealthCommands(program: Command): void {
  const cmd = program
    .command('health')
    .description('Health check read/write');

  cmd
    .command('get')
    .description('Read the current health check')
    .action(() => {
      success({ stub: true, command: 'health get' });
    });
}
