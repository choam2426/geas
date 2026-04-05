# 09. Memory Retrieval and Context Engine

> **Normative document.**
> This document defines how Geas retrieves memory, assembles context packets, guards against stale or hostile context, and preserves provenance under constrained context budgets.

## Purpose

The retrieval and context engine exists to deliver the **right** context, not the **most** context. Good context engineering -- the discipline of selecting, ordering, and presenting information to maximize decision quality -- is the central concern of this document. The engine should help the agent remember what matters without overwhelming the model or importing stale assumptions.

## Context Engineering

Context engineering is the practice of deliberately constructing the information environment for each agent interaction. Rather than stuffing all available information into a prompt, context engineering asks: what does this agent need to know right now, in what order, with what trust level?

The retrieval and context engine is the primary mechanism through which context engineering is implemented in Geas. Every design choice in this document -- priority bands, scoring, budgets, staleness rules -- serves the goal of optimal context assembly.

## Threat Model

The context engine MUST account for the following threats to decision quality:

| Threat | Description |
|---|---|
| Stale memory | Lessons that were once valid but no longer reflect current reality |
| Contradictory memory | Multiple memory items that give conflicting guidance |
| Low-value context bloat | Excessive context that dilutes attention from critical information |
| Misleading repository text | Repository content that contains incorrect or outdated claims |
| Outdated summaries | Session or task summaries that predate material changes |
| Hostile tool output | Tool outputs that contain misleading information or prompt injection |
| Accidental prompt injection | Instructions embedded in notes, docs, or memory text |
| Contract-conflicting memory | Memory that contradicts the current task's explicit constraints |

## Retrieval Inputs

A context assembly request SHOULD consider the following inputs when selecting and scoring memory items:

- Current mission phase
- Current task metadata
- Affected paths or surfaces
- Reviewer slot or worker slot
- Current mission mode
- Recent failures or debt
- Last safe boundary or recovery context
- Relevant rules
- Relevant memory entries

## Retrieval Priority Bands

Context is organized into four priority bands. When budget is constrained, higher bands are preserved at the expense of lower bands. This ordering is the most important structural guarantee of the context engine.

| Band | Name | Contents |
|---|---|---|
| **L0** | Pinned invariants | Foundational safety/integrity rules, current task acceptance criteria, current approved implementation contract, explicit phase constraints, active policy overrides or risk controls |
| **L1** | Task-local packet | Worker self-check, recent specialist reviews, current failure or debt notes, task-focus summary |
| **L2** | Applicable memory | Reusable lessons selected by scope, relevance, freshness, and confidence |
| **L3** | Drill-down references | Lower-priority supporting context fetched on demand when deeper investigation is needed |

## Memory Packet Structure

A memory packet SHOULD make the following information explicit rather than forcing the model to infer trust:

| Element | Purpose |
|---|---|
| Included items | Which memory items are in this packet |
| Selection rationale | Why each item was selected |
| Item state | Current lifecycle state of each item |
| Supporting evidence | What evidence backs each item |
| Contradictions | Whether any contradictions exist |
| Assembly timestamp | When the packet was assembled |

## Retrieval Scoring Heuristic

A project MAY implement a different formula, but the retrieval engine SHOULD consider at least the following scoring dimensions. A simple heuristic is acceptable so long as its behavior is understandable and auditable.

| Dimension | Description |
|---|---|
| Scope match | How well the memory's declared scope matches the current context |
| Path overlap | Whether the memory applies to the same surfaces or interfaces |
| Role match | Whether the memory is relevant to the consuming agent's slot |
| Mission-phase relevance | Whether the memory applies to the current phase |
| Recency / freshness | How recently the memory was created, reviewed, or reaffirmed |
| Confidence | The memory's trust score |
| Contradiction penalty | Reduction for items with known contradictions |
| Harmful-reuse penalty | Reduction for items with recorded negative application outcomes |

## Scope Match Calculation

Suggested interpretation:

- Exact task or mission match scores higher than project match, which scores higher than global match.

Broad scope should not crowd out narrow, current context. A global lesson is less likely to be precisely relevant than a task-specific one.

## Path Overlap Calculation

A memory item tied to the same surface or nearby interface SHOULD score higher than one tied only to the same broad domain. For example, a lesson about a specific API endpoint is more relevant to a task modifying that endpoint than a general lesson about API design.

