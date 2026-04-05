# 07. Memory System Overview

> **Normative document.**
> This document defines the purpose, scope, admissibility, confidence model, and behavioral role of memory in Geas.

## Purpose

Geas memory exists to change future behavior, not to accumulate notes. A memory system is conformant only if stored lessons can materially improve future task execution, review quality, recovery, or scope control.

Core goals:

| goal | description |
|---|---|
| prevent recurrence | stop the same failures from happening again |
| reuse success | apply verified successful patterns to new work |
| accelerate recovery | resume safely after interruptions using retained context |
| improve review | sharpen reviewer focus with historical insight |
| reduce noise | eliminate wasteful context stuffing through selective retrieval |
| preserve knowledge | retain operational knowledge without turning it into stale lore |

## Core Principles

### 1) Memory evolves

No memory item is born as truth. Items progress through states and must earn durability through evidence and reuse. A freshly extracted lesson has minimal authority until it has been validated in practice.

### 2) Memory weakens without evidence

A memory item with insufficient evidence, successful reuse, or review support MUST NOT be treated as strong guidance. Trust decays when supporting evidence is absent or contradicted.

### 3) Memory has scope

Every memory item MUST declare where it applies. Scope is part of trustworthiness -- a lesson learned in one project context may not transfer safely to another without explicit validation.

### 4) Memory enters context under budget

Memory retrieval MUST be selective. The packet builder SHOULD optimize for relevance, provenance, and freshness rather than volume. Overloading context with marginally relevant memories degrades rather than improves decision quality.

### 5) Memory is re-evaluated after use

Successful or harmful application MUST feed back into confidence and state changes. Memory that was applied and produced good outcomes earns trust; memory that was applied and produced harm loses it.

### 6) Memory must connect to a behavior surface

A memory item that changes nothing is non-functional. Memory SHOULD influence at least one of the following surfaces:

| behavior surface | example influence |
|---|---|
| rules | new or updated entries in `.geas/rules.md` |
| packet content | prioritized inclusion in context packets |
| reviewer focus | added checklist items or review emphasis |
| gate strictness | tighter or looser evidence thresholds |
| scheduling caution | avoidance of known-risky parallel combinations |
| recovery heuristics | improved recovery decision-making |

## Memory Layer Model

The memory system organizes information into logical layers. Each layer serves a distinct temporal and contextual purpose. Projects MAY implement fewer physical stores, but they SHOULD preserve the semantic distinction between layers.

| layer | primary use | typical lifespan |
|---|---|---|
| `session_memory` | current-session tactical continuity | single session |
| `task_focus_memory` | dense task-local carry-forward | single task |
| `mission_memory` | lessons relevant to the current mission | single mission |
| `episodic_memory` | history of specific incidents or runs | medium-term |
| `project_memory` | durable project-wide patterns | long-term |
| `agent_memory` | role-specific guidance | long-term |
| `risk_memory` | patterns tied to repeated hazards or sensitive surfaces | long-term |

### Agent memory mechanism

Agent memory is implemented as per-agent markdown files at `.geas/memory/agents/{agent_type}.md`. These files are:

- **read**: included in the agent's context packet at invocation time
- **written**: by the Orchestrator during retrospective, based on memory_suggestions from specialist reviews, challenge reviews, and worker self-checks
- **format**: free-form markdown, fully rewritten on each update
- **scope**: project-wide, persists across missions and sessions

Agent memory is the simplest memory mechanism in Geas. A plain file that the agent reads before working and the Orchestrator updates after learning what was useful.

## Memory Scope

Every memory item declares a scope that controls where it applies and how broadly it can influence behavior. Broader scope requires stronger justification.

| scope | applies to | justification level |
|---|---|---|
| `task` | a single task | minimal -- direct observation suffices |
| `mission` | the current mission | moderate -- pattern should recur across tasks |
| `project` | the entire project | strong -- pattern is durable and project-wide |
| `agent` | a specific agent role | strong -- role-specific and validated |
| `global` | all projects | very strong -- rare, requires broad evidence |

Rules:

- `global` scope SHOULD be rare.
- A memory MUST NOT be promoted to broader scope simply because it was memorable.

## Memory Admissibility

Not every observation deserves to become a memory item. Admissibility criteria prevent the memory system from filling with noise.

A memory candidate SHOULD only enter the system when it can answer all of the following:

