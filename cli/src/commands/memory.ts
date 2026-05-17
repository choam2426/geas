import { Command } from 'commander';
import { join } from 'node:path';
import { geasRoot, readRunState, readYaml } from '../lib/runtime';
import {
  emptyLocation,
  failure,
  success,
  type FailureResult,
  type SuccessResult,
} from '../lib/output';
import { checkMemoryRecord } from '../lib/guards';
import { validate } from '../lib/schema';
import { cleanupFromSource, readPayload } from '../lib/io';
import { runTransaction } from '../lib/transaction';

export type MemoryResult = SuccessResult | FailureResult;

const COMMAND = 'memory record';

export function runMemoryRecord(
  scope: 'common' | 'role' | string,
  role: string | undefined,
  payload: unknown,
  cwd: string = process.cwd(),
): MemoryResult {
  const runState = readRunState(cwd);
  const current = runState
    ? { mission_id: runState.current_mission_id, stage: runState.current_stage, task_id: runState.current_task_id, phase: '' }
    : emptyLocation();

  if (scope !== 'common' && scope !== 'role') {
    return { ok: false, command: COMMAND, current, writes: [], error: { code: 'scope_invalid', detail: scope } };
  }

  const v = validate('memory-item', payload);
  if (!v.valid) {
    return { ok: false, command: COMMAND, current, writes: [], error: { code: 'schema_invalid', detail: v.errors.join('; ') } };
  }

  const guard = checkMemoryRecord(runState, scope, role, payload as { source_refs: string[] }, cwd);
  if (!guard.ok) {
    return { ok: false, command: COMMAND, current, writes: [], error: { code: 'guard_failed', guards: guard.guards } };
  }

  const root = geasRoot(cwd);
  const file = scope === 'common'
    ? join(root, 'memory', 'common.yaml')
    : join(root, 'memory', 'roles', `${role}.yaml`);

  const existing = readYaml<{ items: unknown[] }>(file) ?? { items: [] };
  const next = { items: [...existing.items, payload] };
  try {
    runTransaction((tx) => {
      tx.writeYaml(file, next);
    });
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, command: COMMAND, current, writes: [], error: { code: 'memory_record_failed', detail } };
  }

  const rel = scope === 'common' ? '.geas/memory/common.yaml' : `.geas/memory/roles/${role}.yaml`;
  return {
    ok: true,
    command: COMMAND,
    current,
    writes: [{ path: rel, type: 'updated' }],
    state_changes: [],
  };
}

export function registerMemory(program: Command): void {
  program
    .command('memory')
    .description('Memory updates')
    .command('record')
    .requiredOption('--scope <scope>', 'common or role')
    .option('--role <role>', 'Required for --scope role')
    .requiredOption('--from <path>', 'YAML payload path or - for stdin')
    .description('Append a memory item')
    .action((opts: { scope: string; role?: string; from: string }) => {
      const read = readPayload(opts.from);
      if (!read.ok) {
        failure({
          ok: false,
          command: COMMAND,
          current: emptyLocation(),
          writes: [],
          error: { code: read.code, detail: read.detail },
        });
        return;
      }
      const result = runMemoryRecord(opts.scope, opts.role, read.payload);
      if (result.ok) {
        cleanupFromSource(opts.from);
        success(result);
      }
      else failure(result);
    });
}
