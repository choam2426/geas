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
"remaining_steps": ["design", "tech_guide", "implementation_contract", "implementation", "self_check", "code_review", "testing", "evidence_gate", "critical_reviewer", "final_verdict", "retrospective", "resolve"]
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
- **critical_reviewer → final_verdict** — Nova's prompt requires `critic-review.json` as input. Critic MUST complete and evidence MUST be verified before spawning Nova.

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

### 8.5 Critical Reviewer Challenge [MANDATORY]
Update run.json checkpoint: `pipeline_step` = "critical_reviewer", `agent_in_flight` = "critic"
```
Agent(agent: "critic", prompt: "Read all evidence at .geas/evidence/{task-id}/. Challenge: is this truly ready to ship? Identify risks, missing edge cases, or technical debt. Write to .geas/evidence/{task-id}/critic-review.json")
```
Verify `.geas/evidence/{task-id}/critic-review.json` exists.

### 9. Final Verdict (Nova) [MANDATORY — after critical_reviewer only]
**Precondition:** `.geas/evidence/{task-id}/critic-review.json` must exist. Do NOT spawn Nova until Critic has returned and evidence is verified.
Update run.json checkpoint: `pipeline_step` = "final_verdict", `agent_in_flight` = "nova"
```
Agent(agent: "nova", prompt: "Read all evidence at .geas/evidence/{task-id}/. Verdict: Ship/Iterate/Cut. Write to .geas/evidence/{task-id}/nova-verdict.json")
```
Note: "Iterate" is only valid as a Final Verdict outcome from Nova. Gate verdicts (evidence-gate) are pass/fail/block/error.

### Closure Packet
**Before marking "passed", verify these exist:**
- `.geas/evidence/{task-id}/forge-review.json`
- `.geas/evidence/{task-id}/sentinel.json`
- `.geas/evidence/{task-id}/critic-review.json`
- `.geas/evidence/{task-id}/nova-verdict.json`
**If ANY missing: execute the missing step. Do NOT proceed without all four.**

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
- Iterate (Final Verdict only) → deduct retry_budget (if exhausted → escalate to orchestration_authority). Repopulate remaining_steps with full pipeline (same skip conditions). Include Nova's feedback in all ContextPackets. Resume from first non-skipped step. See evidence-gate "On Iterate" for full procedure.
- Cut → `"cancelled"`, write DecisionRecord

### 11. Run Summary
Invoke `/geas:run-summary` to generate session audit trail.
