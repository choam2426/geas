---
name: evidence-gate
description: Three-tier quality gate — evaluates an EvidenceBundle against its TaskContract. Mechanical (build/lint/test), semantic (acceptance criteria), and product (Nova judgment).
---

# Evidence Gate

Evaluates whether a worker's output meets the TaskContract requirements. This is the gatekeeper that ensures "done" means "contract fulfilled", not "agent says done".

## When to Use

Compass invokes this skill after collecting an EvidenceBundle from a worker.

## Inputs

1. **EvidenceBundle** — read from `.geas/evidence/{task-id}/{worker-name}.json`
2. **TaskContract** — read from `.geas/tasks/{task-id}.json`
3. **Gate level** — which tiers to run (see below)

## Three-Tier Gate

### Tier 1: Mechanical Gate

Run the eval commands from the TaskContract and check results.

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
   - **skip**: command not applicable or not configured

**Stop on first failure** — no point running semantic checks if the code doesn't build.

> **Important:** You MUST execute eval_commands and record the results. Do not assume "pass". If no commands exist, record as `"skip"`. Having commands but not running them is a gate violation.

If the EvidenceBundle already contains `verify_results`, compare them against a fresh run. Trust the fresh run.

### Tier 2: Semantic Gate

Two-part evaluation: acceptance criteria check + rubric scoring.

#### Part A: Acceptance Criteria

For each criterion in `acceptance_criteria`:
1. Read the worker's evidence (summary, files_changed, criteria_results if present)
2. Assess whether the criterion is met:
   - If the worker provided `criteria_results` → verify their self-assessment
   - If not → infer from the evidence (files changed, test results, code inspection)
3. Record: `{ "criterion": "...", "met": true/false, "evidence": "..." }`

**All criteria must be met** to proceed to Part B.

#### Part B: Rubric Scoring

Read the `rubric` array from the TaskContract. For each dimension:
1. Identify the evaluator's evidence:
   - Forge's code review evidence → `code_quality` score
   - Sentinel's QA evidence → `core_interaction`, `feature_completeness`, `regression_safety`, `ux_clarity`, `visual_coherence` scores
2. Read the evaluator's `rubric_scores` from their EvidenceBundle
3. Compare each score against the dimension's `threshold`

**Threshold adjustment**: If the worker's `self_check.confidence` ≤ 2, add +1 to every rubric threshold (stricter review for uncertain work).

**Stub check**: If the worker's `self_check.possible_stubs` is non-empty, verify those files are not left as stubs. Any confirmed stub → `feature_completeness` capped at 2.

Record rubric results:
```json
{
  "rubric_scores": [
    { "dimension": "core_interaction", "score": 4, "evaluator": "sentinel", "threshold": 3, "pass": true },
    { "dimension": "code_quality", "score": 3, "evaluator": "forge", "threshold": 4, "pass": false }
  ],
  "rubric_pass": false,
  "blocking_dimensions": ["code_quality"]
}
```

**All rubric dimensions must meet their threshold** for Tier 2 to pass. If any dimension is below threshold, Tier 2 fails and the task cannot proceed to Tier 3 (Nova). The `blocking_dimensions` list tells the verify-fix-loop exactly what to target.

### Tier 3: Product Gate

Spawn Nova for a ship/iterate/cut judgment (Final Verdict). Only run this tier for:
- Feature completion (not for intermediate steps like design or code review)
- Phase completion (end of Build, Polish, Evolution)
- Pivot decisions

Nova receives:
- The task goal
- All evidence bundles for this task
- Criteria results from Tier 2
- Mission context from seed

Nova's Final Verdict:
- **Ship**: meets all criteria, good quality, aligned with mission
- **Iterate**: partially meets criteria, specific improvements needed (only valid as a Final Verdict, not as a gate verdict)
- **Cut**: fundamentally misaligned or not worth fixing

## Gate Levels

Not every task needs all three tiers:

| Situation | Tiers to Run |
|-----------|-------------|
| Implementation task (code change) | Tier 1 + Tier 2 |
| Design spec (no code) | Tier 2 only |
| Feature completion (ready for Final Verdict) | Tier 1 + Tier 2 + Tier 3 |
| Code review (Forge reviewing) | Tier 2 only |
| QA testing (Sentinel) | Tier 1 + Tier 2 |
| Security review (Shield) | Tier 2 only |
| Phase completion | Tier 1 + Tier 2 + Tier 3 |

