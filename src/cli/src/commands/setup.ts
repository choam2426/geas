/**
 * `geas setup` — bootstrap the `.geas/` tree.
 *
 * Creates the canonical runtime layout specified in protocol doc 08:
 *
 *   .geas/
 *     config.json      — project-level config (minimal bootstrap)
 *     debts.json       — empty debts ledger (valid per debts schema)
 *     events.jsonl     — empty event log
 *     candidates.json  — empty project candidates cache
 *     memory/
 *       shared.md      — empty shared memory
 *       agents/        — (directory)
 *     missions/        — (directory)
 *     .tmp/            — (directory)
 *
 * Existing files are preserved (no-op on re-run). Only missing pieces
 * are created.
 */

import type { Command } from 'commander';
import * as path from 'path';
import { atomicWrite, atomicWriteJson, ensureDir, exists } from '../lib/fs-atomic';
import { emit, ok, err } from '../lib/envelope';
import {
  agentsMemoryDir,
  candidatesPath,
  configPath,
  debtsPath,
  eventsPath,
  geasDir,
  memoryDir,
  missionsDir,
  sharedMemoryPath,
  tmpDir,
} from '../lib/paths';

function nowUtc(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function registerSetupCommand(program: Command): void {
  program
    .command('setup')
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

        // candidates.json — project-level scratch cache (empty)
        recordFile(candidatesPath(root), () => {
          atomicWriteJson(candidatesPath(root), {
            created_at: nowUtc(),
            entries: [],
          });
        });

        // shared.md — empty markdown
        recordFile(sharedMemoryPath(root), () => {
          atomicWrite(sharedMemoryPath(root), '');
        });

        emit(
          ok({
            project_root: root.replace(/\\/g, '/'),
            geas_dir: geasDir(root).replace(/\\/g, '/'),
            created,
            existed,
          }),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        emit(err('io_error', `setup failed: ${msg}`));
      }
    });
}

function relToRoot(root: string, target: string): string {
  return path.relative(root, target).replace(/\\/g, '/');
}