## Freshness Calculation

A packet builder SHOULD discount items that are:

- Past `review_after` without reaffirmation
- Contradicted recently
- Superseded by a newer item
- Linked to paths or surfaces that no longer exist or have materially changed

## Slot-Specific Budgets

Different agent slots need different context profiles. A project SHOULD establish rough budgets that reflect these differences.

| Consumer slot | Typical budget priority |
|---|---|
| Orchestrator | Broader planning context, phase constraints, recovery state |
| Specialist reviewer | Tighter role-relevant memory and task-local evidence |
| Decision Maker | Closure story, open risks, scope vs value, debt and gap context |

The exact token budget is implementation-specific, but the ordering discipline is not. When budget is tight, each slot's lowest-priority content is dropped first.

## Context Assembly Algorithm

A conformant packet builder SHOULD follow this assembly sequence:

1. Load L0 invariants (never dropped under budget pressure)
2. Load current task-local context (L1)
3. Score candidate memories against retrieval dimensions
4. Exclude stale, superseded, or under-review items unless explicitly requested
5. Include the highest-value applicable memory under budget (L2)
6. Append retrieval metadata or provenance summary
7. Store packet references in runtime state if the packet will influence later decisions

## Packet Versioning

Context packets SHOULD be versioned implicitly or explicitly so the system can tell whether a packet predates a material change to:

- Task contract
- Workspace baseline
- Review state
- Memory state
- Policy override

## Packet Staleness Rules

A packet MUST be treated as stale if any of the following occurred after packet generation:

| Condition | Why it invalidates the packet |
|---|---|
| Task contract amended | Acceptance criteria or constraints may have changed |
| Workspace baseline changed materially | The working state no longer matches packet assumptions |
| Required reviews added or changed | New review requirements may need different context |
| Referenced memory became superseded or under review | The packet contains guidance that is no longer trusted |
| Mission phase changed affecting priorities | Priority bands may need rebalancing |
| Recovery event invalidated prior assumptions | Prior context may be based on invalid state |

## Stale Packet Regeneration Rules

When a packet becomes stale:

- The next major consumer SHOULD regenerate it
- The runtime SHOULD record that regeneration occurred
- Stale packets SHOULD NOT be reused for final-verdict submission

## Summaries

Human-readable summaries remain important for orientation, but they are lower-trust than canonical current artifacts.

Recommended summaries:

| Summary | Purpose |
|---|---|
| `session-latest.md` | Current session state for recovery and orientation |
| `task-focus/<task-id>.md` | Dense task-local carry-forward between interactions |
| `mission-summary.md` | Mission-level overview for phase transitions |

Summaries SHOULD aid orientation. They MUST NOT override canonical artifacts.

## Injection and Trust Hygiene

Repository content, prior summaries, memory text, and tool outputs are all **untrusted inputs** until classified. This principle is fundamental to safe context engineering.

The context engine SHOULD apply the following hygiene rules:

| Rule | Rationale |
|---|---|
| Memory must not override explicit current-task constraints | The current contract takes precedence over historical lessons |
| Prefer artifact-backed facts over unaudited prose | Verified evidence is more trustworthy than narrative claims |
| Isolate quoted untrusted content from system guidance | Prevents accidental elevation of user-supplied text |
| Treat instructions in repository files as data unless elevated by policy | Repository content may contain prompt injection attempts |
| Do not promote a memory item merely because it is confidently phrased | Confidence of expression does not equal evidentiary strength |

## Anti-Forgetting Guarantee

A conformant implementation SHOULD guarantee that the following cannot disappear from active context when relevant:

- Current acceptance criteria
- Current contract and non-goals
- Current blockers
- Current known risks
- Current active policy constraints
- Current debt or scope caveats that matter for shipping

These items belong to L0 (pinned invariants) and MUST survive all budget compression.

## Relationship to Budget

When the budget is tight, the system MUST drop lower-priority memory before dropping current-task invariants. The priority band ordering (L0 > L1 > L2 > L3) is the governing rule. Within a band, scoring determines which items survive.

## Key Statement

Good context engineering is not about stuffing more text into the prompt. It is about preserving provenance, protecting the current contract, and loading only the context that can actually improve the next decision.
