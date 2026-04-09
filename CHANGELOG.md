# Changelog

All notable changes to this project are documented in this file.

> **Note**: Tags were restructured in v0.5.1. Previous major versions (v1.x, v2.x) have been flattened to v0.x.y to reflect that the project is pre-1.0.

## [Unreleased]

## [0.7.0] — 2026-04-10

CLI restructure, pipeline enforcement, and process reliability improvements.

### Breaking
- CLI source moved from `plugin/cli/` to `src/cli/` (development only)
- CLI is now a pre-built single-file bundle at `plugin/bin/geas`
- `--cwd` flag no longer required for worktree agents (auto-detection via git)

### Changed
- CLI uses esbuild single-file bundle with embedded JSON schemas (no runtime fs reads)
- `resolveGeasDir` uses `git rev-parse --git-common-dir` to always find main repo `.geas/`, even in worktrees
- Setup Phase 0 simplified: no more `npm install && npm run build` — CLI is pre-bundled
- All worktree Agent() prompts simplified: `geas` replaces `node {project_root}/plugin/cli/index.js --cwd {project_root}`
- Pipeline `remaining_steps` now includes `integration` step
- `integrated` state transition moved to worktree merge point (after gate pass)
- Building→Polishing transition now clears checkpoint and current_task_id
- Evolving phase: `phase: complete` must be set last (triggers CLI auto-cleanup)
- Setup: `.geas/` gitignore is now user's choice (not forced)

### Added
- `plugin/bin/geas` — single-file CLI bundle, auto-registered in PATH by Claude Code
- `drafted → ready` transition explicitly added to pipeline Start Task
- Integration step in pipeline: merge + worktree cleanup after gate pass
- Mission SKILL.md Gotchas section (4 items: TaskCreate confusion, lightweight mode, orchestrate-only, commit≠skip)
- Lightweight mode clarification in specifying.md
- CLI `state update --field phase --value complete` auto-clears mission_id, mission, completed_tasks
- Help skill mandatory display rule

### Fixed
- Help skill output not displayed to user (just said "displayed")
- CLI commands failing after `cd plugin/cli` changed session CWD
- Stale CLI builds causing "unknown command" errors

### Removed
- `plugin/cli/` directory (replaced by `src/cli/` + `plugin/bin/geas`)
- Setup Phase 0 CLI build step (no longer needed)
- Worktree `--cwd` requirement in all skill files

## [0.6.0] — 2026-04-09

Skill-schema alignment, process UX improvements, naming unification, and skill optimization.

### Security
- CLI path traversal defense: validateIdentifier() + assertContainedIn() on 7 commands
- Replace silent sanitization with rejection in memory, packet, decision commands
- .geas/ write-block hook (PreToolUse) prevents direct Write/Edit to runtime state

### Changed
- Agent type naming unified to hyphens across schemas, agents, profiles, CLI, examples
- Agent Name Rule in CLAUDE.md updated (hyphen-only convention)
- Intake skill now asks for mode (lightweight/standard/full_depth) explicitly
- Setup skill uses CLI-only writes (state init, memory init-rules)
- Evolving phase has checkpoint management for all agent spawns
- All 13 skills have Input/Output sections

### Added
- /geas:help skill with usage guide, commands, and workflow explanation
- task-contract schema: dependencies array field
- mission-spec schema: existing_project source enum
- task-compiler/references/examples.md with annotated examples
- CLI commands: state init, memory init-rules
- VALID_PHASES enum validation in evolution.ts

### Fixed
- Skill-schema mismatches: scope.surfaces, concrete agent types, field names
- Specifying phase had exactly one task-list approval (no double approval)

### Documentation
- SKILLS.md and HOOKS.md updated with help skill and write-block hook
- Protocol example files updated to use hyphenated agent names

## [0.5.1] — 2026-03-30

Previously v2.0.1.

- Legacy cleanup: CLI bug fixes, dead code removal, stale reference fixes
- Protocol version bumped to v1
- Tag restructuring from v1.x/v2.x to v0.x.y

## [0.5.1] — 2026-03-30

Previously v2.0.1.

- Enhanced evolving phase: detailed mission complete briefing with task results, scope delivery, metrics
- Schema fixes: design-brief depth, run-state mission_id, debt-register sync
- Schema sync: 10 skill-local schemas aligned to protocol canonical
- Specifying enhancements: detailed task list approval output, 3-tier design brief depth
- Intake enhancements: domain_profile, mode, done_when, risk_notes, affected_surfaces
- Replaced legacy SW terminology: arch_review → design_review, code_review → specialist_review

## [0.5.0] — 2026-03-28

Previously v2.0.0. Domain-agnostic restructure.

- Agent split: authority/ (3) + software/ (5) + research/ (6)
- Slot-based agent routing via domain profiles
- Enhanced agent personas: anti-patterns, priority checklists, self-checks
- Skills consolidated to flat structure (12 core skills)
- Reference docs (AGENTS.md, SKILLS.md, HOOKS.md) synced EN + KO
- CLAUDE.md updated for domain-agnostic wording

## [0.4.0] — 2026-03-22

Previously v1.2.0.

- Agent absorption: repository-manager and process-lead absorbed into orchestrator
- Agent count reduced from 12 to 10 (later expanded to 14 with research agents)
- Pipeline updated for orchestrator-direct git operations
- Korean mirror synced for agent absorption

## [0.3.1] — 2026-03-20

Previously v1.1.1.

- Hook migration to mission-scoped paths (verify-pipeline, verify-task-status, restore-context, protect-geas-state)

## [0.3.0] — 2026-03-19

Previously v1.1.0.

- Directory migration: all artifacts moved to `.geas/missions/{mission_id}/`
- Skills, hooks, and reference docs migrated to new path structure
- Vote-round schema path migration

## [0.2.1] — 2026-03-17

Previously v1.0.1.

- Removed stale seed.json references across docs and skills
- Clarified mission vs mission_id in run.json

## [0.2.0] — 2026-03-15

Previously v1.0.0.

- Replaced seed.json with per-mission spec files (`.geas/missions/{mission_id}/spec.json`)
- Renamed seed.schema.json to mission-spec.schema.json
- Enhanced README for clarity and governance description
- Added mission briefing step to evolving phase

## [0.1.0] — 2026-03-10

Initial structured release.

- Core protocol: 12 documents (00-11)
- 16 JSON Schemas (draft 2020-12)
- Parallel dispatch skill
- Vote round as parallel voting skill
- Run-state schema for session checkpoint
- Basic mission lifecycle: specifying → building → polishing → evolving
