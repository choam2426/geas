# 14. Evolution, Debt, and Gap Loop

## Purpose

This document defines Geas's differentiating feature -- **Evolution** -- as an operational loop. The core questions are:

1. What should the team learn after a task is completed?
2. Where is that learning stored, and how does it change future behavior?
3. How is the gap between implementation scope and the originally promised scope measured?
4. How is technical debt accumulated, reviewed, and resolved?

## Per-Task Retrospective Loop

After every `passed` task, `process_lead` writes a `retrospective.json`.

Minimum items:
- `what_went_well[]`
- `what_broke[]`
- `what_was_surprising[]`
- `rule_candidates[]`
- `memory_candidates[]`
- `debt_candidates[]`
- `next_time_guidance[]`

## Retrospective to Rule Update

### Rule candidate creation
A rule candidate can be created when:
- the same failure pattern repeats 2 or more times
- the same reviewer concern repeats 2 or more times
- the same integration/recovery mistake recurs
- a clear process fix exists

### Rule update approval
One of the following is required:
- `process_lead` + domain authority approval
- 2 or more evidence_refs + `contradiction_count = 0`

### Behavior change
Approved rules modify the following:
- packet L0 pinned invariants
- task compiler default checks
- implementation contract checklist
- reviewer focus prompts
- readiness auto trigger

In other words, a rule is not just a document -- it is a **future behavior modifier**.

## Agent Memory Feedback Loop

Lessons from retrospectives enter `agent_memory` if they are role-specific, otherwise they enter project-level memory.

### Role-specific lesson criteria

A lesson is role-specific if it meets one or more of the following conditions:
- (a) it references a tool/technique used exclusively by that agent type
- (b) it applies to an artifact type produced exclusively by that agent type
- (c) it was generated during a review by that agent type

If none of the above conditions are met, the lesson is classified as project-level memory.

### Examples:
- QA lesson -> `qa_engineer`
- security lesson -> `security_engineer`
- architecture precedent -> `architecture_authority`
- implementation smell -> relevant engineer type
- process improvement lesson -> project-level (not tied to a specific agent type)

On the next spawn, the packet builder injects applicable agent_memory.

## Debt Tracking Model

`debt-register.json` is a mission/phase-level debt ledger.

### Debt source
- worker self-check
- specialist reviews
- integration result
- final verdict notes
- retrospective
- gap assessment

### Debt fields
- `debt_id`
- `severity = low | medium | high | critical`
- `kind = code_quality | architecture | security | docs | ops | test_gap | product_gap`
- `title`
- `description`
- `introduced_by_task_id`
- `owner_type`
- `status = open | accepted | scheduled | resolved | dropped`
  - **`scheduled` to `resolved` transition condition**: the transition occurs when a task explicitly targeting the debt item reaches `state=passed` and the task's evidence verifies that the debt's original concern has been addressed
- `target_phase = polish | evolution | future`

### Debt review cadence
- every task close: add/merge debt candidates
- every phase transition: rollup review
- mission close: unresolved debt snapshot mandatory

### Debt action rules
- `critical` debt requires triage before phase exit. Attempting phase exit without triage is blocked by the `phase_transition_review` hook.
- `high` debt must be resolved in the `polish` phase or receive explicit acceptance from `product_authority`. On acceptance, the reason must be recorded in the `rationale` field.
- `accepted` debt cannot exist without `rationale` and `owner_type`. If either is empty, the validator rejects it.
- `dropped` debt requires `process_lead` approval and a `drop_reason` record. Transitioning to `dropped` without approval is blocked.

### Critical Debt Discovered During Evolution Phase

When new critical debt is discovered during the evolution phase through retrospective or gap assessment, follow this procedure:

1. Record the debt in `debt-register.json` with `severity = critical`, `status = open`.
2. `product_authority` decides one of the following:
   - **a. Immediate fix**: create a fix task within the evolution phase. This task follows the normal task lifecycle (see doc 03).
   - **b. Accept**: change to `status = accepted` with mandatory `rationale` and `owner_type`. Without acceptance rationale, the evolution exit gate cannot be passed (see debt action rules and Evolution Exit Gate above).
   - **c. Defer to next mission**: change to `status = scheduled`, `target_phase = future`. Add the debt to `recommended_followups[]` in `gap-assessment.json`.
3. Record the decision in `decision-record.json`. Set `decision_type` to `"critical_debt_triage"` and include the debt's `debt_id` in `evidence_refs`.

