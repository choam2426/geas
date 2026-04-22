---
name: verifying-task
description: Invoked by a spawned verifier after the implementer has appended implementation evidence and a self-check entry, in parallel with or after post-work reviewers. Runs the task contract's verification_plan (automated or manual procedure) independently against the implementation, and produces one verifier evidence entry with a verdict, per-criterion pass/fail results, concerns, and concrete details. The gate (`running-gate`) reads this entry to compute its Tier 1 status.
user-invocable: false
---

# Verifying Task

## Overview

You have been spawned as the verifier for a task. Your job is to run the contract's `verification_plan` as written, independently of the implementer, and record one verification-kind evidence entry that carries an overall verdict, maps every acceptance criterion to a boolean pass/fail with concrete details, and captures any concerns. The gate reads your entry to compute Tier 1 — the gate does NOT execute the verification_plan itself; you do, and the gate trusts your entry. Missing, missing-entry, or internally inconsistent verifier evidence produces a gate `error`.

<HARD-GATE> Completion = gate verdict `pass`. Your entry is the Tier 1 input. `criteria_results` must cover every acceptance criterion in the contract — omission is treated as absent verification. Every `criteria_results[].passed` is a boolean, not a status string. `scope_excluded` is an array of strings, not a single string. `verdict` is required; choose from `approved` / `changes_requested` / `blocked`. You cannot also hold implementer or reviewer on the same task — CLI enforces agent-slot independence.

## When to Use

- The orchestrator has spawned you after the implementer appended implementation evidence and a self-check entry. Reviewers may have already returned, may be running in parallel with you, or may run after you — the gate only requires that both sets are present by the time it runs.
- You have the task contract, the implementation evidence, and access to the workspace.
- Do NOT run before the implementer has appended implementation evidence.
- Do NOT review — that is the reviewer slots' job; your remit is objective verification of acceptance criteria.

## Preconditions

- `task-state.status == reviewing`. The orchestrator transitions the task from `implementing` to `reviewing` after the implementer has appended implementation evidence + a self-check entry, then spawns you (and the reviewers) against the reviewing state.
- Task contract exists with `verification_plan` non-empty.
- At least one `implementation`-kind evidence entry exists for the task.
- `base_snapshot` still matches the real workspace (if not, verdict=`blocked` with snapshot-mismatch rationale).
- You are not the implementer or a reviewer on this task.

## Process

1. **Read the contract's `verification_plan`** as written. Do not paraphrase; execute exactly.
   - Automated procedure: run the commands; capture stdout/stderr/exit-codes.
   - Manual procedure: walk the described steps, noting observations per step.
   - Hybrid: execute each part as specified.
2. **Map every acceptance criterion** to a boolean result. For each entry in `contract.acceptance_criteria`:
   - `passed: true` — criterion objectively met; cite the evidence (command output, file contents, observed behavior) in `details`.
   - `passed: false` — criterion objectively not met; cite what was observed vs. what was required in `details`.
   Every criterion must appear in `criteria_results`. No criterion = no evidence that it was verified.
3. **Collect concrete details per criterion**: command snippets, exact error messages, diffs, file paths. Prose without substrate is not verification.
4. **Decide a verdict.** Translate the per-criterion results + execution observations into one of three:
   - `approved` — every criterion observed with `passed: true`; no structural blocker encountered.
   - `changes_requested` — at least one criterion is `passed: false`; the task must rework. Do NOT mark `approved` with any `passed: false` entries — the gate treats that as an internal contradiction and returns Tier 1 `error`.
   - `blocked` — the `verification_plan` itself cannot be run as written (ambiguous, tooling missing, snapshot drift, structural issue owned outside this task). A `blocked` verdict signals the plan or environment needs repair, not the implementation.
5. **Collect `concerns`.** Specific issues raised during verification that the reviewers / orchestrator / decision-maker should know about. Empty array if none. Even an `approved` verdict may carry non-blocking concerns; record them.
6. **Append the verification-kind evidence entry** via CLI. Every field below is required for `verification` per the evidence schema:
   ```bash
   geas evidence append --mission {mission_id} --task {task_id} \
       --agent {your_concrete_agent} --slot verifier <<'EOF'
   {
     "evidence_kind": "verification",
     "summary": "<one-line: N/M criteria passed, overall <verdict>>",
     "verdict": "approved",
     "concerns": [],
     "rationale": "<how the verification_plan was executed and why this verdict follows>",
     "scope_examined": "<what you actually ran or inspected>",
     "methods_used": ["<commands / manual steps>"],
     "scope_excluded": ["<item deferred 1>", "<item deferred 2>"],
     "criteria_results": [
       {"criterion": "<criterion text>", "passed": true, "details": "<concrete observation>"}
     ]
   }
   EOF
   ```
   `scope_excluded` is an array of strings (empty array if nothing was excluded); never a single string. `concerns` is an array of strings (empty array if none). `criteria_results[].passed` is a boolean (`true` / `false`), not the string `"pass"` / `"fail"`.
