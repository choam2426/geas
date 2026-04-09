/**
 * Health command group — generate and read health-check.json.
 *
 * `geas health generate` reads .geas/ state and produces health-check.json
 * with 8 signals from protocol doc 12.
 *
 * `geas health read` outputs the current health-check.json.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Command } from 'commander';
import { readJsonFile, writeJsonFile } from '../lib/fs-atomic';
import { resolveGeasDir } from '../lib/paths';
import { validate } from '../lib/schema';
import { success, validationError, fileError } from '../lib/output';
import { getCwd } from '../lib/cwd';

/** Signal definition: name, threshold, and how to compute the value. */
interface SignalDef {
  name: string;
  threshold: number;
  compute: (ctx: HealthContext) => { value: number; detail: string };
  mandatoryResponse: string;
}

/** State gathered from .geas/ for signal computation. */
interface HealthContext {
  geasDir: string;
  memoryIndex: Record<string, unknown> | null;
  runState: Record<string, unknown> | null;
  debtRegister: Record<string, unknown> | null;
  taskFiles: Record<string, unknown>[];
  missionDir: string | null;
}

/**
 * Safely list JSON files in a directory. Returns empty array on error.
 */
function listJsonFiles(dir: string): string[] {
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
}

/**
 * List subdirectories in a directory. Returns empty array on error.
 */
