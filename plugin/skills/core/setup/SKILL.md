---
name: setup
description: First-time setup — initialize .geas/ runtime directory, generate config files.
---

# Setup

orchestration_authority should invoke this automatically on the first natural-language request in a new project.

Users should not need to run setup manually unless they are troubleshooting.

## Steps

### Phase A: Initialize `.geas/` Runtime Directory

Before anything else, create the runtime directory structure in the project root:

```bash
mkdir -p .geas/state .geas/state/task-focus .geas/ledger .geas/summaries .geas/memory/_project .geas/memory/agents .geas/memory/candidates .geas/memory/entries .geas/memory/logs .geas/memory/retro .geas/memory/incidents .geas/recovery
```

Write the initial memory index `.geas/state/memory-index.json` conforming to `schemas/memory-index.schema.json`:
```json
{
  "meta": {
    "version": "1.0",
    "artifact_type": "memory_index",
    "artifact_id": "mi-init",
    "producer_type": "orchestration_authority",
    "created_at": "<ISO 8601>"
  },
  "entries": []
}
```

Write the initial health check `.geas/state/health-check.json`:
```json
{
  "timestamp": "<ISO 8601>",
  "signals": []
}
```

Then ensure `.geas/` is gitignored. Check if `.gitignore` exists:
- If yes: append `.geas/` if not already present
- If no: create `.gitignore` with `.geas/` entry

Write the initial run state file `.geas/state/run.json`:
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

The run state must conform to the RunState schema. Refer to the orchestrating skill's `schemas/run-state.schema.json` for the full field list.

### Phase A-2: Generate `.geas/rules.md`

Write `.geas/rules.md` — the shared rules that ALL agents must follow:

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
