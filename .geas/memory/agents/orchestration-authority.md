# Orchestration Authority Memory

- When scoping terminology cleanup, check references/ subdirectories inside skills — not just top-level skill files
- CLI eval_commands must include both build and bundle steps: cd src/cli && npm run build && npm run bundle. tsc alone does not update plugin/bin/geas
- When spawning worker for implementation contract step, explicitly state DO NOT implement code, only write the contract
- envelope.ts ENVELOPE_REGISTRY is the centralized source for envelope defaults. When adding new artifact types, extend the registry, do not hardcode inline.
- Agent tool isolation:worktree may not persist worktree between calls in this harness; treat implementation and self_check as two separate agent spawns and pass absolute A:/geas/.geas/... paths
