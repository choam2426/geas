/**
 * `geas context` — read-only summary of the current project state.
 *
 * Reports:
 *   project_root, geas_dir
 *   missions[] — for each mission directory under `.geas/missions/`:
 *     mission_id, phase, active_tasks (from mission-state.json when present)
 *
 * G1 ships a minimal view. G2 extends this with active mission selection
 * and phase detail.
 *
 * T2.a (mission-20260427-xIPG1sDY task-002): migrated off the legacy
 * envelope.emit/err/ok bridge to call output.emitOk / output.emitErr +
 * errors.makeError directly. Per AC2 the missing_artifact error rotates
 * exit code 1 → 4 (EXIT_CATEGORY_CODE.missing_artifact). Per AC1 + impl
 * contract Q5 (AC3 deferred — out-of-surface dependencies on
 * lib/output.ts and main-flags.test.js), no ScalarFormatter is
 * registered yet — emitOk falls through to the JSON envelope so
 * default-mode stdout stays byte-stable from T1.
 */

import type { Command } from 'commander';
import * as fs from 'fs';
import {
  findProjectRoot,
  geasDir,
  missionsDir,
  missionStatePath,
} from '../lib/paths';
import { readJsonFile } from '../lib/fs-atomic';
import { emitErr, emitOk, registerFormatter } from '../lib/output';
import { makeError } from '../lib/errors';

interface MissionSummary {
  mission_id: string;
  phase: string | null;
  active_tasks: string[];
}

const COMMAND_NAME = 'context';

/**
 * AC3 (mission-20260427-xIPG1sDY task-006): scalar formatter producing
 * a short human-readable summary on default-mode stdout. The data shape
 * mirrors the emitOk payload below (project_root, geas_dir, missions[]).
 * Token target: ≤200 tokens (1 header line + N mission summary lines).
 */
function formatContext(data: unknown): string {
  const d = data as {
    project_root?: string;
    geas_dir?: string;
    missions?: MissionSummary[];
  };
  const lines: string[] = [];
  lines.push(`project_root: ${d.project_root ?? '<unknown>'}`);
  lines.push(`geas_dir: ${d.geas_dir ?? '<unknown>'}`);
  const missions = Array.isArray(d.missions) ? d.missions : [];
  if (missions.length === 0) {
    lines.push('missions: (none)');
  } else {
    lines.push(`missions: ${missions.length}`);
    for (const m of missions) {
      const active = (m.active_tasks ?? []).join(', ') || '(none)';
      lines.push(`  - ${m.mission_id} phase=${m.phase ?? 'unknown'} active=[${active}]`);
    }
  }
  return lines.join('\n');
}

export function registerContextCommand(program: Command): void {
  registerFormatter(COMMAND_NAME, formatContext);
  program
    .command(COMMAND_NAME)
    .description('Print a summary of the current .geas/ state (scalar text by default; --json for envelope)')
    .action(() => {
      const root = findProjectRoot(process.cwd());
      if (!root) {
        emitErr(
          makeError(
            'missing_artifact',
            `.geas/ not found at ${process.cwd().replace(/\\/g, '/')}.`,
            {
              hint: "run 'geas setup' to bootstrap the .geas/ tree",
              exit_category: 'missing_artifact',
            },
          ),
        );
      }
      const projectRoot = root as string;

      const missions: MissionSummary[] = [];
      const mDir = missionsDir(projectRoot);
      if (fs.existsSync(mDir)) {
        for (const entry of fs.readdirSync(mDir)) {
          const full = `${mDir}/${entry}`;
          if (!fs.statSync(full).isDirectory()) continue;
          const statePath = missionStatePath(projectRoot, entry);
          const state = readJsonFile<Record<string, unknown>>(statePath);
          missions.push({
            mission_id: entry,
            phase: typeof state?.phase === 'string' ? (state.phase as string) : null,
            active_tasks: Array.isArray(state?.active_tasks)
              ? (state!.active_tasks as string[])
              : [],
          });
        }
      }

      emitOk(COMMAND_NAME, {
        project_root: projectRoot.replace(/\\/g, '/'),
        geas_dir: geasDir(projectRoot).replace(/\\/g, '/'),
        missions,
      });
    });
}
