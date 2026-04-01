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

Write the initial debt register `.geas/state/debt-register.json` conforming to `docs/protocol/schemas/debt-register.schema.json`:
```json
{
  "version": "1.0",
  "artifact_type": "debt_register",
  "artifact_id": "dr-init",
  "producer_type": "orchestration_authority",
  "scope": "mission",
  "items": [],
  "rollup_by_severity": { "low": 0, "medium": 0, "high": 0, "critical": 0 },
  "rollup_by_kind": { "code_quality": 0, "architecture": 0, "security": 0, "docs": 0, "ops": 0, "test_gap": 0, "product_gap": 0 },
  "created_at": "<ISO 8601>"
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
  "mode": null,
  "phase": null,
  "current_task_id": null,
  "completed_tasks": [],
  "decisions": [],
  "created_at": "<ISO 8601 now>"
}
```

The run state must conform to `orchestrating/schemas/run-state.schema.json`. Refer to the schema for the full field list.

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

Ready! Stay in Claude and describe your mission in natural language.
```
