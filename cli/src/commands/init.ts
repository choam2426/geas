import { Command } from 'commander';
import { existsSync, rmSync } from 'node:fs';
import {
  ALL_ROLES,
  ensureDir,
  geasRoot,
  writeYamlAtomic,
} from '../lib/runtime';
import {
  emptyLocation,
  failure,
  success,
  type FailureResult,
  type SuccessResult,
} from '../lib/output';

const COMMAND = 'init';

export type InitResult = SuccessResult | FailureResult;

export function runInit(cwd: string = process.cwd()): InitResult {
  const root = geasRoot(cwd);
  if (existsSync(root)) {
    return {
      ok: false,
      command: COMMAND,
      current: emptyLocation(),
      writes: [],
      error: { code: 'already_initialized', detail: '.geas already exists' },
    };
  }

  try {
    ensureDir(root);
    ensureDir(`${root}/memory/roles`);
    ensureDir(`${root}/missions`);

    writeYamlAtomic(`${root}/run-state.yaml`, {
      current_mission_id: '',
      current_stage: '',
      current_task_id: '',
    });
    writeYamlAtomic(`${root}/debts.yaml`, { items: [] });
    writeYamlAtomic(`${root}/memory/common.yaml`, { items: [] });
    for (const role of ALL_ROLES) {
      writeYamlAtomic(`${root}/memory/roles/${role}.yaml`, { items: [] });
    }
  } catch (e: unknown) {
    // Roll back partial init so the user can retry.
    try {
      rmSync(root, { recursive: true, force: true });
    } catch {
      // best-effort rollback; if rmSync also fails, surface the original error below
    }
    const detail = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      command: COMMAND,
      current: emptyLocation(),
      writes: [],
      error: { code: 'init_failed', detail },
    };
  }

  const writes: SuccessResult['writes'] = [
    { path: '.geas/run-state.yaml', type: 'created' },
    { path: '.geas/debts.yaml', type: 'created' },
    { path: '.geas/memory/common.yaml', type: 'created' },
    ...ALL_ROLES.map((r) => ({ path: `.geas/memory/roles/${r}.yaml`, type: 'created' as const })),
  ];

  return {
    ok: true,
    command: COMMAND,
    current: emptyLocation(),
    writes,
    state_changes: [],
  };
}

export function registerInit(program: Command): void {
  program
    .command('init')
    .description('Create .geas/ runtime storage in the current directory')
    .action(() => {
      const result = runInit();
      if (result.ok) success(result);
      else failure(result);
    });
}
