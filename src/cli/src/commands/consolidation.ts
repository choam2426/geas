/**
 * `geas consolidation` — consolidation-phase scaffolding commands.
 *
 *   geas consolidation scaffold --mission <id>
 *
 * Walks every task under `missions/{mission_id}/tasks/*` and harvests
 * `debt_candidate[]`, `memory_suggestion[]`, and `gap_signal[]` fields
 * from each evidence entry into a single convenience cache at
 * `.geas/missions/{mission_id}/consolidation/candidates.json`.
 *
 * Per CLI.md §14.4 + §609 + §625, the candidates file is NOT a protocol
 * artifact — it is a convenience cache that the consolidating-phase
 * orchestrator reads to construct debt register / memory-update / gap
 * writes. It is not schema-validated and re-runs fully overwrite it.
 *
 * Phase guard: scaffolding prepares for the consolidating phase, so the
 * mission must be in `polishing` (preparing) or `consolidating` (running)
 * to accept the command. Tasks whose `evidence/` directory is absent are
 * skipped silently — not every task produces harvestable candidates.
 */

import type { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

import { emit, err, ok, recordEvent } from '../lib/envelope';
import { atomicWriteJson, ensureDir, exists, readJsonFile } from '../lib/fs-atomic';
import {
  evidenceDir,
  findProjectRoot,
  isValidMissionId,
  missionCandidatesPath,
  missionSpecPath,
  missionStatePath,
  tasksDir,
  tmpDir,
} from '../lib/paths';

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

/** Phases in which scaffold is meaningful. */
const SCAFFOLD_PHASES = new Set(['polishing', 'consolidating']);

interface HarvestedItem {
  source_task_id: string;
  source_evidence_entry_id: number;
  [k: string]: unknown;
}

interface CandidatesFile {
  mission_id: string;
  debt_candidates: HarvestedItem[];
  memory_suggestions: HarvestedItem[];
  gap_signals: HarvestedItem[];
  created_at: string;
  updated_at: string;
}

/**
 * Scan a single evidence file and append its harvestable fields to the
 * candidate buckets. Each harvested item carries its source task id and
 * source evidence entry id so orchestrators can trace back to the origin.
 *
 * Tolerates malformed files silently — scaffold is a best-effort cache,
 * not a validation gate. Malformed entries don't block consolidation.
 */
function harvestFile(
  filePath: string,
  taskId: string,
  buckets: {
    debt_candidates: HarvestedItem[];
    memory_suggestions: HarvestedItem[];
    gap_signals: HarvestedItem[];
  },
): void {
  const body = readJsonFile<{ entries?: unknown }>(filePath);
  if (!body || !Array.isArray(body.entries)) return;
  for (const rawEntry of body.entries) {
    if (!rawEntry || typeof rawEntry !== 'object') continue;
    const entry = rawEntry as Record<string, unknown>;
    const entryId =
      typeof entry.entry_id === 'number' ? entry.entry_id : undefined;
    if (entryId === undefined) continue;

    // debt_candidates[] — array of objects per evidence schema.
    const dc = entry.debt_candidates;
    if (Array.isArray(dc)) {
      for (const item of dc) {
        if (!item || typeof item !== 'object') continue;
        buckets.debt_candidates.push({
          source_task_id: taskId,
          source_evidence_entry_id: entryId,
          ...(item as Record<string, unknown>),
        });
      }
    }

    // memory_suggestions[] — array of strings per evidence schema.
    const ms = entry.memory_suggestions;
    if (Array.isArray(ms)) {
      for (const item of ms) {
        if (typeof item !== 'string') continue;
        buckets.memory_suggestions.push({
          source_task_id: taskId,
          source_evidence_entry_id: entryId,
          suggestion: item,
        });
      }
    }

    // gap_signals[] — array of objects per evidence schema.
    const gs = entry.gap_signals;
    if (Array.isArray(gs)) {
      for (const item of gs) {
        if (!item || typeof item !== 'object') continue;
        buckets.gap_signals.push({
          source_task_id: taskId,
          source_evidence_entry_id: entryId,
          ...(item as Record<string, unknown>),
        });
      }
    }
  }
}

function registerScaffold(root: Command): void {
  root
    .command('scaffold')
    .description(
      'Harvest debt_candidate / memory_suggestion / gap_signals fields from every task evidence file under a mission into consolidation/candidates.json (convenience cache, not a protocol artifact).',
    )
    .requiredOption('--mission <id>', 'Mission ID')
    .action((opts: { mission: string }) => {
      if (!isValidMissionId(opts.mission)) {
        emit(err('invalid_argument', `invalid mission id '${opts.mission}'`));
      }
      const projectRoot = needProjectRoot();

      if (!exists(missionSpecPath(projectRoot, opts.mission))) {
        emit(
          err(
            'missing_artifact',
            `mission spec not found for ${opts.mission}`,
          ),
        );
      }
      const state = readJsonFile<{ phase?: string }>(
        missionStatePath(projectRoot, opts.mission),
      );
      if (!state) {
        emit(
          err(
            'missing_artifact',
            `mission-state.json not found for ${opts.mission}`,
          ),
        );
      }
      const phase = (state as { phase?: string }).phase ?? '';
      if (!SCAFFOLD_PHASES.has(phase)) {
        emit(
          err(
            'guard_failed',
            `consolidation scaffold requires mission phase polishing or consolidating (current: ${phase || 'unknown'})`,
            { phase, allowed: [...SCAFFOLD_PHASES] },
          ),
        );
      }

      const buckets = {
        debt_candidates: [] as HarvestedItem[],
        memory_suggestions: [] as HarvestedItem[],
        gap_signals: [] as HarvestedItem[],
      };

      // Walk each task directory. Missing evidence dir is fine — skip.
      const tDir = tasksDir(projectRoot, opts.mission);
      if (exists(tDir)) {
        for (const taskDirName of fs.readdirSync(tDir)) {
          if (!/^task-[0-9]{3}$/.test(taskDirName)) continue;
          const evDir = evidenceDir(projectRoot, opts.mission, taskDirName);
          if (!exists(evDir)) continue;
          for (const file of fs.readdirSync(evDir)) {
            if (!file.endsWith('.json')) continue;
            const filePath = path.join(evDir, file);
            harvestFile(filePath, taskDirName, buckets);
          }
        }
      }

      const target = missionCandidatesPath(projectRoot, opts.mission);
      const existing = readJsonFile<{ created_at?: string }>(target);
      const ts = nowUtc();

      const payload: CandidatesFile = {
        mission_id: opts.mission,
        debt_candidates: buckets.debt_candidates,
        memory_suggestions: buckets.memory_suggestions,
        gap_signals: buckets.gap_signals,
        created_at: existing?.created_at ?? ts,
        updated_at: ts,
      };

      ensureDir(path.dirname(target));
      atomicWriteJson(target, payload, tmpDir(projectRoot));

      recordEvent(projectRoot, {
        kind: 'consolidation_scaffolded',
        actor: 'cli:auto',
        payload: {
          mission_id: opts.mission,
          artifact: slashPath(path.relative(projectRoot, target)),
          counts: {
            debt_candidates: buckets.debt_candidates.length,
            memory_suggestions: buckets.memory_suggestions.length,
            gap_signals: buckets.gap_signals.length,
          },
        },
      });

      emit(
        ok({
          path: slashPath(target),
          ids: { mission_id: opts.mission },
          counts: {
            debt_candidates: buckets.debt_candidates.length,
            memory_suggestions: buckets.memory_suggestions.length,
            gap_signals: buckets.gap_signals.length,
          },
          candidates: payload,
        }),
      );
    });
}

export function registerConsolidationCommands(program: Command): void {
  const root = program
    .command('consolidation')
    .description(
      'Consolidation-phase scaffolding (convenience cache for consolidating phase).',
    );
  registerScaffold(root);
}
