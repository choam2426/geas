---
name: running-gate
description: Invoked by the mission dispatcher when all required reviewer slots and the verifier have appended evidence for a task; runs `geas gate run` (which reads those evidence files and computes Tier 0/1/2 statuses itself), interprets the resulting verdict, and on a fail verdict runs the bounded verify-fix loop (rewinding reviewing→implementing with verify_fix_iterations incremented) until pass or budget exhaustion.
user-invocable: false
---

# Running Gate

## Overview

Answers "may this task move toward `passed`?" by asking the CLI for a gate verdict and interpreting it. The gate itself reads impl-contract, self-check, reviewer evidence, and verifier evidence directly and computes each tier's status — orchestrator does NOT assemble tier statuses or pass them on stdin. On `fail`, runs the verify-fix inner loop (bounded by `verify_fix_iterations` budget). On `pass`, returns to the dispatcher which invokes `closing-task`. Gate verdicts are distinct from reviewer verdicts.

<HARD-GATE> Completion = gate verdict `pass`. Not "code compiles", not "implementer says fixed". The loop runs only on `fail`. `verify_fix_iterations` is authoritative and never reset by direct file edit. `geas gate run` takes no stdin; any attempt to smuggle tier statuses via payload is ignored and, more importantly, meaningless — the gate computes from files.

## When to Use

- Dispatcher signals a task in `reviewing` state with evidence present for every required reviewer slot + verifier.
- Re-run after verify-fix: implementer has re-submitted, reviewers have re-inspected, and verifier has re-appended a verification-kind entry.
- Do NOT run on a task in `implementing` — Tier 0 returns `fail`.
- Do NOT run when any required evidence is missing — Tier 0 / Tier 1 will explain what's missing; the absence itself is not an error to work around.

## Preconditions

Required for the gate to produce a non-`fail` / non-`error` verdict (the CLI still records the run either way, so these are preconditions for a useful verdict, not for the command itself):

- `task-state.status == reviewing`.
- `implementation-contract.json` exists and validates.
- `self-check.json` exists and validates.
- For every slot in `routing.required_reviewers`: at least one `evidence/*.{slot}.json` file has a review-kind entry with a valid verdict (`approved` / `changes_requested` / `blocked`).
- At least one `evidence/*.verifier.json` file has a verification-kind entry with a valid verdict and internally consistent `criteria_results` (verdict=approved ⇒ every `passed` is true).
- CLI is the sole writer to `.geas/`.

## Process

1. **Confirm the precondition frame.** The orchestrator's only job before the gate is to make sure the verifier has run. If a required reviewer or the verifier has not yet appended evidence, return to the dispatcher — do not call the gate.
2. **Run the gate.** `geas gate run --mission <id> --task <id>`. No stdin. The CLI reads the artifacts listed in Preconditions and computes:
   - **Tier 0 — Preflight.** Checks task-state, impl-contract, self-check, and reviewer evidence presence/validity. Missing or invalid artifact → `fail` (rework fixes it); task-state mismatch or corrupt envelope → `error`.
   - **Tier 1 — Verification.** Reads the latest verification-kind entry in each `*.verifier.json`. Maps verdict → tier status: `approved` + all criteria passed → `pass`; `changes_requested` → `fail`; `blocked` → `block`; missing entry / missing file / internally inconsistent → `error`. Across multiple verifier files, worst-wins.
   - **Tier 2 — Judgment.** Reviewer verdict aggregation (doc 03 §168–170). any `blocked` → `block`; any `changes_requested` → `fail`; all `approved` → `pass`; any required reviewer's verdict missing → `error`.
   - **Overall.** Worst-wins across tiers (error > block > fail > pass) — doc 03 §164.
3. **Interpret the verdict** in the response envelope:
   - `pass` → return to dispatcher; dispatcher invokes `closing-task`.
   - `fail` → enter the verify-fix inner loop (step 4 below).
   - `block` → transition the task to `blocked`; halt; return to dispatcher.
   - `error` → inspect `tier_results.*.details` to identify the cause (missing artifact, corrupt envelope, verifier internal contradiction). Resolve the root cause and re-run. After three consecutive `error` verdicts on the same task, move to `blocked`.
