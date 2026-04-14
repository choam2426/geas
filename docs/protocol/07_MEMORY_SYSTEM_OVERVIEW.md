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

Software project example:

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

Research project example:

```markdown
## Project Conventions
- APA 7th edition citation format
- All statistical claims require effect size + confidence interval

## Learned Rules
- Survey instruments must be pilot-tested before full deployment
- Mixed-methods designs require explicit integration point documentation

## Role-Specific Rules
### methodology-reviewer
- Check for Type I error inflation in multiple comparisons
```

Content project example:

```markdown
## Project Conventions
- AP Stylebook for news content, Chicago Manual for long-form
- All claims require two independent sources

## Learned Rules
- Embedded quotes must be verified against primary source, not secondary citations
- Image alt text must convey informational content, not decorative description

## Role-Specific Rules
### fact-checker
- Flag statistical claims that lack original study citation
```

Updated via the Evolving phase rules-update workflow. Injected into every agent context via the `inject-context.sh` hook.

### Agent memory

Per-agent markdown files at `memory/agents/{agent}.md`:

- **Injected** into the agent's context at invocation time
- **Updated** by the agent itself before exiting (via `geas memory agent-note`)
- **Scope**: project-wide, persists across missions and sessions

Software domain example:

```markdown
# Design Authority Memory

- Review must include rubric_scores (task-001 finding)
- FTS5 index scope: title+description only, not code (mission-AQeKIOxC)
```

Research domain example:

```markdown
# Methodology Reviewer Memory

- Always verify sample size justification against stated power analysis (task-003 finding)
- Longitudinal designs: check for attrition bias at each measurement wave (mission-R7kL9mQx)
```

Content domain example:

```markdown
# Editor Memory

- Headlines over 70 chars get truncated in social previews — flag during review (task-012 finding)
- Listicle formats must still have narrative thread, not just bullet accumulation (mission-C4nT8pRw)
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
