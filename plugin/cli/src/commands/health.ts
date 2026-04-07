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
  evidenceDir: string;
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
 * Read all task contract files from the current mission.
 */
function readTaskFiles(missionDir: string | null): Record<string, unknown>[] {
  if (!missionDir) return [];
  const tasksDir = path.join(missionDir, 'tasks');
  const files = listJsonFiles(tasksDir);
  const tasks: Record<string, unknown>[] = [];
  for (const f of files) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(tasksDir, f), 'utf-8'));
      tasks.push(content as Record<string, unknown>);
    } catch {
      // Skip malformed files
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
  const memoryIndex = readJsonFile<Record<string, unknown>>(
    path.join(geasDir, 'state', 'memory-index.json')
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
      path.join(missionDir, 'debt-register.json')
    );
  }

  const taskFiles = readTaskFiles(missionDir);
  const evidenceDir = missionDir ? path.join(missionDir, 'evidence') : '';

  return {
    geasDir,
    memoryIndex,
    runState,
    debtRegister,
    taskFiles,
    evidenceDir,
    missionDir,
  };
}

/**
 * The 8 health signals from protocol doc 12.
 */
const SIGNAL_DEFS: SignalDef[] = [
  {
    // 1. memory_bloat: ratio of non-active memory entries
    name: 'memory_bloat',
    threshold: 0.4,
    mandatoryResponse: 'Trigger memory review cycle to archive or decay stale entries',
    compute(ctx) {
      const entries = ((ctx.memoryIndex?.entries as unknown[]) || []) as Record<string, unknown>[];
      if (entries.length === 0) {
        return { value: 0, detail: 'No memory entries' };
      }
      const activeStates = new Set(['candidate', 'provisional', 'stable', 'canonical']);
      const nonActive = entries.filter((e) => !activeStates.has(e.state as string));
      const ratio = nonActive.length / entries.length;
      return {
        value: Math.round(ratio * 100) / 100,
        detail: `${nonActive.length}/${entries.length} entries in non-active states`,
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
        if (!tid) continue;
        const edir = path.join(ctx.evidenceDir, tid);
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
      // Scan evidence directories for gate-result files
      if (!ctx.evidenceDir) {
        return { value: 0, detail: 'No evidence directory' };
      }
      let total = 0;
      let issues = 0;
      try {
        const taskDirs = fs.readdirSync(ctx.evidenceDir);
        for (const td of taskDirs) {
          const dir = path.join(ctx.evidenceDir, td);
          const files = listJsonFiles(dir);
          for (const f of files) {
            if (!f.includes('gate-result')) continue;
            try {
              const gr = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as Record<string, unknown>;
              total++;
              if (gr.verdict === 'fail' || gr.verdict === 'block') {
                issues++;
              }
            } catch {
              // Skip malformed files
            }
          }
        }
      } catch {
        // Evidence dir doesn't exist
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
    name: 'contradiction_accumulation',
    threshold: 3,
    mandatoryResponse: 'Trigger memory review to resolve contradictions before proceeding',
    compute(ctx) {
      const entries = ((ctx.memoryIndex?.entries as unknown[]) || []) as Record<string, unknown>[];
      // Count from memory entry files for detailed signals
      let totalContradictions = 0;
      const entriesDir = path.join(ctx.geasDir, 'memory', 'entries');
      const files = listJsonFiles(entriesDir);
      for (const f of files) {
        try {
          const entry = JSON.parse(fs.readFileSync(path.join(entriesDir, f), 'utf-8')) as Record<string, unknown>;
          const signals = entry.signals as Record<string, unknown> | undefined;
          if (signals) {
            totalContradictions += (signals.contradiction_count as number) || 0;
          }
        } catch {
          // Skip malformed files
        }
      }
      return {
        value: totalContradictions,
        detail: `${totalContradictions} total contradictions across ${files.length} entries`,
      };
    },
  },
  {
    // 5. repeated_failure_class: count of tasks that failed gate 2+ times
    name: 'repeated_failure_class',
    threshold: 2,
    mandatoryResponse: 'Investigate root cause of repeated failures and consider process change',
    compute(ctx) {
      let repeatedFailures = 0;
      for (const t of ctx.taskFiles) {
        const tid = (t.task_id as string) || (t.id as string) || '';
        if (!tid) continue;
        const edir = path.join(ctx.evidenceDir, tid);
        const files = listJsonFiles(edir);
        let failCount = 0;
        for (const f of files) {
          if (!f.includes('gate-result')) continue;
          try {
            const gr = JSON.parse(fs.readFileSync(path.join(edir, f), 'utf-8')) as Record<string, unknown>;
            if (gr.verdict === 'fail') failCount++;
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
    mandatoryResponse: 'Review task scope definitions and tighten scope.paths constraints',
    compute(ctx) {
      // Count tasks where scope.surfaces or scope.paths is empty
      let weakScope = 0;
      for (const t of ctx.taskFiles) {
        const scope = t.scope as Record<string, unknown> | undefined;
        if (!scope) {
          weakScope++;
          continue;
        }
        const paths = (scope.paths as string[]) || (scope.surfaces as string[]) || [];
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
    name: 'worker_low_confidence',
    threshold: 2,
    mandatoryResponse: 'Review task difficulty, consider splitting or providing additional context',
    compute(ctx) {
      let lowConfidence = 0;
      for (const t of ctx.taskFiles) {
        const tid = (t.task_id as string) || (t.id as string) || '';
        if (!tid) continue;
        const edir = path.join(ctx.evidenceDir, tid);
        const files = listJsonFiles(edir);
        for (const f of files) {
          if (!f.includes('self-check')) continue;
          try {
            const sc = JSON.parse(fs.readFileSync(path.join(edir, f), 'utf-8')) as Record<string, unknown>;
            if (typeof sc.confidence === 'number' && sc.confidence <= 2) {
              lowConfidence++;
            }
          } catch {
            // Skip
          }
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
    .action(() => {
      try {
        const geasDir = resolveGeasDir();
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
        writeJsonFile(filePath, healthCheck);

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
    .action(() => {
      try {
        const geasDir = resolveGeasDir();
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
