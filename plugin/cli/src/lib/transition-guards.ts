/**
 * Transition guards — artifact-existence checks for task state transitions.
 *
 * Each forward transition in the 7-state task model requires specific artifacts
 * to exist before the transition is allowed. Rewind transitions (gate-fail,
 * iterate) have no artifact requirements.
 */

import * as fs from 'fs';
import * as path from 'path';
import { readJsonFile } from './fs-atomic';

// ── Types ──────────────────────────────────────────────────────────────

export interface GuardPass {
  valid: true;
}

export interface GuardFail {
  valid: false;
  missing_artifacts: string[];
}

export type GuardResult = GuardPass | GuardFail;

// ── Rewind transitions (no artifact requirements) ──────────────────────

const REWIND_TRANSITIONS: ReadonlySet<string> = new Set([
  'integrated->implementing',
  'integrated->reviewed',
  'verified->ready',
  'verified->implementing',
  'verified->reviewed',
]);

function isRewind(from: string, to: string): boolean {
  return REWIND_TRANSITIONS.has(`${from}->${to}`);
}

// ── Per-transition guard logic ─────────────────────────────────────────

type GuardFn = (
  geasDir: string,
  missionId: string,
  taskId: string,
) => GuardResult;

function guardDraftedToReady(
  geasDir: string,
  missionId: string,
  taskId: string,
): GuardResult {
  const taskPath = path.resolve(
    geasDir, 'missions', missionId, 'tasks', `${taskId}.json`,
  );
  const task = readJsonFile<Record<string, unknown>>(taskPath);
  if (!task) {
    return { valid: false, missing_artifacts: [`tasks/${taskId}.json`] };
  }

  const required: string[] = [
    'task_kind',
    'risk_level',
    'gate_profile',
    'vote_round_policy',
    'base_snapshot',
  ];

  const missing: string[] = [];
  for (const field of required) {
    if (task[field] === undefined || task[field] === null) {
      missing.push(`task_contract.${field}`);
    }
  }

  // rubric.dimensions[] check
  const rubric = task.rubric as Record<string, unknown> | undefined;
  if (
    !rubric ||
    !Array.isArray(rubric.dimensions) ||
    rubric.dimensions.length === 0
  ) {
    missing.push('task_contract.rubric.dimensions[]');
  }

  return missing.length === 0
    ? { valid: true }
    : { valid: false, missing_artifacts: missing };
}

function guardReadyToImplementing(
  geasDir: string,
  missionId: string,
  taskId: string,
): GuardResult {
  const contractPath = path.resolve(
    geasDir, 'missions', missionId, 'contracts', `${taskId}.json`,
  );
  const contract = readJsonFile<Record<string, unknown>>(contractPath);

  if (!contract) {
    return {
      valid: false,
      missing_artifacts: [`contracts/${taskId}.json`],
    };
  }
  if (contract.status !== 'approved') {
    return {
      valid: false,
      missing_artifacts: [`contracts/${taskId}.json (status must be "approved", got "${contract.status}")`],
    };
  }
  return { valid: true };
}

function guardImplementingToReviewed(
  geasDir: string,
  missionId: string,
  taskId: string,
): GuardResult {
  const missing: string[] = [];
  const taskDir = path.resolve(
    geasDir, 'missions', missionId, 'tasks', taskId,
  );

  // worker-self-check.json
  const selfCheckPath = path.resolve(taskDir, 'worker-self-check.json');
  if (!fs.existsSync(selfCheckPath)) {
    missing.push(`tasks/${taskId}/worker-self-check.json`);
  }

  // At least 1 file containing "review" in filename under evidence/{tid}/
  const evidenceDir = path.resolve(
    geasDir, 'missions', missionId, 'evidence', taskId,
  );
  let hasReview = false;
  if (fs.existsSync(evidenceDir)) {
    try {
      const files = fs.readdirSync(evidenceDir);
      hasReview = files.some(f => f.toLowerCase().includes('review'));
    } catch {
      // directory read failed
    }
  }
  if (!hasReview) {
    missing.push(`evidence/${taskId}/*review* (at least 1 review file)`);
  }

  return missing.length === 0
    ? { valid: true }
    : { valid: false, missing_artifacts: missing };
}

function guardReviewedToIntegrated(
  geasDir: string,
  missionId: string,
  taskId: string,
): GuardResult {
  const resultPath = path.resolve(
    geasDir, 'missions', missionId, 'tasks', taskId, 'integration-result.json',
  );
  if (!fs.existsSync(resultPath)) {
    return {
      valid: false,
      missing_artifacts: [`tasks/${taskId}/integration-result.json`],
    };
  }
  return { valid: true };
}

