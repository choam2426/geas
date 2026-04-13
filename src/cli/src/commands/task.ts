/**
 * Task command group — create task contract, transition status,
 * read task contract, list tasks, record add/get.
 *
 * v4: task contract lives at tasks/{tid}/contract.json (was tasks/{tid}.json).
 *     record.json accumulates pipeline step outputs as sections.
 *     verdict/self-check/closure/contract subcommands removed — use record add.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Command } from 'commander';
import { resolveGeasDir, resolveMissionDir, normalizePath, validateIdentifier } from '../lib/paths';
import { readJsonFile, writeJsonFile, ensureDir } from '../lib/fs-atomic';
import { validate } from '../lib/schema';
import { success, validationError, fileError, noStdinError } from '../lib/output';
import { validateTransition } from '../lib/transition-guards';
import { getCwd } from '../lib/cwd';
import { readInputData, parseSetFlags, deepMergeSetOverrides } from '../lib/input';
import { injectEnvelope } from '../lib/envelope';
import { dryRunGuard, dryRunParseError } from '../lib/dry-run';

// ── Primary chain for advance command ──────────────────────────────
const PRIMARY_CHAIN = ['drafted', 'ready', 'implementing', 'reviewed', 'integrated', 'verified', 'passed'] as const;

const AUXILIARY_STATES = ['blocked', 'escalated', 'cancelled'] as const;

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

// ── Valid record.json section names ─────────────────────────────────

const VALID_SECTIONS = [
  'implementation_contract',
  'self_check',
  'gate_result',
  'challenge_review',
  'verdict',
  'closure',
  'retrospective',
] as const;

type SectionName = typeof VALID_SECTIONS[number];

function isValidSection(s: string): s is SectionName {
  return (VALID_SECTIONS as readonly string[]).includes(s);
}

/**
 * Resolve the mission directory, trying --mission flag first,
 * then falling back to run.json's mission_id.
 */
function resolveMissionId(geasDir: string, missionOpt?: string): string {
  if (missionOpt) return missionOpt;

  // Auto-resolve from run.json
  const runPath = path.resolve(geasDir, 'state', 'run.json');
  const run = readJsonFile<Record<string, unknown>>(runPath);
  if (run?.mission_id && typeof run.mission_id === 'string') {
    return run.mission_id;
  }

  const err = new Error('No --mission provided and no mission_id in run.json');
  (err as NodeJS.ErrnoException).code = 'FILE_ERROR';
  throw err;
}

