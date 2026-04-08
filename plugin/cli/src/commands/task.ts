/**
 * Task command group — create task contract, transition status,
 * read task contract, list tasks.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Command } from 'commander';
import { resolveGeasDir, normalizePath } from '../lib/paths';
import { readJsonFile, writeJsonFile, ensureDir } from '../lib/fs-atomic';
import { validate } from '../lib/schema';
import { success, validationError, fileError } from '../lib/output';
import { validateTransition } from '../lib/transition-guards';

// ── State transition validation ─────────────────────────────────────

/**
 * Valid state transitions for the 7-state task model.
 *
 * Primary chain: drafted -> ready -> implementing -> reviewed -> integrated -> verified -> passed
 * Auxiliary: any -> blocked|escalated|cancelled, blocked|escalated -> ready
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  drafted: ['ready', 'blocked', 'escalated', 'cancelled'],
  ready: ['implementing', 'blocked', 'escalated', 'cancelled'],
  implementing: ['reviewed', 'blocked', 'escalated', 'cancelled'],
  reviewed: ['integrated', 'blocked', 'escalated', 'cancelled'],
  integrated: ['verified', 'implementing', 'blocked', 'escalated', 'cancelled'],
  verified: ['passed', 'ready', 'implementing', 'reviewed', 'blocked', 'escalated', 'cancelled'],
  passed: ['blocked', 'escalated', 'cancelled'],
  blocked: ['ready', 'escalated', 'cancelled'],
  escalated: ['ready', 'blocked', 'cancelled'],
  cancelled: [],
};

function isValidTransition(from: string, to: string): boolean {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

// ── Input data reading ──────────────────────────────────────────────

/** Read JSON from --data flag or piped stdin. */
function readInputData(dataArg: string | undefined): unknown {
  let raw: string | undefined = dataArg;

  if (!raw) {
    // Try reading from stdin (piped, non-TTY)
    try {
      if (!process.stdin.isTTY) {
        raw = fs.readFileSync(0, 'utf-8').trim();
      }
    } catch {
      // stdin not available or empty
    }
  }

  if (!raw) {
    const err = new Error('No data provided. Use --data <json> or pipe JSON to stdin.');
    (err as NodeJS.ErrnoException).code = 'FILE_ERROR';
    throw err;
  }

  try {
    return JSON.parse(raw);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const err = new Error(`Invalid JSON in --data: ${msg}`);
    (err as NodeJS.ErrnoException).code = 'FILE_ERROR';
    throw err;
  }
}

