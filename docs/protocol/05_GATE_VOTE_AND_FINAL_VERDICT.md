# 05. Gate, Vote, and Final Verdict

## Core Separation

- **Evidence Gate**: objective verification
- **Vote Round**: structured disagreement or readiness deliberation
- **Final Verdict**: product closure decision

These three are not interchangeable.

## Differences from Legacy Geas

The original Geas Evidence Gate used a 3-tier structure (Tier 1: mechanical, Tier 2: semantic+rubric, Tier 3: product judgment). Changes in this protocol:
- **Tier 3 removed**: product judgment is no longer inside the gate; it has been separated into an independent **Final Verdict** stage.
- **Tier 0 added**: a Precheck stage has been added to verify artifact existence and state eligibility.
- **Preserved**: rubric scoring, iterate semantics, and phase-level ship decisions remain unchanged.

## Evidence Gate v2

### Gate Profiles

| gate_profile | Tier 0 | Tier 1 | Tier 2 | Description |
|---|---|---|---|---|
| `code_change` | Run | Run | Run | Standard task involving code changes |
| `artifact_only` | Run | Skip | Run (rubric only, no build/test) | Tasks without code changes such as documentation or design |
| `closure_ready` | Run | Skip | Simplified (completeness check only) | Final cleanup tasks such as release or config |

### Tier 0 — Precheck
- Required artifacts existence
- Task state eligibility
- Baseline/integration prerequisites
- Required reviewer/self-check presence

On Tier 0 failure:
- Missing required artifact: gate verdict = `block`. Gate re-entry is not allowed until the artifact is created. Does not consume retry_budget.
- Task state does not meet gate entry conditions: gate verdict = `error`. The orchestration_authority inspects the state.
- Baseline mismatch: gate verdict = `block`. Re-enter after performing revalidation.

If Tier 0 returns fail/block/error, processing does not proceed to Tier 1 or beyond.

### Tier 1 — Mechanical
- build/lint/test/typecheck/command execution
- Result: `pass | fail`

### Tier 2 — Contract + Rubric
- Acceptance criteria
- Scope violation check
- Required checks / demo steps
- Known risk handling: verify that each item in the implementation contract's `known_risks` has been handled as one of: mitigated, accepted with rationale, or deferred to debt
- Rubric scoring
- Result: `pass | fail`

### Gate Verdict
- `pass`
- `fail`
- `block`
- `error` — gate execution itself failed (build system unavailable, timeout, etc.)

`iterate` is not a gate result; it is used in the final verdict.

### Difference Between `fail` and `block`

- `fail`: implementation quality issue. Can be fixed via the verify-fix loop. Consumes 1 from retry_budget.
- `block`: structural prerequisite not met. Cannot be resolved by modifying the implementation. Does not consume retry_budget. Re-enter the gate after resolving the blocking cause.

Conditions that produce `block`:
- Tier 0: missing required artifact, baseline mismatch
- Tier 2: stub cap exceeded, required specialist review missing

### Gate Error Handling
If the gate verdict is `error`, retry_budget is not consumed. The orchestration_authority resolves the cause and re-runs the gate. If the same cause produces `error` 3 consecutive times, the task transitions to `blocked` and the cause is recorded.

## Rubric Scoring

The default rubric dimensions are aligned with the current Geas pipeline.

### Default Dimensions
| dimension | evaluator | default threshold |
|---|---|---:|
| `core_interaction` | `qa_engineer` | 3 |
| `feature_completeness` | `qa_engineer` | 4 |
| `code_quality` | `architecture_authority` | 4 |
| `regression_safety` | `qa_engineer` | 4 |

### UI-sensitive Tasks Add
| dimension | evaluator | default threshold |
|---|---|---:|
| `ux_clarity` | `qa_engineer` or `ui_ux_designer` | 3 |
| `visual_coherence` | `qa_engineer` or `ui_ux_designer` | 3 |

### Scoring Rules
- Score range: 1-5
- If any dimension falls below its threshold, gate Tier 2 fails
- `blocking_dimensions[]` is a key input for the verify-fix-loop and rewind reasons

### Low Confidence Threshold Adjustment

The `confidence` field in worker-self-check.json is a single scalar (1-5). If this value is <= 2, all rubric dimension thresholds are increased by +1.

In the future, if the worker-self-check schema supports per-dimension confidence (`confidence_per_dimension: { dimension: score }`), the +1 adjustment will apply only to the relevant dimension. Currently, the scalar value applies globally.

Example: if worker-self-check.json `confidence` is 2, all dimension thresholds are raised by +1 (`core_interaction` 3->4, `feature_completeness` 4->5, etc.).

### Stub Check
If `possible_stubs[]` is not empty, the gate prioritizes verifying those locations. If confirmed stubs exist, `feature_completeness` is capped at a maximum of 2. If the confirmed stub count exceeds the stub cap, the gate immediately returns `block`.

Default stub cap by risk_level:

| risk_level | stub cap |
|---|---:|
| `low` | 3 |
| `normal` | 2 |
| `high` | 0 |
| `critical` | 0 |

## Worker Self-Check Consumption