| question | purpose |
|---|---|
| What happened? | establishes the factual basis |
| What evidence supports this lesson? | prevents unsupported claims |
| What surface does it apply to? | ensures actionability |
| How should it change future behavior? | confirms operational value |
| What would falsify or weaken it? | enables future re-evaluation |

A candidate SHOULD be rejected or kept weak if it is:

- generic motivational advice
- unsupported by artifacts
- contradicted by recent stronger evidence
- a one-off stylistic preference with no operational consequence

## Confidence Scoring Model

Confidence quantifies how much trust the system places in a memory item. It is derived from evidence count and modified by reuse outcomes.

### Initial confidence

| evidence references | initial confidence |
|---|---|
| 1 | `0.4` |
| 2 | `0.6` |
| 3 or more | `0.8` |

### Modifiers

| event | confidence change |
|---|---|
| successful reuse | `+0.1` |
| failed reuse | `-0.1` |
| contradiction | `-0.2` |

### Bounds

Confidence is bounded between `0.0` (minimum) and `1.0` (maximum).

### Rules

- If confidence drops below `0.3`, review SHOULD trigger.
- Confidence alone MUST NOT override state or freshness rules.
- A stale but high-confidence memory still requires re-evaluation.

## Freshness and Review-After

Memory items carry a `review_after` date that signals when re-examination is due. Past the review date, the memory SHOULD be re-examined before strong reuse.

| memory state | default review interval |
|---|---|
| provisional | promotion date + 90 days |
| stable | promotion date + 180 days |

## Ownership Rules

Each memory category has a typical owner responsible for its accuracy and relevance. Ownership does not imply unilateral truth -- promotion rules still apply regardless of who owns the item.

| memory category | typical owner |
|---|---|
| project-wide delivery pattern | Orchestrator with domain endorsement |
| design precedent | Design Authority |
| quality lesson | Quality Specialist |
| security pattern | Risk Specialist |
| documentation / operations lesson | Communication Specialist |
| cross-role process rule | Orchestrator / process owner |

## Behavior-Change Surfaces

Memory SHOULD influence one or more of the following surfaces. If none of these surfaces change, the memory is likely archival rather than operational.

| surface | how memory influences it |
|---|---|
| `.geas/rules.md` | new rules or updated existing rules |
| packet-builder prioritization | higher relevance scores for related context |
| reviewer checklists | added or emphasized review items |
| task admission caution | flagging known-risky task patterns |
| gate or readiness focus | adjusted evidence thresholds |
| recovery heuristics | improved recovery path selection |
| debt triage focus | priority adjustments based on past patterns |

## Privacy and Sensitivity Rules

Memory MUST NOT become a shadow secrets store. The memory system stores operational lessons, not sensitive data.

Implementations SHOULD avoid storing:

- raw secrets
- credentials
- unnecessary personal data
- security-sensitive exploit details beyond what is needed operationally
- vendor-prohibited or policy-prohibited retained content

Sensitive operational lessons SHOULD be abstracted where possible -- retain the behavioral guidance without the sensitive specifics.

## Contradictions and Harmful Reuse

A contradiction is evidence that a memory item's claimed behavior may no longer hold. Harmful reuse is when applying the memory worsens outcomes. Both require explicit handling rather than silent coexistence.

Rules:

- Contradictions MUST be recorded.
- Repeated harmful reuse SHOULD move the memory into `under_review`.
- Superseded or under-review memory MUST NOT be treated as pinned guidance.
- Contradictory stable memories SHOULD trigger explicit review rather than coexisting without resolution.

## Failure Modes and Recovery

The memory system must handle its own failure modes gracefully. Each failure mode has a defined recovery path.

| failure mode | recovery behavior |
|---|---|
| missing or corrupted index | rebuild from canonical entries and logs where possible; mark resulting confidence as conservative |
| packet references non-existent memory | treat the packet as stale and regenerate it |
| confidence reaches zero | archive the item or require explicit review before further use |
| contradictory stable memories coexist | both move to review unless a documented precedence relation exists |
| required authority absent | promotion MAY be deferred; the item remains candidate or provisional rather than becoming strong memory without authorization |

## Key Statement

Memory in Geas is a governed feedback mechanism. It earns trust through evidence, loses trust through contradiction, and survives only if it continues to improve future work.
