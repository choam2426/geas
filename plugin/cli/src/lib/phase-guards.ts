/**
 * Phase transition guards — validates gate criteria before allowing
 * a mission to advance from one phase to the next.
 *
 * v4: Simplified to 3 guards (was 4). Guards check:
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

  return unmet;
}

/**
 * polishing -> evolving: Security review or debt record must exist.
 */
function guardPolishingToEvolving(missionDir: string): string[] {
  const unmet: string[] = [];

  const debtPath = path.resolve(missionDir, 'evolution', 'debt-register.json');
  const phaseReviewDir = path.resolve(missionDir, 'phase-reviews');

  const hasDebt = fs.existsSync(debtPath);
  let hasSecurityReview = false;

  if (fs.existsSync(phaseReviewDir)) {
    try {
      const files = fs.readdirSync(phaseReviewDir);
      hasSecurityReview = files.some(
        (f) => f.startsWith('polishing_') && f.endsWith('.json'),
      );
    } catch {
      // read failed
    }
  }

  if (!hasDebt && !hasSecurityReview) {
    unmet.push(
      'Neither debt-register.json nor polishing phase-review exists'
    );
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
 * evolving -> complete: Gap assessment or mission summary must exist.
 */
function guardEvolvingToComplete(missionDir: string): string[] {
  const unmet: string[] = [];

  const gapPath = path.resolve(
    missionDir, 'evolution', 'gap-assessment-evolving.json',
  );
  const summaryPath = path.resolve(missionDir, 'mission-summary.md');

  if (!fs.existsSync(gapPath) && !fs.existsSync(summaryPath)) {
    unmet.push(
      'Neither gap-assessment-evolving.json nor mission-summary.md exists'
    );
  }

  return unmet;
}

// ---------------------------------------------------------------------------
// Transition guard registry
// ---------------------------------------------------------------------------

const transitionGuards: Record<string, GuardFn> = {
  'building -> polishing': guardBuildingToPolishing,
  'polishing -> evolving': guardPolishingToEvolving,
  'evolving -> complete': guardEvolvingToComplete,
};
