---
name: sprint
description: Add a bounded feature to an existing project with the Geas team — Design, Build, Review, QA.
user-invocable: true
---

# Delivery Mode (Sprint Pattern)

One feature, one pipeline. Skips Discovery.

**Every step in the pipeline is executed. Code Review and Testing are mandatory.**

---

## Pre-conditions

1. `.geas/spec/seed.json` — read-only project context. If it exists (from Initiative or prior Sprint), read it for mission/constraints. If it doesn't exist, intake will create a minimal one. Sprint NEVER modifies seed.json after it exists.
2. `.geas/memory/_project/conventions.md` — if missing, spawn Forge for onboarding:
   ```
   Agent(agent: "forge", prompt: "Scan this codebase. Write conventions to .geas/memory/_project/conventions.md")
   ```

---

## Sprint Pipeline

### Task File Precondition
The TaskContract MUST be written to `.geas/tasks/{task-id}.json` before the pipeline starts. Do NOT enter the pipeline without a task file on disk. This is required for Closure Packet validation and session recovery.

### 1. Compile TaskContract
Invoke `/geas:task-compiler` for the feature. The TaskContract MUST include a `rubric` object with a `dimensions` array. Base dimensions: core_interaction(3), feature_completeness(4), code_quality(4), regression_safety(4). Add ux_clarity(3), visual_coherence(3) for frontend tasks.

After compilation, write `remaining_steps` to checkpoint:
```json
"remaining_steps": ["design", "tech_guide", "implementation_contract", "implementation", "self_check", "code_review", "testing", "evidence_gate", "closure_packet", "critical_reviewer", "final_verdict", "retrospective", "resolve"]
```
Remove steps that will be skipped. After completing each step, remove it from the front of the array and update run.json.

**Rubric check**: If the TaskContract is missing `rubric`, insert the default:
```json
"rubric": {
  "dimensions": [
    { "name": "core_interaction", "threshold": 3 },
    { "name": "feature_completeness", "threshold": 4 },
    { "name": "code_quality", "threshold": 4 },
    { "name": "regression_safety", "threshold": 4 }
  ]
}
```
Add `ux_clarity` (threshold 3) and `visual_coherence` (threshold 3) if the task has a UI component.

**[MANDATORY] Event logging**: After each step completes and is removed from `remaining_steps`, log:
```
Append to .geas/ledger/events.jsonl:
{"event": "step_complete", "task_id": "{task-id}", "step": "{step_name}", "agent": "{agent_name}", "timestamp": "<actual>"}
```
Exception: `implementation_contract`, `gate_result`, and `task_resolved` have their own event formats. Do not duplicate those.

### Step Groups

Within a single task's pipeline, these steps may run in parallel:
- **[code_review, testing]** — forge and sentinel do not reference each other's output. Spawn both in one message. After both return, remove both from `remaining_steps` and log `step_complete` for each.

All other steps are strictly sequential. In particular:
- **critical_reviewer → final_verdict** — Nova's prompt requires `challenge-review.json` as input. Critic MUST complete and file MUST be verified before spawning Nova.

### 2. Design (Palette) [DEFAULT — skip-if: no user-facing interface]
**Must run if the task has any user-facing interface (pages, forms, dashboards).**
Generate ContextPacket, then:
Update run.json checkpoint: `pipeline_step` = "design", `agent_in_flight` = "palette"
```
Agent(agent: "palette", prompt: "Read .geas/packets/{task-id}/palette.md. Write design to .geas/evidence/{task-id}/palette.json")
```
Verify evidence exists.

### 3. Tech Guide (Forge) [DEFAULT — skip when ALL: existing pattern, no new libs, single module, no schema change]
**Skip** when ALL of these are true:
- Task follows an existing pattern in conventions.md
- No new external libraries or services
- Single module scope (no cross-boundary changes)
- No data model or schema changes

**Spawn** when ANY of these are true:
- New external library/service integration
- Architecture pattern change
- Cross-module dependencies
- New data model or schema changes

