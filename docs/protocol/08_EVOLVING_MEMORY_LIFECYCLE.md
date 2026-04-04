# 08. Evolving Memory Lifecycle

## Purpose

This document defines detailed rules for Geas's core idea: **continuously evolving memory**. The key question is:

> How do we turn learnings from task completion, failure, recovery, and review disagreement into durable memory that improves future behavior?

## Memory Evolution States

- `candidate`
- `provisional`
- `stable`
- `canonical`
- `under_review`
- `decayed`
- `superseded`
- `archived`
- `rejected`

### Meaning
- `candidate`: extracted but still at the hypothesis level
- `provisional`: sufficient evidence exists but further reuse verification is needed
- `stable`: trusted memory that can be repeatedly applied
- `canonical`: near-rule-level memory that has undergone strong approval or repeated verification
- `under_review`: awaiting re-examination due to accumulated harmful reuse or confidence < 0.3 decay (temporarily excluded from retrieval)
- `decayed`: was once valid but freshness/confidence has declined
- `superseded`: replaced by a new memory
- `archived`: retained for reference
- `rejected`: noise or inappropriate memory

## Source Signals

Memory candidates originate from the following signals:

1. `final-verdict.json`
2. `failure-record.json`
3. `revalidation-record.json`
4. `integration-result.json`
5. `specialist-review.json`
6. `readiness-round.json`
7. `recovery-packet.json`
8. `worker-self-check.json`
9. `retrospective.json`
10. `gap-assessment.json`
11. `debt-register.json`

## Per-Task Evolution Loop

After every `passed` task, the following loop runs at minimum:

1. `orchestration_authority` writes `retrospective.json`
2. Extract lessons / debt / memory candidates / rules candidates from the retrospective
3. Domain authority reviews candidates
4. If approved:
   - Promote to `project_memory` or `agent_memory`
   - Update `.geas/rules.md` if needed
   - Update `debt-register.json` for debt items
5. The next task's packet builder injects these
6. Record actual application results in `memory-application-log.json`

## Candidate Extraction Rules

