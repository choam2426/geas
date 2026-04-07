/**
 * Debt command group — debt register management.
 *
 * File: .geas/missions/{mid}/evolution/debt-register.json
 *
 * Supports: add (with auto-ID, duplicate detection, rollup update),
 *           resolve (mark item resolved, rollup update),
 *           list (filtered by status/severity).
 */

import * as path from 'path';
import type { Command } from 'commander';
import { success, fileError } from '../lib/output';
import { resolveGeasDir, resolveMissionDir, normalizePath } from '../lib/paths';
import { readJsonFile, atomicWriteJsonFile, ensureDir } from '../lib/fs-atomic';

// --- Types ---

interface DebtItem {
  debt_id: string;
  severity: string;
  kind: string;
  title: string;
  description: string;
  introduced_by_task_id?: string;
  owner_type?: string;
  status: string;
  target_phase?: string;
}

interface DebtRegister {
  version: string;
  artifact_type: string;
  artifact_id: string;
  producer_type: string;
  scope: string;
  items: DebtItem[];
  rollup_by_severity: Record<string, number>;
  rollup_by_kind: Record<string, number>;
  created_at: string;
}

const VALID_SEVERITIES = ['low', 'normal', 'high', 'critical'];
const VALID_KINDS = ['output_quality', 'verification_gap', 'structural', 'risk', 'process', 'documentation', 'operations'];
const FILTERABLE_STATUSES = ['open', 'resolved', 'accepted', 'scheduled', 'dropped'];

// --- Helpers ---

function debtRegisterPath(missionDir: string): string {
  return path.resolve(missionDir, 'evolution', 'debt-register.json');
}

function createEmptyRegister(missionId: string): DebtRegister {
  return {
    version: '1.0',
    artifact_type: 'debt_register',
    artifact_id: `debt-register-${missionId}`,
    producer_type: 'design_authority',
    scope: 'mission',
    items: [],
    rollup_by_severity: {},
    rollup_by_kind: {},
    created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };
}

/**
 * Compute the next DEBT-xxx ID by finding the highest existing numeric suffix.
 */
