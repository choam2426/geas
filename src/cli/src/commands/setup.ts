/**
 * `geas setup` — bootstrap the `.geas/` tree.
 *
 * Creates the canonical runtime layout specified in protocol doc 08:
 *
 *   .geas/
 *     config.json      — project-level config (minimal bootstrap)
 *     debts.json       — empty debts ledger (valid per debts schema)
 *     events.jsonl     — empty event log
 *     memory/
 *       shared.md      — empty shared memory
 *       agents/        — (directory)
 *     missions/        — (directory)
 *     .tmp/            — (directory)
 *
 * Existing files are preserved (no-op on re-run). Only missing pieces
 * are created.
 *
 * Note: consolidation candidates live per-mission at
 * `missions/{id}/consolidation/candidates.json`, written by
 * `geas consolidation scaffold`. There is no project-level candidates
 * file — the old `.geas/candidates.json` bootstrap was unused by any
 * consumer and has been removed.
 *
 * T2.a (mission-20260427-xIPG1sDY task-002): migrated off the legacy
 * envelope.emit/err/ok bridge to call output.emitOk / output.emitErr +
 * errors.makeError directly. Single-system lock-in: both success and
 * error paths use the new framework. Per AC2, the io_error from a
 * filesystem failure rotates to exit_category 'io' (legacy=4, new=5
 * per EXIT_CATEGORY_CODE).
 */

import type { Command } from 'commander';
import * as path from 'path';
import { atomicWrite, atomicWriteJson, ensureDir, exists } from '../lib/fs-atomic';
import { emitErr, emitOk } from '../lib/output';
import { makeError } from '../lib/errors';
import {
  agentsMemoryDir,
  configPath,
  debtsPath,
  eventsPath,
  geasDir,
  memoryDir,
  missionsDir,
  sharedMemoryPath,
  tmpDir,
} from '../lib/paths';

const COMMAND_NAME = 'setup';

function nowUtc(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function registerSetupCommand(program: Command): void {
  program
    .command(COMMAND_NAME)
    .description('Initialize the .geas/ runtime tree for the current project')
    .action(() => {
      try {
        const root = process.cwd();
        const created: string[] = [];
        const existed: string[] = [];

        const recordDir = (p: string): void => {
          if (!exists(p)) {
            ensureDir(p);
            created.push(relToRoot(root, p));
          } else {
            existed.push(relToRoot(root, p));
          }
        };

        const recordFile = (p: string, writer: () => void): void => {
          if (!exists(p)) {
            writer();
            created.push(relToRoot(root, p));
          } else {
            existed.push(relToRoot(root, p));
          }
        };

        // Directories first
        recordDir(geasDir(root));
        recordDir(memoryDir(root));
        recordDir(agentsMemoryDir(root));
        recordDir(missionsDir(root));
        recordDir(tmpDir(root));

        // config.json
        recordFile(configPath(root), () => {
          atomicWriteJson(configPath(root), {
            created_at: nowUtc(),
          });
        });

        // debts.json — must be a valid empty debts artifact
        recordFile(debtsPath(root), () => {
          const ts = nowUtc();
          atomicWriteJson(debtsPath(root), {
            entries: [],
            created_at: ts,
            updated_at: ts,
          });
        });

        // events.jsonl — empty file
        recordFile(eventsPath(root), () => {
          atomicWrite(eventsPath(root), '');
        });

        // shared.md — empty markdown
        recordFile(sharedMemoryPath(root), () => {
          atomicWrite(sharedMemoryPath(root), '');
        });

        emitOk(COMMAND_NAME, {
          project_root: root.replace(/\\/g, '/'),
          geas_dir: geasDir(root).replace(/\\/g, '/'),
          created,
          existed,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        emitErr(
          makeError('io_error', `setup failed: ${msg}`, {
            hint: 'check filesystem permissions and that the project directory is writable',
            exit_category: 'io',
          }),
        );
      }
    });
}

function relToRoot(root: string, target: string): string {
  return path.relative(root, target).replace(/\\/g, '/');
}
