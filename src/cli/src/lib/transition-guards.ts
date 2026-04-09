/**
 * Transition guards — artifact-existence checks for task state transitions.
 *
 * v4: Guards check record.json sections and tasks/{tid}/evidence/ files
 * instead of individual artifact files.
 *
 * Each forward transition in the 7-state task model requires specific
 * record.json sections and/or evidence files before the transition is allowed.
 * Rewind transitions (gate-fail, iterate) have no artifact requirements.
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

// ── Helpers ────────────────────────────────────────────────────────────

/** Read record.json for a task. Returns null if not found. */
function readRecord(
  geasDir: string, missionId: string, taskId: string,
): Record<string, unknown> | null {
  const recordPath = path.resolve(
    geasDir, 'missions', missionId, 'tasks', taskId, 'record.json',
  );
  return readJsonFile<Record<string, unknown>>(recordPath);
}

/** Check if a record.json section exists and optionally has a specific field value. */
function hasRecordSection(
  record: Record<string, unknown> | null,
  section: string,
  fieldCheck?: { field: string; value: string },
): boolean {
  if (!record) return false;
  const sec = record[section] as Record<string, unknown> | undefined;
  if (!sec || typeof sec !== 'object') return false;
  if (fieldCheck) {
    return sec[fieldCheck.field] === fieldCheck.value;
  }
  return true;
}

/** List evidence files for a task. Returns filenames. */
function listEvidenceFiles(
  geasDir: string, missionId: string, taskId: string,
): string[] {
  const evidenceDir = path.resolve(
    geasDir, 'missions', missionId, 'tasks', taskId, 'evidence',
  );
  if (!fs.existsSync(evidenceDir)) return [];
  try {
    return fs.readdirSync(evidenceDir).filter(f => f.endsWith('.json'));
  } catch {
    return [];
  }
}

/** Check if evidence with a specific role exists. */
function hasEvidenceWithRole(
  geasDir: string, missionId: string, taskId: string, roles: string[],
): boolean {
  const evidenceDir = path.resolve(
    geasDir, 'missions', missionId, 'tasks', taskId, 'evidence',
  );
  if (!fs.existsSync(evidenceDir)) return false;

  try {
    const files = fs.readdirSync(evidenceDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const data = readJsonFile<Record<string, unknown>>(
        path.resolve(evidenceDir, file),
      );
      if (data && typeof data.role === 'string' && roles.includes(data.role)) {
        return true;
      }
    }
  } catch {
    // directory read failed
  }
  return false;
}

// ── Per-transition guard logic ─────────────────────────────────────────

type GuardFn = (
  geasDir: string,
  missionId: string,
  taskId: string,
) => GuardResult;

/**
 * drafted -> ready: contract.json must exist with required fields.
 */
function guardDraftedToReady(
  geasDir: string,
  missionId: string,
  taskId: string,
): GuardResult {
  const contractPath = path.resolve(
    geasDir, 'missions', missionId, 'tasks', taskId, 'contract.json',
  );
  const task = readJsonFile<Record<string, unknown>>(contractPath);
  if (!task) {
    return { valid: false, missing_artifacts: [`tasks/${taskId}/contract.json`] };
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
      missing.push(`contract.json.${field}`);
    }
  }

  // rubric.dimensions[] check
  const rubric = task.rubric as Record<string, unknown> | undefined;
  if (
    !rubric ||
    !Array.isArray(rubric.dimensions) ||
    rubric.dimensions.length === 0
  ) {
    missing.push('contract.json.rubric.dimensions[]');
  }

  return missing.length === 0
    ? { valid: true }
    : { valid: false, missing_artifacts: missing };
}

/**
 * ready -> implementing: record.json must have implementation_contract
 * section with status "approved".
 */
function guardReadyToImplementing(
  geasDir: string,
  missionId: string,
  taskId: string,
): GuardResult {
  const record = readRecord(geasDir, missionId, taskId);

  if (!hasRecordSection(record, 'implementation_contract', { field: 'status', value: 'approved' })) {
    const sec = record?.[
      'implementation_contract'
    ] as Record<string, unknown> | undefined;
    if (!sec) {
      return {
        valid: false,
        missing_artifacts: ['record.json:implementation_contract section'],
      };
    }
    return {
      valid: false,
      missing_artifacts: [
        `record.json:implementation_contract.status must be "approved" (got "${sec.status}")`,
      ],
    };
  }
  return { valid: true };
}

/**
 * implementing -> reviewed: record.json must have self_check section,
 * and evidence/ must have at least 1 file with implementer role.
 */
function guardImplementingToReviewed(
  geasDir: string,
  missionId: string,
  taskId: string,
): GuardResult {
  const missing: string[] = [];
  const record = readRecord(geasDir, missionId, taskId);

  // self_check section required
  if (!hasRecordSection(record, 'self_check')) {
    missing.push('record.json:self_check section');
  }

  // At least 1 evidence file with implementer role
  if (!hasEvidenceWithRole(geasDir, missionId, taskId, ['implementer'])) {
    const evidenceFiles = listEvidenceFiles(geasDir, missionId, taskId);
    if (evidenceFiles.length === 0) {
      missing.push('evidence/ (no files)');
    } else {
      missing.push('evidence/ (no file with role=implementer)');
    }
  }

  return missing.length === 0
    ? { valid: true }
    : { valid: false, missing_artifacts: missing };
}

/**
 * reviewed -> integrated: record.json must have gate_result section
 * with verdict "pass", and evidence/ must have reviewer or tester role.
 */
