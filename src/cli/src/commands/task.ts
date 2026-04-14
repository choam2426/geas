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
import { execFileSync, execSync } from 'child_process';
import type { Command } from 'commander';
import { resolveGeasDir, resolveMissionDir, normalizePath, validateIdentifier } from '../lib/paths';
import { readJsonFile, writeJsonFile, atomicWriteJsonFile, ensureDir, appendJsonlFile } from '../lib/fs-atomic';
import { validate } from '../lib/schema';
import { success, validationError, fileError, noStdinError } from '../lib/output';
import { validateTransition } from '../lib/transition-guards';
import { getCwd } from '../lib/cwd';
import { readInputData, parseSetFlags, deepMergeSetOverrides } from '../lib/input';
import { injectEnvelope } from '../lib/envelope';
import { dryRunGuard, dryRunParseError } from '../lib/dry-run';
import { appendAgentNote } from './memory';

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

// ── Step → Artifact mapping for check-artifacts ───────────────────────

interface ArtifactSpec {
  type: 'record-section' | 'evidence-file';
  section?: string;
  role?: string;
  label: string;
}

const STEP_ARTIFACT_MAP: Record<string, ArtifactSpec[]> = {
  implementation_contract: [{ type: 'record-section', section: 'implementation_contract', label: 'record.json:implementation_contract' }],
  implementation: [{ type: 'evidence-file', role: 'implementer', label: 'evidence/{implementer}.json' }],
  self_check: [{ type: 'record-section', section: 'self_check', label: 'record.json:self_check' }],
  specialist_review: [{ type: 'evidence-file', role: 'reviewer', label: 'evidence/{reviewer}.json' }],
  testing: [{ type: 'evidence-file', role: 'tester', label: 'evidence/{tester}.json' }],
  gate_result: [{ type: 'record-section', section: 'gate_result', label: 'record.json:gate_result' }],
  closure: [{ type: 'record-section', section: 'closure', label: 'record.json:closure' }],
  challenge_review: [{ type: 'record-section', section: 'challenge_review', label: 'record.json:challenge_review' }],
  verdict: [{ type: 'record-section', section: 'verdict', label: 'record.json:verdict' }],
  retrospective: [{ type: 'record-section', section: 'retrospective', label: 'record.json:retrospective' }],
};
const VALID_STEPS = Object.keys(STEP_ARTIFACT_MAP);

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

  // ── geas task create TITLE --goal GOAL --kind KIND ────────────────
  cmd
    .command('create')
    .description('Create a task contract (positional TITLE + flags, or JSON via stdin)')
    .argument('[title]', 'Task title (positional; omit to use JSON stdin)')
    .option('--goal <goal>', 'Task goal description')
    .option('--kind <kind>', 'Task kind (implementation, documentation, configuration, design, review, analysis, delivery)')
    .option('--mission <mission-id>', 'Mission identifier (auto-resolved from run.json)')
    .option('--dry-run', 'Validate input without writing files')
    .action((title: string | undefined, opts: { goal?: string; kind?: string; mission?: string; dryRun?: boolean }) => {
      try {
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const missionId = resolveMissionId(geasDir, opts.mission);
        validateIdentifier(missionId, 'mission ID');
        const missionDir = resolveMissionDir(geasDir, missionId);

        let data: Record<string, unknown>;

        let positionalMode = false;

        if (title) {
          // ── Positional path: construct contract from args ──
          positionalMode = true;

          if (!opts.goal) {
            validationError('task-contract', [{ message: '--goal is required when using positional TITLE' }]);
            return;
          }
          if (!opts.kind) {
            validationError('task-contract', [{ message: '--kind is required when using positional TITLE' }]);
            return;
          }

          const VALID_KINDS = ['implementation', 'documentation', 'configuration', 'design', 'review', 'analysis', 'delivery'];
          if (!VALID_KINDS.includes(opts.kind)) {
            validationError('task-contract', [{ message: `Invalid --kind '${opts.kind}'. Must be one of: ${VALID_KINDS.join(', ')}` }]);
            return;
          }

          // Auto-generate task_id: scan tasks dir, find max numeric suffix, use max+1
          const tasksDir = path.resolve(missionDir, 'tasks');
          let nextNum = 1;
          if (fs.existsSync(tasksDir)) {
            const entries = fs.readdirSync(tasksDir, { withFileTypes: true });
            for (const entry of entries) {
              if (!entry.isDirectory()) continue;
              const match = entry.name.match(/^task-(\d+)$/);
              if (match) {
                const num = parseInt(match[1], 10);
                if (num >= nextNum) nextNum = num + 1;
              }
            }
          }
          const taskId = `task-${String(nextNum).padStart(3, '0')}`;

          // Get base_snapshot from git HEAD
          let baseSnapshot = '';
          try {
            baseSnapshot = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf-8' }).trim();
          } catch {
            process.stderr.write(JSON.stringify({ warning: 'Failed to get git HEAD for base_snapshot' }) + '\n');
          }

          data = {
            task_id: taskId,
            title,
            goal: opts.goal,
            task_kind: opts.kind,
            status: 'drafted',
            risk_level: 'low',
            gate_profile: 'implementation_change',
            vote_round_policy: 'never',
            acceptance_criteria: ['(pending)'],
            eval_commands: [],
            rubric: { dimensions: [{ name: 'default', threshold: 1 }] },
            retry_budget: 2,
            scope: { surfaces: [] },
            routing: {
              primary_worker_slot: 'implementer',
              required_reviewer_slots: ['quality'],
            },
            base_snapshot: baseSnapshot,
          };
        } else {
          // ── Stdin fallback path (backward compatible) ──
          data = readInputData() as Record<string, unknown>;
        }

        // Inject envelope fields for stdin path (backward compatible)
        if (!positionalMode) {
          injectEnvelope('task_contract', data);
        }

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

  // ── Shared helper: load an existing task contract ─────────────────
  function loadContract(missionDir: string, taskId: string): Record<string, unknown> {
    const contractPath = path.resolve(missionDir, 'tasks', taskId, 'contract.json');
    const contract = readJsonFile<Record<string, unknown>>(contractPath);
    if (!contract) {
      const err = new Error(`Task contract not found: ${normalizePath(contractPath)}`);
      (err as NodeJS.ErrnoException).code = 'FILE_ERROR';
      throw err;
    }
    return contract;
  }

  // Fields injected by the CLI (envelope + timestamps) that are not in the task-contract schema
  const NON_SCHEMA_FIELDS = ['version', 'artifact_type', 'producer_type', 'artifact_id', 'created_at', 'updated_at'];

  function saveContract(missionDir: string, taskId: string, data: Record<string, unknown>, cwd: string): string {
    const contractPath = path.resolve(missionDir, 'tasks', taskId, 'contract.json');
    // Strip system/envelope fields for validation (they are re-injected on write)
    const forValidation = { ...data };
    for (const field of NON_SCHEMA_FIELDS) {
      delete forValidation[field];
    }
    const result = validate('task-contract', forValidation);
    if (!result.valid) {
      validationError('task-contract', result.errors!);
      return '';
    }
    writeJsonFile(contractPath, data, { cwd });
    return normalizePath(contractPath);
  }

  // ── geas task add-acceptance <task-id> <criterion> ──────────────
  cmd
    .command('add-acceptance')
    .description('Append an acceptance criterion to a task contract')
    .argument('<task-id>', 'Task identifier')
    .argument('<criterion>', 'Acceptance criterion text')
    .option('--mission <mission-id>', 'Mission identifier (auto-resolved from run.json)')
    .action((taskId: string, criterion: string, opts: { mission?: string }) => {
      try {
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const missionId = resolveMissionId(geasDir, opts.mission);
        validateIdentifier(missionId, 'mission ID');
        validateIdentifier(taskId, 'task ID');
        const missionDir = resolveMissionDir(geasDir, missionId);

        if (!criterion.trim()) {
          validationError('task-contract', [{ message: 'Criterion cannot be empty' }]);
          return;
        }

        const contract = loadContract(missionDir, taskId);

        if (!Array.isArray(contract.acceptance_criteria)) {
          contract.acceptance_criteria = [];
        }
        (contract.acceptance_criteria as string[]).push(criterion);

        const written = saveContract(missionDir, taskId, contract, cwd);
        if (!written) return;

        success({
          written,
          task_id: taskId,
          mission_id: missionId,
          action: 'add-acceptance',
          acceptance_criteria: contract.acceptance_criteria,
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'add-acceptance', nodeErr.message);
        } else {
          throw err;
        }
      }
    });

  // ── geas task add-surface <task-id> <path> ──────────────────────
  cmd
    .command('add-surface')
    .description('Append a scope surface path to a task contract')
    .argument('<task-id>', 'Task identifier')
    .argument('<path>', 'Scope surface path')
    .option('--mission <mission-id>', 'Mission identifier (auto-resolved from run.json)')
    .action((taskId: string, surfacePath: string, opts: { mission?: string }) => {
      try {
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const missionId = resolveMissionId(geasDir, opts.mission);
        validateIdentifier(missionId, 'mission ID');
        validateIdentifier(taskId, 'task ID');
        const missionDir = resolveMissionDir(geasDir, missionId);

        const contract = loadContract(missionDir, taskId);

        if (!contract.scope || typeof contract.scope !== 'object') {
          contract.scope = { surfaces: [] };
        }
        const scope = contract.scope as Record<string, unknown>;
        if (!Array.isArray(scope.surfaces)) {
          scope.surfaces = [];
        }
        (scope.surfaces as string[]).push(surfacePath);

        const written = saveContract(missionDir, taskId, contract, cwd);
        if (!written) return;

        success({
          written,
          task_id: taskId,
          mission_id: missionId,
          action: 'add-surface',
          surfaces: scope.surfaces,
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'add-surface', nodeErr.message);
        } else {
          throw err;
        }
      }
    });

  // ── geas task set-risk <task-id> <level> ────────────────────────
  const VALID_RISK_LEVELS = ['low', 'normal', 'high', 'critical'] as const;

  cmd
    .command('set-risk')
    .description('Update the risk level of a task contract')
    .argument('<task-id>', 'Task identifier')
    .argument('<level>', 'Risk level (low, medium, high, critical)')
    .option('--mission <mission-id>', 'Mission identifier (auto-resolved from run.json)')
    .action((taskId: string, level: string, opts: { mission?: string }) => {
      try {
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const missionId = resolveMissionId(geasDir, opts.mission);
        validateIdentifier(missionId, 'mission ID');
        validateIdentifier(taskId, 'task ID');
        const missionDir = resolveMissionDir(geasDir, missionId);

        // Pre-validate level before reading contract (fast-fail)
        if (!(VALID_RISK_LEVELS as readonly string[]).includes(level)) {
          validationError('task-contract', [{
            message: `Invalid risk level '${level}'. Must be one of: ${VALID_RISK_LEVELS.join(', ')}`,
          }]);
          return;
        }

        const contract = loadContract(missionDir, taskId);
        contract.risk_level = level;

        const written = saveContract(missionDir, taskId, contract, cwd);
        if (!written) return;

        success({
          written,
          task_id: taskId,
          mission_id: missionId,
          action: 'set-risk',
          risk_level: level,
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'set-risk', nodeErr.message);
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

  // ── geas task record self-check TASK SUMMARY --confidence N ────────
  record
    .command('self-check <task> <summary>')
    .description('Write self_check section: geas task record self-check TASK SUMMARY --confidence N')
    .option('--mission <mission-id>', 'Mission identifier (auto-resolved from run.json)')
    .requiredOption('--confidence <n>', 'Confidence level (1-5)')
    .option('--set <key=value...>', 'Set additional fields', collectSet, [])
    .option('--dry-run', 'Validate input without writing files')
    .action((task: string, summary: string, opts: {
      mission?: string;
      confidence: string;
      set: string[];
      dryRun?: boolean;
    }) => {
      try {
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const missionId = resolveMissionId(geasDir, opts.mission);
        validateIdentifier(missionId, 'mission ID');
        validateIdentifier(task, 'task ID');
        const missionDir = resolveMissionDir(geasDir, missionId);

        // Validate confidence range
        const confidence = parseInt(opts.confidence, 10);
        if (isNaN(confidence) || confidence < 1 || confidence > 5) {
          validationError('self_check', ['--confidence must be an integer between 1 and 5']);
          return;
        }

        const taskDir = path.resolve(missionDir, 'tasks', task);
        if (!fs.existsSync(taskDir)) {
          fileError(normalizePath(taskDir), 'record self-check', `Task directory not found: ${task}`);
          return;
        }

        // Build self_check section data
        let sectionData: Record<string, unknown> = {
          summary,
          confidence,
        };

        // Apply --set overrides
        if (opts.set.length > 0) {
          const overrides = parseSetFlags(opts.set);
          deepMergeSetOverrides(sectionData, overrides);
        }

        // Read existing record or create new
        const recordPath = path.resolve(taskDir, 'record.json');
        let recordData = readJsonFile<Record<string, unknown>>(recordPath);
        if (!recordData) {
          recordData = { version: '1.0', task_id: task };
        }

        // Merge into existing section
        const existing = recordData.self_check;
        if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
          recordData.self_check = { ...existing as Record<string, unknown>, ...sectionData };
        } else {
          recordData.self_check = sectionData;
        }

        // --dry-run: validate and exit without writing
        if (opts.dryRun) {
          dryRunGuard(true, recordData, 'record');
          return;
        }

        // Validate entire record against schema
        const result = validate('record', recordData);
        if (!result.valid) {
          validationError('record', result.errors!);
          return;
        }

        writeJsonFile(recordPath, recordData, { cwd });

        success({
          written: normalizePath(recordPath),
          task_id: task,
          mission_id: missionId,
          section: 'self_check',
          action: 'added',
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'record self-check', nodeErr.message);
        } else {
          throw err;
        }
      }
    });

  // ── geas task record gate TASK VERDICT ───────────────────────────
  record
    .command('gate <task> <verdict>')
    .description('Write gate_result section: geas task record gate TASK VERDICT (pass|fail|block|error)')
    .option('--mission <mission-id>', 'Mission identifier (auto-resolved from run.json)')
    .option('--set <key=value...>', 'Set additional fields', collectSet, [])
    .option('--dry-run', 'Validate input without writing files')
    .action((task: string, verdict: string, opts: {
      mission?: string;
      set: string[];
      dryRun?: boolean;
    }) => {
      try {
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const missionId = resolveMissionId(geasDir, opts.mission);
        validateIdentifier(missionId, 'mission ID');
        validateIdentifier(task, 'task ID');
        const missionDir = resolveMissionDir(geasDir, missionId);

        // Validate verdict value
        const validVerdicts = ['pass', 'fail', 'block', 'error'];
        if (!validVerdicts.includes(verdict)) {
          validationError('gate_result', [`Invalid verdict '${verdict}'. Must be one of: ${validVerdicts.join(', ')}`]);
          return;
        }

        const taskDir = path.resolve(missionDir, 'tasks', task);
        if (!fs.existsSync(taskDir)) {
          fileError(normalizePath(taskDir), 'record gate', `Task directory not found: ${task}`);
          return;
        }

        // Build gate_result section data
        let sectionData: Record<string, unknown> = {
          verdict,
        };

        // Apply --set overrides
        if (opts.set.length > 0) {
          const overrides = parseSetFlags(opts.set);
          deepMergeSetOverrides(sectionData, overrides);
        }

        // Read existing record or create new
        const recordPath = path.resolve(taskDir, 'record.json');
        let recordData = readJsonFile<Record<string, unknown>>(recordPath);
        if (!recordData) {
          recordData = { version: '1.0', task_id: task };
        }

        // Merge into existing section
        const existing = recordData.gate_result;
        if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
          recordData.gate_result = { ...existing as Record<string, unknown>, ...sectionData };
        } else {
          recordData.gate_result = sectionData;
        }

        // --dry-run: validate and exit without writing
        if (opts.dryRun) {
          dryRunGuard(true, recordData, 'record');
          return;
        }

        // Validate entire record against schema
        const result = validate('record', recordData);
        if (!result.valid) {
          validationError('record', result.errors!);
          return;
        }

        writeJsonFile(recordPath, recordData, { cwd });

        success({
          written: normalizePath(recordPath),
          task_id: task,
          mission_id: missionId,
          section: 'gate_result',
          action: 'added',
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'record gate', nodeErr.message);
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
  // ── geas task resolve ─────────────────────────────────────────────
  cmd
    .command('resolve')
    .description('Resolve a task: transition + event log + lock release (atomic bundle)')
    .option('--mission <mission-id>', 'Mission identifier (auto-resolved from run.json)')
    .requiredOption('--id <task-id>', 'Task identifier')
    .requiredOption('--verdict <verdict>', 'Resolution verdict (pass, cancel, escalate)')
    .action((opts: { mission?: string; id: string; verdict: string }) => {
      try {
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const missionId = resolveMissionId(geasDir, opts.mission);
        validateIdentifier(missionId, 'mission ID');
        validateIdentifier(opts.id, 'task ID');
        const missionDir = resolveMissionDir(geasDir, missionId);

        // Map verdict to target state
        const verdictMap: Record<string, string> = {
          pass: 'passed',
          cancel: 'cancelled',
          escalate: 'escalated',
        };
        const targetStatus = verdictMap[opts.verdict];
        if (!targetStatus) {
          const msg = {
            error: `Invalid verdict '${opts.verdict}'. Must be one of: pass, cancel, escalate`,
            code: 'VALIDATION_ERROR' as const,
          };
          process.stderr.write(JSON.stringify(msg) + '\n');
          process.exit(1);
          return;
        }

        // Read task contract
        const contractPath = path.resolve(missionDir, 'tasks', opts.id, 'contract.json');
        const task = readJsonFile<Record<string, unknown>>(contractPath);
        if (!task) {
          fileError(
            normalizePath(contractPath),
            'resolve',
            `Task contract not found: ${normalizePath(contractPath)}`
          );
          return;
        }

        const previousStatus = task.status as string;

        // Idempotent: already in target state
        if (previousStatus === targetStatus) {
          success({
            task_id: opts.id,
            verdict: opts.verdict,
            previous_status: previousStatus,
            status: targetStatus,
            idempotent: true,
            locks_released: 0,
            event_logged: false,
          });
          return;
        }

        // Validate transition is allowed
        if (!isValidTransition(previousStatus, targetStatus)) {
          const allowed = VALID_TRANSITIONS[previousStatus] || [];
          const msg = {
            error: `Invalid transition: '${previousStatus}' -> '${targetStatus}'`,
            code: 'STATE_ERROR' as const,
            current_status: previousStatus,
            target_status: targetStatus,
            allowed_transitions: allowed,
          };
          process.stderr.write(JSON.stringify(msg) + '\n');
          process.exit(1);
          return;
        }

        // For verdict=pass, run artifact guard (cancel/escalate skip guards)
        if (opts.verdict === 'pass') {
          const guard = validateTransition(
            geasDir, missionId, opts.id, previousStatus, targetStatus,
          );
          if (!guard.valid) {
            const msg = {
              error: `Missing required artifacts for transition '${previousStatus}' -> '${targetStatus}'`,
              code: 'GUARD_ERROR' as const,
              current_status: previousStatus,
              target_status: targetStatus,
              missing_artifacts: guard.missing_artifacts,
            };
            process.stderr.write(JSON.stringify(msg) + '\n');
            process.exit(1);
            return;
          }
        }

        // === All validation passed — forward-only writes below ===

        // Step 1: Transition task
        task.status = targetStatus;
        writeJsonFile(contractPath, task, { cwd });

        // Step 2: Log task_resolved event
        const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
        const eventsPath = path.resolve(geasDir, 'state', 'events.jsonl');
        const eventEntry: Record<string, unknown> = {
          timestamp: now,
          event_type: 'task_resolved',
          task_id: opts.id,
          data: {
            verdict: opts.verdict,
            previous_status: previousStatus,
            status: targetStatus,
            mission_id: missionId,
          },
        };
        appendJsonlFile(eventsPath, eventEntry);

        // Step 3: Release locks for this task
        const locksPath = path.resolve(geasDir, 'state', 'locks.json');
        const locksData = readJsonFile<{ version: string; locks: Array<{ lock_type: string; task_id: string; session_id: string; targets: string[]; status: string; acquired_at: string; wait_start?: string }> }>(locksPath);
        let locksReleased = 0;

        if (locksData && locksData.locks) {
          const before = locksData.locks.length;
          locksData.locks = locksData.locks.filter(
            (l) => l.task_id !== opts.id
          );
          locksReleased = before - locksData.locks.length;

          // Promote waiting locks that no longer conflict
          for (const lock of locksData.locks) {
            if (lock.status === 'waiting') {
              const hasConflict = locksData.locks.some(
                (other) =>
                  other.status === 'held' &&
                  other.task_id !== lock.task_id &&
                  other.lock_type === lock.lock_type &&
                  other.targets.some((t) => lock.targets.includes(t))
              );
              if (!hasConflict) {
                lock.status = 'held';
                lock.acquired_at = now;
                delete lock.wait_start;
              }
            }
          }

          if (locksReleased > 0) {
            atomicWriteJsonFile(locksPath, locksData, { cwd });
          }
        }

        success({
          task_id: opts.id,
          verdict: opts.verdict,
          previous_status: previousStatus,
          status: targetStatus,
          locks_released: locksReleased,
          event_logged: true,
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'resolve', nodeErr.message);
        } else {
          throw err;
        }
      }
    });

  // ── geas task harvest-memory ────────────────────────────────────────
  cmd
    .command('harvest-memory')
    .description('Batch-extract memory_suggestions from task evidence and write agent notes')
    .requiredOption('--id <task-id>', 'Task identifier')
    .option('--mission <mission-id>', 'Mission identifier (auto-resolved from run.json)')
    .action((opts: { id: string; mission?: string }) => {
      try {
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const missionId = resolveMissionId(geasDir, opts.mission);
        validateIdentifier(missionId, 'mission ID');
        validateIdentifier(opts.id, 'task ID');
        const missionDir = resolveMissionDir(geasDir, missionId);

        const evidenceDir = path.resolve(missionDir, 'tasks', opts.id, 'evidence');

        // If no evidence directory, output success with 0
        if (!fs.existsSync(evidenceDir)) {
          success({ harvested: 0, agents: {} });
          return;
        }

        // Read all .json files in evidence dir
        const entries = fs.readdirSync(evidenceDir, { withFileTypes: true });
        const jsonFiles = entries
          .filter(e => e.isFile() && e.name.endsWith('.json'))
          .map(e => e.name);

        // Collect suggestions grouped by agent
        const suggestionsByAgent: Record<string, string[]> = {};

        for (const fileName of jsonFiles) {
          const filePath = path.resolve(evidenceDir, fileName);
          let data: Record<string, unknown>;
          try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(raw);
          } catch {
            // Warn and skip invalid JSON
            process.stderr.write(
              JSON.stringify({ warning: `Skipping invalid JSON: ${fileName}` }) + '\n'
            );
            continue;
          }

          // Check for memory_suggestions field
          const suggestions = data.memory_suggestions;
          if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
            continue;
          }

          // Determine agent name: use agent field, fallback to filename without extension
          const agent = (typeof data.agent === 'string' && data.agent)
            ? data.agent
            : fileName.replace(/\.json$/, '');

          if (!suggestionsByAgent[agent]) {
            suggestionsByAgent[agent] = [];
          }

          for (const suggestion of suggestions) {
            if (typeof suggestion === 'string' && suggestion.trim()) {
              suggestionsByAgent[agent].push(suggestion.trim());
            }
          }
        }

        // Deduplicate within collected suggestions per agent,
        // then write via appendAgentNote (which also deduplicates against existing file)
        const agentCounts: Record<string, number> = {};
        let totalHarvested = 0;

        for (const [agent, suggestions] of Object.entries(suggestionsByAgent)) {
          // Deduplicate within batch
          const unique = [...new Set(suggestions)];
          let written = 0;

          for (const suggestion of unique) {
            const wasWritten = appendAgentNote(geasDir, agent, suggestion, cwd);
            if (wasWritten) {
              written++;
            }
          }

          if (written > 0) {
            agentCounts[agent] = written;
            totalHarvested += written;
          }
        }

        // Log a single batch event
        const eventsPath = path.resolve(geasDir, 'state', 'events.jsonl');
        const eventEntry: Record<string, unknown> = {
          timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
          event_type: 'memory_extraction',
          task_id: opts.id,
          data: { harvested: totalHarvested, agents: agentCounts },
        };
        appendJsonlFile(eventsPath, eventEntry);

        success({ harvested: totalHarvested, agents: agentCounts });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'harvest-memory', nodeErr.message);
        } else {
          throw err;
        }
      }
    });

  // ── geas task check-artifacts ──────────────────────────────────────
  cmd
    .command('check-artifacts')
    .description('Check whether required artifacts exist and validate for a pipeline step')
    .option('--mission <mission-id>', 'Mission identifier (auto-resolved from run.json)')
    .requiredOption('--id <task-id>', 'Task identifier')
    .requiredOption('--step <step>', `Pipeline step (${VALID_STEPS.join(', ')})`)
    .action((opts: { mission?: string; id: string; step: string }) => {
      try {
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const missionId = resolveMissionId(geasDir, opts.mission);
        validateIdentifier(missionId, 'mission ID');
        validateIdentifier(opts.id, 'task ID');
        const missionDir = resolveMissionDir(geasDir, missionId);

        // Validate step name
        if (!VALID_STEPS.includes(opts.step)) {
          const msg = {
            error: `Invalid step '${opts.step}'. Valid steps: ${VALID_STEPS.join(', ')}`,
            code: 'VALIDATION_ERROR' as const,
          };
          process.stderr.write(JSON.stringify(msg) + '\n');
          process.exit(1);
          return;
        }

        const taskDir = path.resolve(missionDir, 'tasks', opts.id);
        if (!fs.existsSync(taskDir)) {
          fileError(normalizePath(taskDir), 'check-artifacts', `Task directory not found: ${opts.id}`);
          return;
        }

        const specs = STEP_ARTIFACT_MAP[opts.step];
        const expected: string[] = specs.map(s => s.label);
        const found: string[] = [];
        const missing: string[] = [];
        const schemaResults: Array<{ artifact: string; valid: boolean; errors?: unknown[] }> = [];

        for (const spec of specs) {
          if (spec.type === 'record-section') {
            const recordPath = path.resolve(taskDir, 'record.json');
            const record = readJsonFile<Record<string, unknown>>(recordPath);

            if (!record || record[spec.section!] === undefined) {
              missing.push(spec.label);
              schemaResults.push({ artifact: spec.label, valid: false, errors: [{ message: 'Section not found in record.json' }] });
            } else {
              found.push(spec.label);
              // Validate entire record against record schema
              const result = validate('record', record);
              schemaResults.push({
                artifact: spec.label,
                valid: result.valid,
                ...(result.errors ? { errors: result.errors } : {}),
              });
            }
          } else if (spec.type === 'evidence-file') {
            const evidenceDir = path.resolve(taskDir, 'evidence');
            let matched = false;

            if (fs.existsSync(evidenceDir)) {
              const entries = fs.readdirSync(evidenceDir, { withFileTypes: true });
              const jsonFiles = entries.filter(e => e.isFile() && e.name.endsWith('.json'));

              for (const file of jsonFiles) {
                const filePath = path.resolve(evidenceDir, file.name);
                let data: Record<string, unknown>;
                try {
                  const raw = fs.readFileSync(filePath, 'utf-8');
                  data = JSON.parse(raw);
                } catch {
                  continue;
                }

                if (data.role === spec.role) {
                  matched = true;
                  found.push(spec.label);
                  // Validate against evidence schema
                  const result = validate('evidence', data);
                  schemaResults.push({
                    artifact: spec.label,
                    valid: result.valid,
                    ...(result.errors ? { errors: result.errors } : {}),
                  });
                  break;
                }
              }
            }

            if (!matched) {
              missing.push(spec.label);
              schemaResults.push({ artifact: spec.label, valid: false, errors: [{ message: `No evidence file with role '${spec.role}' found` }] });
            }
          }
        }

        const status = missing.length === 0 && schemaResults.every(r => r.valid) ? 'pass' : 'fail';

        success({
          task_id: opts.id,
          step: opts.step,
          status,
          expected,
          found,
          missing,
          schema_results: schemaResults,
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'check-artifacts', nodeErr.message);
        } else {
          throw err;
        }
      }
    });

  // ── geas task closure-assemble ──────────────────────────────────────
  cmd
    .command('closure-assemble')
    .description('Assemble a closure packet with forbidden-pass pre-checks')
    .option('--mission <mission-id>', 'Mission identifier (auto-resolved from run.json)')
    .requiredOption('--id <task-id>', 'Task identifier')
    .option('--write', 'Write closure section to record.json instead of stdout')
    .action((opts: { mission?: string; id: string; write?: boolean }) => {
      try {
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const missionId = resolveMissionId(geasDir, opts.mission);
        validateIdentifier(missionId, 'mission ID');
        validateIdentifier(opts.id, 'task ID');
        const missionDir = resolveMissionDir(geasDir, missionId);

        const taskDir = path.resolve(missionDir, 'tasks', opts.id);
        if (!fs.existsSync(taskDir)) {
          fileError(normalizePath(taskDir), 'closure-assemble', `Task directory not found: ${opts.id}`);
          return;
        }

        // Read record.json
        const recordPath = path.resolve(taskDir, 'record.json');
        const recordData = readJsonFile<Record<string, unknown>>(recordPath);
        if (!recordData) {
          fileError(normalizePath(recordPath), 'closure-assemble', 'record.json not found');
          return;
        }

        // Read evidence files
        const evidenceDir = path.resolve(taskDir, 'evidence');
        const evidenceFiles: Array<Record<string, unknown>> = [];

        if (fs.existsSync(evidenceDir)) {
          const entries = fs.readdirSync(evidenceDir, { withFileTypes: true });
          const jsonFiles = entries.filter(e => e.isFile() && e.name.endsWith('.json'));

          for (const file of jsonFiles) {
            const filePath = path.resolve(evidenceDir, file.name);
            try {
              const raw = fs.readFileSync(filePath, 'utf-8');
              evidenceFiles.push(JSON.parse(raw));
            } catch {
              // Skip malformed JSON (same as check-artifacts)
              process.stderr.write(
                JSON.stringify({ warning: `Skipping invalid JSON: ${file.name}` }) + '\n'
              );
              continue;
            }
          }
        }

        // ── 6 forbidden pass condition pre-checks ──────────────────
        const violations: string[] = [];

        // 1. Missing self_check section
        if (recordData.self_check === undefined) {
          violations.push('Missing self_check section in record.json');
        }

        // 2. Missing gate_result section
        if (recordData.gate_result === undefined) {
          violations.push('Missing gate_result section in record.json');
        }

        // 3. Any reviewer evidence with verdict="blocked"
        for (const ev of evidenceFiles) {
          if (ev.role === 'reviewer' && ev.verdict === 'blocked') {
            violations.push(`Reviewer evidence has verdict=blocked (agent: ${ev.agent || 'unknown'})`);
          }
        }

        // 4. Any tester evidence with verdict="fail"
        for (const ev of evidenceFiles) {
          if (ev.role === 'tester' && ev.verdict === 'fail') {
            violations.push(`Tester evidence has verdict=fail (agent: ${ev.agent || 'unknown'})`);
          }
        }

        // 5. Challenge review with blocking=true
        const challengeReview = recordData.challenge_review as Record<string, unknown> | undefined;
        if (challengeReview && challengeReview.blocking === true) {
          violations.push('Challenge review has blocking=true');
        }

        // 6. Missing verdict section or verdict != "pass"
        const verdict = recordData.verdict as Record<string, unknown> | undefined;
        if (!verdict) {
          violations.push('Missing verdict section in record.json');
        } else if (verdict.verdict !== 'pass') {
          violations.push(`Verdict is '${verdict.verdict}', expected 'pass'`);
        }

        // If any forbidden condition met, output blocked status and exit
        if (violations.length > 0) {
          success({ status: 'blocked', violations });
          return;
        }

        // ── Assemble closure JSON ──────────────────────────────────
        // change_summary: from implementer evidence summary
        let changeSummary = '';
        for (const ev of evidenceFiles) {
          if (ev.role === 'implementer' && typeof ev.summary === 'string') {
            changeSummary = ev.summary;
            break;
          }
        }

        // reviews[]: from all reviewer/tester/authority evidence
        const reviews: Array<{ reviewer_type: string; status: string; summary: string }> = [];
        for (const ev of evidenceFiles) {
          if (ev.role === 'reviewer' || ev.role === 'tester' || ev.role === 'authority') {
            reviews.push({
              reviewer_type: ev.role as string,
              status: ev.verdict === 'pass' || ev.verdict === 'approved' ? 'approved'
                : ev.verdict === 'blocked' ? 'blocked'
                : 'changes_requested',
              summary: typeof ev.summary === 'string' ? ev.summary : '',
            });
          }
        }

        // open_risks[]: from self_check known_risks
        const selfCheck = recordData.self_check as Record<string, unknown> | undefined;
        let openRisks: string[] = [];
        if (selfCheck && Array.isArray(selfCheck.known_risks)) {
          openRisks = selfCheck.known_risks.filter((r: unknown) => typeof r === 'string') as string[];
        }

        // debt_items[]: empty array (debt tracked separately)
        const closure = {
          change_summary: changeSummary,
          reviews,
          open_risks: openRisks,
          debt_items: [] as string[],
        };

        // --write: write to record.json closure section
        if (opts.write) {
          const existing = recordData.closure;
          if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
            recordData.closure = { ...existing as Record<string, unknown>, ...closure };
          } else {
            recordData.closure = closure;
          }

          const result = validate('record', recordData);
          if (!result.valid) {
            validationError('record', result.errors!);
            return;
          }

          writeJsonFile(recordPath, recordData, { cwd });

          success({
            written: normalizePath(recordPath),
            task_id: opts.id,
            mission_id: missionId,
            section: 'closure',
            action: 'assembled',
          });
        } else {
          // Default: output to stdout
          success({
            task_id: opts.id,
            mission_id: missionId,
            status: 'assembled',
            closure,
          });
        }
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'closure-assemble', nodeErr.message);
        } else {
          throw err;
        }
      }
    });

  // ── geas task revalidate ──────────────────────────────────────────
  cmd
    .command('revalidate')
    .description('Check task freshness against current HEAD and classify drift')
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

        // Read task contract
        const contractPath = path.resolve(missionDir, 'tasks', opts.id, 'contract.json');
        const task = readJsonFile<Record<string, unknown>>(contractPath);
        if (!task) {
          fileError(
            normalizePath(contractPath),
            'revalidate',
            `Task contract not found: ${normalizePath(contractPath)}`
          );
          return;
        }

        // Extract base_snapshot and scope.surfaces from contract
        const baseSnapshot = task.base_snapshot as string | undefined;
        const scope = task.scope as Record<string, unknown> | undefined;
        const surfaces: string[] = (scope && Array.isArray(scope.surfaces))
          ? scope.surfaces.filter((s: unknown) => typeof s === 'string') as string[]
          : [];

        if (!baseSnapshot) {
          const msg = {
            error: 'Task contract has no base_snapshot field',
            code: 'VALIDATION_ERROR' as const,
            task_id: opts.id,
          };
          process.stderr.write(JSON.stringify(msg) + '\n');
          process.exit(1);
          return;
        }

        // Validate base_snapshot is a hex commit hash (prevent command injection)
        if (!/^[0-9a-f]{4,40}$/i.test(baseSnapshot)) {
          const msg = {
            error: `Invalid base_snapshot: must be a hex commit hash (4-40 chars), got "${baseSnapshot}"`,
            code: 'VALIDATION_ERROR' as const,
            task_id: opts.id,
          };
          process.stderr.write(JSON.stringify(msg) + '\n');
          process.exit(1);
          return;
        }

        // Get current HEAD
        let currentHead: string;
        try {
          currentHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf-8' }).trim();
        } catch {
          const msg = {
            error: 'Failed to get current HEAD. Is this a git repository?',
            code: 'GIT_ERROR' as const,
            task_id: opts.id,
          };
          process.stderr.write(JSON.stringify(msg) + '\n');
          process.exit(1);
          return;
        }

        const currentShort = currentHead.substring(0, baseSnapshot.length);

        // If base_snapshot matches HEAD short hash: fresh, no revalidation needed
        if (baseSnapshot === currentShort || baseSnapshot === currentHead) {
          success({
            task_id: opts.id,
            classification: 'fresh',
            action: 'none',
            base_snapshot: baseSnapshot,
            current_head: currentShort,
          });
          return;
        }

        // Get changed files between base_snapshot and HEAD
        let changedFiles: string[] = [];
        try {
          const diffOutput = execFileSync(
            'git', ['diff', `${baseSnapshot}..HEAD`, '--name-only'],
            { cwd, encoding: 'utf-8' }
          ).trim();
          changedFiles = diffOutput ? diffOutput.split('\n').filter(f => f.length > 0) : [];
        } catch {
          const msg = {
            error: `Failed to compute diff between ${baseSnapshot} and HEAD. Snapshot may be invalid.`,
            code: 'GIT_ERROR' as const,
            task_id: opts.id,
            base_snapshot: baseSnapshot,
          };
          process.stderr.write(JSON.stringify(msg) + '\n');
          process.exit(1);
          return;
        }

        // Check overlap: changed files that start with any scope surface path
        const overlappingFiles = changedFiles.filter(f =>
          surfaces.some(s => f === s || f.startsWith(s.endsWith('/') ? s : s + '/') || s === f)
        );

        // Check semantic drift: adjacent files (same directory as scope surfaces) that changed
        const surfaceDirs = new Set<string>();
        for (const s of surfaces) {
          // If surface looks like a directory, use it directly; otherwise use its parent
          if (s.endsWith('/')) {
            surfaceDirs.add(s.replace(/\/$/, ''));
          } else {
            const dir = path.posix.dirname(s);
            if (dir !== '.') surfaceDirs.add(dir);
          }
        }

        const adjacentChanged = changedFiles.filter(f => {
          // Not already in overlapping
          if (overlappingFiles.includes(f)) return false;
          const fileDir = path.posix.dirname(f);
          return [...surfaceDirs].some(sd => fileDir === sd || fileDir.startsWith(sd + '/'));
        });

        // Classify
        let classification: string;
        let actionTaken: string;
        const hasOverlap = overlappingFiles.length > 0;
        const hasDrift = adjacentChanged.length > 0;

        if (!hasOverlap && !hasDrift) {
          // No overlap and no semantic drift → clean_sync
          classification = 'clean_sync';
          actionTaken = 'base_snapshot_updated';
        } else if (!hasOverlap && hasDrift) {
          // No overlap but semantic drift → review_sync
          classification = 'review_sync';
          actionTaken = 'base_snapshot_updated_with_flag';
        } else if (hasOverlap) {
          // Check if overlap is auto-resolvable (heuristic: only non-surface-core files)
          // Simple heuristic: if overlapping files are few relative to surfaces, treat as review_sync
          const overlapRatio = overlappingFiles.length / Math.max(surfaces.length, 1);
          if (overlapRatio <= 0.5) {
            classification = 'review_sync';
            actionTaken = 'base_snapshot_updated';
          } else {
            classification = 'replan_required';
            actionTaken = 'none';
          }
        } else {
          classification = 'clean_sync';
          actionTaken = 'base_snapshot_updated';
        }

        // For clean_sync/review_sync: update base_snapshot in contract
        const newSnapshot = currentHead.substring(0, baseSnapshot.length);
        if (classification === 'clean_sync' || classification === 'review_sync') {
          task.base_snapshot = newSnapshot;
          writeJsonFile(contractPath, task, { cwd });
        }

        success({
          task_id: opts.id,
          classification,
          changed_files: changedFiles,
          overlapping_files: overlappingFiles,
          adjacent_changed: adjacentChanged,
          action_taken: actionTaken,
          base_snapshot: classification === 'clean_sync' || classification === 'review_sync'
            ? newSnapshot
            : baseSnapshot,
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'revalidate', nodeErr.message);
        } else {
          throw err;
        }
      }
    });

  // ── geas task retrospective-draft ────────────────────────────────────
  cmd
    .command('retrospective-draft')
    .description('Generate a structured retrospective JSON from evidence and record sections')
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

        const taskDir = path.resolve(missionDir, 'tasks', opts.id);
        if (!fs.existsSync(taskDir)) {
          fileError(normalizePath(taskDir), 'retrospective-draft', `Task directory not found: ${opts.id}`);
          return;
        }

        // Read all evidence/*.json files
        const evidenceDir = path.resolve(taskDir, 'evidence');
        const evidenceFiles: Array<Record<string, unknown>> = [];

        if (fs.existsSync(evidenceDir)) {
          const entries = fs.readdirSync(evidenceDir, { withFileTypes: true });
          const jsonFiles = entries.filter(e => e.isFile() && e.name.endsWith('.json'));

          for (const file of jsonFiles) {
            const filePath = path.resolve(evidenceDir, file.name);
            try {
              const raw = fs.readFileSync(filePath, 'utf-8');
              evidenceFiles.push(JSON.parse(raw));
            } catch {
              // Skip malformed JSON (same pattern as closure-assemble)
              process.stderr.write(
                JSON.stringify({ warning: `Skipping invalid JSON: ${file.name}` }) + '\n'
              );
              continue;
            }
          }
        }

        // Read record.json
        const recordPath = path.resolve(taskDir, 'record.json');
        const recordData = readJsonFile<Record<string, unknown>>(recordPath);

        // Extract record sections (all optional — task may not have all)
        const selfCheck = recordData?.self_check as Record<string, unknown> | undefined;
        const gateResult = recordData?.gate_result as Record<string, unknown> | undefined;
        const closure = recordData?.closure as Record<string, unknown> | undefined;
        const challengeReview = recordData?.challenge_review as Record<string, unknown> | undefined;
        const verdict = recordData?.verdict as Record<string, unknown> | undefined;

        // Read contract for status (needed for cancelled check)
        const contractPath = path.resolve(taskDir, 'contract.json');
        const contract = readJsonFile<Record<string, unknown>>(contractPath);
        const taskStatus = contract?.status as string | undefined;

        // ── what_went_well: evidence summaries with pass/approved verdict ──
        const whatWentWell: string[] = [];
        for (const ev of evidenceFiles) {
          if (
            (ev.verdict === 'pass' || ev.verdict === 'approved') &&
            typeof ev.summary === 'string'
          ) {
            whatWentWell.push(`[${ev.role || 'unknown'}] ${ev.summary}`);
          }
        }

        // ── what_broke: evidence with concerns or non-pass verdict + self_check known_risks ──
        const whatBroke: string[] = [];
        for (const ev of evidenceFiles) {
          if (ev.verdict && ev.verdict !== 'pass' && ev.verdict !== 'approved') {
            const label = `[${ev.role || 'unknown'}] verdict=${ev.verdict}`;
            const detail = typeof ev.summary === 'string' ? `: ${ev.summary}` : '';
            whatBroke.push(label + detail);
          }
          if (Array.isArray(ev.concerns)) {
            for (const c of ev.concerns) {
              if (typeof c === 'string') {
                whatBroke.push(`[${ev.role || 'unknown'} concern] ${c}`);
              }
            }
          }
        }
        if (selfCheck && Array.isArray(selfCheck.known_risks)) {
          for (const risk of selfCheck.known_risks) {
            if (typeof risk === 'string') {
              whatBroke.push(`[self_check known_risk] ${risk}`);
            }
          }
        }

        // ── what_was_surprising: from challenge_review concerns ──
        const whatWasSurprising: string[] = [];
        if (challengeReview) {
          if (Array.isArray(challengeReview.concerns)) {
            for (const c of challengeReview.concerns) {
              if (typeof c === 'string') {
                whatWasSurprising.push(c);
              }
            }
          }
          if (typeof challengeReview.rationale === 'string') {
            whatWasSurprising.push(`[challenge rationale] ${challengeReview.rationale}`);
          }
        }

        // ── rule_candidates: empty (orchestrator fills) ──
        const ruleCandidates: string[] = [];

        // ── memory_candidates: from evidence memory_suggestions fields ──
        const memoryCandidates: string[] = [];
        for (const ev of evidenceFiles) {
          if (Array.isArray(ev.memory_suggestions)) {
            for (const ms of ev.memory_suggestions) {
              if (typeof ms === 'string') {
                memoryCandidates.push(ms);
              }
            }
          }
        }

        // ── debt_candidates: from evidence tech_debt fields ──
        const debtCandidates: string[] = [];
        for (const ev of evidenceFiles) {
          if (Array.isArray(ev.tech_debt)) {
            for (const td of ev.tech_debt) {
              if (typeof td === 'string') {
                debtCandidates.push(td);
              }
            }
          }
        }

        // ── next_time_guidance: from self_check untested_paths ──
        const nextTimeGuidance: string[] = [];
        if (selfCheck && Array.isArray(selfCheck.untested_paths)) {
          for (const up of selfCheck.untested_paths) {
            if (typeof up === 'string') {
              nextTimeGuidance.push(up);
            }
          }
        }

        // ── For cancelled tasks: include cancellation context ──
        let cancellationContext: Record<string, unknown> | undefined;
        if (taskStatus === 'cancelled') {
          // Check for DecisionRecord in packets/
          const packetsDir = path.resolve(taskDir, 'packets');
          if (fs.existsSync(packetsDir)) {
            const packetEntries = fs.readdirSync(packetsDir, { withFileTypes: true });
            const packetJsonFiles = packetEntries.filter(e => e.isFile() && e.name.endsWith('.json'));

            for (const file of packetJsonFiles) {
              const filePath = path.resolve(packetsDir, file.name);
              try {
                const raw = fs.readFileSync(filePath, 'utf-8');
                const packet = JSON.parse(raw) as Record<string, unknown>;
                // Look for a decision record related to cancellation
                if (
                  packet.artifact_type === 'decision_record' ||
                  packet.type === 'decision_record' ||
                  packet.decision_type === 'cancellation'
                ) {
                  cancellationContext = {
                    source: file.name,
                    reason: packet.reason || packet.rationale || packet.summary || 'No reason provided',
                    decided_by: packet.decided_by || packet.agent || 'unknown',
                  };
                  break;
                }
              } catch {
                continue;
              }
            }
          }

          // Fallback: use verdict section if it mentions cancellation
          if (!cancellationContext && verdict) {
            cancellationContext = {
              source: 'record.json:verdict',
              reason: verdict.rationale || verdict.reason || verdict.summary || 'Cancelled (no detailed reason found)',
              decided_by: verdict.decided_by || verdict.agent || 'unknown',
            };
          }
        }

        // ── Assemble retrospective JSON ──
        const retrospective: Record<string, unknown> = {
          task_id: opts.id,
          mission_id: missionId,
          task_status: taskStatus || 'unknown',
          what_went_well: whatWentWell,
          what_broke: whatBroke,
          what_was_surprising: whatWasSurprising,
          rule_candidates: ruleCandidates,
          memory_candidates: memoryCandidates,
          debt_candidates: debtCandidates,
          next_time_guidance: nextTimeGuidance,
        };

        if (cancellationContext) {
          retrospective.cancellation_context = cancellationContext;
        }

        success(retrospective);
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'FILE_ERROR') {
          fileError('', 'retrospective-draft', nodeErr.message);
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
