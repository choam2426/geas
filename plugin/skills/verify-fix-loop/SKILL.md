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
1. **TaskContract** from `.geas/tasks/{task-id}.json` — for retry_budget and escalation_policy
2. **Failed EvidenceBundle** from `.geas/evidence/{task-id}/sentinel.json` — for specific failures
3. **Gate verdict** — which tier failed (mechanical or semantic) and why

---

## If Gate Passed

Proceed immediately to **Nova product review** (Tier 3 of evidence-gate). No further action needed.

---

## If Gate Failed — Enter Fix Loop

### Read Retry Budget

From the TaskContract:
- `retry_budget`: maximum fix-verify iterations (default: 3)
- `escalation_policy`: what to do when budget exhausted

Track current iteration count in `.geas/state/run.json` under `current_task_id`.

### Iteration N (repeat up to retry_budget times)

#### Step A — Identify the Fixer
- **Frontend bugs** (UI rendering, form behavior, CSS, client-side logic): spawn **Pixel**
- **Backend bugs** (API errors, data issues, server logic, database): spawn **Circuit**
- **Both**: spawn both, with clear ownership of which bugs each agent owns

#### Step B — Spawn Fixer with ContextPacket
Generate a fix-specific ContextPacket:
- Include the specific failures from the gate verdict
- Include the original acceptance criteria that weren't met
- **Include `blocking_dimensions` from rubric evaluation** — the fixer must know which quality dimensions failed and their current scores vs. thresholds
- Include files_changed from the previous attempt
- Reference the full EvidenceBundle for context
- If the worker's `self_check.untested_paths` overlap with failure areas, highlight the connection

Spawn the fixer **with worktree isolation** (implementation agents always use worktree):
```
Agent(agent: "{fixer}", isolation: "worktree", prompt: "Read your ContextPacket at .geas/packets/{task-id}/{fixer}-fix-{N}.md. Fix the specific failures listed in your packet. Write your results to .geas/evidence/{task-id}/{fixer}-fix-{N}.json")
```

After the fixer completes, merge the worktree branch before re-running the evidence gate. If merge conflicts arise, follow the Compass merge conflict protocol.

#### Step C — Re-run Evidence Gate
After the fixer completes:
- Invoke `/evidence-gate` with the updated evidence and TaskContract
- Gate re-runs Tier 1 (mechanical) and Tier 2 (semantic)

#### Step D — Evaluate
- If **PASS**: exit loop, proceed to Nova product review (Tier 3).
- If **FAIL**: check remaining retry budget.
  - Budget remaining → next iteration
  - Budget exhausted → escalation

---

## After Budget Exhausted — Escalation

Follow the TaskContract's `escalation_policy`:

### `"forge-review"` (default)

Spawn **Forge** for architectural review:
```
The evidence gate has failed {retry_budget} times for task {task-id}.
Read the TaskContract at .geas/tasks/{task-id}.json
Read all evidence at .geas/evidence/{task-id}/
Analyze: Is there a fundamental design issue? Is the approach viable?
Write your analysis to .geas/evidence/{task-id}/forge-escalation.json
```

Then evaluate Forge's assessment:
- If Forge identifies a fixable root cause: apply the fix, re-test one more time.
- If Forge says the approach is broken: escalate to Nova.

### `"nova-decision"`

Spawn **Nova** with full context:
- TaskContract, all evidence bundles, gate verdicts
- Nova decides: scope cut, feature drop, alternative approach, or push through.

### `"pivot"`

Invoke `/pivot-protocol` with full context.

### Write DecisionRecord

For any escalation, write a DecisionRecord to `.geas/decisions/{dec-id}.json`:
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
  "decided_by": "forge|nova",
  "participants": ["sentinel", "pixel|circuit", "forge"],
  "related_task_id": "{task-id}",
  "created_at": "..."
}
```

Log the escalation event to `.geas/ledger/events.jsonl`.

---

## Summary

```
Evidence Gate PASS?
  YES -> Nova review (Tier 3)
  NO  -> Fix (Pixel/Circuit) -> Re-gate
         PASS? -> Nova review
         NO    -> Fix -> Re-gate (iteration 2)
                  PASS? -> Nova review
                  NO    -> ... (up to retry_budget)
                           Budget exhausted?
                           -> escalation_policy:
                              forge-review -> Forge analysis -> fixable? -> one more try
                              nova-decision -> Nova decides
                              pivot -> Pivot Protocol
                           -> Write DecisionRecord
```
