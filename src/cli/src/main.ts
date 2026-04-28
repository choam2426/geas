/**
 * Geas CLI entry point.
 *
 * G1 ships the foundation command set: setup, context, schema, state.
 * G2 adds mission; G3 adds task; G4 adds evidence / self-check /
 * deliberation / gate; G5 adds memory (shared.md + agents/{type}.md);
 * G6 adds debt / gap / memory-update (consolidation artifacts); G7
 * adds event (explicit events.jsonl append).
 *
 * This module is pure wiring — no business logic lives here. T2
 * (mission-20260426-DbFKlpAr) adds the global --json / --verbose /
 * --debug flag layer; the flags are recognized at any subcommand depth
 * by walking every registered Command after wiring and attaching the
 * same option triple to each. The resolved state is then forwarded to
 * lib/output.ts via setOutputMode() before the subcommand action runs.
 */

import { Command, Option } from 'commander';
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
import { registerDebtCommands } from './commands/debt';
import { registerGapCommands } from './commands/gap';
import { registerMemoryUpdateCommands } from './commands/memory-update';
import { registerEventCommands } from './commands/event';
import { registerConsolidationCommands } from './commands/consolidation';
import { registerImplContractCommands } from './commands/impl-contract';
import { setOutputMode, type OutputMode } from './lib/output';

const VERSION = '0.14.0';

/**
 * Names of the global flags. Kept here as the single source of truth so
 * the recursive attach helper and the resolution helper agree.
 */
const GLOBAL_FLAG_FIELDS = ['json', 'verbose', 'debug'] as const;
type GlobalFlagField = (typeof GLOBAL_FLAG_FIELDS)[number];

/**
 * Build a fresh Option instance for a global flag. Returning a fresh
 * Option per attach is necessary because Commander's Option carries
 * per-Command parsed-value state; sharing one instance across subcommands
 * results in cross-talk.
 */
function makeGlobalFlagOption(field: GlobalFlagField): Option {
  switch (field) {
    case 'json':
      return new Option('--json', 'emit machine-readable JSON envelope on stdout');
    case 'verbose':
      return new Option('--verbose', 'include extra context in human-readable output');
    case 'debug':
      return new Option('--debug', 'include diagnostic detail (pairs with --json)');
  }
}

/**
 * Recursively attach the three global flags to `cmd` and every subcommand
 * underneath it. Idempotent per command: if a flag with the same long
 * name is already registered (e.g. an unlikely collision with a future
 * subcommand), we skip it rather than throwing.
 */
function attachGlobalFlagsRecursive(cmd: Command): void {
  for (const field of GLOBAL_FLAG_FIELDS) {
    const flagName = `--${field}`;
    const alreadyRegistered = cmd.options.some((o) => o.long === flagName);
    if (!alreadyRegistered) {
      cmd.addOption(makeGlobalFlagOption(field));
    }
  }
  for (const sub of cmd.commands) {
    attachGlobalFlagsRecursive(sub);
  }
}

/**
 * Walk the command tree starting at `leaf` toward the root, collecting
 * the most-specific value of each global flag. Subcommand-level
 * `--json` should win over program-level when both are present (it
 * usually won't be, since program-level is parsed before the subcommand
 * args, but we honor the leaf-most occurrence to match Commander's own
 * resolution behavior).
 */
function resolveGlobalFlags(leaf: Command): {
  mode: OutputMode;
  verbose: boolean;
  debug: boolean;
} {
  let json = false;
  let verbose = false;
  let debug = false;

  // Walk from root to leaf so leaf overrides win.
  const chain: Command[] = [];
  let cursor: Command | null = leaf;
  while (cursor) {
    chain.unshift(cursor);
    cursor = cursor.parent;
  }
  for (const node of chain) {
    const opts = node.opts();
    if (opts.json === true) json = true;
    if (opts.verbose === true) verbose = true;
    if (opts.debug === true) debug = true;
  }

  return {
    mode: json ? 'json' : 'default',
    verbose,
    debug,
  };
}

/**
 * Install hooks on `cmd` and every subcommand so that resolved global
 * flag values are pushed into the output module before the action body
 * runs. preAction fires once for the deepest subcommand that owns the
 * action (Commander semantics), so this catches every command.
 */
function installFlagPropagationHooks(cmd: Command): void {
  cmd.hook('preAction', (_thisCommand, actionCommand) => {
    setOutputMode(resolveGlobalFlags(actionCommand));
  });
  for (const sub of cmd.commands) {
    installFlagPropagationHooks(sub);
  }
}

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
  registerDebtCommands(program);
  registerGapCommands(program);
  registerMemoryUpdateCommands(program);
  registerEventCommands(program);
  registerConsolidationCommands(program);
  registerImplContractCommands(program);

  // Attach --json / --verbose / --debug to every command in the tree so
  // they are recognized at any depth, then install a preAction hook that
  // resolves the leaf-most flag values into lib/output's state.
  attachGlobalFlagsRecursive(program);
  installFlagPropagationHooks(program);

  program.parse(process.argv);
}
