---
name: setup
description: First-time setup — initialize .geas/ runtime directory, generate config files.
---

# Setup

Compass should invoke this automatically on the first natural-language request in a new project.

Users should not need to run setup manually unless they are troubleshooting.

## Steps

### Phase A: Initialize `.geas/` Runtime Directory

Before anything else, create the runtime directory structure in the project root:

```bash
mkdir -p .geas/spec .geas/state .geas/tasks .geas/contracts .geas/packets .geas/evidence .geas/decisions .geas/decisions/pending .geas/ledger .geas/summaries .geas/memory/_project .geas/memory/retro .geas/memory/agents
```

Write the initial debt tracking file `.geas/debt.json`:
```json
{"items": []}
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
  "mode": null,
  "phase": null,
  "current_task_id": null,
  "completed_tasks": [],
  "decisions": [],
  "created_at": "<ISO 8601 now>"
}
```

### Phase A-2: Generate `.geas/rules.md`

Write `.geas/rules.md` — the shared rules that ALL agents must follow:

```markdown
# Agent Rules

## Evidence
- Write results to .geas/evidence/{task-id}/{your-name}.json as JSON
- Required fields: agent, task_id, summary, files_changed, created_at
- created_at is auto-injected by the PostToolUse hook. No manual timestamp needed.

## Code
- Respect prohibited_paths from the TaskContract
- Do not modify files outside the task scope
```

### Phase B: Report Results

```
Setup complete:
- .geas/: initialized (spec, state, tasks, contracts, packets, evidence, decisions, ledger, summaries, memory)
- Config: .geas/config.json saved

Ready! Stay in Claude and describe your mission in natural language.
```
