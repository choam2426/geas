/**
 * Phase transition guards — validates gate criteria before allowing
 * a mission to advance from one phase to the next.
 *
 * v4: 4 guards. Guards check:
 *   - Task contract.json status (tasks/{tid}/contract.json)
 *   - Debt register existence
 *   - Evolution artifacts
 */

import * as fs from 'fs';
import * as path from 'path';
import { readJsonFile } from './fs-atomic';

export interface PhaseGuardPass {
  valid: true;
}

export interface PhaseGuardFail {
  valid: false;
  unmet_criteria: string[];
}

export type PhaseGuardResult = PhaseGuardPass | PhaseGuardFail;

/**
 * Validate whether a mission can transition from currentPhase to nextPhase.
 */
export function validatePhaseTransition(
  geasDir: string,
  missionId: string,
  currentPhase: string,
  nextPhase: string
): PhaseGuardResult {
  const key = `${currentPhase} -> ${nextPhase}`;
  const guard = transitionGuards[key];

  if (!guard) {
    return { valid: true };
  }

  const missionDir = path.resolve(geasDir, 'missions', missionId);
  const unmet = guard(missionDir);

  if (unmet.length === 0) {
    return { valid: true };
  }
  return { valid: false, unmet_criteria: unmet };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * List all task directories and read their contract.json.
 * v4: tasks are directories with contract.json inside.
 */
function readAllTasks(
  missionDir: string,
): Array<{ file: string; task: Record<string, unknown> }> {
  const tasksDir = path.resolve(missionDir, 'tasks');
  if (!fs.existsSync(tasksDir)) return [];

  const result: Array<{ file: string; task: Record<string, unknown> }> = [];
  try {
    const entries = fs.readdirSync(tasksDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const contractPath = path.resolve(tasksDir, entry.name, 'contract.json');
      const task = readJsonFile<Record<string, unknown>>(contractPath);
      if (task) {
        result.push({ file: entry.name, task });
      }
    }
  } catch {
    // read failed
  }
  return result;
}

// ---------------------------------------------------------------------------
// Per-transition gate functions
// ---------------------------------------------------------------------------

type GuardFn = (missionDir: string) => string[];

/**
 * specifying -> building: spec.json + design-brief approved + ≥1 task.
 */
function guardSpecifyingToBuilding(missionDir: string): string[] {
  const unmet: string[] = [];

  const specPath = path.resolve(missionDir, 'spec.json');
  if (!fs.existsSync(specPath)) {
    unmet.push('spec.json does not exist');
  }

  const briefPath = path.resolve(missionDir, 'design-brief.json');
  const brief = readJsonFile<Record<string, unknown>>(briefPath);
  if (!brief) {
    unmet.push('design-brief.json does not exist');
  } else if (brief.status !== 'approved') {
    unmet.push(
      `design-brief.json status is "${brief.status}", expected "approved"`
    );
  }

  const tasksDir = path.resolve(missionDir, 'tasks');
  if (!fs.existsSync(tasksDir)) {
    unmet.push('tasks/ directory does not exist (need at least 1 task)');
  } else {
    try {
      const entries = fs.readdirSync(tasksDir, { withFileTypes: true });
      const taskDirs = entries.filter(e => e.isDirectory());
      if (taskDirs.length === 0) {
        unmet.push('No task directories found in tasks/ (need at least 1)');
      }
    } catch {
      unmet.push('Cannot read tasks/ directory');
    }
  }

  return unmet;
}

/**
 * building -> polishing: All tasks must be "passed" or "cancelled".
 */
function guardBuildingToPolishing(missionDir: string): string[] {
  const unmet: string[] = [];

  const tasks = readAllTasks(missionDir);
  for (const { file, task } of tasks) {
    const status = task.status as string | undefined;
    if (status !== 'passed' && status !== 'cancelled') {
      unmet.push(
        `Task ${file} has status "${status ?? 'unknown'}", expected "passed" or "cancelled"`
      );
    }
  }

  // Gap assessment for building must exist
  const gapPath = path.resolve(missionDir, 'evolution', 'gap-assessment-building.json');
  if (!fs.existsSync(gapPath)) {
    unmet.push('evolution/gap-assessment-building.json does not exist');
  }

  return unmet;
}

/**
 * polishing -> evolving: gap-assessment + debt-register + no blocked/escalated.
 */
function guardPolishingToEvolving(missionDir: string): string[] {
  const unmet: string[] = [];

  // Gap assessment required
  const gapPath = path.resolve(missionDir, 'evolution', 'gap-assessment-polishing.json');
  if (!fs.existsSync(gapPath)) {
    unmet.push('evolution/gap-assessment-polishing.json does not exist');
  }

  // Debt register required (even if empty)
  const debtPath = path.resolve(missionDir, 'evolution', 'debt-register.json');
  if (!fs.existsSync(debtPath)) {
    unmet.push('evolution/debt-register.json does not exist');
  }

  // No blocked/escalated tasks
  const tasks = readAllTasks(missionDir);
  for (const { file, task } of tasks) {
    const status = task.status as string | undefined;
    if (status === 'blocked' || status === 'escalated') {
      unmet.push(`Task ${file} has status "${status}"`);
    }
  }

  return unmet;
}

/**
 * evolving -> complete: gap-assessment AND mission-summary required.
 */
function guardEvolvingToComplete(missionDir: string): string[] {
  const unmet: string[] = [];

  const gapPath = path.resolve(missionDir, 'evolution', 'gap-assessment-evolving.json');
  if (!fs.existsSync(gapPath)) {
    unmet.push('evolution/gap-assessment-evolving.json does not exist');
  }

  const summaryPath = path.resolve(missionDir, 'mission-summary.md');
  if (!fs.existsSync(summaryPath)) {
    unmet.push('mission-summary.md does not exist');
  }

  return unmet;
}

// ---------------------------------------------------------------------------
// Transition guard registry
// ---------------------------------------------------------------------------

const transitionGuards: Record<string, GuardFn> = {
  'specifying -> building': guardSpecifyingToBuilding,
  'building -> polishing': guardBuildingToPolishing,
  'polishing -> evolving': guardPolishingToEvolving,
  'evolving -> complete': guardEvolvingToComplete,
};
