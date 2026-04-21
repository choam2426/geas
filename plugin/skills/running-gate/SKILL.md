---
name: running-gate
description: Invoked by the mission dispatcher when all required reviewer slots and the verifier have appended evidence for a task; runs the Tier 0/1/2 gate, aggregates reviewer verdicts, and on a fail verdict runs the bounded verify-fix loop (rewinding reviewed→implementing with verify_fix_iterations incremented) until pass or budget exhaustion.
user-invocable: false
---

# Running Gate

## Overview

Answers "may this task move toward `passed`?" with a single verdict derived from three tiers. On `fail`, runs the verify-fix inner loop (bounded by `verify_fix_iterations` budget). On `pass`, returns to the dispatcher which invokes `closing-task`. Gate verdicts are distinct from reviewer verdicts.

<HARD-GATE> Completion = gate verdict `pass`. Not "code compiles", not "implementer says fixed". The loop runs only on `fail`. `verify_fix_iterations` is authoritative and never reset by direct file edit.

## When to Use

- Dispatcher signals a task in `reviewed` state with evidence present for every required reviewer slot + verifier.
- Re-run after verify-fix: implementer has re-submitted and reviewers have re-inspected.
- Do NOT run on a task in `implementing` — precheck returns `error`.
- Do NOT run to "check progress" without complete reviewer evidence — Tier 0 returns `block`.

## Preconditions

- `task-state.status == reviewed`.
- `self-check.json` exists and validates.
- For every slot in `routing.required_reviewers`: at least one `*.{slot}.json` evidence file has a review-kind entry with a valid verdict.
- Verifier evidence present (verification-kind entry).
- CLI is the sole writer to `.geas/`.

## Process

1. **Tier 0 — Precheck.** Confirm inputs exist before heavier work:
   - `self-check.json` exists + schema-valid.
   - Every required reviewer slot has ≥1 review-kind entry with a valid verdict (`approved` / `changes_requested` / `blocked`).
   - `task-state.status == reviewed` (else `error`).
   - `base_snapshot` still matches the real workspace baseline (else `block`).
   - Missing required artifact → `block`. State ineligibility → `error`. Baseline mismatch → `block`.
2. **Tier 1 — Objective verification.** Execute `contract.verification_plan` (automated or manual; same inputs produce same result). Produce a verification-kind evidence entry whose `criteria_results` maps each acceptance criterion to pass/fail with concrete details.
   - One or more acceptance criteria objectively fail → `fail`.
   - Procedure cannot be run as written (ambiguous or missing tooling) → `error`.
   - Procedure discovers a structural block owned outside this task → `block`.
3. **Tier 2 — Reviewer verdict aggregation.** Combine the latest review entry's `verdict` from every required slot:
   - Any `blocked` → tier status `block`.
   - Else any `changes_requested` → tier status `fail`.
   - Else all `approved` → tier status `pass`.
   - If two reviewers disagree on incompatible grounds and cannot be resolved by aggregation, open a task-level deliberation via `convening-deliberation` before recording the gate run; the deliberation result informs Tier 2.
   - Challenger counts as a reviewer verdict when challenger was required (`risk_level ≥ high`).
4. **Record the gate run.** Call `geas gate run` with tier statuses. CLI assigns `gate_run_id`, derives the overall verdict (any non-pass short-circuits; else pass), appends to `gate-results.json`, and returns a `suggested_next_transition` hint.
5. **Interpret the verdict.**
   - `pass` → return to dispatcher; dispatcher invokes `closing-task`.
   - `fail` → enter the verify-fix inner loop (below).
   - `block` → transition the task to `blocked`; halt; return to dispatcher.
   - `error` → resolve the cause (missing tooling, ambiguous plan, snapshot drift) and re-run. After three consecutive `error` verdicts, move to `blocked`.
6. **Verify-fix inner loop (on `fail` only).** Bounded by budget (`default 3`; `critical` = 1):
   - Diagnose: read the failing gate run + reviewer/verifier evidence; build a fix brief naming failed criteria, concerns, implicated surfaces.
   - `geas task transition --to implementing` — CLI auto-increments `verify_fix_iterations`.
   - Dispatch the primary implementer with the fix brief. Implementer appends a new `implementation` evidence entry with `revision_ref` back to the prior entry.
   - Reviewers re-inspect and append new review entries.
   - Re-run the gate (back to step 1).
   - `pass` → exit loop. `fail` + budget remaining → loop. `fail` + budget exhausted → transition to `blocked`, then `escalated`; decision-maker writes closure evidence with verdict `escalated` or `cancelled`.

