/**
 * Shared --cwd resolution for all command groups.
 *
 * Uses optsWithGlobals() to traverse the full command hierarchy,
 * which works regardless of subcommand nesting depth.
 */

import type { Command } from 'commander';

/** Resolve cwd from the --cwd global option or process.cwd(). */
export function getCwd(cmd: Command): string {
  const opts = cmd.optsWithGlobals();
  return (opts.cwd as string) || process.cwd();
}