4. **Verify-fix inner loop (on `fail` only).** Bounded by the risk-tiered retry-budget (see "Retry-budget" subsection below):
   - Diagnose: read the failing run's `tier_results` details and the cited evidence entries (`entry_id` references). Build a fix brief naming failed criteria, specific reviewer concerns, implicated surfaces.
   - `geas task transition --to implementing` — CLI auto-increments `verify_fix_iterations`.
   - Dispatch the primary implementer with the fix brief. Implementer appends a new `implementation` evidence entry with `revision_ref` back to the prior entry. If the plan itself changed, implementer also appends a new `impl-contract set` amendment.
   - Reviewers re-inspect and append new review entries (latest entry becomes authoritative).
   - Verifier re-runs the verification_plan and appends a new verification-kind entry (again, latest entry wins).
   - Re-run the gate (back to step 2).
   - `pass` → exit loop. `fail` + budget remaining → loop. `fail` + budget exhausted → transition to `blocked`, then `escalated`; decision-maker writes closure evidence with verdict `escalated` or `cancelled`.

The gate never takes a payload. If you find yourself writing JSON into stdin before `geas gate run`, stop — you are re-implementing the old raw-recorder model the CLI deliberately removed.

See `references/verdict-handling.md` for the verdict table, self-check reuse matrix, and loop invariants.

## Red Flags

| Excuse | Reality |
|---|---|
| "All reviewers said approved; gate is redundant" | Gate verifies Tier 0 (artifact presence + validity) + Tier 1 (verifier evidence) + Tier 2 (verdict aggregation). Three distinct checks, computed from three distinct evidence sources. |
| "Just stub the tier_results on stdin to move things along" | The CLI ignores stdin. The gate's authority comes from reading evidence files, not from caller-supplied claims. Stubbing never worked after the rewrite. |
| "This task is low risk; skip the full gate" | Risk level does not bypass the gate. `reviewing → deciding` guard rejects without a gate-results run whose verdict is `pass`. |
| "Time pressure — treat `changes_requested` as pass" | `verify_fix_iterations` is bounded, not optional. Verdict manipulation corrupts the audit trail and will be caught by the gate on re-read. |
| "Reset iterations so the loop gets another try" | `verify_fix_iterations` is authoritative. If the count is wrong, that is a CLI bug, not a workaround opportunity. |
| "Fix the code directly without re-reviewer evidence or re-verifier evidence" | A fix without updated reviewer / verifier verdicts is an unverified claim. The gate reads the LATEST entry in each file — stale entries become the basis for a stale verdict. |
| "`gate run` returned `error` — run it again, maybe it'll work" | `error` means the gate cannot trust its inputs. Re-running without changing the inputs returns the same result. Read `details` and fix the cited cause. |

## Invokes

| CLI command | Purpose |
|---|---|
| `geas gate run --mission <id> --task <id>` | Compute tier statuses from evidence files and record the run. No stdin. |
| `geas task transition --task <id> --to implementing` | Rewind on `fail`; CLI increments `verify_fix_iterations`. |
| `geas task transition --task <id> --to blocked` | On `block`, or on budget exhaustion before `escalated`. |
| `geas task transition --task <id> --to escalated` | Budget-exhausted escalation. |

Sub-skill invoked: `convening-deliberation` (only when reviewer verdicts conflict on incompatible grounds in `full_depth` mode; deliberation result informs whether to re-request review vs. escalate).

## Outputs

- `.geas/missions/{mission_id}/tasks/{task_id}/gate-results.json` grows by one `runs` entry per run.
- On `fail` loop: new implementation-kind evidence + new review entries + new verification entry per iteration, written by the spawned agents (not by this skill).
- On `pass`: no further writes — dispatcher invokes `closing-task`.

The gate never creates evidence. It reads.

## Retry-budget