Generate ContextPacket, then:
Update run.json checkpoint: `pipeline_step` = "tech_guide", `agent_in_flight` = "forge"
```
Agent(agent: "forge", prompt: "Read .geas/packets/{task-id}/forge.md. Write tech guide to .geas/evidence/{task-id}/forge.json")
```
Verify evidence exists.

### 4. Implementation Contract [MANDATORY]
Invoke `/geas:implementation-contract` — worker writes action plan, Sentinel and Forge approve before coding.
Update run.json checkpoint: `pipeline_step` = "implementation_contract", `agent_in_flight` = "{worker}"
Verify `.geas/contracts/{task-id}.json` exists with `status: "approved"`.

### 5. Implementation [MANDATORY — worktree isolated]
Generate ContextPacket, then:
Update run.json checkpoint: `pipeline_step` = "implementation", `agent_in_flight` = "{worker}"
```
Agent(agent: "{worker}", isolation: "worktree", prompt: "Read .geas/packets/{task-id}/{worker}.md. Implement. Write evidence to .geas/evidence/{task-id}/{worker}.json")
```
Verify evidence. Merge worktree. After successful merge, update TaskContract status to `"integrated"`.

### 5.5 Worker Self-Check [MANDATORY]
Update run.json checkpoint: `pipeline_step` = "self_check", `agent_in_flight` = "{worker}"
```
Agent(agent: "{worker}", prompt: "Implementation for {task-id} is complete. Before handing off to code review, produce your self-check artifact. Write .geas/tasks/{task-id}/worker-self-check.json conforming to docs/protocol/schemas/worker-self-check.schema.json. Required fields: version (\"1.0\"), artifact_type (\"worker_self_check\"), artifact_id (e.g. \"self-check-{task-id}\"), producer_type (your agent type: frontend_engineer | backend_engineer | devops_engineer | technical_writer), task_id, known_risks (string[]), untested_paths (string[]), possible_stubs (string[]), what_to_test_next (string[]), confidence (integer 1-5: 1=very_low … 5=very_high), summary (string), created_at (ISO 8601 timestamp).")
```
Verify `.geas/tasks/{task-id}/worker-self-check.json` exists. Do NOT proceed to Code Review without this file.

### 6. Code Review (Forge) [MANDATORY]
Generate ContextPacket, then:
Update run.json checkpoint: `pipeline_step` = "code_review", `agent_in_flight` = "forge"
```
Agent(agent: "forge", prompt: "Read .geas/packets/{task-id}/forge-review.md. Review code. Write to .geas/evidence/{task-id}/forge-review.json")
```
Verify evidence.
Update TaskContract status to `"reviewed"`.
Update run.json checkpoint: `pipeline_step` = "code_review"

### 7. Testing (Sentinel) [MANDATORY]
Generate ContextPacket, then:
Update run.json checkpoint: `pipeline_step` = "testing", `agent_in_flight` = "sentinel"
```
Agent(agent: "sentinel", prompt: "Read .geas/packets/{task-id}/sentinel.md. Test feature. Write to .geas/evidence/{task-id}/sentinel.json")
```
Verify evidence.
Update run.json checkpoint: `pipeline_step` = "testing"

### 8. Evidence Gate
Run eval_commands. Check acceptance criteria. Log detailed result.
On gate pass: update TaskContract status to `"verified"`.
If fail → invoke `/geas:verify-fix-loop`. **Spawn the worker agent to fix.** After fix, re-run gate.

### 8.25 Closure Packet Assembly [MANDATORY — after gate pass]

orchestration_authority (Orchestrator) assembles the closure packet by reading all task artifacts. This is NOT an agent spawn — Orchestrator reads and writes directly.

**Read required artifacts:**
- TaskContract: `.geas/tasks/{task-id}.json`
- Worker Self-Check: `.geas/tasks/{task-id}/worker-self-check.json`
- Gate Result: `.geas/tasks/{task-id}/gate-result.json`
- Specialist Reviews: `.geas/evidence/{task-id}/forge-review.json`, `.geas/evidence/{task-id}/sentinel.json`
- Integration Result: from worktree merge (commit hash, conflict status)

