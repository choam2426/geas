/**
 * Lock command group — acquire, release, list, and cleanup locks in locks.json.
 */

import * as path from 'path';
import type { Command } from 'commander';
import { resolveGeasDir } from '../lib/paths';
import { readJsonFile, atomicWriteJsonFile } from '../lib/fs-atomic';
import { success, fileError } from '../lib/output';
import { getCwd } from '../lib/cwd';

/** Shape of a single lock entry per lock-manifest.schema.json. */
interface LockEntry {
  lock_type: string;
  task_id: string;
  session_id: string;
  targets: string[];
  status: 'held' | 'waiting';
  acquired_at: string;
  wait_start?: string;
}

/** Shape of the locks.json file per lock-manifest.schema.json. */
interface LockManifest {
  version: string;
  locks: LockEntry[];
  created_at?: string;
}

/** Resolve the locks.json path. */
function locksJsonPath(geasDir: string): string {
  return path.join(geasDir, 'state', 'locks.json');
}

/** Read locks.json, returning a default empty manifest if not found. */
function readLocks(geasDir: string): LockManifest {
  const filePath = locksJsonPath(geasDir);
  const data = readJsonFile<LockManifest>(filePath);
  if (data === null) {
    return { version: '1.0', locks: [] };
  }
  return data;
}

/**
 * Detect conflicts: another task already holds a lock of the same type
 * with overlapping targets.
 */
function findConflicts(
  locks: LockEntry[],
  taskId: string,
  lockType: string,
  targets: string[]
): LockEntry[] {
  return locks.filter(
    (l) =>
      l.status === 'held' &&
      l.task_id !== taskId &&
      l.lock_type === lockType &&
      l.targets.some((t) => targets.includes(t))
  );
}

export function registerLockCommands(program: Command): void {
  const cmd = program
    .command('lock')
    .description('Lock manifest management (acquire, release, query)');

  // --- lock acquire ---
  cmd
    .command('acquire')
    .description('Acquire a lock for a task')
    .requiredOption('--task <id>', 'Task ID requesting the lock')
    .requiredOption(
      '--type <type>',
      'Lock type (path, interface, resource, integration)'
    )
    .requiredOption(
      '--targets <targets>',
      'Comma-separated lock targets'
    )
    .option('--session <id>', 'Session ID')
    .action(
      (opts: {
        task: string;
        type: string;
        targets: string;
        session?: string;
      }) => {
        try {
          const cwd = getCwd(cmd);
          const geas = resolveGeasDir(cwd);
          const filePath = locksJsonPath(geas);
          const manifest = readLocks(geas);
          const now = new Date()
            .toISOString()
            .replace(/\.\d{3}Z$/, 'Z');

          const targets = opts.targets
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);

          if (targets.length === 0) {
            fileError(filePath, 'acquire', 'No targets specified');
            return;
          }

          const sessionId =
            opts.session || `session-${now.replace(/[:.]/g, '-')}`;

          // Check if same task already holds an identical lock (idempotent re-acquire)
          const existingLock = manifest.locks.find(
            (l) =>
              l.task_id === opts.task &&
              l.lock_type === opts.type &&
              l.status === 'held' &&
              targets.every((t) => l.targets.includes(t)) &&
              l.targets.every((t) => targets.includes(t))
          );
          if (existingLock) {
            success({
              acquired: true,
              lock: existingLock,
              already_held: true,
            });
            return;
          }

          // Check for conflicts
          const conflicts = findConflicts(
            manifest.locks,
            opts.task,
            opts.type,
            targets
          );

          const newLock: LockEntry = {
            lock_type: opts.type,
            task_id: opts.task,
            session_id: sessionId,
            targets,
            status: conflicts.length > 0 ? 'waiting' : 'held',
            acquired_at: now,
          };

          if (conflicts.length > 0) {
            newLock.wait_start = now;
          }

          manifest.locks.push(newLock);
          atomicWriteJsonFile(filePath, manifest, { cwd });

          success({
            acquired: conflicts.length === 0,
            lock: newLock,
            ...(conflicts.length > 0
              ? {
                  conflicts: conflicts.map((c) => ({
                    task_id: c.task_id,
                    targets: c.targets,
                  })),
                }
              : {}),
          });
        } catch (err: unknown) {
          const e = err as NodeJS.ErrnoException;
          fileError('.geas/state/locks.json', 'acquire', e.message);
        }
      }
    );

  // --- lock release ---
  cmd
    .command('release')
    .description('Release all locks held by a task')
    .requiredOption('--task <id>', 'Task ID whose locks to release')
    .action((opts: { task: string }) => {
      try {
        const cwd = getCwd(cmd);
        const geas = resolveGeasDir(cwd);
        const filePath = locksJsonPath(geas);
        const manifest = readLocks(geas);

        const before = manifest.locks.length;
        manifest.locks = manifest.locks.filter(
          (l) => l.task_id !== opts.task
        );
        const released = before - manifest.locks.length;

        // Promote waiting locks that no longer have conflicts
        for (const lock of manifest.locks) {
          if (lock.status === 'waiting') {
            const conflicts = findConflicts(
              manifest.locks,
              lock.task_id,
              lock.lock_type,
              lock.targets
            );
            if (conflicts.length === 0) {
              lock.status = 'held';
              lock.acquired_at = new Date()
                .toISOString()
                .replace(/\.\d{3}Z$/, 'Z');
              delete lock.wait_start;
            }
          }
        }

        atomicWriteJsonFile(filePath, manifest, { cwd });
        success({ released, task_id: opts.task });
      } catch (err: unknown) {
        const e = err as NodeJS.ErrnoException;
        fileError('.geas/state/locks.json', 'release', e.message);
      }
    });

  // --- lock list ---
  cmd
    .command('list')
    .description('List active locks')
    .option('--task <id>', 'Filter by task ID')
    .option('--type <type>', 'Filter by lock type')
    .action((opts: { task?: string; type?: string }) => {
      try {
        const geas = resolveGeasDir(getCwd(cmd));
        const manifest = readLocks(geas);

        let locks = manifest.locks;
        if (opts.task) {
          locks = locks.filter((l) => l.task_id === opts.task);
        }
        if (opts.type) {
          locks = locks.filter((l) => l.lock_type === opts.type);
        }

        success({ locks, count: locks.length });
      } catch (err: unknown) {
        const e = err as NodeJS.ErrnoException;
        fileError('.geas/state/locks.json', 'list', e.message);
      }
    });

  // --- lock cleanup ---
  cmd
    .command('cleanup')
    .description('Remove orphan locks from non-existent sessions')
    .requiredOption('--session <id>', 'Current valid session ID')
    .action((opts: { session: string }) => {
      try {
        const cwd = getCwd(cmd);
        const geas = resolveGeasDir(cwd);
        const filePath = locksJsonPath(geas);
        const manifest = readLocks(geas);

        const before = manifest.locks.length;
        // Remove locks whose session_id does not match the active session
        manifest.locks = manifest.locks.filter(
          (l) => l.session_id === opts.session
        );
        const removed = before - manifest.locks.length;

        atomicWriteJsonFile(filePath, manifest, { cwd });
        success({ cleaned: removed, remaining: manifest.locks.length });
      } catch (err: unknown) {
        const e = err as NodeJS.ErrnoException;
        fileError('.geas/state/locks.json', 'cleanup', e.message);
      }
    });
}
