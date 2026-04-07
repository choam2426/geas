/**
 * Evidence command group — evidence directory management, file write with schema validation.
 */

import type { Command } from 'commander';
import { success } from '../lib/output';

export function registerEvidenceCommands(program: Command): void {
  const cmd = program
    .command('evidence')
    .description('Evidence directory management and file write');

  cmd
    .command('get')
    .description('Read an evidence file')
    .argument('<task-id>', 'Task identifier')
    .argument('<filename>', 'Evidence filename')
    .action((taskId: string, filename: string) => {
      success({ stub: true, command: 'evidence get', taskId, filename });
    });
}
