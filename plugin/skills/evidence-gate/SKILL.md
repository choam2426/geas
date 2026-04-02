---
name: evidence-gate
description: Evidence Gate v2 — Tier 0 (Precheck) + Tier 1 (Mechanical) + Tier 2 (Contract+Rubric). Returns pass/fail/block/error.
---

# Evidence Gate

Objective verification of whether a worker's output meets the TaskContract requirements. The gate verdict is strictly objective — it answers "does this meet the contract?" with one of four verdicts: **pass**, **fail**, **block**, or **error**.

`iterate` is NOT a gate verdict. Product judgment happens in the Final Verdict, which is a separate pipeline step.

## Inputs

1. **TaskContract** — read from `.geas/tasks/{task-id}.json`
2. **Worker Self-Check** — read from `.geas/tasks/{task-id}/worker-self-check.json`
3. **Specialist Reviews** — read from `.geas/evidence/{task-id}/` (e.g., `architecture-authority-review.json`, `qa-engineer.json`)
4. **Integration Result** — merge status from worktree integration
5. **Gate profile** — determines which tiers to run (see below)

## Gate Profiles

| gate_profile | Tier 0 | Tier 1 | Tier 2 | Description |
|---|---|---|---|---|
| `code_change` | Run | Run | Run | Standard task involving code changes |
| `artifact_only` | Run | Skip | Run (rubric only, no build/test) | Tasks without code changes such as documentation or design |
| `closure_ready` | Run | Skip | Simplified (completeness check only) | Final cleanup tasks such as release or config |

---

## Tier 0 — Precheck

Verify that all prerequisites are in place before running expensive checks.

### Checks

