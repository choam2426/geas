---
name: evidence-gate
description: Evidence Gate v2 — Tier 0 (Precheck) + Tier 1 (Mechanical) + Tier 2 (Contract+Rubric). Returns pass/fail/block/error.
---

# Evidence Gate

Objective verification of whether a worker's output meets the TaskContract requirements. The gate verdict is strictly objective — it answers "does this meet the contract?" with one of four verdicts: **pass**, **fail**, **block**, or **error**.

`iterate` is NOT a gate verdict. Product judgment happens in the Final Verdict, which is a separate pipeline step.

## Inputs

1. **TaskContract** — read from `.geas/missions/{mission_id}/tasks/{task-id}/contract.json`
2. **Worker Self-Check** — read from record.json `self_check` section (`.geas/missions/{mission_id}/tasks/{task-id}/record.json`)
3. **Specialist Reviews** — read from `.geas/missions/{mission_id}/tasks/{task-id}/evidence/`. Naming: `{agent-type}.json` per agent
4. **Integration Result** — merge status from worktree integration

**Evidence schema fields by role:**
- All roles: `version`, `agent`, `task_id`, `role`, `summary`
- `implementer`: + `files_changed[]`, optional `commit`
- `reviewer`: + `verdict` (approved|changes_requested|blocked), `concerns[]`
- `tester`: + `verdict` (pass|iterate|escalate), `criteria_results[]` (items: `criterion`, `passed`, optional `details`)
- `authority`: + `verdict`, `rationale`
- Optional for all: `rubric_scores[]` (items: `dimension`, `score` (1-5), optional `rationale`)
5. **Gate profile** — determines which tiers to run (see below)

## Gate Profiles

| gate_profile | Tier 0 | Tier 1 | Tier 2 | Description |
|---|---|---|---|---|
| `implementation_change` | Run | Run | Run | Standard task involving implementation changes |
| `artifact_only` | Run | Skip | Run (rubric only, no build/test) | Tasks without code changes such as documentation or design |
| `closure_ready` | Run | Skip | Simplified (completeness check only) | Final cleanup tasks such as release or config |

---

## Tier 0 — Precheck

Verify that all prerequisites are in place before running expensive checks.

### Checks

1. **Required artifacts existence**
   - record.json must contain a `self_check` section (`.geas/missions/{mission_id}/tasks/{task-id}/record.json`)
   - Specialist reviews must exist in `tasks/{task-id}/evidence/` (per the task's required reviewer set)
   - Integration result must be recorded (for `implementation_change` profile)

2. **Task state eligibility**
   - `implementation_change` profile: task must be in `integrated` state
   - `artifact_only` profile: task must be in `reviewed` state
   - `closure_ready` profile: task must be in `reviewed` or `integrated` state

3. **Baseline check**
   - For `implementation_change`: verify `base_snapshot` ancestry — the integration branch must contain the declared base snapshot

4. **Required reviewer presence**
   - All agent types listed in the task's required reviewer set must have submitted reviews

### On Tier 0 Failure

- **Missing required artifact**: verdict = `block`. Does NOT consume retry_budget. Gate re-entry not allowed until the artifact is created.
- **Task state ineligible**: verdict = `error`. The orchestration-authority inspects and corrects the state.
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

Compare files changed against the task's `scope.surfaces`:
1. Read `scope.surfaces` from the TaskContract (or implementation contract)
2. List all files modified by the worker
3. Flag any file outside `scope.surfaces` as a potential scope violation
4. Minor scope violations (e.g., shared config files): record as warning
5. Major scope violations (touching unrelated modules): Tier 2 fails

### Part C: Known Risk Handling

Verify that each item in the implementation contract's `known_risks` has been handled:
- **Mitigated**: evidence shows the risk was addressed
- **Accepted with rationale**: explicit rationale recorded for accepting the risk
- **Deferred to debt**: recorded in the debt register

Any `known_risk` with no handling status -> Tier 2 fails.

### Part D: Rubric Scoring

Read the `rubric` array from the TaskContract. For each dimension:

1. Identify the evaluator's evidence:
   - `design-authority` review evidence -> `output_quality` score
   - `quality_specialist` evidence -> `core_interaction`, `output_completeness`, `regression_safety` scores
   - `quality_specialist` or `communication_specialist` evidence -> `ux_clarity`, `visual_coherence` scores (UI-sensitive tasks)
2. Read the evaluator's `rubric_scores` from their review
3. Compare each score against the dimension's `threshold`

#### Default Dimensions

| dimension | evaluator | default threshold |
|---|---|---:|
| `core_interaction` | `quality_specialist` | 3 |
| `output_completeness` | `quality_specialist` | 4 |
| `output_quality` | `design-authority` | 4 |
| `regression_safety` | `quality_specialist` | 4 |

UI-sensitive tasks add:

| dimension | evaluator | default threshold |
|---|---|---:|
| `ux_clarity` | `quality_specialist` or `communication_specialist` | 3 |
| `visual_coherence` | `quality_specialist` or `communication_specialist` | 3 |

#### Low Confidence Threshold Adjustment

Read `confidence` from record.json `self_check` section. If `confidence` <= 2, add +1 to **every** rubric dimension threshold.

Example: if confidence is 2, thresholds become: `core_interaction` 3->4, `output_completeness` 4->5, `output_quality` 4->5, `regression_safety` 4->5.

#### Stub Check

If `possible_stubs[]` from the record.json `self_check` section is non-empty:
1. Verify those locations are not left as stubs
2. If confirmed stubs exist: `output_completeness` is capped at a maximum of 2
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
    { "dimension": "output_quality", "score": 3, "threshold": 4, "passed": false }
  ],
  "blocking_dimensions": ["output_quality"]
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
- The orchestration-authority resolves the cause and re-runs the gate
- If the same cause produces `error` 3 consecutive times, the task transitions to `blocked` and the cause is recorded

