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
import { emit, err, ok } from '../lib/envelope';

interface MissionSummary {
  mission_id: string;
  phase: string | null;
  active_tasks: string[];
}

export function registerContextCommand(program: Command): void {
  program
    .command('context')
    .description('Print a JSON summary of the current .geas/ state')
    .action(() => {
      const root = findProjectRoot(process.cwd());
      if (!root) {
        emit(
          err(
            'missing_artifact',
            `.geas/ not found at ${process.cwd().replace(/\\/g, '/')}. Run 'geas setup' first.`,
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

      emit(
        ok({
          project_root: projectRoot.replace(/\\/g, '/'),
          geas_dir: geasDir(projectRoot).replace(/\\/g, '/'),
          missions,
        }),
      );
    });
}
