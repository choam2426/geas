/**
 * Geas CLI entry point.
 *
 * G1 ships the foundation command set: setup, context, schema, state.
 * G2–G7 will register additional commands (mission, task, evidence, etc.).
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

const VERSION = '0.8.0';

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

  program.parse(process.argv);
}
