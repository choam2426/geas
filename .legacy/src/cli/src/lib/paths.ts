/**
 * Centralized `.geas/` path builders.
 *
 * All on-disk paths used by the CLI are computed here. Paths match the
 * registry in `docs/ko/protocol/08` (Runtime Artifacts and Schemas) and
 * the `.geas/` tree described in `docs/ko/architecture/CLI.md`.
 *
 * Layout (relative to the project root that contains `.geas/`):
 *
 *   .geas/
 *     config.json
 *     debts.json
 *     events.jsonl
 *     memory/
 *       shared.md
 *       agents/
 *         {agent}.md
 *     missions/
 *       {mission_id}/
 *         spec.json
 *         mission-design.md
 *         mission-state.json
 *         phase-reviews.json
 *         mission-verdicts.json
 *         deliberations.json
 *         consolidation/
 *           candidates.json
 *           gap.json
 *           memory-update.json
 *         tasks/
 *           {task_id}/
 *             contract.json
 *             task-state.json
 *             implementation-contract.json
 *             self-check.json
 *             deliberations.json
 *             gate-results.json
 *             evidence/
 *               {agent}.{slot}.json
 *     tmp/
 *       (used by fs-atomic)
 *
 * This module only assembles paths; it does NOT enforce existence.
 */

import * as path from 'path';
import * as fs from 'fs';

/**
 * Normalize a path to absolute + forward-slash form.
 * Used by callers that format paths for JSON output or logs.
 */
export function normalizePath(p: string): string {
  return path.resolve(p).replace(/\\/g, '/');
}

/**
 * Resolve `.geas/` from a project root. The root must be the directory
 * that contains `.geas/`. This module does NOT walk parents; callers
 * decide where the project root is (typically process.cwd()).
 *
 * @param projectRoot - Absolute path to the directory that contains `.geas/`.
 * @returns Absolute path to `.geas/` (not verified to exist).
 */
export function geasDir(projectRoot: string): string {
  return path.join(projectRoot, '.geas');
}

/**
 * Resolve the project root by looking for `.geas/` at the given cwd.
 * Does NOT walk parents. Returns null if `.geas/` is not present.
 */
export function findProjectRoot(cwd: string): string | null {
  const candidate = path.join(cwd, '.geas');
  return fs.existsSync(candidate) ? cwd : null;
}

// ── Top-level project artifacts ────────────────────────────────────────

export function configPath(projectRoot: string): string {
  return path.join(geasDir(projectRoot), 'config.json');
}

export function debtsPath(projectRoot: string): string {
  return path.join(geasDir(projectRoot), 'debts.json');
}

export function eventsPath(projectRoot: string): string {
  return path.join(geasDir(projectRoot), 'events.jsonl');
}

export function tmpDir(projectRoot: string): string {
  return path.join(geasDir(projectRoot), 'tmp');
}

// ── Memory ──────────────────────────────────────────────────────────────

export function memoryDir(projectRoot: string): string {
  return path.join(geasDir(projectRoot), 'memory');
}

export function sharedMemoryPath(projectRoot: string): string {
  return path.join(memoryDir(projectRoot), 'shared.md');
}

export function agentsMemoryDir(projectRoot: string): string {
  return path.join(memoryDir(projectRoot), 'agents');
}

export function agentMemoryPath(projectRoot: string, agent: string): string {
  return path.join(agentsMemoryDir(projectRoot), `${agent}.md`);
}

// ── Missions ────────────────────────────────────────────────────────────

export function missionsDir(projectRoot: string): string {
  return path.join(geasDir(projectRoot), 'missions');
}

export function missionDir(projectRoot: string, missionId: string): string {
  return path.join(missionsDir(projectRoot), missionId);
}

export function missionSpecPath(projectRoot: string, missionId: string): string {
  return path.join(missionDir(projectRoot, missionId), 'spec.json');
}

export function missionDesignPath(projectRoot: string, missionId: string): string {
  return path.join(missionDir(projectRoot, missionId), 'mission-design.md');
}

export function missionStatePath(projectRoot: string, missionId: string): string {
  return path.join(missionDir(projectRoot, missionId), 'mission-state.json');
}

export function phaseReviewsPath(projectRoot: string, missionId: string): string {
  return path.join(missionDir(projectRoot, missionId), 'phase-reviews.json');
}

