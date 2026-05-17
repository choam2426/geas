import { Command } from 'commander';
import { join } from 'node:path';
import { checkDebtRecord, checkDebtUpdate } from '../lib/guards';
import { cleanupFromSource, readPayload } from '../lib/io';
import {
  emptyLocation,
  failure,
  success,
  type FailureResult,
  type SuccessResult,
} from '../lib/output';
import { geasRoot, readRunState, readYaml } from '../lib/runtime';
import { validate } from '../lib/schema';
import { runTransaction } from '../lib/transaction';

const COMMAND_RECORD = 'debt record';
const COMMAND_UPDATE = 'debt update';

type DebtItem = {
  debt_id: string;
  status: 'open' | 'resolved' | 'dropped';
  title: string;
  summary: string;
  impact: string;
  source_refs: string[];
  accepted_in_ref: string;
  revisit_when: string[];
  resolved_by_refs: string[];
};

type DebtLedger = {
  items: DebtItem[];
};

export type DebtResult = SuccessResult | FailureResult;

export function runDebtRecord(payload: unknown, cwd: string = process.cwd()): DebtResult {
  const runState = readRunState(cwd);
  const current = runState
    ? { mission_id: runState.current_mission_id, stage: runState.current_stage, task_id: runState.current_task_id, phase: '' }
    : emptyLocation();

  if (!isPlainObject(payload)) {
    return { ok: false, command: COMMAND_RECORD, current, writes: [], error: { code: 'payload_invalid', detail: 'payload must be an object' } };
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'debt_id')) {
    return { ok: false, command: COMMAND_RECORD, current, writes: [], error: { code: 'debt_id_not_allowed' } };
  }

  const ledgerPath = join(geasRoot(cwd), 'debts.yaml');
  const ledger = readYaml<DebtLedger>(ledgerPath) ?? { items: [] };
  const item = { ...payload, debt_id: nextDebtId(ledger) };

  const v = validate('debt-item', item);
  if (!v.valid) {
    return { ok: false, command: COMMAND_RECORD, current, writes: [], error: { code: 'schema_invalid', detail: v.errors.join('; ') } };
  }

  const guard = checkDebtRecord(runState, item as DebtItem, cwd);
  if (!guard.ok) {
    return { ok: false, command: COMMAND_RECORD, current, writes: [], error: { code: 'guard_failed', guards: guard.guards } };
  }

  const nextLedger = { items: [...ledger.items, item as DebtItem] };
  const lv = validate('debt-ledger', nextLedger);
  if (!lv.valid) {
    return { ok: false, command: COMMAND_RECORD, current, writes: [], error: { code: 'schema_invalid', detail: lv.errors.join('; ') } };
  }

  try {
    runTransaction((tx) => {
      tx.writeYaml(ledgerPath, nextLedger);
    });
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, command: COMMAND_RECORD, current, writes: [], error: { code: 'debt_record_failed', detail } };
  }

  return {
    ok: true,
    command: COMMAND_RECORD,
    current,
    writes: [{ path: '.geas/debts.yaml', type: 'updated' }],
    state_changes: [],
  };
}

export function runDebtUpdate(debtId: string, patch: unknown, cwd: string = process.cwd()): DebtResult {
  const runState = readRunState(cwd);
  const current = runState
    ? { mission_id: runState.current_mission_id, stage: runState.current_stage, task_id: runState.current_task_id, phase: '' }
    : emptyLocation();

  if (!isPlainObject(patch)) {
    return { ok: false, command: COMMAND_UPDATE, current, writes: [], error: { code: 'payload_invalid', detail: 'payload must be an object' } };
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'debt_id')) {
    return { ok: false, command: COMMAND_UPDATE, current, writes: [], error: { code: 'debt_id_not_allowed' } };
  }

  const ledgerPath = join(geasRoot(cwd), 'debts.yaml');
  const ledger = readYaml<DebtLedger>(ledgerPath) ?? { items: [] };
  const index = ledger.items.findIndex((item) => item.debt_id === debtId);
  if (index < 0) {
    return { ok: false, command: COMMAND_UPDATE, current, writes: [], error: { code: 'debt_not_found', detail: debtId } };
  }

  const merged = { ...ledger.items[index], ...patch };
  const v = validate('debt-item', merged);
  if (!v.valid) {
    return { ok: false, command: COMMAND_UPDATE, current, writes: [], error: { code: 'schema_invalid', detail: v.errors.join('; ') } };
  }

  const guard = checkDebtUpdate(runState, merged as DebtItem, cwd);
  if (!guard.ok) {
    return { ok: false, command: COMMAND_UPDATE, current, writes: [], error: { code: 'guard_failed', guards: guard.guards } };
  }

  const nextItems = [...ledger.items];
  nextItems[index] = merged as DebtItem;
  const nextLedger = { items: nextItems };
  const lv = validate('debt-ledger', nextLedger);
  if (!lv.valid) {
    return { ok: false, command: COMMAND_UPDATE, current, writes: [], error: { code: 'schema_invalid', detail: lv.errors.join('; ') } };
  }

  try {
    runTransaction((tx) => {
      tx.writeYaml(ledgerPath, nextLedger);
    });
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, command: COMMAND_UPDATE, current, writes: [], error: { code: 'debt_update_failed', detail } };
  }

  return {
    ok: true,
    command: COMMAND_UPDATE,
    current,
    writes: [{ path: '.geas/debts.yaml', type: 'updated' }],
    state_changes: [],
  };
}

export function registerDebt(program: Command): void {
  const debt = program.command('debt').description('Debt Ledger commands');

  debt
    .command('record')
    .requiredOption('--from <path>', 'YAML debt item payload path or - for stdin')
    .description('Append a debt item')
    .action((opts: { from: string }) => {
      const read = readPayload(opts.from);
      if (!read.ok) {
        failure({ ok: false, command: COMMAND_RECORD, current: emptyLocation(), writes: [], error: { code: read.code, detail: read.detail } });
        return;
      }
      const result = runDebtRecord(read.payload);
      if (result.ok) {
        cleanupFromSource(opts.from);
        success(result);
      }
      else failure(result);
    });

  debt
    .command('update')
    .requiredOption('--id <debt-id>', 'Debt id to update')
    .requiredOption('--from <path>', 'YAML debt item patch path or - for stdin')
    .description('Patch a debt item')
    .action((opts: { id: string; from: string }) => {
      const read = readPayload(opts.from);
      if (!read.ok) {
        failure({ ok: false, command: COMMAND_UPDATE, current: emptyLocation(), writes: [], error: { code: read.code, detail: read.detail } });
        return;
      }
      const result = runDebtUpdate(opts.id, read.payload);
      if (result.ok) {
        cleanupFromSource(opts.from);
        success(result);
      }
      else failure(result);
    });
}

function nextDebtId(ledger: DebtLedger): string {
  let max = 0;
  for (const item of ledger.items) {
    const m = item.debt_id.match(/^DEBT-(\d{3})$/);
    if (!m) continue;
    const n = parseInt(m[1]!, 10);
    if (n > max) max = n;
  }
  return `DEBT-${String(max + 1).padStart(3, '0')}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