### Debt conflict resolution
When conflicting debt items exist in the same scope (e.g., "switch API authentication to OAuth" vs. "keep the current API key approach"):
1. `process_lead` reviews with the relevant domain authority.
2. One item is transitioned to `dropped` with the conflict resolution reason recorded in `drop_reason`.
3. The decision outcome is recorded in the `what_was_surprising[]` field of `retrospective.json`.

## Gap Assessment

`gap-assessment.json` is an artifact comparing the original `scope_in` with the actual `scope_out`.

### When to use
- `build -> polish`
- `polish -> evolution`
- `evolution -> mission close`
- after a major pivot

### Minimum fields
- `scope_in_summary`
- `scope_out_summary`
- `fully_delivered[]`
- `partially_delivered[]`
- `not_delivered[]`
- `intentional_cuts[]`
- `unexpected_additions[]`
- `recommended_followups[]`

### Interpretation rules
- If `unexpected_additions` exist, a traceability note is required
- If `not_delivered` items remain and phase close is desired, `product_authority` rationale is required
- **Repeated partial delivery forward-feeding**: if the same item appears in `partially_delivered` across 2 or more gap assessments, it is automatically added as a priority constraint to the next discovery phase intake.

  **End-to-end forward-feed procedure:**
  1. **Detection**: when writing the gap assessment, `process_lead` cross-references each item in `partially_delivered[]` against previous gap assessments. Matching criteria are identical `title` or identical `scope_ref`.
  2. **Determination**: if the same item appears 2 or more times, it is marked as a forward-feed target. The item in the gap assessment is annotated with `forward_feed: true` and `occurrence_count: N`.
  3. **Propagation**: during the next mission's discovery phase, when the intake skill generates `seed.json`, forward-feed target items are automatically inserted into the `constraints` field. Each constraint includes `source_ref: "{gap_assessment_id}"`, `reason: "repeated_partial_delivery"`, and `original_scope: "{item title}"`.
  4. **Verification**: when a forward-feed constraint exists in `seed.json`, the task compiler must create at least one task that covers that item. If none is created, explicit rationale from `product_authority` is required.
  5. **Completion check**: when a forward-fed item transitions to `fully_delivered`, the constraint is removed from the next gap assessment. If it remains in `partially_delivered`, the occurrence_count increases and forward-feeding repeats.
  6. **On failure**: if the item persists unresolved after 3 or more repetitions, `process_lead` reassesses its feasibility during retrospective, and `product_authority` decides whether to transition it to `intentional_cuts`.

## Initiative Evolution Phase

The evolution phase is not merely a retrospective -- it is the following bundle:

1. collect retrospectives from all passed tasks
2. promote rules / memory candidates
3. debt register rollup
4. perform gap assessment
5. generate mission summary
6. decide next-loop backlog or mission close

## Evolution Exit Gate

To close the evolution phase, all 5 of the following artifacts **must** exist. If any is missing, the `phase_transition_review` hook blocks closure.

1. `gap-assessment.json` -- scope_in vs scope_out comparison for this phase completed
2. updated `debt-register.json` -- all debt item statuses updated (remaining `open` debt must each be triaged to `accepted` or higher)
3. approved `rules-update.json` -- if rule candidates exist, approval/rejection completed. If no candidates exist, create an artifact with `"no_candidates": true`
4. `mission-summary.md` -- mission-level status, remaining issues, pending decisions, outstanding risks summarized
5. `phase-review.json` -- `product_authority` phase review completed. The `verdict` field must be `"approve"` or `"approve_with_conditions"`

**On exit gate failure**: return the list of missing artifacts to the `orchestration_authority`. The phase remains open until those artifacts are created.

## Harmful Reuse Feedback Loop

When a memory-based rule exists in `rules.md` but the underlying memory has been weakened or superseded (see doc 08), follow this procedure:

1. `process_lead` reviews the rule's memory dependency.
2. If the reason the memory was weakened/superseded affects the rule's validity:
   - Update the rule to remove the memory dependency and re-establish it with independent justification, or
   - Archive the rule and record the archive reason in `rules-update.json`.
3. If the memory was weakened/superseded but the rule's own logic remains valid:
   - Remove the reference to that memory from the rule's `evidence_refs` and add an alternative justification.

This review is performed during the memory review cadence or retrospective.

## Key Statement

> Evolution is the protocol stage that guarantees not just "this round is done" but "next time will be done better."
