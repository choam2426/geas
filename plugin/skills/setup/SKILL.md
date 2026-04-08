---
name: setup
description: First-time setup — initialize .geas/ runtime directory, generate config files.
---

# Setup

orchestration_authority should invoke this automatically on the first natural-language request in a new project.

Users should not need to run setup manually unless they are troubleshooting.

## Steps

### Phase 0: Ensure CLI Dependencies

Before any CLI commands can run, verify that the CLI's npm dependencies are installed. Check if `plugin/cli/node_modules` exists relative to the plugin directory. If it does not:

```bash
cd plugin/cli && npm install
```

If `plugin/cli/dist/main.js` also does not exist, the CLI must be built:

```bash
cd plugin/cli && npm run build
```

Skip this step if both `node_modules/` and `dist/main.js` already exist.

### Phase A: Initialize `.geas/` Runtime Directory

Before anything else, create the runtime directory structure in the project root. Use `mkdir -p` for the base directories that the CLI does not create (CLI commands create their own subdirectories on first write):

```bash
mkdir -p .geas/state .geas/state/task-focus .geas/ledger .geas/summaries .geas/memory/_project .geas/memory/agents .geas/memory/candidates .geas/memory/entries .geas/memory/logs .geas/memory/retro .geas/memory/incidents .geas/recovery
```

Write the initial memory index via CLI with schema validation:
```bash
Bash("geas memory index-update --data '{\"memory_id\":\"_init\",\"state\":\"candidate\",\"memory_type\":\"project_rule\",\"title\":\"init\",\"scope\":\"project\"}'")
```
Note: The CLI creates the initial memory-index.json structure automatically if it does not exist.

Write the initial health check via CLI:
```bash
Bash("geas health generate")
```
The CLI creates `.geas/state/health-check.json` with all 8 signals computed from current state.

Then ensure `.geas/` is gitignored. Check if `.gitignore` exists:
- If yes: append `.geas/` if not already present
- If no: create `.gitignore` with `.geas/` entry

Write the initial run state file (use Write tool — BOOTSTRAP EXCEPTION: CLI state commands expect this file to already exist, so initial creation must be direct):
```json
{
  "version": "1.0",
  "status": "initialized",
  "mission": null,
  "phase": null,
  "current_task_id": null,
  "completed_tasks": [],
  "decisions": [],
  "created_at": "<ISO 8601 now>"
}
```
Write to `.geas/state/run.json`.

After initial creation, all subsequent updates use the CLI:
```bash
Bash("geas state update --field status --value in_progress")
Bash("geas state update --field phase --value specifying")
```

The run state must conform to the RunState schema. Refer to the mission skill's `schemas/run-state.schema.json` for the full field list.

### Phase A-1.5: Codebase Discovery (Onboarding)

Phase A also includes codebase discovery — scan project structure, detect stack, and generate `.geas/memory/_project/conventions.md`. This absorbs the functionality of the former onboard skill.

1. Scan project root for configuration files (package.json, go.mod, pyproject.toml, Cargo.toml, Makefile, etc.)
2. Detect the project stack (language, framework, package manager, test runner)
3. Read existing build/lint/test commands from configuration files
4. Write `.geas/memory/_project/conventions.md` with detected conventions (use Write tool — BOOTSTRAP EXCEPTION: no CLI command for conventions.md, and this runs during initial setup before mission starts):
   - Build commands
   - Lint commands
   - Test commands
   - Dev server start command
   - Project structure notes

If the project is empty (no source files yet), write a minimal conventions.md noting that commands will be populated as the project develops.

### Phase A-1.6: Agent Memory Migration

If `.geas/memory/agents/` already exists with files from a previous version, migrate old agent type names:

| old file | action |
|---|---|
| `frontend_engineer.md` + `backend_engineer.md` | merge into `software_engineer.md` (concatenate with `---` separator) |
| `devops_engineer.md` | rename to `platform_engineer.md` |
| `critical_reviewer.md` | rename to `challenger.md` |
| `ui_ux_designer.md` | merge relevant content into `software_engineer.md` |
| `architecture_authority.md` | rename to `design_authority.md` |

Migration is best-effort. Log what was migrated. Do not delete originals until migration is confirmed successful.

If `.geas/memory/agents/` does not exist or has no old-named files, skip this step.

### Phase A-2: Generate `.geas/rules.md`

Write `.geas/rules.md` (use Write tool — BOOTSTRAP EXCEPTION: rules.md is created during initial setup before any CLI-driven workflow begins) — the shared rules that ALL agents must follow:

```markdown
# Agent Rules

## Evidence
- Write results to .geas/missions/{mission_id}/evidence/{task-id}/{your-name}.json as JSON (read mission_id from .geas/state/run.json)
- Required fields: agent, task_id, summary, files_changed, created_at
- created_at is auto-injected by the PostToolUse hook. No manual timestamp needed.

## Code
- Respect scope.paths from the TaskContract — only modify files within the declared scope
```

### Phase B: Report Results

```
Setup complete:
- .geas/: initialized (state, ledger, summaries, memory, recovery)
- Mission directories will be created by intake when the mission starts.

Ready! Stay in Claude and describe your mission in natural language.
```