7. **Return.** The orchestrator runs `running-gate`; the gate reads your latest verification entry and produces a Tier 1 status from its verdict + `criteria_results` consistency.

## Red Flags

| Excuse | Reality |
|---|---|
| "The implementer said it works — trust and skip" | Verification is independent by construction. The implementer's claim is evidence; yours is too, produced separately. |
| "The verification_plan is ambiguous — I'll interpret it" | Ambiguity is a plan failure, not a verifier license. Mark verdict=`blocked` with a rationale naming the ambiguity; the gate returns `block` and the plan gets fixed. |
| "Use `status: 'pass'` strings like the old examples" | Schema is `passed: boolean`. String statuses fail validation. Use `true` / `false`. |
| "Put `scope_excluded` as a single string" | `scope_excluded` is `string[]`. Use `[]` for nothing excluded, `["<item 1>", "<item 2>"]` otherwise. |
| "`approved` with some `passed: false` — the overall result is 'mostly good'" | The gate treats verdict=`approved` with any `passed: false` as an internal contradiction and returns Tier 1 `error`. If anything failed, verdict is `changes_requested`. |
| "`verdict` is optional; my criteria_results speak for themselves" | `verdict` is required by the evidence schema for `verification` entries. Without it the entry is rejected at append time. |
| "I'll report 'all pass' in prose without per-criterion details" | `criteria_results` must map every criterion with a boolean and details. Prose-only summaries break Tier 1 aggregation. |
| "I'll run a faster substitute instead of the full plan" | The plan is the contract. Substitutions change what is being verified. If the plan is wrong, verdict=`blocked` + fix-the-plan, not a shortcut. |
| "A criterion is obviously fine; skip it" | Omission = no verification evidence for that criterion. Every criterion is covered explicitly. |
| "I'll fix a small code issue I notice while verifying" | You are not the implementer here. Record the observation as `passed: false` with detail; the verify-fix loop picks it up. |

## Invokes

| CLI command | Purpose |
|---|---|
| `geas evidence append --slot verifier --agent <concrete> --mission <id> --task <id>` | Append the verification-kind evidence entry. |

Read-only helpers:
| CLI command | Purpose |
|---|---|
| `geas mission state --mission <id>` | Confirm phase + task state. |
| `geas context` | Mission overview from the dispatcher view. |

(There is no `geas evidence list`; walk evidence by reading `.geas/missions/{id}/tasks/{id}/evidence/` directly when you need prior-entry context.)

Sub-skills you do NOT invoke: none.

## Outputs

- One verification-kind evidence entry under `.geas/missions/{mission_id}/tasks/{task_id}/evidence/*.verifier.json`, carrying `verdict`, `concerns`, `criteria_results`, `rationale`, `scope_examined`, `methods_used`, `scope_excluded`.
- Command logs / manual step notes captured inside `methods_used` + `criteria_results[].details`.
- No other artifacts.

## Failure Handling

- **`verification_plan` cannot be executed as written**: verdict=`blocked`. Explain in `rationale`. Gate Tier 1 = `block`; plan or tooling is fixed, then a new verifier run replaces your entry (latest wins).
- **Tooling missing**: verdict=`blocked` with the missing tool named. Do not improvise replacements.
- **Base_snapshot mismatch**: verdict=`blocked` with the mismatch reason.
- **Implementation evidence absent**: stop; return to orchestrator without appending. Verification without implementation is meaningless; an absent verifier entry becomes Tier 1 `error`, which is the correct signal.
- **Cannot produce a coherent entry** (run crashed, partial data): do not append a partial entry. Return to orchestrator. Tier 1 = `error` is the honest signal.
- **Three consecutive `block` or `error` verdicts from this plan**: the plan itself needs rewriting. Escalate by naming the pattern in your `rationale`; decision-maker reviews.

## Related Skills

- **Invoked by**: orchestrator spawning the verifier slot, after the implementer has appended implementation evidence and reviewer slots have been spawned.
- **Invokes**: none.
- **Do NOT invoke**: `reviewing-task` (reviewers are parallel peers, not verifier), `running-gate` (orchestrator runs it after you return), `implementing-task` (you are not the implementer).

## Remember

- Execute the plan exactly; ambiguity = verdict=`blocked`, not interpretation.
- Every criterion gets an explicit result with boolean `passed` and concrete `details`.
- Verifier evidence carries `verdict` + `criteria_results` + `concerns` — the schema requires all three.
- `scope_excluded` and `concerns` are arrays of strings, not single strings.
- verdict=`approved` requires every `criteria_results[].passed` to be `true`; otherwise the gate returns Tier 1 `error` for internal contradiction.
- You cannot be implementer or reviewer on this task.
- Independent execution is the point; a verifier who copies the implementer's output has not verified.
