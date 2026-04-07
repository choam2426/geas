/**
 * Task command group — task-contract files, status transitions.
 */

import type { Command } from 'commander';
import { success } from '../lib/output';

export function registerTaskCommands(program: Command): void {
  const cmd = program
    .command('task')
    .description('Task CRUD (contracts, status transitions)');

  cmd
    .command('get')
    .description('Read a task contract')
    .argument('<task-id>', 'Task identifier')
    .action((taskId: string) => {
      success({ stub: true, command: 'task get', taskId });
    });
}
