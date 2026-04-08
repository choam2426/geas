# 07. Memory System

> **Normative document.**
> This document defines the purpose, structure, and retrieval of memory in Geas.

## Purpose

Geas memory exists to change future behavior, not to accumulate notes. A memory system is conformant only if stored lessons materially improve future task execution, review quality, or recovery.

| goal | description |
|---|---|
| prevent recurrence | stop the same failures from happening again |
| reuse success | apply verified successful patterns to new work |
| accelerate recovery | resume safely after interruptions using retained context |
| improve review | sharpen reviewer focus with historical insight |

## Core Principles

1. **Memory must change behavior.** A memory that influences no rule, context, or decision is non-functional.
2. **Two storage locations.** `rules.md` for project knowledge, `memory/agents/*.md` for agent-specific notes.
3. **Selective injection over volume.** Both files are injected into agent context. Keep them concise.

## Structure

| storage | location | format | injected by |
|---|---|---|---|
| project knowledge | `.geas/rules.md` | markdown | `inject-context.sh` → all agents |
| agent notes | `.geas/memory/agents/{agent}.md` | markdown | `inject-context.sh` → matching agent |

### rules.md

Unifies project conventions, learned rules, and role-specific guidance:

```markdown
## Project Conventions
- TypeScript strict, ES2022, NodeNext
- React 19 + Vite

## Learned Rules
- FTS5 MATCH requires try-catch for malformed queries
- Category moves must check full subtree depth

## Role-Specific Rules
### reviewer
- Always include rubric_scores in evidence
```

Updated via the Evolving phase rules-update workflow. Injected into every agent context via the `inject-context.sh` hook.

### Agent memory

Per-agent markdown files at `memory/agents/{agent}.md`:

- **Injected** into the agent's context at invocation time
- **Updated** by the agent itself before exiting (via `geas memory agent-note`)
- **Scope**: project-wide, persists across missions and sessions

```markdown
# Design Authority Memory

- Review must include rubric_scores (task-001 finding)
- FTS5 index scope: title+description only, not code (mission-AQeKIOxC)
```

## Sources

Memory candidates originate from:

| source | destination |
|---|---|
| task retrospective `memory_candidates` | `rules.md` (project-wide) or agent memory (role-specific) |
| challenger review `concerns` | `rules.md` as learned rules |
| worker self-check `known_risks` | agent memory for that worker type |
| specialist review findings | agent memory for that specialist type |

## Admissibility

A memory candidate enters the system only when it can answer:

1. What happened? (factual basis)
2. What evidence supports this? (prevents unsupported claims)
3. How should it change future behavior? (operational value)

Reject candidates that are generic advice, unsupported by artifacts, or one-off preferences with no operational consequence.

## Retrieval

1. `rules.md` is always injected for all agents
2. `memory/agents/{agent}.md` is always injected for matching agent type

The two files are the complete memory surface.

## Privacy

Memory MUST NOT store raw secrets, credentials, personal data, or security-sensitive exploit details beyond operational need. Abstract sensitive lessons — retain behavioral guidance without sensitive specifics.

## Key Statement

Memory in Geas is two files: `rules.md` for what the team learned, and agent memory for what each role learned. Everything else is ceremony.
