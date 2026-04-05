# 13. Evolution, Debt, and Gap Loop

> **Normative document.**
> This document defines the retrospective loop, debt model, gap assessment, and mission-to-mission learning mechanisms that make Geas accumulate operational competence over time.

## Purpose

Evolution is what makes Geas more than a gating workflow. This document answers:

- what the team must learn after each task or mission
- how compromises are tracked instead of forgotten
- how promised scope is compared to delivered scope
- how harmful patterns get converted into better future behavior

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

Role-specific lessons SHOULD become agent memory. Cross-role lessons SHOULD become project memory or rules.

### Role-specific lesson criteria

A lesson is role-specific when it primarily relates to:

- a tool or technique used mainly by that slot
- an artifact produced mainly by that slot
- a recurring review blind spot for that slot
- a recurring domain-specific success pattern for that slot

## Debt Tracking Model

Debt is the explicit register of accepted compromise. Every project accumulates debt; the protocol requires that debt be visible, owned, and tracked rather than hidden or forgotten.

### Debt sources

Debt MAY originate from any point in the pipeline where a compromise is identified:

| source | example |
|---|---|
| worker self-check | "I implemented a workaround for X; proper solution needs Y" |
| specialist reviews | reviewer flags a concern that is accepted but not fixed now |
| integration result | integration succeeds but introduces a known limitation |
| gate findings | evidence gate passes with noted caveats |
| final verdict notes | Decision Maker accepts with conditions |
| retrospective | post-task reflection identifies a shortcut taken |
| gap assessment | scope comparison reveals transferred risk |
| policy override follow-up | override creates obligation for future remediation |

### Minimum debt fields

Each debt item SHOULD contain at least the following fields:

| field | description |
|---|---|
| `debt_id` | unique identifier |
| `severity` | `critical`, `high`, `normal`, `low` |
| `kind` | category of debt (see below) |
| `title` | short human-readable summary |
| `description` | detailed explanation of the compromise |
| `introduced_by_task_id` | task that created this debt |
| `owner_type` | slot or team responsible for resolution |
| `status` | current lifecycle state |
| target timing or phase | when resolution is expected |

Debt kinds classify the nature of the compromise:

| kind | what it represents |
|---|---|
| `output_quality` | quality issues in deliverables that were accepted temporarily |
| `verification_gap` | missing or insufficient verification coverage |
| `structural` | design or architecture decisions that need future revision |
| `risk` | known security, safety, or trust concerns deferred for later |
| `process` | workflow or process shortcuts taken under time pressure |
| `documentation` | missing or outdated documentation |
| `operations` | operational readiness gaps deferred for later |

### Recommended debt statuses

| status | meaning |
|---|---|
| `open` | identified but not yet triaged |
| `accepted` | triaged and acknowledged as real debt |
| `scheduled` | assigned to a specific future task or phase |
| `resolved` | addressed with evidence |
| `dropped` | determined to no longer be relevant |

## Debt Action Rules

- `critical` debt MUST be triaged before relevant phase exit
- `high` debt SHOULD not survive delivery readiness without rationale
- accepted debt SHOULD still have owner and review cadence
- resolved debt SHOULD reference the task or evidence that resolved it
- dropped debt SHOULD explain why it no longer matters

A team MUST NOT use debt as a hiding place for unknown blockers.

## Scheduled-to-Resolved Transition

A debt item SHOULD become `resolved` only when:

- a task explicitly targeting it reaches `passed`
- or equivalent evidence proves the original concern is no longer valid

"Probably fixed" is not resolution.

## Gap Assessment

Gap assessment compares what was promised against what was actually delivered, making scope honesty a first-class protocol concern.

- `scope_in` — what was promised
- `scope_out` — what was delivered and evidenced

### When to perform it

Gap assessment SHOULD happen:

- at phase boundaries
- at mission close
- after meaningful re-scope
- after emergency or hotfix shortcuts

### Minimum questions

Each gap assessment SHOULD address at least these questions:

| question | what it reveals |
|---|---|
| what was promised but not delivered? | under-delivery or deferred scope |
| what was delivered but not originally promised? | scope creep or opportunistic improvement |
| what changed in risk, cost, or maintainability? | hidden cost transfers |
| what future work is now implied? | downstream obligations |
| what should become debt, memory, or a new mission input? | carry-forward actions |

## Gap Interpretation Rules

Not every gap is failure. The assessment SHOULD classify the gap rather than just list it.

| interpretation | meaning |
|---|---|
| **under-delivery** | promised scope missing |
| **over-delivery** | extra work done without prior approval |
| **risk transfer** | core functionality delivered but hidden cost moved into debt |
| **learning gain** | scope changed because the original plan was wrong and the change improved reality |

## Initiative Evolving Phase

The evolving phase exists to consolidate what the mission learned. It is the final phase of a mission and ensures that lessons, debt, and gaps are processed rather than lost.

Typical evolving work includes:

- memory promotion and review
- rules updates
- debt rollup
- gap analysis
- mission summary
- carry-forward backlog framing

The evolving phase SHOULD not be skipped for non-trivial work.

## Evolving Phase Exit Gate

A mission SHOULD NOT close cleanly until:

- gap assessment exists
- retrospective bundle exists
- debt snapshot exists
- approved rules or memory changes are recorded
- mission summary exists

## Harmful Reuse Feedback Loop

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
- memory packets
- debt priorities
- reviewer focus

Mission close is therefore not an ending; it is a handoff.

## Key Statement

The protocol is only as strong as its learning loop. Debt makes compromise visible, gap assessment makes scope honest, and retrospectives convert repeated pain into better future defaults.
