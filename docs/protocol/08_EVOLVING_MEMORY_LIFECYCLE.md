# 08. Evolving Memory Lifecycle

> **Normative document.**
> This document defines the state machine and procedures by which lessons become durable memory, decay, supersession, or archival material.

## Purpose

The lifecycle prevents two opposite failure modes:

- **Lesson loss**: valuable lessons never promoted, eventually forgotten.
- **Premature rigidity**: weak anecdotes turned into rigid pseudo-rules too early.

A conformant lifecycle ensures that memory items earn durability through evidence and weaken without it.

## Memory Evolution States

Every memory item occupies exactly one of eight canonical states. These states form the backbone of the promotion, decay, and retirement pipeline.

| State | Description |
|---|---|
| `candidate` | Newly extracted lesson with limited confidence. Not yet trusted for reuse. |
| `provisional` | Accepted for limited use with bounded trust. Awaiting further evidence or successful reuse. |
| `stable` | Sufficiently supported by evidence and reuse. Safe for general application within its declared scope. |
| `canonical` | Highly trusted, repeatedly validated. Often mapped into rules or pinned guidance. Projects should keep canonical items small in number. |
| `under_review` | Temporarily withheld from normal trust because contradictions or harmful reuse require examination. |
| `decayed` | Previously useful, now stale or weak. Requires fresh evidence or explicit review before returning to active use. |
| `superseded` | Replaced by a newer or stronger lesson covering the same behavior surface. Retained for history. |
| `archived` | Retained for historical reference only. Not included in active retrieval. |

## Source Signals

Memory candidates may be extracted from operational artifacts produced during mission execution. The following are typical sources:

| Source | Example |
|---|---|
| Retrospectives | End-of-mission or end-of-phase reviews |
| Failure records | Evidence gate failures, verify-fix-loop exhaustion |
| Specialist reviews | Challenger, Quality Specialist, or Risk Specialist findings |
| Gate results | Patterns in pass/fail/block outcomes |
| Recovery incidents | Session recovery issues with repeat risk |
| Debt patterns | Recurring entries in the debt register |
| Decision records | Structured decisions with outcome data |
| Gap assessments | Repeated planning or capability gaps |

Candidates SHOULD NOT be extracted from pure speculation unsupported by artifacts.

## Per-Task Evolution Loop

After a task reaches `passed`, the evolution loop attempts to capture and refine lessons. This loop is the primary mechanism by which operational experience becomes reusable memory.

| Step | Action |
|---|---|
| 1 | Lesson extraction from task artifacts |
| 2 | Candidate deduplication and merge |
| 3 | Routing to owner or endorsing authority |
| 4 | Promotion or defer decision |
| 5 | Application logging on future reuse |

A task that never emits any lesson is acceptable. A task that repeatedly emits the same lesson without converging indicates a process failure.

## Candidate Extraction Rules

Not every observation deserves memory status. Extraction rules distinguish actionable lessons from noise.

### Acceptable for automatic extraction

- Repeated failure pattern with clear evidence
- Repeated reviewer concern across multiple tasks
- Successful pattern with obvious reuse value
- Recovery issue with repeat risk
- Gap-assessment pattern that can change future planning

### Not acceptable for automatic extraction

- Purely subjective preference without operational consequence
- Unresolved controversy with no evidence weighting
- One-off novelty with no repeat or transfer value
- Content prohibited by local retention policy

## Minimum Candidate Fields

A candidate record captures the lesson, its provenance, and the proposed behavior change. At minimum, a candidate SHOULD contain:

| Field | Purpose |
|---|---|
| `memory_id` | Unique identifier |
| `summary` | Human-readable description of the lesson |
| `scope` | Where the lesson applies (task, mission, project, agent, global) |
| `source_artifact_refs[]` | Links to the evidence that supports this lesson |
| `confidence` | Numeric trust score (0.0 -- 1.0) |
| `proposed_behavior_change` | How future behavior should change if this lesson is applied |
| `owner_type` | Which agent slot owns this memory item |
| `state` | Current lifecycle state |
| `created_at` | Timestamp of extraction |

## Promotion Pipeline

The promotion pipeline moves a memory item from raw extraction through review to active use. Each stage adds confidence or filters out weak candidates.

| Stage | Name | Description |
|---|---|---|
| 1 | Candidate creation | The extractor records the lesson and links it to source evidence. |
| 2 | Dedupe / merge | Equivalent or overlapping candidates are merged to avoid memory bloat. |
| 3 | Review | The appropriate authority or reviewer evaluates evidence sufficiency, scope correctness, transferability, risk of over-generalization, and expected behavior impact. |
| 4 | Promotion | The item advances to the next state only when current-state minimum requirements are met. |
| 5 | Application logging | Once used in future work, the system records whether the memory helped, was neutral, or harmed. |
| 6 | Reinforcement / weakening | Confidence and state may change based on real reuse outcomes. |

