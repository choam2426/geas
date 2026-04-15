# 08. Debt and Gap

> **Normative document.**
> This document defines the debt tracking model and the gap assessment loop used to keep promised scope and delivered scope aligned.

## Purpose

Debt and gap tracking make compromise visible and scope honest. This document answers:

- how accepted compromises are registered, owned, and tracked
- how promised scope is compared to delivered scope
- what actions are required based on debt severity
- how gaps are classified rather than merely listed

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
- after lightweight-mode shortcuts or hotfix work

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

## Key Statement

Debt makes compromise visible and gap assessment makes scope honest. Together they ensure that what the project accepted and what it actually delivered are explicit, owned, and carried forward rather than silently forgotten.