---

## Output

Write gate result to record.json via CLI:
```bash
Bash("geas task record add --task {task-id} --section gate_result < <gate_result_json_file>")
```

Envelope fields (`version`, `artifact_type`, `artifact_id`, `producer_type`, `created_at`) are auto-injected by the CLI — agents only need to provide the content fields below.

```json
{
  "task_id": "{task-id}",
  "gate_profile": "implementation_change",
  "verdict": "pass",
  "tier_results": {
    "tier_0": { "status": "pass", "details": "All prerequisites verified" },
    "tier_1": { "status": "pass", "details": "All eval_commands passed" },
    "tier_2": { "status": "pass", "details": "All criteria met, rubric passed" }
  },
  "rubric_scores": [
    { "dimension": "core_interaction", "score": 4, "threshold": 3, "passed": true },
    { "dimension": "output_completeness", "score": 4, "threshold": 4, "passed": true },
    { "dimension": "output_quality", "score": 4, "threshold": 4, "passed": true },
    { "dimension": "regression_safety", "score": 5, "threshold": 4, "passed": true }
  ],
  "blocking_dimensions": [],
  "retry_budget_before": 3,
  "retry_budget_after": 3
}
```

Also log a detailed event via CLI:
```bash
Bash("geas event log --type gate_result --task {task-id} --data '{\"result\":\"pass\",\"gate_profile\":\"implementation_change\",\"tier_results\":{\"tier_0\":{\"status\":\"pass\"},\"tier_1\":{\"status\":\"pass\"},\"tier_2\":{\"status\":\"pass\"}},\"blocking_dimensions\":[]}'")
```

---

## On Pass

1. Update TaskContract status: `Bash("geas task transition --mission {mission_id} --id {task-id} --to verified")`
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
     - `"design-authority-review"`: spawn the `design-authority` for architectural review, write a DecisionRecord
     - `"product-authority-decision"`: spawn the `product-authority` for a strategic decision (continue/cut/pivot)
     - `"pivot"`: invoke `/geas:vote-round`
   - Update TaskContract status: `Bash("geas task transition --mission {mission_id} --id {task-id} --to escalated")`
   - Write a DecisionRecord via CLI: `Bash("geas decision write --mission {mission_id} <<'EOF'\n<decision_json>\nEOF")`

## On Block

1. Do NOT decrement `retry_budget` (`retry_budget_after` = `retry_budget_before`)
2. Record the blocking cause in the gate result
3. Task cannot re-enter the gate until the blocking cause is resolved
4. The orchestration-authority is responsible for resolving the block

---

## Decision Records

When the gate results in an escalation or significant decision, write a DecisionRecord:

Write the DecisionRecord via CLI (the CLI creates the decisions directory automatically):
```bash
Bash("geas decision write --mission {mission_id} <<'EOF'\n<decision_record_json>\nEOF")
```
The CLI enforces schema validation on the decision record.

This creates a durable record of WHY a decision was made, not just WHAT happened.