## Promotion Rules

Each state transition has specific requirements. Promoting without meeting these requirements undermines memory trust.

### `candidate` to `provisional`

Recommended when:

- Evidence exists linking the lesson to a real artifact
- The lesson appears useful for future work
- Transferability is plausible
- No strong contradiction exists

### `provisional` to `stable`

Recommended when:

- The item has been reused successfully at least once, or has strong multi-source evidence
- Owner review agrees that scope is correct
- Contradiction count is low or zero

### `stable` to `canonical`

Recommended only when all of the following hold:

- Successful reuse is repeated across multiple tasks or missions
- The lesson has remained valid across time or contexts
- The item strongly influences future process, safety, or quality
- Stronger assurance profiles require it as pinned guidance

A project SHOULD keep the number of canonical items small.

## Rules.md Update Loop

Some memories deserve rule status. When a lesson should change behavior globally or semi-globally -- rather than merely appear in context packets -- it becomes a rule candidate.

### Rule candidate sources

- Repeated failure pattern
- Repeated reviewer omission
- Repeated recovery mistake
- Repeated scope-control issue
- Repeated safety or quality blind spot

### Rule update conditions

A rule candidate SHOULD require one or more of:

- Supporting evidence from multiple tasks
- Zero unresolved contradiction
- Owner endorsement
- Explicit rationale for the expected behavior change

### Rule application

When a rule is approved, the implementation SHOULD specify how it changes one or more of:

| Surface | Example change |
|---|---|
| Task compiler defaults | New classification or routing rule |
| Contract checklist | Additional acceptance criterion |
| Review checklist | New focus area for specialist reviewers |
| Gate focus | Adjusted evidence requirements |
| Readiness-round triggers | New readiness condition |
| Recovery handling | Modified recovery heuristic |

## Agent Memory Improvement Path

Role-specific lessons SHOULD prefer `agent_memory` when:

- The lesson is primarily about that slot's review or implementation behavior
- The artifact type is primarily produced by that slot
- The lesson improves specialist checklists more than global process

Otherwise, prefer project-level memory.

## Confidence and Freshness

Confidence and freshness are related but distinct dimensions of memory trust.

| Dimension | Question it answers |
|---|---|
| Confidence | "How much should we trust this lesson?" |
| Freshness | "How likely is this lesson still current?" |

A memory may be high-confidence but low-freshness (e.g., a well-evidenced lesson about an interface that has since been redesigned). In such cases, reuse SHOULD be conservative until freshness is reaffirmed.

## Decay Rules

A memory SHOULD be considered for the `decayed` state when:

- `review_after` has passed without reaffirmation
- Contradiction count grows
- Reuse count remains zero for too long
- The surrounding project structure or architecture changed materially

### Decayed-state exit

A decayed memory may return to stronger states only after fresh supporting evidence or explicit review. The system MUST NOT automatically restore a decayed item without new justification.

## Supersession

A memory becomes `superseded` when a newer item more accurately covers the same behavior surface. Supersession preserves institutional history while preventing stale guidance.

| Rule | Description |
|---|---|
| History preservation | Supersession SHOULD preserve the old item's history |
| Forward reference | The replacement SHOULD reference the older item |
| Active use prohibition | Superseded memory MUST NOT be used as active guidance unless a recovery or audit workflow explicitly requests historical comparison |

## Negative Learning and Harmful Reuse

If reuse of a memory repeatedly harms outcomes, the system SHOULD:

1. Move the item to `under_review`
2. Record the negative applications
3. Inspect whether the scope was wrong, the lesson became stale, or the original evidence was weak
4. Decide whether to revise, decay, supersede, or archive it

Repeated harmful reuse SHOULD trigger rule or checklist review, not just memory review.

## Application Logging

The system SHOULD keep a `memory-application-log` or equivalent record. This log is essential for distinguishing elegant theory from actually useful guidance.

| Field | Description |
|---|---|
| `memory_id` | Which memory item was applied |
| `task_id` | The task where it was applied |
| `applied_at` | Where in the pipeline the memory was used |
| `effect` | `positive`, `neutral`, or `negative` |
| `notes` | Free-text explanation |
| `timestamp` | When the application occurred |

## Anti-Bloat Rules

A conformant implementation SHOULD actively control memory bloat. Without active management, memory stores grow without bound and retrieval quality degrades.

Recommended policies:

- Merge duplicates during candidate creation
- Archive dead low-value items periodically
- Keep canonical memory small
- Review zero-reuse items on a regular cadence
- Refuse promotion for vague advice without concrete behavior change

## Key Statement

The lifecycle is the immune system of Geas memory. Without promotion discipline, memory stays weak; without decay and supersession, memory becomes fossilized clutter.
