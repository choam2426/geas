---
name: sprint
description: Add a bounded feature to an existing project with the Geas team — Design, Build, Review, QA.
user-invocable: true
---

# Sprint Mode

One feature, one pipeline. Skips Genesis.

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

### 1. Compile TaskContract
Invoke `/geas:task-compiler` for the feature. The TaskContract MUST include a `rubric` array. Base dimensions: core_interaction(3), feature_completeness(4), code_quality(4), regression_safety(4). Add ux_clarity(3), visual_coherence(3) for frontend tasks.

After compilation, write `remaining_steps` to checkpoint:
```json
"remaining_steps": ["design", "tech_guide", "implementation_contract", "implementation", "code_review", "testing", "evidence_gate", "critic_review", "nova_review", "retrospective", "resolve"]
```
Remove steps that will be skipped. After completing each step, remove it from the front of the array and update run.json.

**Rubric check**: If the TaskContract is missing `rubric`, insert the default (same as initiative mode).

**Event logging**: After each step completes and is removed from `remaining_steps`, log:
```
Append to .geas/ledger/events.jsonl:
{"event": "step_complete", "task_id": "{task-id}", "step": "{step_name}", "agent": "{agent_name}", "timestamp": "<actual>"}
```
Exception: `implementation_contract`, `gate_result`, and `task_resolved` have their own event formats. Do not duplicate those.

### 2. Design (Palette) [DEFAULT — skip-if: no user-facing interface]
**Must run if the task has any user-facing interface (pages, forms, dashboards).**
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
Update run.json checkpoint: `pipeline_step` = "implementation", `agent_in_flight` = "{worker}"
```
Agent(agent: "{worker}", isolation: "worktree", prompt: "Read .geas/packets/{task-id}/{worker}.md. Implement. Write evidence to .geas/evidence/{task-id}/{worker}.json")
```
Verify evidence. Merge worktree.

### 6. Code Review (Forge) [MANDATORY]
Update run.json checkpoint: `pipeline_step` = "code_review", `agent_in_flight` = "forge"
```
Agent(agent: "forge", prompt: "Read .geas/packets/{task-id}/forge-review.md. Review code. Write to .geas/evidence/{task-id}/forge-review.json")
```
Verify evidence.

### 7. Testing (Sentinel) [MANDATORY]
Update run.json checkpoint: `pipeline_step` = "testing", `agent_in_flight` = "sentinel"
```
Agent(agent: "sentinel", prompt: "Read .geas/packets/{task-id}/sentinel.md. Test feature. Write to .geas/evidence/{task-id}/sentinel.json")
```
Verify evidence.

### 8. Evidence Gate
Run eval_commands. Check acceptance criteria. Log detailed result.
If fail → invoke `/geas:verify-fix-loop`. **Spawn the worker agent to fix.** After fix, re-run gate.

### 8.5 Critic Pre-ship Review [MANDATORY]
Update run.json checkpoint: `pipeline_step` = "critic_review", `agent_in_flight` = "critic"
```
Agent(agent: "critic", prompt: "Read all evidence at .geas/evidence/{task-id}/. Challenge: is this truly ready to ship? Identify risks, missing edge cases, or technical debt. Write to .geas/evidence/{task-id}/critic-review.json")
```
Verify `.geas/evidence/{task-id}/critic-review.json` exists.

### 9. Nova Product Review [MANDATORY]
Update run.json checkpoint: `pipeline_step` = "nova_review", `agent_in_flight` = "nova"
```
Agent(agent: "nova", prompt: "Read all evidence at .geas/evidence/{task-id}/. Verdict: Ship/Iterate/Cut. Write to .geas/evidence/{task-id}/nova-verdict.json")
```

### Ship Gate
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
- Iterate → re-dispatch with feedback
- Cut → `"failed"`, write DecisionRecord

### 11. Run Summary
Invoke `/geas:run-summary` to generate session audit trail.