**If ANY required artifact is missing: go back and execute the missing step. Do NOT proceed.**

**Write** `.geas/tasks/{task-id}/closure-packet.json` conforming to `docs/protocol/schemas/closure-packet.schema.json`:

```json
{
  "version": "1.0",
  "artifact_type": "closure_packet",
  "artifact_id": "closure-{task-id}",
  "producer_type": "orchestration_authority",
  "created_at": "<ISO 8601 timestamp>",
  "task_id": "{task-id}",
  "task_summary": "<one-line summary from TaskContract description>",
  "change_summary": "<brief description of what was implemented>",
  "specialist_reviews": [
    {
      "reviewer_type": "architecture_authority",
      "status": "approved",
      "summary": "<key finding from forge-review.json>"
    },
    {
      "reviewer_type": "qa_engineer",
      "status": "approved",
      "summary": "<key finding from sentinel.json>"
    }
  ],
  "integration_result": {
    "status": "success",
    "merge_commit": "<commit hash from worktree merge>"
  },
  "verification_result": {
    "gate_verdict": "pass",
    "rubric_scores": [
      { "dimension": "core_interaction", "score": 4, "passed": true },
      { "dimension": "feature_completeness", "score": 4, "passed": true },
      { "dimension": "code_quality", "score": 4, "passed": true },
      { "dimension": "regression_safety", "score": 4, "passed": true }
    ]
  },
  "worker_self_check": {
    "confidence": 4,
    "known_risks": ["<from worker-self-check.json known_risks>"],
    "untested_paths": ["<from worker-self-check.json untested_paths>"]
  },
  "open_risks": {
    "status": "none",
    "items": []
  },
  "debt_snapshot": {
    "status": "none",
    "items": []
  },
  "readiness_round": null
}
```

Set `readiness_round: null` initially — may be updated by the critical reviewer step.

**Verify** `.geas/tasks/{task-id}/closure-packet.json` exists and all required fields are populated before proceeding.

Update run.json checkpoint: `pipeline_step` = "closure_packet"

### 8.5 Critical Reviewer Challenge [CONDITIONAL — mandatory for high/critical risk]

**Skip condition:** If `risk_level` is `low` or `normal`, this step is at orchestration_authority's discretion. If skipped: remove `"critical_reviewer"` from `remaining_steps`, update run.json checkpoint, and proceed directly to Final Verdict.

**Mandatory condition:** If `risk_level` is `high` or `critical`, this step MUST run.

Update run.json checkpoint: `pipeline_step` = "critical_reviewer", `agent_in_flight` = "critic"
```
Agent(agent: "critic", prompt: "Read the closure packet at .geas/tasks/{task-id}/closure-packet.json. Read all evidence at .geas/evidence/{task-id}/. You MUST raise at least 1 substantive concern — surface a real risk, edge case, or technical debt item. For each concern, state clearly whether it is BLOCKING or non-blocking. Write .geas/tasks/{task-id}/challenge-review.json with the following fields: reviewer_type (\"critical_reviewer\"), concerns (array of strings, each prefixed with \"[BLOCKING]\" or \"[non-blocking]\"), blocking (boolean — true if ANY concern is blocking).")
```

Verify `.geas/tasks/{task-id}/challenge-review.json` exists.

**After critic returns:**

1. Read `.geas/tasks/{task-id}/challenge-review.json`.
2. Update the closure packet: add a `challenge_review` field populated from the review.
3. **If `blocking` is true:**
   - Add blocking concerns to `open_risks` in the closure packet: set `status: "present"` and append each blocking concern as an item.
   - Invoke `/geas:vote-round` as a readiness_round:
     - Participants: orchestration_authority, product_authority, 1 specialist (most relevant to the blocking concern)
     - Vote options: ship / iterate / escalate
     - Record the outcome in the closure packet `readiness_round` field
   - **If ship:** convert blocking concerns to acknowledged risks (add `acknowledged: true` to each item in `open_risks`). Proceed to Final Verdict.
   - **If iterate:** rewind to resolve the blocking concern. Repopulate `remaining_steps` from the rewind point.
   - **If escalate:** set task status to `"escalated"`. Write a DecisionRecord. Stop pipeline.