function nextDebtId(items: DebtItem[]): string {
  let maxNum = 0;
  for (const item of items) {
    const match = item.debt_id.match(/^DEBT-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  const nextNum = maxNum + 1;
  return `DEBT-${String(nextNum).padStart(3, '0')}`;
}

/**
 * Recompute rollup counts from the items array.
 * Counts only open/accepted/scheduled items (not resolved/dropped).
 */
function recomputeRollups(register: DebtRegister): void {
  const bySeverity: Record<string, number> = {};
  const byKind: Record<string, number> = {};

  for (const item of register.items) {
    if (item.status === 'resolved' || item.status === 'dropped') continue;

    bySeverity[item.severity] = (bySeverity[item.severity] || 0) + 1;
    byKind[item.kind] = (byKind[item.kind] || 0) + 1;
  }

  register.rollup_by_severity = bySeverity;
  register.rollup_by_kind = byKind;
}

export function registerDebtCommands(program: Command): void {
  const cmd = program
    .command('debt')
    .description('Debt register management (add, resolve, list)');

  // --- debt add ---
  cmd
    .command('add')
    .description('Add an item to the debt register (auto-ID, duplicate detection)')
    .requiredOption('--mission <mid>', 'Mission identifier')
    .requiredOption('--title <title>', 'Debt item title')
    .requiredOption('--severity <severity>', `Severity: ${VALID_SEVERITIES.join(', ')}`)
    .requiredOption('--kind <kind>', `Kind: ${VALID_KINDS.join(', ')}`)
    .requiredOption('--task <tid>', 'Task that introduced this debt')
    .requiredOption('--owner <owner>', 'Owner type (agent type responsible)')
    .option('--description <desc>', 'Detailed description', '')
    .action((opts: {
      mission: string;
      title: string;
      severity: string;
      kind: string;
      task: string;
      owner: string;
      description: string;
    }) => {
      try {
        // Validate severity
        if (!VALID_SEVERITIES.includes(opts.severity)) {
          fileError('', 'validate', `Invalid severity '${opts.severity}'. Must be one of: ${VALID_SEVERITIES.join(', ')}`);
          return;
        }

        // Validate kind
        if (!VALID_KINDS.includes(opts.kind)) {
          fileError('', 'validate', `Invalid kind '${opts.kind}'. Must be one of: ${VALID_KINDS.join(', ')}`);
          return;
        }

        const geasDir = resolveGeasDir();
        const missionDir = resolveMissionDir(geasDir, opts.mission);
        const regPath = debtRegisterPath(missionDir);

        // Ensure evolution directory exists
        ensureDir(path.dirname(regPath));

        // Read or create register
        let register = readJsonFile<DebtRegister>(regPath);
        if (!register) {
          register = createEmptyRegister(opts.mission);
        }

        // Duplicate detection by title
        const existingByTitle = register.items.find(
          (item) => item.title === opts.title
        );
        if (existingByTitle) {
          success({
            skipped: true,
            reason: 'duplicate_title',
            existing_id: existingByTitle.debt_id,
            title: opts.title,
          });
          return;
        }

        // Generate new ID and create item
        const debtId = nextDebtId(register.items);
        const newItem: DebtItem = {
          debt_id: debtId,
          severity: opts.severity,
          kind: opts.kind,
          title: opts.title,
          description: opts.description || opts.title,
          introduced_by_task_id: opts.task,
          owner_type: opts.owner,
          status: 'open',
        };

        register.items.push(newItem);
        recomputeRollups(register);

        atomicWriteJsonFile(regPath, register);

        success({
          added: true,
          debt_id: debtId,
          title: opts.title,
          severity: opts.severity,
          kind: opts.kind,
          path: normalizePath(regPath),
          rollup_by_severity: register.rollup_by_severity,
          rollup_by_kind: register.rollup_by_kind,
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        fileError('', 'debt add', nodeErr.message || String(err));
      }
    });

  // --- debt resolve ---
  cmd
    .command('resolve')
    .description('Mark a debt item as resolved and update rollup')
    .requiredOption('--mission <mid>', 'Mission identifier')
    .requiredOption('--id <debt-id>', 'Debt item ID (e.g. DEBT-001)')
    .action((opts: { mission: string; id: string }) => {
      try {
        const geasDir = resolveGeasDir();
        const missionDir = resolveMissionDir(geasDir, opts.mission);
        const regPath = debtRegisterPath(missionDir);

        const register = readJsonFile<DebtRegister>(regPath);
        if (!register) {
          fileError(normalizePath(regPath), 'read', 'Debt register not found');
          return;
        }

        const item = register.items.find((i) => i.debt_id === opts.id);
        if (!item) {
          fileError(opts.id, 'resolve', `Debt item '${opts.id}' not found in register`);
          return;
        }

        if (item.status === 'resolved') {
          success({
            already_resolved: true,
            debt_id: opts.id,
          });
          return;
        }

        item.status = 'resolved';
        recomputeRollups(register);

        atomicWriteJsonFile(regPath, register);

        success({
          resolved: true,
          debt_id: opts.id,
          title: item.title,
          path: normalizePath(regPath),
          rollup_by_severity: register.rollup_by_severity,
          rollup_by_kind: register.rollup_by_kind,
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        fileError('', 'debt resolve', nodeErr.message || String(err));
      }
    });

  // --- debt list ---
  cmd
    .command('list')
    .description('List debt items with optional filters')
    .requiredOption('--mission <mid>', 'Mission identifier')
    .option('--status <status>', `Filter by status: ${FILTERABLE_STATUSES.join(', ')}`)
    .option('--severity <severity>', `Filter by severity: ${VALID_SEVERITIES.join(', ')}`)
    .action((opts: { mission: string; status?: string; severity?: string }) => {
      try {
        const geasDir = resolveGeasDir();
        const missionDir = resolveMissionDir(geasDir, opts.mission);
        const regPath = debtRegisterPath(missionDir);

        const register = readJsonFile<DebtRegister>(regPath);
        if (!register) {
          success({
            mission_id: opts.mission,
            items: [],
            total: 0,
            filters: { status: opts.status || null, severity: opts.severity || null },
          });
          return;
        }

        let items = register.items;

        // Apply status filter
        if (opts.status) {
          items = items.filter((i) => i.status === opts.status);
        }

        // Apply severity filter
        if (opts.severity) {
          items = items.filter((i) => i.severity === opts.severity);
        }

        success({
          mission_id: opts.mission,
          items,
          total: items.length,
          filters: { status: opts.status || null, severity: opts.severity || null },
          rollup_by_severity: register.rollup_by_severity,
          rollup_by_kind: register.rollup_by_kind,
        });
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        fileError('', 'debt list', nodeErr.message || String(err));
      }
    });
}