1. **Required artifacts existence**
   - `worker-self-check.json` must exist at `.geas/tasks/{task-id}/worker-self-check.json`
   - Specialist reviews must exist (per the task's required reviewer set)
   - Integration result must be recorded (for `code_change` profile)

2. **Task state eligibility**
   - `code_change` profile: task must be in `integrated` state
   - `artifact_only` profile: task must be in `reviewed` state
   - `closure_ready` profile: task must be in `reviewed` or `integrated` state

3. **Baseline check**
   - For `code_change`: verify `base_commit` ancestry — the integration branch must contain the declared base commit

4. **Required reviewer presence**
   - All agent types listed in the task's required reviewer set must have submitted reviews

### On Tier 0 Failure

- **Missing required artifact**: verdict = `block`. Does NOT consume retry_budget. Gate re-entry not allowed until the artifact is created.
- **Task state ineligible**: verdict = `error`. The orchestration_authority inspects and corrects the state.
- **Baseline mismatch**: verdict = `block`. Re-enter after performing revalidation.
- **Missing required reviewer**: verdict = `block`. Does NOT consume retry_budget.

**Stop** — do not proceed to Tier 1 or Tier 2.

---

## Tier 1 — Mechanical

Run the eval commands from the TaskContract and check results.

**Skip conditions**: Skip for `artifact_only` and `closure_ready` profiles. Record as `{"status": "skipped", "details": "Profile does not require mechanical verification"}`.

### Procedure

1. Read `eval_commands` from the TaskContract
2. Run each command:
   ```bash
   # Run each eval_command from the TaskContract
   {eval_command_1}
   {eval_command_2}
   ...
   ```
3. Record results:
   - **pass**: command exits 0
   - **fail**: command exits non-zero (capture error output)

**Stop on first failure** — no point running contract checks if the code doesn't build.

> **Important:** You MUST execute eval_commands and record the results. Do not assume "pass". If no commands exist, record as `{"status": "skipped", "details": "No eval_commands configured"}`. Having commands but not running them is a gate violation.

If previous evidence already contains `verify_results`, compare them against a fresh run. Trust the fresh run.

---

## Tier 2 — Contract + Rubric

Multi-part evaluation of contract compliance and quality.

**For `closure_ready` profile**: only run Part A (completeness check). Skip Parts B, C, D.

### Part A: Acceptance Criteria

For each criterion in `acceptance_criteria`:
1. Read the worker's evidence (summary, files_changed, criteria_results if present)
2. Assess whether the criterion is met:
   - If the worker provided `criteria_results` -> verify their self-assessment
   - If not -> infer from the evidence (files changed, test results, code inspection)
3. Record: `{ "criterion": "...", "met": true/false, "evidence": "..." }`

**All criteria must be met** to proceed to Part B.

### Part B: Scope Violation Check

Compare files changed against the task's `scope.paths`:
1. Read `scope.paths` from the TaskContract (or implementation contract)
2. List all files modified by the worker
3. Flag any file outside `scope.paths` as a potential scope violation
4. Minor scope violations (e.g., shared config files): record as warning
5. Major scope violations (touching unrelated modules): Tier 2 fails

### Part C: Known Risk Handling

Verify that each item in the implementation contract's `known_risks` has been handled:
- **Mitigated**: evidence shows the risk was addressed
- **Accepted with rationale**: explicit rationale recorded for accepting the risk
- **Deferred to debt**: recorded in `.geas/state/debt-register.json`

Any `known_risk` with no handling status -> Tier 2 fails.

### Part D: Rubric Scoring

Read the `rubric` array from the TaskContract. For each dimension:

1. Identify the evaluator's evidence:
   - `architecture_authority` review evidence -> `code_quality` score
   - `qa_engineer` evidence -> `core_interaction`, `feature_completeness`, `regression_safety` scores
   - `qa_engineer` or `ui_ux_designer` evidence -> `ux_clarity`, `visual_coherence` scores (UI-sensitive tasks)
2. Read the evaluator's `rubric_scores` from their review
3. Compare each score against the dimension's `threshold`

#### Default Dimensions

| dimension | evaluator | default threshold |
|---|---|---:|
| `core_interaction` | `qa_engineer` | 3 |
| `feature_completeness` | `qa_engineer` | 4 |
| `code_quality` | `architecture_authority` | 4 |
| `regression_safety` | `qa_engineer` | 4 |

UI-sensitive tasks add:

| dimension | evaluator | default threshold |
|---|---|---:|
| `ux_clarity` | `qa_engineer` or `ui_ux_designer` | 3 |
| `visual_coherence` | `qa_engineer` or `ui_ux_designer` | 3 |

#### Low Confidence Threshold Adjustment

Read `confidence` from `worker-self-check.json`. If `confidence` <= 2, add +1 to **every** rubric dimension threshold.

Example: if confidence is 2, thresholds become: `core_interaction` 3->4, `feature_completeness` 4->5, `code_quality` 4->5, `regression_safety` 4->5.

#### Stub Check

If `possible_stubs[]` from the worker self-check is non-empty:
1. Verify those locations are not left as stubs
2. If confirmed stubs exist: `feature_completeness` is capped at a maximum of 2
3. If confirmed stub count exceeds the stub cap: gate immediately returns `block`

Default stub cap by `risk_level`:

| risk_level | stub cap |
|---|---:|
| `low` | 3 |
| `normal` | 2 |
| `high` | 0 |
| `critical` | 0 |

#### Rubric Result

Record rubric results:
```json
{
  "rubric_scores": [
    { "dimension": "core_interaction", "score": 4, "threshold": 3, "passed": true },
    { "dimension": "code_quality", "score": 3, "threshold": 4, "passed": false }
  ],
  "blocking_dimensions": ["code_quality"]
}
```

**All rubric dimensions must meet their threshold** for Tier 2 to pass. The `blocking_dimensions` list tells the verify-fix-loop exactly what to target.

---

## `fail` vs `block` Distinction

- **`fail`**: implementation quality issue. Can be fixed via the verify-fix-loop. Consumes 1 from `retry_budget`.
- **`block`**: structural prerequisite not met. Cannot be resolved by modifying the implementation alone. Does NOT consume `retry_budget`. Re-enter the gate after resolving the blocking cause.

Conditions that produce `block`:
- Tier 0: missing required artifact, baseline mismatch, missing required reviewer
- Tier 2: stub cap exceeded, required specialist review missing

---

## Gate Error Handling

If the gate verdict is `error`:
- `retry_budget` is NOT consumed
- The orchestration_authority resolves the cause and re-runs the gate
- If the same cause produces `error` 3 consecutive times, the task transitions to `blocked` and the cause is recorded

---

## Output

Write to `.geas/tasks/{task-id}/gate-result.json` conforming to `docs/protocol/schemas/gate-result.schema.json`.

```json
{
  "version": "1.0",
  "artifact_type": "gate_result",
  "artifact_id": "gate-{task-id}-{timestamp}",
  "producer_type": "qa_engineer",
  "created_at": "<actual ISO 8601 from date -u>",
  "task_id": "{task-id}",
  "gate_profile": "code_change",
  "verdict": "pass",
  "tier_results": {
    "tier_0": { "status": "pass", "details": "All prerequisites verified" },
    "tier_1": { "status": "pass", "details": "All eval_commands passed" },
    "tier_2": { "status": "pass", "details": "All criteria met, rubric passed" }
  },
  "rubric_scores": [
    { "dimension": "core_interaction", "score": 4, "threshold": 3, "passed": true },
    { "dimension": "feature_completeness", "score": 4, "threshold": 4, "passed": true },
    { "dimension": "code_quality", "score": 4, "threshold": 4, "passed": true },
    { "dimension": "regression_safety", "score": 5, "threshold": 4, "passed": true }
  ],
  "blocking_dimensions": [],
  "retry_budget_before": 3,
  "retry_budget_after": 3
}
```

Also log a detailed event to `.geas/ledger/events.jsonl`:
```json
{
  "event": "gate_result",
  "task_id": "{task-id}",
  "result": "pass",
  "gate_profile": "code_change",
  "tier_results": {
    "tier_0": { "status": "pass" },
    "tier_1": { "status": "pass" },
    "tier_2": { "status": "pass" }
  },
  "blocking_dimensions": [],
  "timestamp": "<actual ISO 8601 from date -u>"
}
```

---

## On Pass

1. Update TaskContract status to `"verified"` in `.geas/tasks/{task-id}.json`
2. Log the gate_result event (see Output above)
3. Return to the pipeline — next step is **Closure Packet assembly**, then **Critical Reviewer Challenge**, then **Final Verdict**

## On Fail

1. Decrement `retry_budget` (`retry_budget_after` = `retry_budget_before` - 1)
2. If retries remain:
   - Invoke `/verify-fix-loop` with the failure details
   - The fix loop dispatches the worker with failure context
   - After fix, re-run the gate
3. If retries exhausted:
   - Follow the `escalation_policy`:
     - `"architecture-authority-review"`: spawn the `architecture_authority` for architectural review, write a DecisionRecord
     - `"product-authority-decision"`: spawn the `product_authority` for a strategic decision (continue/cut/pivot)
     - `"pivot"`: invoke pivot protocol
   - Update TaskContract status to `"escalated"`
   - Write a DecisionRecord to `.geas/decisions/{dec-id}.json`

## On Block

1. Do NOT decrement `retry_budget` (`retry_budget_after` = `retry_budget_before`)
2. Record the blocking cause in the gate result
3. Task cannot re-enter the gate until the blocking cause is resolved
4. The orchestration_authority is responsible for resolving the block

---

## Decision Records

When the gate results in an escalation or significant decision, write a DecisionRecord:

```bash
mkdir -p .geas/decisions
```

Write to `.geas/decisions/{dec-id}.json` conforming to `schemas/decision-record.schema.json`.

This creates a durable record of WHY a decision was made, not just WHAT happened.