function guardIntegratedToVerified(
  geasDir: string,
  missionId: string,
  taskId: string,
): GuardResult {
  const gatePath = path.resolve(
    geasDir, 'missions', missionId, 'tasks', taskId, 'gate-result.json',
  );
  const gate = readJsonFile<Record<string, unknown>>(gatePath);

  if (!gate) {
    return {
      valid: false,
      missing_artifacts: [`tasks/${taskId}/gate-result.json`],
    };
  }
  if (gate.verdict !== 'pass') {
    return {
      valid: false,
      missing_artifacts: [`tasks/${taskId}/gate-result.json (verdict must be "pass", got "${gate.verdict}")`],
    };
  }
  return { valid: true };
}

function guardVerifiedToPassed(
  geasDir: string,
  missionId: string,
  taskId: string,
): GuardResult {
  const missing: string[] = [];
  const taskDir = path.resolve(
    geasDir, 'missions', missionId, 'tasks', taskId,
  );

  // closure-packet.json
  if (!fs.existsSync(path.resolve(taskDir, 'closure-packet.json'))) {
    missing.push(`closure-packet.json does not exist for task ${taskId}`);
  }

  // final-verdict.json with verdict: "pass"
  const verdictPath = path.resolve(taskDir, 'final-verdict.json');
  const verdict = readJsonFile<Record<string, unknown>>(verdictPath);
  if (!verdict) {
    missing.push(`final-verdict.json does not exist for task ${taskId}`);
  } else if (verdict.verdict !== 'pass') {
    missing.push(
      `final-verdict.json verdict is '${verdict.verdict}', expected 'pass'`,
    );
  }

  // retrospective.json
  if (!fs.existsSync(path.resolve(taskDir, 'retrospective.json'))) {
    missing.push(`tasks/${taskId}/retrospective.json`);
  }

  // challenge-review.json — required for high, critical risk
  const taskContractPath = path.resolve(
    geasDir, 'missions', missionId, 'tasks', `${taskId}.json`,
  );
  const taskContract = readJsonFile<Record<string, unknown>>(taskContractPath);
  const riskLevel = taskContract?.risk_level as string | undefined;
  const requiresChallenge = ['high', 'critical'].includes(
    riskLevel ?? '',
  );

  if (requiresChallenge) {
    if (!fs.existsSync(path.resolve(taskDir, 'challenge-review.json'))) {
      missing.push(
        `challenge-review.json is required for ${riskLevel}-risk task ${taskId}`,
      );
    }
  }

  return missing.length === 0
    ? { valid: true }
    : { valid: false, missing_artifacts: missing };
}

// ── Guard dispatch table ───────────────────────────────────────────────

const GUARDS: Record<string, GuardFn> = {
  'drafted->ready': guardDraftedToReady,
  'ready->implementing': guardReadyToImplementing,
  'implementing->reviewed': guardImplementingToReviewed,
  'reviewed->integrated': guardReviewedToIntegrated,
  'integrated->verified': guardIntegratedToVerified,
  'verified->passed': guardVerifiedToPassed,
};

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Validate that the required artifacts exist for a task state transition.
 *
 * - Forward transitions check for specific artifacts.
 * - Rewind transitions (gate-fail / iterate) pass unconditionally.
 * - Auxiliary transitions (-> blocked/escalated/cancelled) pass unconditionally.
 * - Unknown transitions pass (state validity is checked elsewhere).
 */
export function validateTransition(
  geasDir: string,
  missionId: string,
  taskId: string,
  fromStatus: string,
  toStatus: string,
): GuardResult {
  // Rewind transitions — no artifact requirements
  if (isRewind(fromStatus, toStatus)) {
    return { valid: true };
  }

  // Auxiliary transitions — no artifact requirements
  const auxiliary = ['blocked', 'escalated', 'cancelled'];
  if (auxiliary.includes(toStatus)) {
    return { valid: true };
  }

  // Recovery from auxiliary — no artifact requirements
  if (['blocked', 'escalated'].includes(fromStatus) && toStatus === 'ready') {
    return { valid: true };
  }

  const key = `${fromStatus}->${toStatus}`;
  const guard = GUARDS[key];
  if (!guard) {
    // No guard defined for this transition — allow it
    return { valid: true };
  }

  return guard(geasDir, missionId, taskId);
}
