Review task-001: CLI path traversal defense and identifier validation

## What Changed
7 CLI command files modified to add validateIdentifier() and assertContainedIn() consistently:
- packet.ts, debt.ts, decision.ts, evolution.ts, recovery.ts, lock.ts, memory.ts

## Design Guide Compliance Check
1. validateIdentifier() at top of each subcommand action, after geasDir resolution
2. assertContainedIn() on final resolved file path only (not intermediate)
3. Anchored to missionDir for mission-scoped, geasDir for global
4. No assertContainedIn on read-only external paths
5. Reject-not-sanitize pattern (all .replace removed)
6. VALID_PHASES enum in evolution.ts
7. Existing FILE_ERROR + fileError() pattern used

## Known Deviations
- lock.ts omits assertContainedIn (writes to fixed state/locks.json path)
- lock.ts omits task existence check (would break test ordering)
- packet.ts had no prior sanitization to replace (only validation added)

## Review Focus
- Verify all user-supplied identifiers have validateIdentifier calls
- Verify assertContainedIn on all output paths
- Verify no remaining sanitization patterns
- Check for missed edge cases

## Files to Review
plugin/cli/src/commands/packet.ts
plugin/cli/src/commands/debt.ts
plugin/cli/src/commands/decision.ts
plugin/cli/src/commands/evolution.ts
plugin/cli/src/commands/recovery.ts
plugin/cli/src/commands/lock.ts
plugin/cli/src/commands/memory.ts
plugin/cli/src/lib/paths.ts (reference — unchanged)