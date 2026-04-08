/**
 * Phase transition guard — validates gate criteria before allowing
 * a mission to advance from one phase to the next.
 *
 * Each transition has specific file-existence and status requirements
 * that mirror the protocol's phase exit gates.
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
 *
 * @param geasDir  - Absolute path to .geas/ directory
 * @param missionId - Mission identifier
 * @param currentPhase - The phase the mission is leaving
 * @param nextPhase - The phase the mission is entering
 * @returns Guard result with unmet criteria if invalid
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
    // No guard defined for this transition — allow it
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
 * Check if a phase-review file exists for the given phase.
 * Phase reviews are stored as: phase-reviews/{phase}_*.json
 */
function hasPhaseReview(missionDir: string, phase: string): boolean {
  const reviewsDir = path.resolve(missionDir, 'phase-reviews');
  if (!fs.existsSync(reviewsDir)) return false;
  try {
    const files = fs.readdirSync(reviewsDir);
    return files.some((f) => f.startsWith(`${phase}_`) && f.endsWith('.json'));
  } catch {
    return false;
  }
}

/**
 * Check if a gap-assessment file exists for the given phase.
 */
function hasGapAssessment(missionDir: string, phase: string): boolean {
  const gapPath = path.resolve(
    missionDir,
    'evolution',
    `gap-assessment-${phase}.json`
  );
  return fs.existsSync(gapPath);
}

// ---------------------------------------------------------------------------
// Per-transition gate functions
// ---------------------------------------------------------------------------

type GuardFn = (missionDir: string) => string[];

/**
 * specifying -> building
 */
function guardSpecifyingToBuilding(missionDir: string): string[] {
  const unmet: string[] = [];

  // spec.json must exist
  const specPath = path.resolve(missionDir, 'spec.json');
  if (!fs.existsSync(specPath)) {
    unmet.push('spec.json does not exist');
  }

  // design-brief.json must exist with status "approved"
  const briefPath = path.resolve(missionDir, 'design-brief.json');
  const brief = readJsonFile<Record<string, unknown>>(briefPath);
  if (!brief) {
    unmet.push('design-brief.json does not exist');
  } else if (brief.status !== 'approved') {
    unmet.push(
      `design-brief.json status is "${brief.status}", expected "approved"`
    );
  }

  // At least 1 task file in tasks/
  const tasksDir = path.resolve(missionDir, 'tasks');
  if (!fs.existsSync(tasksDir)) {
    unmet.push('tasks/ directory does not exist (need at least 1 task)');
  } else {
    const taskFiles = fs
      .readdirSync(tasksDir)
      .filter((f) => f.endsWith('.json'));
    if (taskFiles.length === 0) {
      unmet.push('No task files found in tasks/ (need at least 1)');
    }
  }

  // Phase review for specifying must exist
  if (!hasPhaseReview(missionDir, 'specifying')) {
    unmet.push('No phase-review found for specifying phase');
  }

  return unmet;
}

/**
 * building -> polishing
 */
