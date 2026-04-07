/**
 * Post-write checks — replicates 8 PostToolUse hook behaviors inside the CLI.
 *
 * SIGNATURES ONLY. Implementation deferred to task-003 per design guide.
 *
 * Each check function maps to a specific hook:
 * - checkTimestampAndScope      -> protect-geas-state.sh
 * - checkTaskPassedEvidence     -> verify-task-status.sh
 * - checkDebtThreshold          -> check-debt.sh
 * - checkLockConflicts          -> lock-conflict-check.sh
 * - checkMemoryPromotion        -> memory-promotion-gate.sh
 * - checkStaleMemoryRefs        -> memory-superseded-warning.sh
 * - cleanupCheckpointPending    -> checkpoint-post-write.sh
 * - checkPacketStaleness        -> packet-stale-check.sh
 */

// TODO: Implement in task-003.

/**
 * Dispatches to the appropriate check functions based on file path.
 *
 * @param _filePath - Absolute path of the file that was written.
 * @param _data - The data that was written (parsed JSON).
 * @param _cwd - Current working directory for relative path resolution.
 * @returns Array of warning messages. Empty array means no warnings.
 */
export function runPostWriteChecks(
  _filePath: string,
  _data: unknown,
  _cwd: string
): string[] {
  // TODO: Implement dispatching to individual check functions in task-003.
  return [];
}
