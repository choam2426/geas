Test task-001: CLI path traversal defense and identifier validation

## What Changed
7 CLI command files hardened with validateIdentifier() and assertContainedIn().

## Acceptance Criteria to Verify
1. packet.ts uses validateIdentifier for task/agent/mission IDs
2. debt.ts validates mission/task/owner identifiers
3. decision.ts validates mission and decision identifiers
4. evolution.ts validates mission and phase (enum check)
5. recovery.ts validates recovery_id
6. lock.ts validates task identifier
7. assertContainedIn() called after path compositions
8. Invalid identifiers rejected, not sanitized
9. npm run typecheck passes
10. node test/integration.js passes

## Test Strategy
- Run eval commands: cd plugin/cli && npm run build && npm run typecheck && node test/integration.js
- Test rejection: try invalid identifiers with ../evil patterns
- Test valid identifiers still work
- Verify error messages use FILE_ERROR pattern

## Known Deviations
- lock.ts omits task existence check
- lock.ts omits assertContainedIn (fixed path)