export function registerTaskCommands(program: Command): void {
  const cmd = program
    .command('task')
    .description('Task CRUD (contracts, status transitions, execution record)');

  // ── geas task create --mission <mid> (JSON via stdin) ─────────────
  cmd
    .command('create')
    .description('Create a task contract with schema validation (JSON via stdin)')
    .option('--mission <mission-id>', 'Mission identifier (auto-resolved from run.json)')
    .option('--dry-run', 'Validate input without writing files')
    .action((opts: { mission?: string; dryRun?: boolean }) => {
      try {
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const missionId = resolveMissionId(geasDir, opts.mission);
        validateIdentifier(missionId, 'mission ID');
        const missionDir = resolveMissionDir(geasDir, missionId);

        const data = readInputData() as Record<string, unknown>;

        // Inject envelope fields (version, artifact_type, producer_type, artifact_id)
        injectEnvelope('task_contract', data);

        // Enforce status=drafted for new task contracts
        if (!data.status || data.status !== 'drafted') {
          data.status = 'drafted';
        }

        // --dry-run: validate and exit without writing
        if (opts.dryRun) {
          dryRunGuard(true, data, 'task-contract');
          return;
        }

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
        validateIdentifier(taskId, 'task ID');

        // v4: tasks/{tid}/contract.json (directory per task)
        const taskDir = path.resolve(missionDir, 'tasks', taskId);
        ensureDir(taskDir);

        const contractPath = path.resolve(taskDir, 'contract.json');
        if (fs.existsSync(contractPath)) {
          fileError(
            normalizePath(contractPath),
            'create',
            `Task contract already exists: ${normalizePath(contractPath)}`
          );
          return;
        }

        // Create subdirectories for evidence and packets
        ensureDir(path.resolve(taskDir, 'evidence'));
        ensureDir(path.resolve(taskDir, 'packets'));

        writeJsonFile(contractPath, data, { cwd });

        success({
          written: normalizePath(contractPath),
          task_id: taskId,
          mission_id: missionId,
          artifact_type: 'task_contract',
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'NO_STDIN') {
          noStdinError('task create', nodeErr.message);
        } else if (nodeErr.code === 'INVALID_JSON') {
          if (opts.dryRun) { dryRunParseError(nodeErr.message); return; }
          fileError('', 'parse', nodeErr.message);
        } else if (nodeErr.code === 'FILE_ERROR') {
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
    .option('--mission <mission-id>', 'Mission identifier (auto-resolved from run.json)')
    .requiredOption('--id <task-id>', 'Task identifier')
    .requiredOption('--to <status>', 'Target status')
    .action((opts: { mission?: string; id: string; to: string }) => {
      try {
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const missionId = resolveMissionId(geasDir, opts.mission);
        validateIdentifier(missionId, 'mission ID');
        validateIdentifier(opts.id, 'task ID');
        const missionDir = resolveMissionDir(geasDir, missionId);

        // v4: contract.json lives inside tasks/{tid}/
        const contractPath = path.resolve(missionDir, 'tasks', opts.id, 'contract.json');
        const task = readJsonFile<Record<string, unknown>>(contractPath);

        if (!task) {
          fileError(
            normalizePath(contractPath),
            'transition',
            `Task contract not found: ${normalizePath(contractPath)}`
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
          geasDir, missionId, opts.id, currentStatus, targetStatus,
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
        writeJsonFile(contractPath, task, { cwd });

        success({
          task_id: opts.id,
          mission_id: missionId,
          previous_status: currentStatus,
          status: targetStatus,
          path: normalizePath(contractPath),
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

  // ── geas task advance --id <tid> ──────────────────────────────────
  cmd
    .command('advance')
    .description('Advance a task to the next primary-chain state (with guard pre-check)')
    .option('--mission <mission-id>', 'Mission identifier (auto-resolved from run.json)')
    .requiredOption('--id <task-id>', 'Task identifier')
    .action((opts: { mission?: string; id: string }) => {
      try {
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const missionId = resolveMissionId(geasDir, opts.mission);
        validateIdentifier(missionId, 'mission ID');
        validateIdentifier(opts.id, 'task ID');
        const missionDir = resolveMissionDir(geasDir, missionId);

        const contractPath = path.resolve(missionDir, 'tasks', opts.id, 'contract.json');
        const task = readJsonFile<Record<string, unknown>>(contractPath);

        if (!task) {
          fileError(
            normalizePath(contractPath),
            'advance',
            `Task contract not found: ${normalizePath(contractPath)}`
          );
          return;
        }

        const currentStatus = task.status as string;

        // Reject auxiliary states
        if ((AUXILIARY_STATES as readonly string[]).includes(currentStatus)) {
          const msg = {
            error: `Cannot advance: task is in auxiliary state '${currentStatus}'. Advance only operates on primary chain states.`,
            code: 'STATE_ERROR' as const,
            current_status: currentStatus,
          };
          process.stderr.write(JSON.stringify(msg) + '\n');
          process.exit(1);
          return;
        }

        // Reject terminal state
        if (currentStatus === 'passed') {
          const msg = {
            error: `Cannot advance: task has reached terminal state 'passed'.`,
            code: 'STATE_ERROR' as const,
            current_status: currentStatus,
          };
          process.stderr.write(JSON.stringify(msg) + '\n');
          process.exit(1);
          return;
        }

        // Find current index in primary chain
        const currentIndex = (PRIMARY_CHAIN as readonly string[]).indexOf(currentStatus);
        if (currentIndex === -1) {
          const msg = {
            error: `Cannot advance: unknown status '${currentStatus}' is not in the primary chain.`,
            code: 'STATE_ERROR' as const,
            current_status: currentStatus,
          };
          process.stderr.write(JSON.stringify(msg) + '\n');
          process.exit(1);
          return;
        }

        const nextStatus = PRIMARY_CHAIN[currentIndex + 1];

        // Guard pre-check
        const guard = validateTransition(
          geasDir, missionId, opts.id, currentStatus, nextStatus,
        );
        if (!guard.valid) {
          const msg = {
            error: `Missing required artifacts for transition '${currentStatus}' -> '${nextStatus}'`,
            code: 'GUARD_ERROR' as const,
            current_status: currentStatus,
            target_status: nextStatus,
            missing_artifacts: guard.missing_artifacts,
          };
          process.stderr.write(JSON.stringify(msg) + '\n');
          process.exit(1);
          return;
        }

        // Apply the transition
        task.status = nextStatus;
        writeJsonFile(contractPath, task, { cwd });

        success({
          task_id: opts.id,
          mission_id: missionId,
          previous_status: currentStatus,
          status: nextStatus,
          path: normalizePath(contractPath),
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'advance', nodeErr.message);
        } else {
          throw err;
        }
      }
    });

  // ── geas task read --mission <mid> --id <tid> ─────────────────────
  cmd
    .command('read')
    .description('Read a task contract')
    .option('--mission <mission-id>', 'Mission identifier (auto-resolved from run.json)')
    .requiredOption('--id <task-id>', 'Task identifier')
    .action((opts: { mission?: string; id: string }) => {
      try {
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const missionId = resolveMissionId(geasDir, opts.mission);
        validateIdentifier(missionId, 'mission ID');
        validateIdentifier(opts.id, 'task ID');
        const missionDir = resolveMissionDir(geasDir, missionId);

        const contractPath = path.resolve(missionDir, 'tasks', opts.id, 'contract.json');
        const task = readJsonFile(contractPath);

        if (!task) {
          fileError(
            normalizePath(contractPath),
            'read',
            `Task contract not found: ${normalizePath(contractPath)}`
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
    .option('--mission <mission-id>', 'Mission identifier (auto-resolved from run.json)')
    .action((opts: { mission?: string }) => {
      try {
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const missionId = resolveMissionId(geasDir, opts.mission);
        validateIdentifier(missionId, 'mission ID');
        const missionDir = resolveMissionDir(geasDir, missionId);

        const tasksDir = path.resolve(missionDir, 'tasks');
        if (!fs.existsSync(tasksDir)) {
          success([]);
          return;
        }

        // v4: each task is a directory with contract.json inside
        const entries = fs.readdirSync(tasksDir, { withFileTypes: true });
        const tasks: Array<{ task_id: string; title: string; status: string }> = [];

        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const contractPath = path.resolve(tasksDir, entry.name, 'contract.json');
          const task = readJsonFile<Record<string, unknown>>(contractPath);
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

  // ── geas task record add ──────────────────────────────────────────
  const record = cmd
    .command('record')
    .description('Task execution record (record.json) management');

  record
    .command('add')
    .description('Add or overwrite a section in record.json (JSON via stdin and/or --set)')
    .option('--mission <mission-id>', 'Mission identifier (auto-resolved from run.json)')
    .requiredOption('--task <task-id>', 'Task identifier')
    .requiredOption('--section <name>', `Section name (${VALID_SECTIONS.join(', ')})`)
    .option('--set <key=value...>', 'Set individual fields', collectSet, [])
    .option('--dry-run', 'Validate input without writing files')
    .action((opts: {
      mission?: string;
      task: string;
      section: string;
      set: string[];
      dryRun?: boolean;
    }) => {
      try {
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const missionId = resolveMissionId(geasDir, opts.mission);
        validateIdentifier(missionId, 'mission ID');
        validateIdentifier(opts.task, 'task ID');
        const missionDir = resolveMissionDir(geasDir, missionId);

        // Validate section name
        if (!isValidSection(opts.section)) {
          fileError('', 'record add', `Invalid section: '${opts.section}'. Valid: ${VALID_SECTIONS.join(', ')}`);
          return;
        }

        const taskDir = path.resolve(missionDir, 'tasks', opts.task);
        if (!fs.existsSync(taskDir)) {
          fileError(normalizePath(taskDir), 'record add', `Task directory not found: ${opts.task}`);
          return;
        }

        // Build section data: stdin JSON forms the base, --set overlays on top.
        // Shallow merge semantics (Object.assign) match parseSetFlags, which
        // produces only top-level / bracketed-array keys.
        let sectionData: Record<string, unknown> | undefined;

        try {
          sectionData = readInputData() as Record<string, unknown>;
        } catch (readErr: unknown) {
          const rnErr = readErr as NodeJS.ErrnoException;
          if (rnErr.code === 'NO_STDIN') {
            // Empty stdin is OK if --set provides data; fall through.
            sectionData = undefined;
          } else if (rnErr.code === 'INVALID_JSON') {
            if (opts.dryRun) { dryRunParseError(rnErr.message); return; }
            fileError('', 'parse', rnErr.message);
            return;
          } else {
            throw readErr;
          }
        }

        if (opts.set.length > 0) {
          const overrides = parseSetFlags(opts.set);
          if (sectionData) {
            // stdin-base + --set overlay: deep merge so nested dot-path fields
            // don't clobber sibling keys in the base object.
            deepMergeSetOverrides(sectionData, overrides);
          } else {
            sectionData = overrides;
          }
        }

        if (!sectionData) {
          noStdinError(
            'task record add',
            'No data provided. Pipe JSON to stdin, or use --set <key=value>.',
          );
          return;
        }

        // Read existing record or create new
        const recordPath = path.resolve(taskDir, 'record.json');
        let record = readJsonFile<Record<string, unknown>>(recordPath);
        if (!record) {
          record = { version: '1.0', task_id: opts.task };
        }

        // Merge into existing section (shallow), or create new
        const existing = record[opts.section];
        if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
          record[opts.section] = { ...existing as Record<string, unknown>, ...sectionData };
        } else {
          record[opts.section] = sectionData;
        }

        // --dry-run: validate and exit without writing
        if (opts.dryRun) {
          dryRunGuard(true, record, 'record');
          return;
        }

        // Validate entire record against schema
        const result = validate('record', record);
        if (!result.valid) {
          validationError('record', result.errors!);
          return;
        }

        writeJsonFile(recordPath, record, { cwd });

        success({
          written: normalizePath(recordPath),
          task_id: opts.task,
          mission_id: missionId,
          section: opts.section,
          action: 'added',
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'record add', nodeErr.message);
        } else {
          throw err;
        }
      }
    });

  // ── geas task record get ──────────────────────────────────────────
  record
    .command('get')
    .description('Read record.json (full or specific section)')
    .option('--mission <mission-id>', 'Mission identifier (auto-resolved from run.json)')
    .requiredOption('--task <task-id>', 'Task identifier')
    .option('--section <name>', 'Section name (omit for full record)')
    .action((opts: { mission?: string; task: string; section?: string }) => {
      try {
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const missionId = resolveMissionId(geasDir, opts.mission);
        validateIdentifier(missionId, 'mission ID');
        validateIdentifier(opts.task, 'task ID');
        const missionDir = resolveMissionDir(geasDir, missionId);

        const taskDir = path.resolve(missionDir, 'tasks', opts.task);
        const recordPath = path.resolve(taskDir, 'record.json');
        const record = readJsonFile<Record<string, unknown>>(recordPath);

        if (!record) {
          fileError(normalizePath(recordPath), 'record get', 'record.json not found');
          return;
        }

        if (opts.section) {
          if (!isValidSection(opts.section)) {
            fileError('', 'record get', `Invalid section: '${opts.section}'. Valid: ${VALID_SECTIONS.join(', ')}`);
            return;
          }
          const section = record[opts.section];
          if (section === undefined) {
            fileError('', 'record get', `Section '${opts.section}' not found in record.json`);
            return;
          }
          success({ task_id: opts.task, section: opts.section, data: section });
        } else {
          success(record);
        }
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'record get', nodeErr.message);
        } else {
          throw err;
        }
      }
    });
}

/** Commander variadic option collector for --set. */
function collectSet(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}
