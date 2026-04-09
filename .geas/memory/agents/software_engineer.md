# Software_engineer Memory

- When hardening CLI commands: validateIdentifier at top of subcommand actions, assertContainedIn on final output paths only. Anchor to missionDir for mission-scoped, geasDir for global. Check for inline regex patterns in other commands that should use shared validator.