### Acceptable for automatic extraction
- Same `failure_class` failure repeats 2+ times (based on the `failure_class` field in `failure-record.json`)
- Same reviewer concern reappears in `specialist-review.json` across 2+ tasks (based on the concern's `category` field)
- Same `recovery_class` recovery incident repeats 2+ times
- A specific demo/test recipe is effectively used in 3+ tasks
- Conflicts in `integration-result.json` occur 2+ times for a specific path/domain
- `confidence <= 2` in `worker-self-check.json` repeats 2+ times for the same `task_kind`

### Not acceptable for automatic extraction
- Aesthetic preferences from a single task
- One-off implementation preferences without conflict
- Generalizations inferred by an LLM without evidence

## Minimum Candidate Fields

- `memory_id`
- `memory_type`
- `state`
- `title`
- `summary`
- `scope`
- `evidence_refs[]`
- `signals.confidence`
- `signals.evidence_count`
- `signals.reuse_count`
- `signals.contradiction_count`
- `review_after`

## Promotion Pipeline

### Stage 1 — candidate creation
Convert signals into candidates.

### Stage 2 — dedupe/merge
Determine whether to merge with similar existing candidates or stable memories.

**Merge Eligibility Conditions** — two candidates are merge-eligible if they satisfy all three of the following:
1. Same `memory_type`
2. Overlapping `scope` (same scope or one is a parent scope of the other)
3. Semantic similarity of `summary` is at the merge-eligible level (see criteria below)

**Semantic Similarity Criteria:**

Semantic similarity of `summary` is determined by one of the following methods (selected per project configuration):
1. **LLM judgment (default)**: the orchestration_authority compares the two summaries and answers "Is this the same lesson about the same topic?" with yes/no. If yes, merge-eligible.
2. **Keyword-based (fallback)**: extract key nouns/verbs from both summaries; if Jaccard similarity >= 0.70, merge-eligible.

Regardless of method, the merge decision rationale is recorded in the `rationale` field of `memory-review.json`.

**Merge Procedure:**
- Use the entry with more `evidence_refs` as the base.
- Add the other entry's unique evidence_refs to the base entry.
- Set `signals.evidence_count` to the sum of both entries.
- Change the weaker entry to `state = "superseded"`, `superseded_by = {base entry's memory_id}`.

### Stage 3 — review
The relevant domain owner verifies the memory quality:
- Process memory -> `orchestration_authority`
- Architecture precedent -> `architecture_authority`
- Product precedent -> `product_authority`
- QA recipe -> `qa_engineer`
- Security warning -> `security_engineer`

### Stage 4 — promotion
Promote to `provisional` or `stable` based on review and evidence strength.

### Stage 5 — application logging
Record success/failure each time the memory is applied to a future task.

### Stage 6 — reinforcement / weakening
Successful reuse raises confidence; contradiction or harmful reuse lowers confidence.

## Promotion Rules

### candidate -> provisional
At least one of the following must be met:
- 2+ evidence_refs
- 2+ same-type or similar incidents
- Explicit approval from the domain authority

### provisional -> stable
**All** of the following must be met:
- 3+ successful application logs
- 0 contradictions in the most recent 5 applications
- Domain authority review completed

### stable -> canonical
**All** of the following must be met:
- 5+ successful application logs, spanning 3+ different tasks
- Joint approval from orchestration_authority + the relevant domain authority

## Rules.md Update Loop

`rules.md` is a durable behavior surface. Updates must not happen arbitrarily after any task; the following must be satisfied:

### Rule Candidate Sources
- Retrospective lesson
- Repeated failure pattern
- Repeated QA recipe
- Architecture precedent
- Security warning
- Product precedent

### Rule Update Conditions
**All** of the following must be met:
- 2+ evidence_refs or explicit approval from the relevant domain authority
- Scope is verified as `project` (per the `memoryScope` definition in `_defs.schema.json`). Rules that are not project-wide are classified as `agent_memory`
- 0 negative application logs related to the rule candidate in the most recent 5 tasks (no harmful side effects)

### Rules Update Artifact
- `rules-update.json`
- `affected_rule_ids[]`
- `reason`
- `evidence_refs[]`
- `applies_to`

### Rule Application
Updated rules are used in the following from that point forward:
- Packet builder L0 pinned invariants
- Task compiler default checks
- Implementation contract checklist
- Readiness round auto triggers
- Reviewer caution items

## Agent Memory Improvement Path

agent_memory is a per-type performance improvement path.

Examples:
- `qa_engineer` -> store frequently missed edge-case recipes
- `architecture_authority` -> store boundary smell precedents
- `critical_reviewer` -> store recurring ship-risk patterns
- `backend_engineer` -> store transaction/auth/db migration hazards

Rules:
- Do not unconditionally inject into the same type.
- Retrieve only when there is a task scope and role match.
- Weaken or supersede when harmful reuse accumulates.

## Confidence and Freshness

Required fields (per `memory-entry.schema.json`):
- `signals.confidence`: 0.0 - 1.0
- `signals.evidence_count`
- `signals.reuse_count`
- `signals.contradiction_count`
- `review_after`

### Decay Rules

- If the `review_after` date has passed and there are 0 successful reuses during that period: `decayed`
- If `contradiction_count >= 3`: `decayed` (same as the contradiction accumulation threshold in doc 12 Health Signals)
- If a superseding memory appears: `superseded`
- If `confidence < 0.3`: decay review trigger (see doc 07 Confidence Scoring Model)

### Decayed State Exit Transitions

Memory in `decayed` state can transition as follows:
- `decayed` -> `under_review`: when the orchestration_authority or domain authority manually requests re-examination. Based on re-examination results, transition to reinstate (restore previous state), archive, or reject.
- `decayed` -> `archived`: when cleanup is needed without re-examination. Executed by orchestration_authority.
- There is no automatic restoration from `decayed` state. An explicit human/authority action is always required.

## Supersession

Memory is not immutable truth. It can be replaced when new facts emerge.

Fields:
- `supersedes[]`
- `superseded_by`
- `supersession_reason`

Rules:
- Superseded memory is not deleted.
- Excluded from retrieval by default, but visible in audit/drill-down (L3).
- If other memories reference superseded memory in their `evidence_refs`, update those references to the superseding memory's `memory_id`.
- If `rules.md` entries are based on superseded memory, follow the Harmful Reuse Feedback Loop procedure in doc 14 to re-examine the rule's validity.

### Superseded State Exit Transitions

Memory in `superseded` state can transition as follows:
- `superseded` -> `archived`: cleanup after the audit trail is fully preserved. Executed by orchestration_authority.
- If the memory pointed to by `superseded_by` is `rejected`: transition `superseded` -> `under_review` to re-examine the original memory's validity. Based on re-examination results, reinstate to the previous state or archive.

## Negative Learning

Storing only good memories is not enough. The following also become memory:
- Missed verification patterns that produced false greens
- Combinations that looked fine before merge but broke during integration
- Unsafe checkpoint patterns that caused recovery failures
- Regressions caused by ignoring low-confidence self-checks

These items are primarily recorded under the following `memoryType` enum values (per `_defs.schema.json`):
- `failure_lesson` — lessons extracted from failures (false green, missed verification, etc.)
- `risk_pattern` — recurring risk patterns (unsafe checkpoint, integration breakage, etc.)
- `security_pattern` — security-related warnings/patterns
- `process_improvement` — process improvements (lessons derived from gaps/debt)

## Application Logging

Every time memory is actually used, record the following:
- Which task it was injected into
- Who used it
- What effect it had (`positive | negative | neutral | neutral_but_risky | unknown`)
- Whether strengthen / weaken / supersede is needed

This record is what makes memory a "living system."

### Logging Frequency

An application log is recorded when **all** of the following conditions are met:
1. A memory entry was included in `memory-packet.json` and injected into an agent
2. The task that consumed the packet has reached a terminal state (`passed`, `cancelled`, or `escalated`)

Note: `failed` is not a task state (see doc 03). Task failure is recorded as a FailureRecord, and the task is rewound or transitions to `escalated`. Tasks that reach `escalated` due to retry_budget exhaustion are treated as terminal, and an application log is recorded.

`effect` determination criteria:
- Task `passed` and the memory's guidance was within the applicable scope -> `positive`
- Task `passed` but the memory had no actual behavioral effect -> `neutral`
- Task `escalated` and the FailureRecord's failure cause is related to the memory's guidance -> `negative`
- Task `escalated` but the failure cause is unrelated to the memory -> `neutral`
- Task `cancelled` -> `unknown` (intentional cancellation makes memory effect undeterminable)
- Cannot determine -> `unknown`

### Harmful Reuse Rollback Procedure

When a promoted memory (provisional or above) accumulates **2+ negative application logs**, the following procedure is triggered:

1. **Automatic state change**: change the memory's state to `"under_review"`.
2. **Review convened**: orchestration_authority + domain authority review the memory and negative logs.
3. **Possible decisions** (values in parentheses are `decision` enum values from `memory-review.schema.json`):
   - **supersede** (`supersede`): create a corrected new memory and change the existing entry to `superseded`
   - **demote** (`weaken`): demote to `provisional` (if it was stable/canonical)
   - **archive** (`archive`): change to `archived` state and apply the `"invalidated"` tag
4. The decision is recorded in `memory-review.json` with `reason` and `evidence_refs` specified.

### under_review State Transition Full Specification

**Entry conditions** (any of the following):
- 2+ accumulated negative application logs (Harmful Reuse Rollback)
- `confidence < 0.3` decay review trigger (see doc 07)
- Manual re-examination request from orchestration_authority or domain authority

**Behavior on entry**:
- Change the memory's `state` to `"under_review"`
- Temporarily exclude from retrieval (add to `suppressed_memory_ids[]` with `reason: "under_review"`)

**Exit conditions** (transition to one of the following after review completion; values in parentheses are `decision` enum values from `memory-review.schema.json`):
1. **reinstate** (`keep`): if the review determines the memory is still valid, restore to the previous state (`provisional`/`stable`/`canonical`). Reset `contradiction_count` to 0 and update `review_after` to the current date + 90 days.
2. **supersede** (`supersede`): create a corrected new memory and change the existing entry to `superseded`
3. **demote** (`weaken`): demote to `provisional` (if it was stable/canonical)
4. **archive** (`archive`): change to `archived` state and apply the `"invalidated"` tag
5. **reject** (`reject`): change to `rejected` if the evidence is completely invalidated

**When review is incomplete**: if left in under_review state without review for 30+ days, the orchestration_authority must handle it in the next retrospective. After 60+ days, it is automatically changed to `archived`.

### Reinstate Circuit Breaker

When the same memory has gone through `under_review` 3 or more times (a pattern of reinstate followed by re-entry into under_review):

- `reinstate` (`keep`) can no longer be selected. This option is excluded from the review.
- Possible decisions are limited to `supersede`, `demote` (`weaken`), `archive`, or `reject`.
- This limit is tracked by adding an `under_review_count` field to `memory-entry.json`. Initial value is `0`, incremented by `+1` on each entry into `under_review` state.
- Memory that has been through under_review 3+ times is considered structurally unstable; allowing reinstate would risk an infinite loop (reinstate -> problem recurrence -> under_review -> reinstate), so this is blocked.

## Anti-Bloat Rules

1. Reject stylistic preferences with 0 `evidence_refs`
2. Memory with `confidence < 0.3` past its `review_after` date is excluded from retrieval by default (accessible only via L3 drill-down)
3. Even stable memory has a review cadence (default: promotion date + 180 days; see doc 11 `review_after`)
4. Do not create duplicate memories for the same content. Apply the Promotion Pipeline Stage 2 Merge procedure when duplication is detected
5. Do not directly promote a `scope = "task"` observation to a `scope = "project"` rule. It must go through at least `scope = "mission"` first

## Key Statement

> Geas memory is not "records that are stored" but "operational knowledge that continuously strengthens or weakens based on reuse results, and changes future behavior through rules and packets."
