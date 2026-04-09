/**
 * Recovery command group — write recovery packets to .geas/recovery/{id}.json.
 *
 * Recovery packets capture session recovery context:
 * recovery class, detected problem, recommended action, artifact inventory.
 */

import * as path from 'path';
import type { Command } from 'commander';
import { writeJsonFile } from '../lib/fs-atomic';
import { resolveGeasDir, validateIdentifier, assertContainedIn } from '../lib/paths';
import { validate } from '../lib/schema';
import { success, validationError, fileError } from '../lib/output';
import { getCwd } from '../lib/cwd';

export function registerRecoveryCommands(program: Command): void {
  const cmd = program
    .command('recovery')
    .description('Recovery packet and session management');

  // --- write ---
  cmd
    .command('write')
    .description('Write a recovery packet')
    .requiredOption('--data <json>', 'JSON recovery packet object')
    .action((opts: { data: string }, cmd: Command) => {
      try {
        const data = JSON.parse(opts.data) as Record<string, unknown>;
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);

        const recoveryId = data.recovery_id as string;
        if (!recoveryId) {
          fileError('recovery/', 'write', 'recovery_id is required in --data');
          return;
        }
        validateIdentifier(recoveryId, 'recovery_id');

        // Validate against recovery-packet schema
        const result = validate('recovery-packet', data);
        if (!result.valid) {
          validationError('recovery-packet', result.errors || []);
          return;
        }

        const filePath = path.resolve(geasDir, 'recovery', `${recoveryId}.json`);
        assertContainedIn(filePath, geasDir);
        writeJsonFile(filePath, data, { cwd });

        success({
          ok: true,
          recovery_id: recoveryId,
          path: filePath,
        });
      } catch (err: unknown) {
        const msg = err instanceof SyntaxError
          ? 'Invalid JSON in --data'
          : (err as Error).message;
        fileError('recovery/', 'write', msg);
      }
    });
}