function guardBuildingToPolishing(missionDir: string): string[] {
  const unmet: string[] = [];

  // All tasks must be "passed" or "cancelled"
  const tasksDir = path.resolve(missionDir, 'tasks');
  if (fs.existsSync(tasksDir)) {
    const taskFiles = fs
      .readdirSync(tasksDir)
      .filter((f) => f.endsWith('.json'));
    for (const file of taskFiles) {
      const task = readJsonFile<Record<string, unknown>>(
        path.resolve(tasksDir, file)
      );
      if (task) {
        const status = task.status as string | undefined;
        if (status !== 'passed' && status !== 'cancelled') {
          unmet.push(
            `Task ${file} has status "${status ?? 'unknown'}", expected "passed" or "cancelled"`
          );
        }
      }
    }
  }

  // Debt register: no critical+open items
  const debtPath = path.resolve(
    missionDir,
    'evolution',
    'debt-register.json'
  );
  const debt = readJsonFile<Record<string, unknown>>(debtPath);
  if (debt && Array.isArray(debt.items)) {
    const items = debt.items as Array<Record<string, unknown>>;
    const criticalOpen = items.filter(
      (i) => i.severity === 'critical' && i.status === 'open'
    );
    if (criticalOpen.length > 0) {
      unmet.push(
        `Debt register has ${criticalOpen.length} critical open item(s)`
      );
    }

    // Warning threshold: 3+ high open items
    const highOpen = items.filter(
      (i) => i.severity === 'high' && i.status === 'open'
    );
    if (highOpen.length >= 3) {
      unmet.push(
        `Debt register has ${highOpen.length} high-severity open items (threshold: 3)`
      );
    }
  }

  // Phase review for building must exist
  if (!hasPhaseReview(missionDir, 'building')) {
    unmet.push('No phase-review found for building phase');
  }

  // Gap assessment for building must exist
  if (!hasGapAssessment(missionDir, 'building')) {
    unmet.push('evolution/gap-assessment-building.json does not exist');
  }

  return unmet;
}

/**
 * polishing -> evolving
 */
function guardPolishingToEvolving(missionDir: string): string[] {
  const unmet: string[] = [];

  // No task with status "blocked" or "escalated"
  const tasksDir = path.resolve(missionDir, 'tasks');
  if (fs.existsSync(tasksDir)) {
    const taskFiles = fs
      .readdirSync(tasksDir)
      .filter((f) => f.endsWith('.json'));
    for (const file of taskFiles) {
      const task = readJsonFile<Record<string, unknown>>(
        path.resolve(tasksDir, file)
      );
      if (task) {
        const status = task.status as string | undefined;
        if (status === 'blocked' || status === 'escalated') {
          unmet.push(`Task ${file} has status "${status}"`);
        }
      }
    }
  }

  // Debt register: no critical or high open items (all must be triaged)
  const debtPath = path.resolve(
    missionDir,
    'evolution',
    'debt-register.json'
  );
  const debt = readJsonFile<Record<string, unknown>>(debtPath);
  if (debt && Array.isArray(debt.items)) {
    const items = debt.items as Array<Record<string, unknown>>;
    const untriaged = items.filter(
      (i) =>
        (i.severity === 'critical' || i.severity === 'high') &&
        i.status === 'open'
    );
    if (untriaged.length > 0) {
      unmet.push(
        `Debt register has ${untriaged.length} critical/high open item(s) that must be triaged`
      );
    }
  }

  // Phase review for polishing must exist
  if (!hasPhaseReview(missionDir, 'polishing')) {
    unmet.push('No phase-review found for polishing phase');
  }

  // Gap assessment for polishing must exist
  if (!hasGapAssessment(missionDir, 'polishing')) {
    unmet.push('evolution/gap-assessment-polishing.json does not exist');
  }

  return unmet;
}

/**
 * evolving -> complete
 */
function guardEvolvingToComplete(missionDir: string): string[] {
  const unmet: string[] = [];

  const gapPath = path.resolve(
    missionDir,
    'evolution',
    'gap-assessment-evolving.json'
  );
  if (!fs.existsSync(gapPath)) {
    unmet.push('evolution/gap-assessment-evolving.json does not exist');
  }

  const rulesPath = path.resolve(
    missionDir,
    'evolution',
    'rules-update.json'
  );
  if (!fs.existsSync(rulesPath)) {
    unmet.push('evolution/rules-update.json does not exist');
  }

  const summaryPath = path.resolve(missionDir, 'mission-summary.md');
  if (!fs.existsSync(summaryPath)) {
    unmet.push('mission-summary.md does not exist');
  }

  // Phase review for evolving must exist
  if (!hasPhaseReview(missionDir, 'evolving')) {
    unmet.push('No phase-review found for evolving phase');
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
