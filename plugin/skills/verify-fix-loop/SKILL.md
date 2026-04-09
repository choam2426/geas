---
name: verify-fix-loop
description: Verify-Fix Loop — bounded fix-verify inner loop. Reads TaskContract for retry budget, produces EvidenceBundle per iteration, writes DecisionRecord on escalation. Max iterations from contract (default 3).
---

# Verify-Fix Loop Protocol

After the evidence gate fails, this loop ensures bugs are actually fixed — not just "code is written."

**KEY PRINCIPLE: Completion = Evidence Gate says PASS, not "code is written."**

---

## Entry Point

Read the gate failure details:
1. **TaskContract** from `.geas/missions/{mission_id}/tasks/{task-id}/contract.json` — for retry_budget and escalation_policy
2. **Failed EvidenceBundle** from `.geas/missions/{mission_id}/tasks/{task-id}/evidence/quality-specialist.json` — for specific failures
3. **Gate verdict** — which tier failed (mechanical or semantic) and why

---

## If Gate Passed

Exit the loop. Return to the pipeline — next step is Closure Packet assembly, then Critical Reviewer Challenge, then Final Verdict.

---

## If Gate Failed — Enter Fix Loop

### Read Retry Budget

From the TaskContract:
- `retry_budget`: maximum fix-verify iterations (default: 3)
- `escalation_policy`: what to do when budget exhausted

Track current iteration count in `.geas/state/run.json` under `current_task_id`.

### Iteration N (repeat up to retry_budget times)

#### Step A — Identify the Fixer
- Spawn the **implementer** assigned to this task (from `routing.primary_worker_type` in the TaskContract)
- If the task requires multiple implementers, spawn each with clear ownership of which bugs each agent owns

#### Step B — Spawn Fixer with ContextPacket
Generate a fix-specific ContextPacket:
- Include the specific failures from the gate verdict
- Include the original acceptance criteria that weren't met
- **Include `blocking_dimensions` from rubric evaluation** — the fixer must know which quality dimensions failed and their current scores vs. thresholds
- Include files_changed from the previous attempt
- Reference the full EvidenceBundle for context
- If the worker's `self_check.untested_paths` overlap with failure areas, highlight the connection

Resolve `project_root` — the absolute path of the main session working directory (see mission/SKILL.md "Worktree state access rule").

Spawn the fixer **with worktree isolation** (implementation agents always use worktree):
```
Agent(agent: "{fixer}", isolation: "worktree", prompt: "IMPORTANT: You are running in a worktree. The .geas/ directory is NOT available via relative paths. Use the absolute paths below for ALL .geas/ access. Read your ContextPacket at {project_root}/.geas/missions/{mission_id}/tasks/{task-id}/packets/{fixer}-fix-{N}.md. Fix the specific failures listed in your packet. Write your results by running: node {project_root}/plugin/cli/index.js --cwd {project_root} evidence add --task {task-id} --agent {fixer}-fix-{N} --role implementer --set summary=... --set files_changed=...")
```

After the fixer completes, merge the worktree branch before re-running the evidence gate. If merge conflicts arise, follow the orchestration_authority merge conflict protocol.

#### Step C — Re-run Evidence Gate
After the fixer completes:
- Invoke `/evidence-gate` with the updated evidence and TaskContract
- Gate re-runs Tier 1 (mechanical) and Tier 2 (semantic)

#### Step D — Evaluate
- If **PASS**: exit loop, return to pipeline.
- If **FAIL**: check remaining retry budget.
  - Budget remaining → next iteration
  - Budget exhausted → escalation

---

## After Budget Exhausted — Escalation

Follow the TaskContract's `escalation_policy`:

### `"design-authority-review"` (default)

Spawn **design-authority** for architectural review:
```
The evidence gate has failed {retry_budget} times for task {task-id}.
Read the TaskContract at .geas/missions/{mission_id}/tasks/{task-id}/contract.json
Read all evidence at .geas/missions/{mission_id}/tasks/{task-id}/evidence/
Analyze: Is there a fundamental design issue? Is the approach viable?
Write your analysis as evidence. Run: geas evidence add --task {task-id} --agent design-authority-escalation --role authority --set "summary=<assessment>" --set "verdict=<approved|blocked>" --set "rationale=<reasoning>"
```

Then evaluate design_authority's assessment:
- If design_authority identifies a fixable root cause: apply the fix, re-test one more time.
- If design_authority says the approach is broken: escalate to product_authority.

### `"product-authority-decision"`

Spawn **product-authority** with full context:
- TaskContract, all evidence bundles, gate verdicts
- product_authority decides: scope cut, feature drop, alternative approach, or push through.

### `"pivot"`

Invoke `/geas:vote-round` with full context.

### Write DecisionRecord

For any escalation, write a DecisionRecord via CLI:
```bash
Bash("geas decision write --mission {mission_id} --data '<decision_record_json>'")
```
The data must conform to the decision record schema:
```json
{
  "version": "1.0",
  "id": "dec-003",
  "title": "Escalation: {task-title} failed {retry_budget} fix attempts",
  "context": "Evidence gate failed repeatedly. Tier failures: ...",
  "options": [...],
  "decision": "...",
  "reasoning": "...",
  "trade_offs": "...",
  "decided_by": "design-authority|product-authority",
  "participants": ["quality-specialist", "implementer", "design-authority"],
  "related_task_id": "{task-id}",
  "created_at": "..."
}
```

Log the escalation event via CLI:
```bash
Bash("geas event log --type escalation --task {task-id} --data '{\"escalation_policy\":\"...\",\"retry_budget_exhausted\":true}'")
```

---

## Summary

```
Evidence Gate PASS?
  YES -> Return to pipeline (Closure Packet -> Critical Reviewer -> Final Verdict)
  NO  -> Fix (implementer) -> Re-gate
         PASS? -> Return to pipeline (Closure Packet -> Critical Reviewer -> Final Verdict)
         NO    -> Fix -> Re-gate (iteration 2)
                  PASS? -> Return to pipeline (Closure Packet -> Critical Reviewer -> Final Verdict)
                  NO    -> ... (up to retry_budget)
                           Budget exhausted?
                           -> escalation_policy:
                              design-authority-review -> design_authority analysis -> fixable? -> one more try
                              product-authority-decision -> product_authority decides
                              pivot -> /geas:vote-round
                           -> Write DecisionRecord
```