export function missionVerdictsPath(projectRoot: string, missionId: string): string {
  return path.join(missionDir(projectRoot, missionId), 'mission-verdicts.json');
}

export function missionDeliberationsPath(
  projectRoot: string,
  missionId: string,
): string {
  return path.join(missionDir(projectRoot, missionId), 'deliberations.json');
}

export function consolidationDir(projectRoot: string, missionId: string): string {
  return path.join(missionDir(projectRoot, missionId), 'consolidation');
}

export function missionCandidatesPath(
  projectRoot: string,
  missionId: string,
): string {
  return path.join(consolidationDir(projectRoot, missionId), 'candidates.json');
}

export function gapPath(projectRoot: string, missionId: string): string {
  return path.join(consolidationDir(projectRoot, missionId), 'gap.json');
}

export function memoryUpdatePath(projectRoot: string, missionId: string): string {
  return path.join(consolidationDir(projectRoot, missionId), 'memory-update.json');
}

// ── Tasks ───────────────────────────────────────────────────────────────

export function tasksDir(projectRoot: string, missionId: string): string {
  return path.join(missionDir(projectRoot, missionId), 'tasks');
}

export function taskDir(
  projectRoot: string,
  missionId: string,
  taskId: string,
): string {
  return path.join(tasksDir(projectRoot, missionId), taskId);
}

export function taskContractPath(
  projectRoot: string,
  missionId: string,
  taskId: string,
): string {
  return path.join(taskDir(projectRoot, missionId, taskId), 'contract.json');
}

export function taskStatePath(
  projectRoot: string,
  missionId: string,
  taskId: string,
): string {
  return path.join(taskDir(projectRoot, missionId, taskId), 'task-state.json');
}

export function implementationContractPath(
  projectRoot: string,
  missionId: string,
  taskId: string,
): string {
  return path.join(
    taskDir(projectRoot, missionId, taskId),
    'implementation-contract.json',
  );
}

export function selfCheckPath(
  projectRoot: string,
  missionId: string,
  taskId: string,
): string {
  return path.join(taskDir(projectRoot, missionId, taskId), 'self-check.json');
}

export function taskDeliberationsPath(
  projectRoot: string,
  missionId: string,
  taskId: string,
): string {
  return path.join(taskDir(projectRoot, missionId, taskId), 'deliberations.json');
}

export function gateResultsPath(
  projectRoot: string,
  missionId: string,
  taskId: string,
): string {
  return path.join(taskDir(projectRoot, missionId, taskId), 'gate-results.json');
}

export function evidenceDir(
  projectRoot: string,
  missionId: string,
  taskId: string,
): string {
  return path.join(taskDir(projectRoot, missionId, taskId), 'evidence');
}

export function evidenceFilePath(
  projectRoot: string,
  missionId: string,
  taskId: string,
  agent: string,
  slot: string,
): string {
  return path.join(evidenceDir(projectRoot, missionId, taskId), `${agent}.${slot}.json`);
}

// ── Identifier validation ──────────────────────────────────────────────

export const MISSION_ID_RE = /^mission-[0-9]{8}-[a-zA-Z0-9]{8}$/;
export const TASK_ID_RE = /^task-[0-9]{3}$/;
/** Agent and slot names used in filenames: kebab/alphanumeric. */
export const AGENT_SLOT_RE = /^[a-z0-9][a-z0-9-]*$/;

export function isValidMissionId(id: string): boolean {
  return MISSION_ID_RE.test(id);
}

export function isValidTaskId(id: string): boolean {
  return TASK_ID_RE.test(id);
}

export function isValidAgentOrSlot(id: string): boolean {
  return AGENT_SLOT_RE.test(id);
}

/**
 * Assert a resolved path stays inside a base directory. Rejects path
 * traversal even if the input is crafted to include `..` segments.
 */
export function assertContainedIn(resolvedPath: string, baseDir: string): void {
  const base = path.resolve(baseDir) + path.sep;
  const full = path.resolve(resolvedPath);
  if (!full.startsWith(base) && full !== path.resolve(baseDir)) {
    const err = new Error(
      `Path "${resolvedPath}" escapes base directory "${baseDir}"`,
    );
    (err as NodeJS.ErrnoException).code = 'path_traversal';
    throw err;
  }
}
