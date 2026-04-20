/**
 * Geas CLI entry point.
 *
 * G1 ships the foundation command set: setup, context, schema, state.
 * G2 adds mission; G3 adds task; G4 adds evidence / self-check /
 * deliberation / gate; G5 adds memory (shared.md + agents/{type}.md).
 *
 * This module is pure wiring — no business logic lives here.
 */

import { Command } from 'commander';
import { registerSetupCommand } from './commands/setup';
import { registerContextCommand } from './commands/context';
import { registerSchemaCommands } from './commands/schema';
import { registerStateCommands } from './commands/state';
import { registerMissionCommands } from './commands/mission';
import { registerTaskCommands } from './commands/task';
import { registerEvidenceCommands } from './commands/evidence';
import { registerSelfCheckCommands } from './commands/self-check';
import { registerDeliberationCommands } from './commands/deliberation';
import { registerGateCommands } from './commands/gate';
import { registerMemoryCommands } from './commands/memory';

const VERSION = '0.10.0';

export function run(): void {
  const program = new Command();

  program
    .name('geas')
    .description('Geas CLI — atomic actuator for .geas/ runtime artifacts')
    .version(VERSION);

  registerSetupCommand(program);
  registerContextCommand(program);
  registerSchemaCommands(program);
  registerStateCommands(program);
  registerMissionCommands(program);
  registerTaskCommands(program);
  registerEvidenceCommands(program);
  registerSelfCheckCommands(program);
  registerDeliberationCommands(program);
  registerGateCommands(program);
  registerMemoryCommands(program);

  program.parse(process.argv);
}
