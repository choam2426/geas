/**
 * Geas CLI entry point.
 *
 * Creates the commander program, registers all 15 command groups,
 * sets global options, and exports run() for the index.js bootstrap.
 *
 * This file is pure wiring — no business logic belongs here.
 */

import { Command } from 'commander';

import { registerStateCommands } from './commands/state';
import { registerMissionCommands } from './commands/mission';
import { registerTaskCommands } from './commands/task';
import { registerEvidenceCommands } from './commands/evidence';
import { registerEventCommands } from './commands/event';
import { registerLockCommands } from './commands/lock';
import { registerDebtCommands } from './commands/debt';
import { registerMemoryCommands } from './commands/memory';
import { registerContextCommands } from './commands/context';
import { registerRecoveryCommands } from './commands/recovery';
import { registerPhaseCommands } from './commands/phase';
import { registerDecisionCommands } from './commands/decision';
import { registerHealthCommands } from './commands/health';
import { registerEvolutionCommands } from './commands/evolution';
import { registerPacketCommands } from './commands/packet';

function getVersion(): string {
  try {
    // Use require to read package.json version at runtime.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('../package.json');
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export function run(): void {
  const program = new Command();

  program
    .name('geas')
    .description('Geas CLI — atomic commands for .geas/ file I/O')
    .version(getVersion());

  // Global options
  program.option('--cwd <path>', 'Override working directory');
  program.option('--json', 'Force JSON output (default: true)', true);

  // Register all 15 command groups
  registerStateCommands(program);
  registerMissionCommands(program);
  registerTaskCommands(program);
  registerEvidenceCommands(program);
  registerEventCommands(program);
  registerLockCommands(program);
  registerDebtCommands(program);
  registerMemoryCommands(program);
  registerContextCommands(program);
  registerRecoveryCommands(program);
  registerPhaseCommands(program);
  registerDecisionCommands(program);
  registerHealthCommands(program);
  registerEvolutionCommands(program);
  registerPacketCommands(program);

  program.parse(process.argv);
}
