Task: [T1] CLI path traversal defense and identifier validation

## Goal
Add validateIdentifier() to all 6 unsecured commands (packet, debt, decision, evolution, recovery, lock), call assertContainedIn() after path composition, add --phase enum validation, reject invalid identifiers instead of sanitizing.

## Acceptance Criteria
1. packet.ts uses validateIdentifier for task/agent/mission IDs instead of inline regex
2. debt.ts validates mission/task/owner identifiers
3. decision.ts validates mission and decision identifiers
4. evolution.ts validates mission and phase (enum check)
5. recovery.ts validates recovery_id
6. lock.ts validates task identifier and verifies task exists
7. assertContainedIn() called after all path compositions in these commands
8. Invalid identifiers are rejected, not sanitized (memory.ts, packet.ts, decision.ts)
9. npm run typecheck passes
10. node test/integration.js passes

## Design Guide (from design-authority)
1. Call validateIdentifier() at the top of each subcommand action handler, after resolving geasDir
2. Call assertContainedIn() on final resolved file path only (not intermediate path.join)
3. Use existing FILE_ERROR code and fileError() output helper — no new error codes
4. --phase enum: hardcoded VALID_PHASES array in evolution.ts (specifying, building, polishing, evolving)
5. Replace all .replace(/[^a-zA-Z0-9_-]/g, "") sanitization with validateIdentifier() rejection in memory.ts, packet.ts, decision.ts
6. Anchor assertContainedIn to missionDir for mission-scoped files, geasDir for global files
7. Do NOT add assertContainedIn to read-only external paths (e.g., --file input)

## Surfaces
- plugin/cli/src/commands/packet.ts
- plugin/cli/src/commands/debt.ts
- plugin/cli/src/commands/decision.ts
- plugin/cli/src/commands/evolution.ts
- plugin/cli/src/commands/recovery.ts
- plugin/cli/src/commands/lock.ts
- plugin/cli/src/commands/memory.ts
- plugin/cli/src/lib/paths.ts
- plugin/cli/test/integration.js

## Eval Commands
- cd plugin/cli && npm run build
- cd plugin/cli && npm run typecheck
- cd plugin/cli && node test/integration.js