## Output

### Gate Verdict

After running all applicable tiers, produce a verdict:

```json
{
  "task_id": "task-003",
  "verdict": "pass | fail | block | error",
  "tiers": {
    "mechanical": { "status": "pass", "results": {...} },
    "semantic": { "status": "pass", "criteria_met": 5, "criteria_total": 5, "rubric_pass": true, "rubric_scores": [...], "blocking_dimensions": [] },
    "product": { "status": "ship", "nova_notes": "..." }
  },
  "failures": [],
  "timestamp": "..."
}
```

### On Pass

1. Update the TaskContract status to `"in_review"` in `.geas/tasks/{task-id}.json` (Critical Reviewer Challenge and Final Verdict still pending — only Resolve sets "passed")
2. Log a **detailed** event to `.geas/ledger/events.jsonl` with tier results. Timestamp must be actual current time (not dummy):
   ```json
   {
     "event": "gate_result",
     "task_id": "task-001",
     "result": "pass",
     "tiers": {
       "mechanical": { "status": "pass", "commands_run": ["{build_command}", "{test_command}"] },
       "semantic": { "status": "pass", "criteria_met": 5, "criteria_total": 5, "rubric_pass": true, "rubric_scores": [...], "blocking_dimensions": [] },
       "product": { "status": "ship", "nova_notes": "..." }
     },
     "timestamp": "<actual ISO 8601 from date -u>"
   }
   ```
3. Return to Compass to proceed with the next task

### On Fail

1. Check the TaskContract's `retry_budget`
2. If retries remain:
   - Invoke `/verify-fix-loop` with the failure details
   - The fix loop will dispatch the worker again with failure context
   - After fix, re-run the gate
   - Decrement retry count
3. If retries exhausted:
   - Follow the `escalation_policy`:
     - `"forge-review"`: Spawn Forge for architectural review, write a DecisionRecord
     - `"nova-decision"`: Spawn Nova for a strategic decision (continue/cut/pivot)
     - `"pivot"`: Invoke `/pivot-protocol`
   - Update TaskContract status to `"escalated"`
   - Write a DecisionRecord to `.geas/decisions/{dec-id}.json`

### On Iterate (Final Verdict from Nova)

Nova's "Iterate" Final Verdict means the gate passed mechanically and semantically, but the product is not ready from Nova's perspective. Unlike verify-fix-loop (which targets specific gate failures), Iterate triggers a full pipeline re-run because the changes may affect design, implementation approach, or quality across all dimensions. Note: "Iterate" is only valid as a Final Verdict outcome. Gate verdicts are pass/fail/block/error.

**Procedure:**

1. **Deduct retry_budget.** If exhausted → follow `escalation_policy` (same as verify-fix-loop escalation).
2. **Repopulate `remaining_steps`** with the full pipeline, applying the same skip conditions as the original run:
   ```json
   ["design", "tech_guide", "implementation_contract", "implementation",
    "code_review", "testing", "evidence_gate", "critical_reviewer",
    "final_verdict", "retrospective", "resolve"]
   ```
   Remove steps that were skipped originally (e.g., remove `"design"` if the task has no UI).
3. **Generate new ContextPackets** for all downstream workers. Nova's specific feedback MUST be included in every packet as a `## Nova Feedback` section.
4. **Resume from the first non-skipped step** (typically Design or Tech Guide).
5. The full pipeline runs again: Design → Tech Guide → Implementation Contract → Implementation → Code Review → Testing → Evidence Gate → Critical Reviewer Challenge → Final Verdict → Retrospective → Resolve.

**Comparison with verify-fix-loop:**

| | Verify-Fix Loop | Iterate (Final Verdict) |
|---|---|---|
| Trigger | Gate failure (Tier 1 or 2) | Nova Final Verdict (Tier 3) |
| Re-entry point | Implementation only | Full pipeline (Design onward) |
| Scope | Fix specific failures | Product-level improvement |
| Budget | Shared `retry_budget` | Shared `retry_budget` |

## Decision Records

When the gate results in an escalation or significant decision, write a DecisionRecord:

```bash
mkdir -p .geas/decisions
```

Write to `.geas/decisions/{dec-id}.json` conforming to `schemas/decision-record.schema.json`.

This creates a durable record of WHY a decision was made, not just WHAT happened.