function listSubdirs(dir: string): string[] {
  try {
    return fs.readdirSync(dir).filter((f) => {
      try {
        return fs.statSync(path.join(dir, f)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

/**
 * Read all task contract files from the current mission.
 * v4: tasks are directories with contract.json inside (tasks/{tid}/contract.json).
 */
function readTaskFiles(missionDir: string | null): Record<string, unknown>[] {
  if (!missionDir) return [];
  const tasksDir = path.join(missionDir, 'tasks');
  const taskDirs = listSubdirs(tasksDir);
  const tasks: Record<string, unknown>[] = [];
  for (const tid of taskDirs) {
    try {
      const contractPath = path.join(tasksDir, tid, 'contract.json');
      const content = JSON.parse(fs.readFileSync(contractPath, 'utf-8'));
      tasks.push(content as Record<string, unknown>);
    } catch {
      // Skip directories without a valid contract.json
    }
  }
  return tasks;
}

/**
 * Build the health context by reading state files.
 */
function buildContext(geasDir: string): HealthContext {
  const runState = readJsonFile<Record<string, unknown>>(
    path.join(geasDir, 'state', 'run.json')
  );

  const missionId = runState?.mission_id as string | undefined;
  let missionDir: string | null = null;
  let debtRegister: Record<string, unknown> | null = null;

  if (missionId) {
    const mdir = path.join(geasDir, 'missions', missionId);
    try {
      fs.accessSync(mdir);
      missionDir = mdir;
    } catch {
      // Mission dir does not exist
    }
  }

  if (missionDir) {
    debtRegister = readJsonFile<Record<string, unknown>>(
      path.join(missionDir, 'evolution', 'debt-register.json')
    );
  }

  const taskFiles = readTaskFiles(missionDir);

  return {
    geasDir,
    memoryIndex: null,
    runState,
    debtRegister,
    taskFiles,
    missionDir,
  };
}

/**
 * The 8 health signals from protocol doc 12.
 */
const SIGNAL_DEFS: SignalDef[] = [
  {
    // 1. memory_bloat: ratio of non-active memory entries
    // v4: memory is simplified to 2-state (draft/active) with agent .md files
    // No structured index to scan — this signal is retained for schema compatibility
    name: 'memory_bloat',
    threshold: 0.4,
    mandatoryResponse: 'Trigger memory review cycle to archive or decay stale entries',
    compute(_ctx) {
      // v4 simplified memory has no structured memory-index.json.
      // This signal is retained for schema compatibility but always reports 0.
      return {
        value: 0,
        detail: 'v4 memory model uses simplified 2-state agent notes',
      };
    },
  },
  {
    // 2. review_gap: fraction of completed tasks missing reviewer evidence
    name: 'review_gap',
    threshold: 0.2,
    mandatoryResponse: 'Schedule missing reviews before allowing new task starts',
    compute(ctx) {
      const completed = ctx.taskFiles.filter(
        (t) => t.status === 'passed' || t.status === 'verified'
      );
      if (completed.length === 0) {
        return { value: 0, detail: 'No completed tasks to review' };
      }
      let missing = 0;
      for (const t of completed) {
        const tid = (t.task_id as string) || (t.id as string) || '';
        if (!tid || !ctx.missionDir) continue;
        // v4: evidence lives at tasks/{tid}/evidence/
        const edir = path.join(ctx.missionDir, 'tasks', tid, 'evidence');
        const evidenceFiles = listJsonFiles(edir);
        if (evidenceFiles.length === 0) {
          missing++;
        }
      }
      const ratio = missing / completed.length;
      return {
        value: Math.round(ratio * 100) / 100,
        detail: `${missing}/${completed.length} completed tasks lack evidence`,
      };
    },
  },
  {
    // 3. gate_quality_issue: fraction of gate results that were fail or block
    name: 'gate_quality_issue',
    threshold: 0.3,
    mandatoryResponse: 'Review gate criteria and consider lowering scope or splitting tasks',
    compute(ctx) {
      // v4: gate_result is a section in tasks/{tid}/record.json
      if (!ctx.missionDir) {
        return { value: 0, detail: 'No mission directory' };
      }
      let total = 0;
      let issues = 0;
      for (const t of ctx.taskFiles) {
        const tid = (t.task_id as string) || (t.id as string) || '';
        if (!tid) continue;
        const recordPath = path.join(ctx.missionDir, 'tasks', tid, 'record.json');
        try {
          const record = JSON.parse(fs.readFileSync(recordPath, 'utf-8')) as Record<string, unknown>;
          const sections = (record.sections as Record<string, unknown>) || record;
          const gateResult = sections.gate_result as Record<string, unknown> | undefined;
          if (gateResult) {
            total++;
            if (gateResult.verdict === 'fail' || gateResult.verdict === 'block') {
              issues++;
            }
          }
        } catch {
          // Skip tasks without record.json
        }
      }
      if (total === 0) {
        return { value: 0, detail: 'No gate results found' };
      }
      const ratio = issues / total;
      return {
        value: Math.round(ratio * 100) / 100,
        detail: `${issues}/${total} gate results were fail/block`,
      };
    },
  },
  {
    // 4. contradiction_accumulation: total contradictions across memory entries
    // v4: memory is simplified to 2-state (draft/active) with memory/agents/{agent}.md
    // No structured contradiction_count in v4 — always returns 0
    name: 'contradiction_accumulation',
    threshold: 3,
    mandatoryResponse: 'Trigger memory review to resolve contradictions before proceeding',
    compute(_ctx) {
      // v4 simplified memory has no structured contradiction tracking.
      // This signal is retained for schema compatibility but always reports 0.
      return {
        value: 0,
        detail: 'v4 memory model has no structured contradiction tracking',
      };
    },
  },
  {
    // 5. repeated_failure_class: count of tasks that failed gate 2+ times
    // v4: gate_result is in record.json (single result per task). Repeated failures
    // are tracked via retry_count in the contract or evidence files.
    name: 'repeated_failure_class',
    threshold: 2,
    mandatoryResponse: 'Investigate root cause of repeated failures and consider process change',
    compute(ctx) {
      let repeatedFailures = 0;
      for (const t of ctx.taskFiles) {
        const tid = (t.task_id as string) || (t.id as string) || '';
        if (!tid || !ctx.missionDir) continue;
        // v4: evidence files at tasks/{tid}/evidence/ — count fail verdicts
        const edir = path.join(ctx.missionDir, 'tasks', tid, 'evidence');
        const files = listJsonFiles(edir);
        let failCount = 0;
        for (const f of files) {
          try {
            const ev = JSON.parse(fs.readFileSync(path.join(edir, f), 'utf-8')) as Record<string, unknown>;
            if (ev.verdict === 'fail') failCount++;
          } catch {
            // Skip
          }
        }
        if (failCount >= 2) repeatedFailures++;
      }
      return {
        value: repeatedFailures,
        detail: `${repeatedFailures} tasks had 2+ gate failures`,
      };
    },
  },
  {
    // 6. debt_stagnation: count of open debt items older than reasonable window
    name: 'debt_stagnation',
    threshold: 5,
    mandatoryResponse: 'Schedule debt reduction tasks in next phase',
    compute(ctx) {
      if (!ctx.debtRegister) {
        return { value: 0, detail: 'No debt register found' };
      }
      const items = (ctx.debtRegister.items as Record<string, unknown>[]) || [];
      const openItems = items.filter((i) => i.status === 'open');
      return {
        value: openItems.length,
        detail: `${openItems.length} open debt items`,
      };
    },
  },
  {
    // 7. scope_control_weakness: tasks with scope warnings (from post-write checks)
    name: 'scope_control_weakness',
    threshold: 2,
    mandatoryResponse: 'Review task scope definitions and tighten scope.surfaces constraints',
    compute(ctx) {
      // Count tasks where scope.surfaces is empty
      let weakScope = 0;
      for (const t of ctx.taskFiles) {
        const scope = t.scope as Record<string, unknown> | undefined;
        if (!scope) {
          weakScope++;
          continue;
        }
        const paths = (scope.surfaces as string[]) || [];
        if (paths.length === 0) {
          weakScope++;
        }
      }
      return {
        value: weakScope,
        detail: `${weakScope}/${ctx.taskFiles.length} tasks have weak or missing scope`,
      };
    },
  },
  {
    // 8. worker_low_confidence: tasks where self-check had confidence <= 2
    // v4: self_check is a section in record.json
    name: 'worker_low_confidence',
    threshold: 2,
    mandatoryResponse: 'Review task difficulty, consider splitting or providing additional context',
    compute(ctx) {
      let lowConfidence = 0;
      for (const t of ctx.taskFiles) {
        const tid = (t.task_id as string) || (t.id as string) || '';
        if (!tid || !ctx.missionDir) continue;
        // v4: self_check is in record.json
        const recordPath = path.join(ctx.missionDir, 'tasks', tid, 'record.json');
        try {
          const record = JSON.parse(fs.readFileSync(recordPath, 'utf-8')) as Record<string, unknown>;
          const sections = (record.sections as Record<string, unknown>) || record;
          const selfCheck = sections.self_check as Record<string, unknown> | undefined;
          if (selfCheck && typeof selfCheck.confidence === 'number' && selfCheck.confidence <= 2) {
            lowConfidence++;
          }
        } catch {
          // Skip tasks without record.json
        }
      }
      return {
        value: lowConfidence,
        detail: `${lowConfidence} self-checks with confidence <= 2`,
      };
    },
  },
];

export function registerHealthCommands(program: Command): void {
  const cmd = program
    .command('health')
    .description('Health check read/write');

  // --- generate ---
  cmd
    .command('generate')
    .description('Generate health-check.json from current state')
    .action((_opts: unknown, cmd: Command) => {
      try {
        const cwd = getCwd(cmd);
        const geasDir = resolveGeasDir(cwd);
        const ctx = buildContext(geasDir);

        const signals = SIGNAL_DEFS.map((def) => {
          const { value, detail } = def.compute(ctx);
          const triggered = value > def.threshold;
          const signal: Record<string, unknown> = {
            name: def.name,
            value,
            threshold: def.threshold,
            triggered,
            detail,
          };
          if (triggered) {
            signal.mandatory_response = def.mandatoryResponse;
          }
          return signal;
        });

        const anyTriggered = signals.some((s) => s.triggered);
        const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

        const healthCheck = {
          version: '1.0',
          artifact_type: 'health_check',
          artifact_id: `health-check-${timestamp.replace(/:/g, '-')}`,
          producer_type: 'orchestration_authority',
          signals,
          any_triggered: anyTriggered,
          trigger_context: 'manual',
          created_at: timestamp,
        };

        // Validate against health-check schema
        const result = validate('health-check', healthCheck);
        if (!result.valid) {
          validationError('health-check', result.errors || []);
          return;
        }

        const filePath = path.join(geasDir, 'state', 'health-check.json');
        writeJsonFile(filePath, healthCheck, { cwd });

        success({
          ok: true,
          any_triggered: anyTriggered,
          triggered_count: signals.filter((s) => s.triggered).length,
          path: filePath,
          signals,
        });
      } catch (err: unknown) {
        fileError('health-check.json', 'generate', (err as Error).message);
      }
    });

  // --- read ---
  cmd
    .command('read')
    .description('Read current health-check.json')
    .action((_opts: unknown, cmd: Command) => {
      try {
        const geasDir = resolveGeasDir(getCwd(cmd));
        const filePath = path.join(geasDir, 'state', 'health-check.json');
        const data = readJsonFile<Record<string, unknown>>(filePath);
        if (!data) {
          fileError(filePath, 'read', 'health-check.json not found. Run "geas health generate" first.');
          return;
        }
        success(data);
      } catch (err: unknown) {
        fileError('health-check.json', 'read', (err as Error).message);
      }
    });
}
