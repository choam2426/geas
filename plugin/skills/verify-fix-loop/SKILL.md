---
name: verify-fix-loop
description: Bounded verify-fix iteration — reads verify_fix_iterations from task-state, dispatches the implementer with concrete failure context, re-runs the gate. Budget exhaustion escalates to the decision-maker.
---

# Verify-Fix Loop

The inner loop that runs when the evidence gate verdict is `fail`. It keeps fix attempts bounded and grounded in concrete failing criteria — not "write more code and hope".

**Invariant**: completion means the gate says `pass`. Not "code compiles" and not "implementer says they fixed it".

## When to Use

Orchestrator invokes this skill when the most recent `geas gate run` returned `verdict: fail`. If the verdict was `block`, `error`, or `pass`, this skill does not run — those are handled elsewhere.

## Inputs

1. **Task contract** — `.geas/missions/{mission_id}/tasks/{task_id}/contract.json`. Acceptance criteria and verification_plan define the target.
2. **Task state** — `.geas/missions/{mission_id}/tasks/{task_id}/task-state.json`. `verify_fix_iterations` is the iteration count so far.
3. **Latest gate run** — the final entry in `gate-results.json`'s `runs` array tells us which tier failed and on what.
4. **Reviewer evidence** — `evidence/{agent}.{slot}.json` files. Each reviewer's concerns are the concrete fix targets.
5. **Verifier evidence** — `*.verifier.json` file's `criteria_results` tells us which criteria failed.

## Iteration Budget

Iteration count is tracked by `task-state.verify_fix_iterations`. The CLI increments this on every `reviewed -> implementing` transition automatically. The default budget is 3 iterations; risk_level `critical` tightens to 1.

When the count equals the budget and the gate still fails, the loop exits without another attempt and the task escalates.

## Flow

### Step 1 — Diagnose

Read the failing gate run and the reviewer/verifier evidence. Build a concise fix brief that names:

- Which acceptance criteria failed (from Tier 1 `criteria_results`).
- Which reviewer raised which concern (from Tier 2 reviewer verdicts).
- Which files/surfaces are implicated.
- Any `known_risks` or `gap_signals` from the self-check that line up with the failure.

### Step 2 — Move task to implementing

```bash
geas task transition --mission {mission_id} --task {task_id} --to implementing
```

This:

- transitions the task from `reviewed` back to `implementing`.
- increments `verify_fix_iterations` by 1 (CLI-auto).

### Step 3 — Dispatch the implementer with fix brief

Spawn the primary worker. The prompt references the fix brief and the specific evidence entries to read. The implementer writes a new `implementation`-kind evidence entry that points at what they changed and why, including `revision_ref` back to their prior implementation entry.

### Step 4 — Re-collect reviewer evidence

Reviewers re-inspect and append new review-kind entries to their same evidence file. They may reuse their prior `scope_examined` if scope didn't change, but their verdict and concerns are re-stated for this iteration.

### Step 5 — Re-run the gate

```bash
geas gate run --mission {mission_id} --task {task_id} <<'EOF'
<tier_results>
EOF
```

- `verdict=pass` → exit loop. Proceed to closure.
- `verdict=fail` → check budget. If `verify_fix_iterations < budget`, go to Step 1. Else go to Escalation.
- `verdict=block` or `error` → exit loop. Orchestrator handles per gate skill.

### Escalation

When iteration budget is exhausted on a fail:

1. Move the task to `blocked`:

   ```bash
   geas task transition --mission {mission_id} --task {task_id} --to blocked
   ```

2. Escalate to decision-maker via `escalated`:

   ```bash
   geas task transition --mission {mission_id} --task {task_id} --to escalated
   ```

3. Decision-maker reviews the full evidence trail and writes a closure-kind evidence entry with `verdict=escalated` or `verdict=cancelled`. Rationale must state whether a follow-up task (`supersedes`-linked) should take over.

4. If structural — e.g. the task contract itself is wrong — the resolution might be a new task that supersedes this one rather than retrying within this task's budget.

## Boundaries

- The loop never bypasses reviewer evidence. A "fix" without updated reviewer verdicts is not a fix — it's an unverified claim.
- `verify_fix_iterations` is authoritative. Do not reset it by rewriting task-state directly. If the real iteration count is wrong, that is a CLI bug, not a workaround opportunity.
- Iteration budget is a hard ceiling. No "one more try" exceptions — the ceiling exists because the cost of indefinite retry is real.
- The loop produces evidence, not commits. Each fix is traceable in evidence's entries array with `revision_ref`.

## Loop Summary

```
gate run → verdict=fail
    ↓
read failing criteria + reviewer concerns
    ↓
task transition → implementing    (iterations += 1)
    ↓
implementer fixes + appends implementation evidence
    ↓
reviewers re-review + append review evidence
    ↓
gate run again
    ↓
    pass → closure flow
    fail + budget remaining → loop
    fail + budget exhausted → escalate (blocked → escalated)
    block / error → gate-level handling
```