4. **If `blocking` is false:** record concerns in the closure packet `challenge_review` field. Proceed to Final Verdict.

Update run.json checkpoint: `pipeline_step` = "critical_reviewer"

### 9. Final Verdict (Nova) [MANDATORY — after critical_reviewer only]
**Preconditions:**
- `.geas/tasks/{task-id}/challenge-review.json` must exist OR `critical_reviewer` was explicitly skipped for low/normal risk
- Closure Packet must be assembled (all required fields populated)
- Do NOT spawn Nova until both preconditions are verified

Update run.json checkpoint: `pipeline_step` = "final_verdict", `agent_in_flight` = "nova"
```
Agent(agent: "nova", prompt: "Read the closure packet at .geas/tasks/{task-id}/closure-packet.json (which includes the challenge_review field if critic ran) and all evidence at .geas/evidence/{task-id}/. Decide: pass, iterate, or escalate. Write .geas/tasks/{task-id}/final-verdict.json conforming to docs/protocol/schemas/final-verdict.schema.json. Required fields: version (\"1.0\"), artifact_type (\"final_verdict\"), artifact_id (e.g. \"verdict-{task-id}\"), producer_type (\"product_authority\"), created_at (ISO 8601 timestamp), task_id, verdict (\"pass\" | \"iterate\" | \"escalate\"), rationale (why this verdict), closure_packet_ref (path to closure packet). If iterate: include rewind_target (\"ready\" | \"implementing\" | \"reviewed\") and iterate_count. If escalate: include escalation_reason. Also write to .geas/evidence/{task-id}/nova-verdict.json for backward compatibility.")
```

**Verdict rules:**
- `pass` -> task proceeds to Resolve (status `"passed"`)
- `iterate` -> specify `rewind_target` (ready/implementing/reviewed). Does NOT consume `retry_budget`. After 3 cumulative iterates for the same task -> `escalated`.
- `escalate` -> requires higher-level decision-making. Include `escalation_reason`.

Note: "iterate" is only valid as a Final Verdict outcome. Gate verdicts (evidence-gate) are pass/fail/block/error.

### Pre-Resolve Check
**Before marking "passed", verify:**
- `.geas/tasks/{task-id}/closure-packet.json` exists (assembled in Step 8.25)
- `.geas/tasks/{task-id}/challenge-review.json` exists OR critical_reviewer was explicitly skipped (low/normal risk)
- `.geas/tasks/{task-id}/final-verdict.json` exists with `verdict: "pass"`
**If ANY missing: execute the missing step. Do NOT proceed without all three.**

### Retrospective (Scrum) [MANDATORY]
Update run.json checkpoint: `pipeline_step` = "retrospective", `agent_in_flight` = "scrum"
```
Agent(agent: "scrum", prompt: "Read all evidence at .geas/evidence/{task-id}/. Run retrospective: update rules.md with new conventions, write lessons to .geas/memory/retro/{task-id}.json")
```
Verify `.geas/memory/retro/{task-id}.json` exists.

### 10. Resolve
- Ship → Read `.geas/tasks/{task-id}.json`, set `"status": "passed"`, Write it back. Then spawn Keeper for commit:
  Update run.json checkpoint: `pipeline_step` = "resolve", `agent_in_flight` = "keeper"
  ```
  Agent(agent: "keeper", prompt: "Commit all changes for {task-id} with conventional commit format. Write to .geas/evidence/{task-id}/keeper.json")
  ```
- Iterate (Final Verdict only) → does NOT deduct retry_budget (iterate is a product judgment, not a gate failure). Track iterate_count — after 3 cumulative iterates, escalate to orchestration_authority. Repopulate remaining_steps with full pipeline (same skip conditions). Include Nova's feedback in all ContextPackets. Resume from the rewind_target specified in the final verdict.
- Cut → `"cancelled"`, write DecisionRecord

### 11. Run Summary
Invoke `/geas:run-summary` to generate session audit trail.