The verify-fix inner loop is bounded by a risk-tiered retry-budget that caps how far `verify_fix_iterations` may grow via the `reviewing -> implementing` rewind. The mapping is keyed off the task contract's `risk_level`:

| `risk_level` | retry-budget |
|---|---|
| `low` | 1 |
| `normal` | 2 |
| `high` | 2 |
| `critical` | 3 |

The CLI enforces this on every `reviewing -> implementing` transition: when `verify_fix_iterations >= budget(risk_level)`, the rewind is refused with `guard_failed` and a hint suggesting `blocked` or `escalated`. The gate itself does not pick the budget — it observes the rewind refusal and routes the task downstream. Budget exhaustion follows the documented path in step 4 of Process and in Failure Handling: `* -> blocked -> escalated`, with the decision-maker writing closure evidence (`escalated` or `cancelled`). An unrecognised or absent `risk_level` falls back to the `normal` budget. The mapping also appears in [references/verdict-handling.md](references/verdict-handling.md).

## Failure Handling

- **Tier 0 `fail` (missing artifact)**: return to dispatcher; the missing precondition must be supplied (usually a reviewer or the verifier forgot to append). Re-running the gate without supplying the missing artifact returns the same `fail`.
- **Tier 0 `error` (state or schema)**: task-state.status is not `reviewing`, or one of impl-contract / self-check / reviewer files is corrupt. Fix before re-running.
- **Tier 1 `error`**: verifier evidence is missing, has no verification entry, or the latest entry is internally inconsistent (verdict=approved but some `criteria_results.passed` is false). The verifier must re-run with a coherent entry. After three consecutive `error`s → `blocked`.
- **Tier 2 conflict** (reviewers disagree on incompatible grounds): invoke `convening-deliberation` before re-running the gate; the deliberation result feeds the next review round's verdicts.
- **Budget exhaustion**: `blocked` → `escalated`. Decision-maker reviews the full trail and writes closure evidence with verdict `escalated` or `cancelled`. Rationale states whether a supersedes-linked successor is needed.
- **CLI `missing_artifact` on `gate run`**: mission spec or task contract missing. Scheduler bug — return to dispatcher.

## Dispatch Model

When the verify-fix loop re-dispatches the implementer (and re-spawns reviewers + verifier), it follows the same slot- and risk-driven dispatch pattern that `scheduling-work` describes: authority slots aim for the most capable model the harness exposes; specialist slots aim for a balanced choice; on `task.risk_level` of `high` or `critical`, specialist slots are lifted toward the most-capable end. A task contract's per-task rationale, when present, takes precedence.

The canonical guidance lives in [scheduling-work/SKILL.md](../scheduling-work/SKILL.md) under "Dispatch Model". The gate does not pick the model itself — it inherits whatever the orchestrator chooses at re-spawn time. Iterations across the verify-fix loop normally use the same choice as the original dispatch unless the contract was amended (rare; record the change in the implementation contract).

## Related Skills

- **Invoked by**: mission dispatcher once all required reviewer slots and the verifier have evidence for a `reviewing` task.
- **Invokes**: `convening-deliberation` (Tier 2 conflict in `full_depth`); the verify-fix loop dispatches the primary implementer which runs `implementing-task` in a spawned context, and re-spawns reviewers + verifier via `reviewing-task` / `verifying-task`.
- **Do NOT invoke**: `closing-task` — the dispatcher invokes it after this skill returns `pass`. `reviewing-phase` — phase review is a separate concern after all mission-scope tasks are terminal.

## Remember

- Four verdicts: `pass` / `fail` / `block` / `error`. Only `fail` consumes budget.
- `gate run` takes no stdin. The CLI computes all tier statuses from the task's evidence files.
- Gate never writes reviewer, verifier, or implementation evidence — it reads.
- Reviewers AND the verifier re-inspect each iteration; a fix without both re-examined is not a fix.
- Budget is a hard ceiling; no exceptions.
- `suggested_next_transition` is a hint — orchestrator still calls `task transition` explicitly.