CLI payload shape (gate run):

```json
{
  "tier_results": {
    "tier_0": {"status": "pass", "details": "self-check + reviewer evidence present"},
    "tier_1": {"status": "pass", "details": "verification_plan ran clean; 4/4 criteria met"},
    "tier_2": {"status": "pass", "details": "challenger approved, risk-assessor approved"}
  }
}
```

See `references/verdict-handling.md` for the verdict table, self-check reuse matrix, and loop invariants.

## Red Flags

| Excuse | Reality |
|---|---|
| "All reviewers said approved; gate is redundant" | Gate verifies Tier 0 (artifact presence) + Tier 1 (verification_plan) + Tier 2 (verdict aggregation). Three distinct checks. |
| "This task is low risk; skip the full gate" | Risk level does not bypass the gate. `reviewed → verified` guard rejects without a gate-results entry. |
| "Time pressure — treat `changes_requested` as pass" | `verify_fix_iterations` is bounded, not optional. Verdict manipulation corrupts the audit trail. |
| "Reset iterations so the loop gets another try" | `verify_fix_iterations` is authoritative. If the count is wrong, that is a CLI bug, not a workaround opportunity. |
| "Fix the code directly without re-reviewer evidence" | A fix without updated reviewer verdicts is an unverified claim. Reviewers re-inspect every iteration. |

## Invokes

| CLI command | Purpose |
|---|---|
| `geas gate run --mission <id> --task <id>` | Record the gate run; CLI derives verdict and returns transition hint. |
| `geas task transition --task <id> --to implementing` | Rewind on `fail`; CLI increments `verify_fix_iterations`. |
| `geas task transition --task <id> --to blocked` | On `block`, or on budget exhaustion before `escalated`. |
| `geas task transition --task <id> --to escalated` | Budget-exhausted escalation. |

Sub-skill invoked: `convening-deliberation` (only when reviewer verdicts conflict on incompatible grounds in `full_depth` mode).

## Outputs

- `.geas/missions/{mission_id}/tasks/{task_id}/gate-results.json` grows by one `runs` entry per run.
- Verification-kind evidence entry written by the verifier each iteration.
- On `fail` loop: new implementation-kind evidence + new review entries per iteration.
- On `pass`: no further writes — dispatcher invokes `closing-task`.

## Failure Handling

- **Tier 0 `block`**: return to dispatcher; the missing precondition must be resolved (usually a reviewer forgot to append).
- **Tier 1 `error`** (plan ambiguous or tooling missing): do not retry blindly. Halt; the contract's `verification_plan` or the workspace tooling needs correction. After three consecutive `error`s → `blocked`.
- **Tier 2 conflict**: invoke `convening-deliberation` before recording the gate run; the deliberation result is input to Tier 2.
- **Budget exhaustion**: `blocked` → `escalated`. Decision-maker reviews the full trail and writes closure evidence with verdict `escalated` or `cancelled`. Rationale states whether a supersedes-linked successor is needed.
- **CLI `guard_failed` on `gate run`**: inspect hints; common cause is missing reviewer evidence in a required slot.

## Related Skills

- **Invoked by**: mission dispatcher once all required reviewer slots and the verifier have evidence for a `reviewed` task.
- **Invokes**: `convening-deliberation` (Tier 2 conflict in `full_depth`); the verify-fix loop dispatches the primary implementer which runs `implementing-task` in a spawned context.
- **Do NOT invoke**: `closing-task` — the dispatcher invokes it after this skill returns `pass`. `reviewing-phase` — phase review is a separate concern after all mission-scope tasks are terminal.

## Remember

- Four verdicts: `pass` / `fail` / `block` / `error`. Only `fail` consumes budget.
- Gate never modifies the contract and never writes reviewer evidence.
- Reviewers re-inspect each iteration; a fix without re-review is not a fix.
- Budget is a hard ceiling; no exceptions.
- `suggested_next_transition` is a hint — orchestrator still calls `task transition` explicitly.
