Task: [T1] CLI path traversal defense and identifier validation

## Goal
Add validateIdentifier() to all 6 unsecured commands (packet, debt, decision, evolution, recovery, lock), call assertContainedIn() after path composition, add --phase enum validation, reject invalid identifiers instead of sanitizing.

## Context
- CLI has validateIdentifier() in lib/paths.ts and assertContainedIn() but they are not consistently applied
- 6 commands lack validation: packet.ts, debt.ts, decision.ts, evolution.ts, recovery.ts, lock.ts
- memory.ts, packet.ts, decision.ts currently sanitize invalid input instead of rejecting
- Security concern: path traversal via crafted identifiers

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

## Design Questions
1. Where exactly should validateIdentifier() be called in each command (entry point vs per-subcommand)?
2. Should assertContainedIn() wrap every path.join or only final resolved paths?
3. What error messages and exit codes for rejection?
4. Should --phase use a hardcoded enum or pull from schema?

## Risk
High — security-critical change across 6+ files