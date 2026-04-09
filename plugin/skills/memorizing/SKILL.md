---
name: memorizing
description: Memory management — extract learnings from retrospectives, update rules.md and agent memory notes. 2-file model for simplicity and directness.
---

# Memorizing

Manages project memory through two files: `.geas/rules.md` (project-wide rules) and `.geas/memory/agents/{agent}.md` (agent-specific notes). Orchestrator invokes this skill after retrospective (per-task extraction) and during Evolving (batch review).

## Inputs

- **record.json `retrospective` section** — contains `memory_candidates[]` from per-task retrospective
- **`.geas/rules.md`** — current project-wide rules (for deduplication)
- **`.geas/memory/agents/*.md`** — current agent notes (for deduplication)
- **Task ID** — source task for tracing extracted learnings

## Output

- **Updated `.geas/rules.md`** — new or strengthened project-wide rules (with `[DRAFT]` prefix until promoted)
- **Updated `.geas/memory/agents/{agent}.md`** — new or strengthened agent-specific notes
- **Event log entries** — `memory_extracted`, `memory_reviewed`, or `memory_cleanup` events in `events.jsonl`

---

## When to Use

- **Per-task**: After retrospective completes, extract learnings from `memory_candidates[]` in the retrospective section of record.json
- **Evolving phase**: Batch review of rules.md and agent notes — trim stale content, resolve contradictions
- **Wrap-Up**: Inline extraction for single-task executions
- **Session start**: Review rules.md for staleness

## Memory Files

```
.geas/
├── rules.md              # Project-wide rules ALL agents follow
└── memory/
    └── agents/           # Per-agent memory notes
        ├── software-engineer.md
        ├── design-authority.md
        ├── quality-specialist.md
        └── ...
```

**Two states only**: `draft` (proposed, not yet reviewed) and `active` (reviewed and applied). Draft items are appended with a `[DRAFT]` prefix in rules.md or agent notes. After review, the prefix is removed.

## 1. Extract Learnings

Input: record.json `retrospective` section → `memory_candidates[]`

For each candidate string in `memory_candidates[]`:

1. Classify the learning:
   - **Project-wide rule** — applies to all agents (conventions, patterns, failure lessons, architecture decisions)
   - **Agent-specific note** — applies to a specific agent type (workflow tips, domain expertise, role-specific patterns)

2. Determine the target:
   - Project-wide → append to `.geas/rules.md`
   - Agent-specific → append to `.geas/memory/agents/{agent}.md`

3. Write the learning:

   **For rules.md** (use Write tool to append):
   ```markdown
   ## [DRAFT] {Short title}
   {Learning description from retrospective}
   Source: task-{task-id}
   ```

   **For agent notes** (use CLI):
   ```bash
   Bash("geas memory agent-note --agent {agent-name} --add '[DRAFT] {learning description}'")
   ```

4. Log the event:
   ```bash
   Bash("geas event log --type memory_extracted --data '{\"target\":\"rules.md|agents/{agent}.md\",\"source_task\":\"{task-id}\"}'")
   ```

### Classification Guide

| Pattern | Target | Section in rules.md |
|---------|--------|-------------------|
| Failure/bug pattern | rules.md | `## Failure Lessons` |
| Architecture decision | rules.md | `## Architecture` |
| Security finding | rules.md | `## Security` |
| Project convention | rules.md | `## Code` |
| Build/test approach | rules.md | `## Code` |
| Agent workflow tip | agents/{agent}.md | — |
| Agent-specific learning | agents/{agent}.md | — |
| Role-specific pattern | agents/{agent}.md | — |

### Automatic Extraction Triggers

Check during retrospective review:
- Same failure class repeats 2+ times across tasks → auto-extract to rules.md
- Same reviewer concern across 2+ tasks → auto-extract to rules.md
- `confidence <= 2` in record.json `self_check` repeats 2+ times for same `task_kind` → auto-extract to relevant agent note

## 2. Deduplication

Before adding a new entry:

1. Read `.geas/rules.md` (or the target agent note)
2. Compare the candidate against existing entries
3. **If semantically similar rule exists**: strengthen the existing rule with the new evidence instead of adding a duplicate. Append the task reference.
4. **If no match**: proceed with new entry

## 3. Review and Promotion

### Per-task (inline)

After extraction, `orchestration-authority` reviews each `[DRAFT]` item:
- **Promote**: Remove `[DRAFT]` prefix — the rule is now active
- **Reject**: Remove the entry entirely
- **Defer**: Keep as `[DRAFT]` for batch review during Evolving

### Evolving phase (batch)

During the Evolving phase, review all `[DRAFT]` items across both files:

1. Read `.geas/rules.md` — find all `[DRAFT]` entries
2. Read all `.geas/memory/agents/*.md` — find all `[DRAFT]` entries
3. For each draft:
   - Has supporting evidence from 2+ tasks → promote (remove `[DRAFT]`)
   - Single-task evidence but clearly useful → promote
   - No longer relevant or contradicted → remove
4. Log promotions/removals:
   ```bash
   Bash("geas event log --type memory_reviewed --data '{\"promoted\":N,\"removed\":N}'")
   ```

## 4. Staleness Detection

Run during Evolving phase or at session start:

1. Read `.geas/rules.md` — check for rules that may be outdated
2. Read `.geas/memory/agents/*.md` — check for stale notes
3. Indicators of staleness:
   - Rule references files/paths that no longer exist
   - Rule contradicts current project conventions
   - Agent note references deprecated patterns
4. Remove or update stale entries
5. Log: `Bash("geas event log --type memory_cleanup --data '{\"stale_removed\":N}'")` 

## 5. Contradiction Resolution

When rules in `.geas/rules.md` contradict each other:

1. Identify the conflicting rules
2. Determine which has more supporting evidence (more task references)
3. Keep the stronger rule, remove or revise the weaker one
4. If unclear, `orchestration-authority` makes the call
5. Log the resolution

## Conflict Resolution Priority

When rules conflict: **rules.md** > **agent-specific notes**

Rules.md is the single source of truth for project-wide behavior. Agent notes supplement but never override rules.md.
