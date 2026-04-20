/**
 * `geas gate` — Evidence Gate run recording.
 *
 *   geas gate run --mission <id> --task <id>   (stdin: tier_results body)
 *
 * Writes to `.geas/missions/{mission_id}/tasks/{task_id}/gate-results.json`.
 * The file holds `{ mission_id, task_id, runs, created_at, updated_at }`
 * with each run as `{ gate_run_id, verdict, tier_results, created_at }`.
 *
 * The CLI:
 *   - auto-assigns `gate_run_id` (`gate-1`, `gate-2`, …) based on run count.
 *   - computes overall `verdict` from tier statuses per protocol 03 §166:
 *       if any tier_0/tier_1/tier_2 status is fail/block/error, that is the
 *       overall verdict; else pass.
 *   - validates the merged file against `gate-results` schema.
 *
 * Caller must supply tier_results with statuses + details. The suggested
 * next transition is emitted in the response envelope (CLI.md §14.5) but
 * not persisted — orchestrator calls `geas task transition` separately.
 */

import type { Command } from 'commander';
import * as path from 'path';

import { emit, err, ok, recordEvent } from '../lib/envelope';
import {
  atomicWriteJson,
  ensureDir,
  readJsonFile,
} from '../lib/fs-atomic';
import {
  findProjectRoot,
  gateResultsPath,
  isValidMissionId,
  isValidTaskId,
  missionSpecPath,
  taskContractPath,
  tmpDir,
} from '../lib/paths';
import { readStdinJson, StdinError } from '../lib/input';
import { validate } from '../lib/schema';
import { exists } from '../lib/fs-atomic';

function nowUtc(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function slashPath(p: string): string {
  return p.replace(/\\/g, '/');
}

function needProjectRoot(): string {
  const root = findProjectRoot(process.cwd());
  if (!root) {
    emit(
      err(
        'missing_artifact',
        `.geas/ not found at ${process.cwd().replace(/\\/g, '/')}. Run 'geas setup' first.`,
      ),
    );
  }
  return root as string;
}

interface GateResultsFile {
  mission_id: string;
  task_id: string;
  runs: Array<Record<string, unknown>>;
  created_at: string;
  updated_at: string;
}

/**
 * Compute the overall gate verdict from tier statuses.
 * Per protocol 03 §166: sequential Tier 0 → 1 → 2; any non-pass status
 * becomes the overall verdict.
 */
function overallFromTiers(
  tier0: string,
  tier1: string,
  tier2: string,
): 'pass' | 'fail' | 'block' | 'error' {
  for (const s of [tier0, tier1, tier2]) {
    if (s === 'error') return 'error';
    if (s === 'block') return 'block';
    if (s === 'fail') return 'fail';
  }
  // skipped is treated as non-blocking (tier narrowed away for this profile).
  // Any mix of pass/skipped => pass.
  return 'pass';
}

function registerGateRun(cmd: Command): void {
  cmd
    .command('run')
    .description(
      'Record an evidence gate run. stdin: tier_results body. Auto-assigns gate_run_id and derives overall verdict.',
    )
    .requiredOption('--mission <id>', 'Mission ID')
    .requiredOption('--task <id>', 'Task ID')
    .action((opts: { mission: string; task: string }) => {
      if (!isValidMissionId(opts.mission)) {
        emit(err('invalid_argument', `invalid mission id '${opts.mission}'`));
      }
      if (!isValidTaskId(opts.task)) {
        emit(err('invalid_argument', `invalid task id '${opts.task}'`));
      }
      const root = needProjectRoot();
      if (!exists(missionSpecPath(root, opts.mission))) {
        emit(
          err(
            'missing_artifact',
            `mission spec not found for ${opts.mission}`,
          ),
        );
      }
      if (!exists(taskContractPath(root, opts.mission, opts.task))) {
        emit(
          err('missing_artifact', `task contract not found for ${opts.task}`),
        );
      }

      let payload: Record<string, unknown>;
      try {
        payload = readStdinJson() as Record<string, unknown>;
      } catch (e) {
        if (e instanceof StdinError) emit(err('invalid_argument', e.message));
        throw e;
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        emit(
          err(
            'invalid_argument',
            'gate run expects a JSON object on stdin',
          ),
        );
      }

      const tierResults =
        (payload.tier_results as Record<string, { status?: string; details?: string }> | undefined) ??
        undefined;
      if (!tierResults) {
        emit(
          err(
            'invalid_argument',
            'gate run payload must contain `tier_results` with tier_0, tier_1, tier_2',
          ),
        );
      }
      const t0 = tierResults!.tier_0?.status;
      const t1 = tierResults!.tier_1?.status;
      const t2 = tierResults!.tier_2?.status;
      if (!t0 || !t1 || !t2) {
        emit(
          err(
            'invalid_argument',
            'tier_results must include tier_0, tier_1, tier_2 each with a status',
          ),
        );
      }

      const overall = overallFromTiers(t0 as string, t1 as string, t2 as string);

      const filePath = gateResultsPath(root, opts.mission, opts.task);
      const existing = readJsonFile<GateResultsFile>(filePath);
      const nextRunN =
        existing && Array.isArray(existing.runs) ? existing.runs.length + 1 : 1;
      const gateRunId = `gate-${nextRunN}`;
      const ts = nowUtc();

      const run = {
        gate_run_id: gateRunId,
        verdict: overall,
        tier_results: tierResults,
        created_at: ts,
      };

      const merged: GateResultsFile = {
        mission_id: opts.mission,
        task_id: opts.task,
        runs: existing && Array.isArray(existing.runs)
          ? [...existing.runs, run]
          : [run],
        created_at: existing?.created_at ?? ts,
        updated_at: ts,
      };

      const v = validate('gate-results', merged);
      if (!v.ok) {
        emit(
          err(
            'schema_validation_failed',
            'gate-results schema validation failed',
            v.errors,
          ),
        );
      }

      ensureDir(path.dirname(filePath));
      atomicWriteJson(filePath, merged, tmpDir(root));

      recordEvent(root, {
        kind: 'gate_run_recorded',
        actor: 'cli:auto',
        payload: {
          mission_id: opts.mission,
          task_id: opts.task,
          artifact: slashPath(path.relative(root, filePath)),
          gate_run_id: gateRunId,
          verdict: overall,
        },
      });

      // Suggested next transition per CLI.md §14.5.
      let suggested: { verdict: string; target_state: string | null; command: string | null } = {
        verdict: overall,
        target_state: null,
        command: null,
      };
      if (overall === 'pass') {
        suggested.target_state = 'verified';
        suggested.command = `geas task transition --mission ${opts.mission} --task ${opts.task} --to verified`;
      } else if (overall === 'block') {
        suggested.target_state = 'blocked';
        suggested.command = `geas task transition --mission ${opts.mission} --task ${opts.task} --to blocked`;
      }

      emit(
        ok({
          path: slashPath(filePath),
          ids: {
            mission_id: opts.mission,
            task_id: opts.task,
            gate_run_id: gateRunId,
          },
          verdict: overall,
          suggested_next_transition: suggested,
          runs_count: merged.runs.length,
        }),
      );
    });
}

export function registerGateCommands(program: Command): void {
  const g = program
    .command('gate')
    .description('Evidence gate run recording (gate-results.json).');
  registerGateRun(g);
}