function guardReviewedToIntegrated(
  geasDir: string,
  missionId: string,
  taskId: string,
): GuardResult {
  const missing: string[] = [];
  const record = readRecord(geasDir, missionId, taskId);

  if (!hasRecordSection(record, 'gate_result', { field: 'verdict', value: 'pass' })) {
    const sec = record?.['gate_result'] as Record<string, unknown> | undefined;
    if (!sec) {
      missing.push('record.json:gate_result section');
    } else {
      missing.push(
        `record.json:gate_result.verdict must be "pass" (got "${sec.verdict}")`,
      );
    }
  }

  // reviewer or tester role required
  if (!hasEvidenceWithRole(geasDir, missionId, taskId, ['reviewer', 'tester'])) {
    missing.push('evidence/ (no file with role=reviewer or role=tester)');
  }

  return missing.length === 0
    ? { valid: true }
    : { valid: false, missing_artifacts: missing };
}

/**
 * integrated -> verified: pass (no requirements).
 */
function guardIntegratedToVerified(
  _geasDir: string,
  _missionId: string,
  _taskId: string,
): GuardResult {
  return { valid: true };
}

/**
 * verified -> passed: record.json must have verdict (pass), gate_result (pass),
 * closure (with ≥1 review), retrospective sections.
 * challenge_review required for high/critical risk, and must not be blocking.
 */
function guardVerifiedToPassed(
  geasDir: string,
  missionId: string,
  taskId: string,
): GuardResult {
  const missing: string[] = [];
  const record = readRecord(geasDir, missionId, taskId);

  // verdict section with verdict: "pass"
  if (!hasRecordSection(record, 'verdict', { field: 'verdict', value: 'pass' })) {
    const sec = record?.['verdict'] as Record<string, unknown> | undefined;
    if (!sec) {
      missing.push('record.json:verdict section');
    } else {
      missing.push(
        `record.json:verdict.verdict must be "pass" (got "${sec.verdict}")`,
      );
    }
  }

  // C3: gate_result.verdict must be "pass" (re-verify)
  if (!hasRecordSection(record, 'gate_result', { field: 'verdict', value: 'pass' })) {
    const sec = record?.['gate_result'] as Record<string, unknown> | undefined;
    if (!sec) {
      missing.push('record.json:gate_result section');
    } else {
      missing.push(
        `record.json:gate_result.verdict must be "pass" (got "${sec.verdict}")`,
      );
    }
  }

  // C3: closure section with at least 1 review
  if (!hasRecordSection(record, 'closure')) {
    missing.push('record.json:closure section');
  } else {
    const closure = record!['closure'] as Record<string, unknown>;
    const reviews = closure.reviews as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(reviews) || reviews.length === 0) {
      missing.push('record.json:closure.reviews must have at least 1 review');
    }

    // Check no review is in blocked state
    if (Array.isArray(reviews)) {
      for (const review of reviews) {
        const reviewObj = review as Record<string, unknown>;
        if (reviewObj.status === 'blocked') {
          missing.push(`record.json:closure.reviews contains a review with status "blocked" (from ${reviewObj.reviewer_type || 'unknown'})`);
        }
      }
    }
  }

  // retrospective section
  if (!hasRecordSection(record, 'retrospective')) {
    missing.push('record.json:retrospective section');
  }

  // challenge_review — required for high/critical risk
  const contractPath = path.resolve(
    geasDir, 'missions', missionId, 'tasks', taskId, 'contract.json',
  );
  const contract = readJsonFile<Record<string, unknown>>(contractPath);

  // Check required reviewer coverage from contract
  const routing = contract?.routing as Record<string, unknown> | undefined;
  const requiredReviewers = routing?.required_reviewer_types as string[] | undefined;
  if (Array.isArray(requiredReviewers) && requiredReviewers.length > 0) {
    for (const reviewerType of requiredReviewers) {
      // Check if any evidence file has this agent type as a substring in the filename
      // or has a matching role (reviewer/tester/authority)
      const evidenceDir = path.resolve(
        geasDir, 'missions', missionId, 'tasks', taskId, 'evidence',
      );
      if (fs.existsSync(evidenceDir)) {
        const files = fs.readdirSync(evidenceDir).filter(f => f.endsWith('.json'));
        const hasEvidence = files.some(f => {
          const name = f.replace('.json', '');
          // Match by agent type name (e.g., "design-authority" in "design-authority.json" or "design-authority-review.json")
          return name === reviewerType || name.replace(/_/g, '-') === reviewerType.replace(/_/g, '-') || name.startsWith(reviewerType.replace(/_/g, '-'));
        });
        if (!hasEvidence) {
          missing.push(`evidence/ missing for required reviewer type "${reviewerType}"`);
        }
      } else {
        missing.push(`evidence/ directory does not exist (required reviewer "${reviewerType}" not covered)`);
      }
    }
  }

  const riskLevel = contract?.risk_level as string | undefined;
  const requiresChallenge = ['high', 'critical'].includes(riskLevel ?? '');

  if (requiresChallenge) {
    if (!hasRecordSection(record, 'challenge_review')) {
      missing.push(
        `record.json:challenge_review section (required for ${riskLevel}-risk task)`,
      );
    } else {
      // C3: challenge_review must not be blocking
      const cr = record!['challenge_review'] as Record<string, unknown>;
      if (cr.blocking === true) {
        missing.push('record.json:challenge_review.blocking is true (must be resolved before passing)');
      }
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
 * - Forward transitions check for specific artifacts (record.json sections + evidence).
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