`worker-self-check.json` affects the gate as follows:
- `known_risks[]` -> contract review priority
- `untested_paths[]` -> QA priority
- `possible_stubs[]` -> stub cap
- `confidence` -> threshold adjustment
- `what_to_test_next[]` -> QA test plan seed

## Vote Rounds

### vote_round_policy Application Rules
- `never`: do not run a vote round. Even if readiness_round trigger conditions are met, skip it.
- `auto`: automatically run a readiness_round if any of the trigger conditions below are met. Skip if none are met.
- `always`: run a readiness_round regardless of trigger conditions.

When a task set to `never` encounters a readiness_round trigger condition, the orchestration_authority records it but does not run the round. However, specialist review conflicts (see doc 01 Specialist Conflict Resolution) always invoke a vote round regardless of vote_round_policy.

### `proposal_round`
When to use:
- Cross-cutting proposals during the specifying phase
- Major design/API boundary decisions during the building phase

Quorum requirement: at least 2 participants (proposer + reviewer).

Vote enum:
- `agree`
- `disagree`

On quorum failure: the vote round is recorded as `inconclusive`, and the orchestration_authority assigns additional participants for a retry. If quorum fails 2 consecutive times, the task transitions to `escalated`.

### `readiness_round`
When to use:
- `risk_level = high` or `critical`
- `open_risks.status = present`
- Out-of-scope changes exist
- Specialist reviews are split
- Resubmission after a retry
- Requested by product_authority or orchestration_authority

Quorum requirement: at least `orchestration_authority` + `product_authority` + 1 specialist.

Vote enum:
- `ship`
- `iterate`
- `escalate`

On quorum failure: the same rules as proposal_round apply (transition to `escalated` after 2 consecutive quorum failures).

## Closure Packet

Required fields:
- `task_summary`
- `change_summary`
- `specialist_reviews[]`
- `integration_result`
- `verification_result`
- `worker_self_check`
- `open_risks`
- `debt_snapshot`
- `readiness_round` (`null` if none)

### `specialist_reviews[]`
Each review must contain at minimum:
- `reviewer_type`
- `status = approved | changes_requested | blocked`
- `summary`
- `blocking_concerns[]`
- `rubric_scores[]` (optional but recommended)

### `open_risks`
Enforced as a structured type:
- `status = none | present`
- `items[]`

### `debt_snapshot`
- `status = none | present`
- `items[]`

## Critical Reviewer Pre-ship Challenge

After gate pass, after closure packet assembly, and before the final verdict, the `critical_reviewer` performs a pre-ship challenge.

### Purpose
- Surface structural risks, hidden assumptions, and excessive complexity that the gate might miss
- Improve the quality of the closure packet entering the final verdict

### Rules
- Mandatory when `risk_level` is `high` or `critical`; otherwise at orchestration_authority's discretion
- The `critical_reviewer` must raise at least 1 concern (substantive challenge obligation)
- If a concern is blocking, add it to `open_risks` in the closure packet and trigger a readiness_round
- If a concern is non-blocking, record it in the closure packet's notes
- Challenge results are recorded in `challenge-review.json`

### Relationship Between Readiness Round and Blocking Concerns

When a blocking concern from the `critical_reviewer` triggers a readiness_round:
- If the readiness_round result is `ship`, the blocking concern is converted to an **acknowledged risk**. The `resolved` field of the corresponding item in the specialist-review's `blocking_concerns[]` is set to `true`, and `resolution = "accepted_via_readiness_round"` is recorded. This satisfies the closure packet completeness condition.
- If the readiness_round result is `iterate`, rewind to resolve the concern.
- If the readiness_round result is `escalate`, the task transitions to `escalated`.

### Flow
```
Evidence Gate pass -> Closure Packet assembly -> Critical Reviewer Challenge -> Final Verdict
```

## Final Verdict

The `product_authority` makes decisions based primarily on the **task definition + closure packet**.

Allowed verdicts:
- `pass`
- `iterate`
- `escalate`

Meaning:
- `pass` -> `passed`
- `iterate` -> specify rewind target
- `escalate` -> requires higher-level decision-making

Final Verdict `iterate` is independent of retry_budget. Since `iterate` is a product judgment rather than a gate failure, it does not consume retry_budget. However, `iterate` also has a repetition limit: if `iterate` accumulates 3 times for the same task, the task transitions to `escalated`.

If the packet is incomplete, `pass` is prohibited. For a packet to be "complete", all of the following must be satisfied:
- All required fields (`task_summary`, `change_summary`, `specialist_reviews[]`, `integration_result`, `verification_result`, `worker_self_check`, `open_risks`, `debt_snapshot`) are populated
- Specialist reviews for all types in the required reviewer set are included in `specialist_reviews[]`
- The gate result (`verification_result`) exists
- No unresolved items in `blocking_concerns[]` (no specialist review with `status = blocked`)

## Gap Assessment Linkage

At phase-level or mission-level closure decisions, task closure alone is not sufficient. The `product_authority` also considers the following as needed:
- Current `scope_in`
- Delivered `scope_out`
- `gap-assessment.json`
- Current debt snapshot
- Unresolved product risks

In other words, **a task may be closed but the phase may still remain open.**
