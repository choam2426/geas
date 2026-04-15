# 07. Memory and Retrospective

> **Normative document.**
> This document defines the purpose, structure, retrospective loop, and retrieval rules for memory in Geas.

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

## Storage Structure

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
- Always verify acceptance_criteria against the delivered evidence before approving
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

These stored updates originate from the retrospective loop that runs after every passed task.

## Per-Task Retrospective Loop

After every `passed` task, the project SHOULD produce a retrospective or retrospective contribution. The retrospective captures what happened during the task so that future tasks benefit from the experience.

### Minimum retrospective topics

Each retrospective SHOULD address at least the following areas:

| topic | what to capture |
|---|---|
| `what_went_well[]` | practices, tools, or decisions that produced good outcomes |
| `what_broke[]` | failures, regressions, or unexpected problems |
| `what_was_surprising[]` | assumptions that turned out wrong, unexpected complexity |
| `rule_candidates[]` | behavioral changes that would prevent repeated problems |
| `memory_candidates[]` | lessons worth preserving for future context |
| `debt_candidates[]` | compromises that need explicit tracking |
| `next_time_guidance[]` | concrete advice for the next similar task |

A retrospective SHOULD be concrete. "Need to be more careful" is too weak. "Auth endpoints without rate limits keep failing challenge review" is useful.

### Memory Candidate Sources

Memory candidates originate from:

| source | destination |
|---|---|
| task retrospective `memory_candidates` | `rules.md` (project-wide) or agent memory (role-specific) |
| challenger review `concerns` | `rules.md` as learned rules |
| worker self-check `known_risks` | agent memory for that worker type |
| specialist review findings | agent memory for that specialist type |

## Retrospective to Rule Update

When retrospectives surface recurring problems, the project should consider converting those patterns into enforceable rules.

### When a rule candidate is justified

Rule candidates are especially justified when:

- the same failure repeats
- the same reviewer concern repeats
- the same recovery mistake repeats
- the same scope-control drift repeats
- a clear behavior change would have prevented the problem

### Rule approval expectations

A rule SHOULD have:

| requirement | purpose |
|---|---|
| supporting evidence | proves the problem is real and recurring |
| clear behavior impact | states what changes because of the rule |
| an owner | someone responsible for enforcement |
| scope statement | where and when the rule applies |
| enforcement plan | how the rule will be surfaced or checked |

### Behavior-change requirement

A rule is not complete until the project can explain what will change because of it, such as:

- stricter contract checklist
- review checklist addition
- gate focus change
- scheduler caution
- packet-builder pinning

## Agent Memory Feedback Loop

Per-agent markdown files at `memory/agents/{agent}.md`:

- **Injected** into the agent's context at invocation time
- **Updated** by the agent itself before exiting (via `geas memory agent-note`)
- **Scope**: project-wide, persists across missions and sessions

Software domain example:

```markdown
# Design Authority Memory

- Review must reference each acceptance_criterion explicitly (task-001 finding)
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

Role-specific lessons SHOULD become agent memory. Cross-role lessons SHOULD become project memory or rules.

### Role-specific lesson criteria

A lesson is role-specific when it primarily relates to:

- a tool or technique used mainly by that slot
- an artifact produced mainly by that slot
- a recurring review blind spot for that slot
- a recurring domain-specific success pattern for that slot

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

## Harmful Reuse Rollback

When the team sees a repeated harmful pattern caused by prior guidance:

1. identify the memory or rule involved
2. move the memory to review if needed
3. update the rule if needed
4. record the negative pattern explicitly
5. verify that future packets stop propagating the bad guidance

A system that keeps reusing harmful guidance without rollback is not evolving.

## Mission-to-Mission Carry Forward

Evolution outputs SHOULD influence the next mission through:

- task templates
- rules
- rules.md and agent memory
- debt priorities
- reviewer focus

Mission close is therefore not an ending; it is a handoff.

## Privacy

Memory MUST NOT store raw secrets, credentials, personal data, or security-sensitive exploit details beyond operational need. Abstract sensitive lessons — retain behavioral guidance without sensitive specifics.

## Key Statement

Memory in Geas is two files and one loop: `rules.md` for what the team learned, agent memory for what each role learned, and the retrospective loop for converting task experience into durable guidance. Everything else is ceremony.
