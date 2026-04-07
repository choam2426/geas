/**
 * Mission command group — spec.json, design-brief.json, mission directory creation.
 */

import type { Command } from 'commander';
import { success } from '../lib/output';

export function registerMissionCommands(program: Command): void {
  const cmd = program
    .command('mission')
    .description('Mission CRUD (spec, design-brief, directory)');

  cmd
    .command('get')
    .description('Read mission spec')
    .argument('<mission-id>', 'Mission identifier')
    .action((missionId: string) => {
      success({ stub: true, command: 'mission get', missionId });
    });
}
