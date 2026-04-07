/**
 * Context command group — context packet read/write.
 */

import type { Command } from 'commander';
import { success } from '../lib/output';

export function registerContextCommands(program: Command): void {
  const cmd = program
    .command('context')
    .description('Context packet read/write');

  cmd
    .command('get')
    .description('Read a context packet')
    .argument('<packet-id>', 'Context packet identifier')
    .action((packetId: string) => {
      success({ stub: true, command: 'context get', packetId });
    });
}
