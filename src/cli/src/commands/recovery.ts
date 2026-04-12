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
import { success, validationError, fileError, noStdinError } from '../lib/output';
import { getCwd } from '../lib/cwd';
import { readInputData } from '../lib/input';
import { dryRunGuard, dryRunParseError } from '../lib/dry-run';

export function registerRecoveryCommands(program: Command): void {
  const cmd = program
    .command('recovery')
    .description('Recovery packet and session management');

  // --- write ---
  cmd
    .command('write')
    .description('Write a recovery packet (JSON via stdin)')
    .option('--dry-run', 'Validate input without writing files')
    .action((_opts: { dryRun?: boolean }, cmd: Command) => {
      try {
        const data = readInputData() as Record<string, unknown>;
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);

        const recoveryId = data.recovery_id as string;
        if (!recoveryId) {
          fileError('recovery/', 'write', 'recovery_id is required in stdin JSON');
          return;
        }
        validateIdentifier(recoveryId, 'recovery_id');

        // --dry-run: validate and exit without writing
        if (_opts.dryRun) {
          dryRunGuard(true, data, 'recovery-packet');
          return;
        }

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
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'NO_STDIN') {
          noStdinError('recovery write', nodeErr.message);
          return;
        }
        if (nodeErr.code === 'INVALID_JSON') {
          if (_opts.dryRun) { dryRunParseError(nodeErr.message); return; }
          fileError('recovery/', 'parse', nodeErr.message);
          return;
        }
        const msg = err instanceof SyntaxError
          ? 'Invalid JSON on stdin'
          : (err as Error).message;
        fileError('recovery/', 'write', msg);
      }
    });
}