export function registerTaskCommands(program: Command): void {
  const cmd = program
    .command('task')
    .description('Task CRUD (contracts, status transitions)');

  // ── geas task create --mission <mid> --data <json> ────────────────
  cmd
    .command('create')
    .description('Create a task contract with schema validation')
    .requiredOption('--mission <mission-id>', 'Mission identifier')
    .option('--data <json>', 'JSON data (or pipe via stdin)')
    .action((opts: { mission: string; data?: string }) => {
      try {
        const geasDir = resolveGeasDir(program.opts().cwd);
        const missionDir = path.resolve(geasDir, 'missions', opts.mission);

        if (!fs.existsSync(missionDir)) {
          fileError(
            normalizePath(missionDir),
            'create',
            `Mission directory not found: ${normalizePath(missionDir)}`
          );
          return;
        }

        const data = readInputData(opts.data) as Record<string, unknown>;

        // Validate against task-contract schema
        const result = validate('task-contract', data);
        if (!result.valid) {
          validationError('task-contract', result.errors!);
          return;
        }

        const taskId = data.task_id as string;
        if (!taskId) {
          fileError('', 'create', 'task_id is required in the data');
          return;
        }

        const tasksDir = path.resolve(missionDir, 'tasks');
        ensureDir(tasksDir);

        const taskPath = path.resolve(tasksDir, `${taskId}.json`);
        if (fs.existsSync(taskPath)) {
          fileError(
            normalizePath(taskPath),
            'create',
            `Task contract already exists: ${normalizePath(taskPath)}`
          );
          return;
        }

        writeJsonFile(taskPath, data);

        success({
          written: normalizePath(taskPath),
          task_id: taskId,
          mission_id: opts.mission,
          artifact_type: 'task_contract',
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'create', nodeErr.message);
        } else {
          throw err;
        }
      }
    });

  // ── geas task transition --mission <mid> --id <tid> --to <status> ─
  cmd
    .command('transition')
    .description('Validate and apply a task status transition')
    .requiredOption('--mission <mission-id>', 'Mission identifier')
    .requiredOption('--id <task-id>', 'Task identifier')
    .requiredOption('--to <status>', 'Target status')
    .action((opts: { mission: string; id: string; to: string }) => {
      try {
        const geasDir = resolveGeasDir(program.opts().cwd);
        const missionDir = path.resolve(geasDir, 'missions', opts.mission);

        if (!fs.existsSync(missionDir)) {
          fileError(
            normalizePath(missionDir),
            'transition',
            `Mission directory not found: ${normalizePath(missionDir)}`
          );
          return;
        }

        const taskPath = path.resolve(missionDir, 'tasks', `${opts.id}.json`);
        const task = readJsonFile<Record<string, unknown>>(taskPath);

        if (!task) {
          fileError(
            normalizePath(taskPath),
            'transition',
            `Task contract not found: ${normalizePath(taskPath)}`
          );
          return;
        }

        const currentStatus = task.status as string;
        const targetStatus = opts.to;

        // Validate the target status is a known status
        if (!VALID_TRANSITIONS[targetStatus] && !Object.values(VALID_TRANSITIONS).some(arr => arr.includes(targetStatus))) {
          const msg = {
            error: `Unknown target status '${targetStatus}'`,
            code: 'STATE_ERROR' as const,
            current_status: currentStatus,
            target_status: targetStatus,
          };
          process.stderr.write(JSON.stringify(msg) + '\n');
          process.exit(1);
          return;
        }

        if (!isValidTransition(currentStatus, targetStatus)) {
          const allowed = VALID_TRANSITIONS[currentStatus] || [];
          const msg = {
            error: `Invalid transition: '${currentStatus}' -> '${targetStatus}'`,
            code: 'STATE_ERROR' as const,
            current_status: currentStatus,
            target_status: targetStatus,
            allowed_transitions: allowed,
          };
          process.stderr.write(JSON.stringify(msg) + '\n');
          process.exit(1);
          return;
        }

        // Artifact guard — check required artifacts exist for this transition
        const guard = validateTransition(
          geasDir, opts.mission, opts.id, currentStatus, targetStatus,
        );
        if (!guard.valid) {
          const msg = {
            error: `Missing required artifacts for transition '${currentStatus}' -> '${targetStatus}'`,
            code: 'GUARD_ERROR' as const,
            current_status: currentStatus,
            target_status: targetStatus,
            missing_artifacts: guard.missing_artifacts,
          };
          process.stderr.write(JSON.stringify(msg) + '\n');
          process.exit(1);
          return;
        }

        // Apply the transition
        task.status = targetStatus;
        writeJsonFile(taskPath, task);

        success({
          task_id: opts.id,
          mission_id: opts.mission,
          previous_status: currentStatus,
          status: targetStatus,
          path: normalizePath(taskPath),
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'transition', nodeErr.message);
        } else {
          throw err;
        }
      }
    });

  // ── geas task read --mission <mid> --id <tid> ─────────────────────
  cmd
    .command('read')
    .description('Read a task contract')
    .requiredOption('--mission <mission-id>', 'Mission identifier')
    .requiredOption('--id <task-id>', 'Task identifier')
    .action((opts: { mission: string; id: string }) => {
      try {
        const geasDir = resolveGeasDir(program.opts().cwd);
        const missionDir = path.resolve(geasDir, 'missions', opts.mission);

        if (!fs.existsSync(missionDir)) {
          fileError(
            normalizePath(missionDir),
            'read',
            `Mission directory not found: ${normalizePath(missionDir)}`
          );
          return;
        }

        const taskPath = path.resolve(missionDir, 'tasks', `${opts.id}.json`);
        const task = readJsonFile(taskPath);

        if (!task) {
          fileError(
            normalizePath(taskPath),
            'read',
            `Task contract not found: ${normalizePath(taskPath)}`
          );
          return;
        }

        success(task);
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'read', nodeErr.message);
        } else {
          throw err;
        }
      }
    });

  // ── geas task list --mission <mid> ────────────────────────────────
  cmd
    .command('list')
    .description('List all tasks with id, title, status')
    .requiredOption('--mission <mission-id>', 'Mission identifier')
    .action((opts: { mission: string }) => {
      try {
        const geasDir = resolveGeasDir(program.opts().cwd);
        const missionDir = path.resolve(geasDir, 'missions', opts.mission);

        if (!fs.existsSync(missionDir)) {
          fileError(
            normalizePath(missionDir),
            'list',
            `Mission directory not found: ${normalizePath(missionDir)}`
          );
          return;
        }

        const tasksDir = path.resolve(missionDir, 'tasks');
        if (!fs.existsSync(tasksDir)) {
          success([]);
          return;
        }

        const files = fs.readdirSync(tasksDir).filter(f => f.endsWith('.json'));
        const tasks: Array<{ task_id: string; title: string; status: string }> = [];

        for (const file of files) {
          const filePath = path.resolve(tasksDir, file);
          const task = readJsonFile<Record<string, unknown>>(filePath);
          if (task && task.task_id) {
            tasks.push({
              task_id: task.task_id as string,
              title: (task.title as string) || '',
              status: (task.status as string) || 'unknown',
            });
          }
        }

        // Sort by task_id for consistent output
        tasks.sort((a, b) => a.task_id.localeCompare(b.task_id));

        success(tasks);
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'list', nodeErr.message);
        } else {
          throw err;
        }
      }
    });
}
