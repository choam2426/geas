/**
 * Post-write checks -- replicates 6 PostToolUse hook behaviors inside the CLI.
 *
 * Each check function maps to a specific hook:
 * - checkTimestampAndScope      -> protect-geas-state.sh
 * - checkTaskPassedEvidence     -> verify-task-status.sh
 * - checkDebtThreshold          -> check-debt.sh
 * - checkLockConflicts          -> lock-conflict-check.sh
 * - writeCheckpointPending      -> checkpoint-pre-write.sh
 * - cleanupCheckpointPending    -> checkpoint-post-write.sh
 * - checkPacketStaleness        -> packet-stale-check.sh
 *
 * Design: checks return warnings as string[]. They do NOT block writes
 * (warn, don't fail) except as noted. The caller (fs-atomic.ts) emits
 * warnings to stderr via output.warn().
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Normalize backslashes to forward slashes for consistent matching. */
function norm(p: string): string {
  return p.replace(/\\/g, '/');
}

/** Read and parse a JSON file. Returns null on any error. */
function readJsonSafe(filePath: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Check if a file exists. */
function fileExists(p: string): boolean {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

/** Simple fnmatch-style glob (supports * and ?). Mirrors geas-hooks.js fnmatch. */
function fnmatch(str: string, pattern: string): boolean {
  let re = '^';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') re += '.*';
    else if (c === '?') re += '.';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  re += '$';
  return new RegExp(re).test(str);
}

/** Check if a relative path matches any scope.surfaces entry. */
function matchScope(rel: string, scopePaths: string[]): boolean {
  if (!scopePaths || scopePaths.length === 0) return true;
  return scopePaths.some(
    (p) => fnmatch(rel, p) || rel.startsWith(p.replace(/\/$/, '') + '/')
  );
}

/** Compute relative path with forward slashes. */
function relPath(filePath: string, cwd: string): string {
  return path.relative(cwd, filePath).replace(/\\/g, '/');
}

/** Resolve the .geas directory from cwd. */
function geasDir(cwd: string): string {
  return path.join(cwd, '.geas');
}

/** Generate an ISO timestamp without milliseconds (matches hook format). */
function isoTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// ---------------------------------------------------------------------------
// 1a. enrichTimestamp  (pre-write phase of protect-geas-state.sh)
// ---------------------------------------------------------------------------

/**
 * PRE-WRITE: Injects created_at into the data object when missing or placeholder.
 * Must be called BEFORE serialization so the atomic write includes the timestamp.
 * Mutates the data object in place and returns it.
 */
export function enrichTimestamp(
  filePath: string,
  data: unknown
): unknown {
  const normFp = norm(filePath);
  if (!normFp.includes('/.geas/') || !normFp.endsWith('.json')) return data;
  if (typeof data !== 'object' || data === null) return data;

  const d = data as Record<string, unknown>;

  // If the file already exists on disk, this is an update — inject updated_at
  if (fs.existsSync(filePath)) {
    d.updated_at = isoTimestamp();
  }

  // Inject created_at if missing or placeholder (unchanged logic)
  const ts = (d.created_at as string) || '';
  if (!ts || /:00:00Z$/.test(ts) || /:00:00\.000Z$/.test(ts)) {
    d.created_at = isoTimestamp();
  }
  return data;
}

// ---------------------------------------------------------------------------
// 1b. checkScopeAndFrozenSpec  (post-write phase of protect-geas-state.sh)
// ---------------------------------------------------------------------------

/**
 * POST-WRITE: Scope validation and frozen spec warning (no file rewrites).
 */
export function checkScopeAndFrozenSpec(
  filePath: string,
  _data: unknown,
  cwd: string
): string[] {
  const warnings: string[] = [];
  const normFp = norm(filePath);
  const rel = relPath(filePath, cwd);
  const geas = geasDir(cwd);

  // --- Scope check (for files OUTSIDE .geas/) ---
  if (!rel.startsWith('.geas/') && !rel.startsWith('.geas\\')) {
    const run = readJsonSafe(path.join(geas, 'state', 'run.json'));
    if (run && run.current_task_id) {
      const mid = (run.mission_id as string) || '';
      const mdir = mid ? path.join(geas, 'missions', mid) : geas;
      // v4: tasks/{tid}/contract.json (directory per task)
      const task = readJsonSafe(
        path.join(mdir, 'tasks', run.current_task_id as string, 'contract.json')
      );
      if (task) {
        const scope = task.scope as Record<string, unknown> | undefined;
        const scopePaths = (scope?.surfaces as string[]) || [];
        if (scopePaths.length > 0 && !matchScope(rel, scopePaths)) {
          warnings.push(
            `Write to ${rel} outside scope.surfaces in ${run.current_task_id}`
          );
        }
      }
    }
  }

  // --- Mission spec frozen warning ---
  if (normFp.includes('/.geas/missions/') && normFp.endsWith('/spec.json')) {
    warnings.push(
      'Mission spec was modified. Mission specs should be frozen after intake. Use a vote round for scope changes.'
    );
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// 2. checkTaskPassedEvidence  (verify-task-status.sh)
// ---------------------------------------------------------------------------

/**
 * When a task contract is written with status "passed", verifies:
 * - Required reviewer evidence exists in tasks/{tid}/evidence/ (from routing.required_reviewer_types).
 * - record.json has verdict section.
 * - record.json has challenge_review section for high/critical risk tasks.
 * - record.json has retrospective section.
 * - All reviewer evidence files have rubric_scores.
 */
export function checkTaskPassedEvidence(
  filePath: string,
  data: unknown,
  cwd: string
): string[] {
  const normFp = norm(filePath);
  // v4: tasks/{tid}/contract.json (directory per task)
  if (!normFp.includes('/.geas/missions/') || !normFp.endsWith('/contract.json')) return [];

  const d = (typeof data === 'object' && data !== null)
    ? (data as Record<string, unknown>)
    : null;
  if (!d || d.status !== 'passed') return [];

  const tid = (d.task_id as string) || (d.id as string) || '';
  if (!tid) return [];

  const geas = geasDir(cwd);
  const run = readJsonSafe(path.join(geas, 'state', 'run.json'));
  const mid = run?.mission_id as string | undefined;
  if (!mid) return [];

  const mdir = path.join(geas, 'missions', mid);
  // v4: evidence at tasks/{tid}/evidence/
  const edir = path.join(mdir, 'tasks', tid, 'evidence');
  const tdir = path.join(mdir, 'tasks', tid);

  const warnings: string[] = [];

  // Check required reviewer evidence
  const routing = (d.routing as Record<string, unknown>) || {};
  const reviewerTypes = (routing.required_reviewer_types as string[]) || [];
  for (const rt of reviewerTypes) {
    const kebab = rt.replace(/_/g, '-');
    const found =
      fileExists(path.join(edir, kebab + '-review.json')) ||
      fileExists(path.join(edir, kebab + '.json')) ||
      fileExists(path.join(edir, rt + '-review.json')) ||
      fileExists(path.join(edir, rt + '.json'));
    if (!found) {
      warnings.push(`${tid} marked as passed but evidence from ${rt} is missing`);
    }
  }

  // v4: verdict, challenge_review, retrospective are record.json sections
  const recordPath = path.join(tdir, 'record.json');
  const record = readJsonSafe(recordPath);
  const sections = record || {};

  // Always required: verdict section in record.json
  if (!sections.verdict) {
    warnings.push(`${tid} marked as passed but record.json verdict section is missing`);
  }

  // Challenge review required for high/critical
  const riskLevel = (d.risk_level as string) || 'normal';
  if (['high', 'critical'].includes(riskLevel)) {
    if (!sections.challenge_review) {
      warnings.push(`${tid} is ${riskLevel} risk but record.json challenge_review section is missing`);
    }
  }

  // Retrospective required
  if (!sections.retrospective) {
    warnings.push(`${tid} marked as passed but record.json retrospective section is missing`);
  }

  // Rubric scores check on all evidence files
  try {
    const files = fs.readdirSync(edir).filter((f) => f.endsWith('.json'));
    for (const f of files) {
      const review = readJsonSafe(path.join(edir, f));
      if (
        review &&
        review.reviewer_type &&
        (!review.rubric_scores ||
          Object.keys(review.rubric_scores as Record<string, unknown>).length === 0)
      ) {
        warnings.push(`${tid} ${f} is missing rubric_scores`);
      }
    }
  } catch {
    // Evidence directory may not exist yet; silently skip
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// 3. checkDebtThreshold  (check-debt.sh)
// ---------------------------------------------------------------------------

/**
 * Warns when 3+ HIGH severity debt items are open in a debt-register file.
 * Only runs on files inside .geas/missions/.
 */
export function checkDebtThreshold(
  filePath: string,
  data: unknown,
  _cwd: string
): string[] {
  const normFp = norm(filePath);
  if (!normFp.includes('.geas/missions/')) return [];

  const d = (typeof data === 'object' && data !== null)
    ? (data as Record<string, unknown>)
    : null;
  if (!d || !Array.isArray(d.items)) return [];

  interface DebtItem {
    severity?: string;
    status?: string;
  }

  const items = d.items as DebtItem[];
  const highOpen = items.filter(
    (i) => i.severity === 'high' && i.status === 'open'
  );

  if (highOpen.length >= 3) {
    return [
      `Debt register has ${highOpen.length} open HIGH severity items. Consider addressing before proceeding.`,
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// 4. checkLockConflicts  (lock-conflict-check.sh)
// ---------------------------------------------------------------------------

/**
 * Detects conflicting locks between tasks in a locks.json file.
 * Two locks conflict when they are both "held", have different task_ids,
 * the same lock_type, and overlapping targets.
 */
export function checkLockConflicts(
  filePath: string,
  data: unknown,
  _cwd: string
): string[] {
  const normFp = norm(filePath);
  if (!normFp.endsWith('.geas/state/locks.json')) return [];

  const d = (typeof data === 'object' && data !== null)
    ? (data as Record<string, unknown>)
    : null;
  if (!d || !Array.isArray(d.locks)) return [];

  interface LockEntry {
    status?: string;
    lock_type?: string;
    task_id?: string;
    targets?: string[];
  }

  const locks = d.locks as LockEntry[];
  const held = locks.filter((l) => l.status === 'held');

  // Group by lock_type
  const byType: Record<string, LockEntry[]> = {};
  for (const l of held) {
    const lt = l.lock_type || 'unknown';
    if (!byType[lt]) byType[lt] = [];
    byType[lt].push(l);
  }

  const conflicts: string[] = [];
  for (const [type, group] of Object.entries(byType)) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (group[i].task_id === group[j].task_id) continue;
        const targetsI = group[i].targets || [];
        const targetsJ = group[j].targets || [];
        const overlap = targetsI.filter((t) => targetsJ.includes(t));
        if (overlap.length > 0) {
          conflicts.push(
            `${type}: ${group[i].task_id} vs ${group[j].task_id} on [${overlap.join(', ')}]`
          );
        }
      }
    }
  }

  if (conflicts.length > 0) {
    return [
      'Lock conflicts detected:',
      ...conflicts.map((c) => '  ' + c),
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// 5a. writeCheckpointPending  (checkpoint-pre-write.sh)
// ---------------------------------------------------------------------------

/**
 * Two-phase checkpoint: write _checkpoint_pending BEFORE run.json is updated.
 * Copies the current run.json to _checkpoint_pending so recovery can detect
 * incomplete writes.
 *
 * Call this BEFORE writing run.json. Not a post-write check -- it is a
 * pre-write action, but grouped here for cohesion with its cleanup counterpart.
 */
export function writeCheckpointPending(
  filePath: string,
  cwd: string
): void {
  const normFp = norm(filePath);
  if (!normFp.endsWith('.geas/state/run.json')) return;

  const runFile = path.join(cwd, '.geas', 'state', 'run.json');
  const pendingFile = path.join(cwd, '.geas', 'state', '_checkpoint_pending');

  if (fileExists(runFile)) {
    try {
      fs.copyFileSync(runFile, pendingFile);
    } catch {
      // Best-effort; don't block the write
    }
  }
}

// ---------------------------------------------------------------------------
// 5b. cleanupCheckpointPending  (checkpoint-post-write.sh)
// ---------------------------------------------------------------------------

/**
 * Two-phase checkpoint: remove _checkpoint_pending AFTER run.json write succeeds.
 */
export function cleanupCheckpointPending(
  filePath: string,
  cwd: string
): void {
  const normFp = norm(filePath);
  if (!normFp.endsWith('.geas/state/run.json')) return;

  const pendingFile = path.join(cwd, '.geas', 'state', '_checkpoint_pending');
  if (fileExists(pendingFile)) {
    try {
      fs.unlinkSync(pendingFile);
    } catch {
      // Best-effort cleanup
    }
  }
}

// ---------------------------------------------------------------------------
// 6. checkPacketStaleness  (packet-stale-check.sh)
// ---------------------------------------------------------------------------

/**
 * After run.json is written, if recovery_class is set and a current_task_id
 * exists, warns that context packets for that task may be stale.
 */
export function checkPacketStaleness(
  filePath: string,
  data: unknown,
  cwd: string
): string[] {
  const normFp = norm(filePath);
  if (!normFp.endsWith('.geas/state/run.json')) return [];

  const d = (typeof data === 'object' && data !== null)
    ? (data as Record<string, unknown>)
    : null;
  if (!d || !d.current_task_id || !d.recovery_class) return [];

  const taskId = d.current_task_id as string;
  const recoveryClass = d.recovery_class as string;
  const packetsDir = path.join(geasDir(cwd), 'packets', taskId);

  try {
    const files = fs.readdirSync(packetsDir).filter((f) => f.endsWith('.md'));
    if (files.length > 0) {
      return [
        `Recovery detected (${recoveryClass}). Context packets in packets/${taskId}/ may be stale. Consider regenerating.`,
      ];
    }
  } catch {
    // packets directory doesn't exist -- nothing stale
  }

  return [];
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * Dispatches to the appropriate check functions based on file path.
 *
 * @param filePath - Absolute path of the file that was written.
 * @param data - The data that was written (parsed JSON).
 * @param cwd - Current working directory for relative path resolution.
 * @returns Array of warning messages. Empty array means no warnings.
 */
export function runPostWriteChecks(
  filePath: string,
  data: unknown,
  cwd: string
): string[] {
  const warnings: string[] = [];

  // 1. Scope validation + frozen spec warning (timestamp done pre-write)
  warnings.push(...checkScopeAndFrozenSpec(filePath, data, cwd));

  // 2. Task passed evidence completeness
  warnings.push(...checkTaskPassedEvidence(filePath, data, cwd));

  // 3. Debt threshold
  warnings.push(...checkDebtThreshold(filePath, data, cwd));

  // 4. Lock conflicts
  warnings.push(...checkLockConflicts(filePath, data, cwd));

  // 5. Checkpoint cleanup (post-write for run.json)
  cleanupCheckpointPending(filePath, cwd);

  // 6. Packet staleness (run.json)
  warnings.push(...checkPacketStaleness(filePath, data, cwd));

  return warnings;
}
