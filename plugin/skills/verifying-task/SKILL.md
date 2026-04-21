---
name: verifying-task
description: Invoked by a spawned verifier after reviewers have returned concurrence. Runs the task contract's verification_plan (automated or manual procedure) independently against the implementation, and produces one verifier evidence entry with per-criterion pass/fail results and concrete details.
user-invocable: false
---

# Verifying Task

## Overview

You have been spawned as the verifier for a task. Your job is to run the contract's `verification_plan` as written, independently of the implementer, and record one verification-kind evidence entry that maps every acceptance criterion to a pass/fail result with concrete details. Verification is the Tier 1 input to `running-gate`; missing or ambiguous verification produces a gate `error`.

<HARD-GATE> Completion = gate verdict `pass`. Not "code compiles", not "implementer says fixed". You cannot also hold implementer or reviewer on the same task — CLI enforces agent-slot independence. `criteria_results` covers every criterion in the contract; omission is treated as `fail`.

## When to Use

- The orchestrator has spawned you after reviewers have returned verdicts (or alongside them in full_depth missions).
- You have the task contract, the implementation evidence, and access to the workspace.
- Do NOT run before the implementer has appended implementation evidence.
- Do NOT review — that is the reviewer slots' job; your remit is objective verification of acceptance criteria.

## Preconditions

- `task-state.status == reviewed` (or `implementing` if the profile runs verifier concurrent with reviewers).
- Task contract exists with `verification_plan` non-empty.
- At least one `implementation`-kind evidence entry exists for the task.
- `base_snapshot` still matches the real workspace (if not, raise `error`).
- You are not the implementer or a reviewer on this task.

## Process

1. **Read the contract's `verification_plan`** as written. Do not paraphrase; execute exactly.
   - Automated procedure: run the commands; capture stdout/stderr/exit-codes.
   - Manual procedure: walk the described steps, noting observations per step.
   - Hybrid: execute each part as specified.
2. **Map every acceptance criterion** to a result. For each entry in `contract.acceptance_criteria`:
   - `pass` — criterion objectively met; cite the evidence (command output, file contents, observed behavior).
   - `fail` — criterion objectively not met; cite what was observed vs. what was required.
   - `inconclusive` — plan cannot be executed as written, or tooling is missing. This becomes Tier 1 `error` at gate time.
3. **Collect concrete details** per criterion: command snippets, exact error messages, diffs, file paths. Prose without substrate is not verification.
4. **Append the verification-kind evidence entry** via CLI:
   ```bash
   geas evidence append --mission {mission_id} --task {task_id} \
       --agent {your_concrete_agent} --slot verifier <<'EOF'
   {
     "evidence_kind": "verification",
     "summary": "<one-line: N/M criteria met>",
     "criteria_results": [
       {"criterion": "<criterion text>", "status": "pass|fail|inconclusive", "details": "<concrete observation>"}
     ],
     "rationale": "<how the verification_plan was executed>",
     "scope_examined": "<what you actually ran or inspected>",
     "methods_used": ["<commands / manual steps>"],
     "scope_excluded": "<items in verification_plan deferred, with reason>"
   }
   EOF
   ```
5. **Do not write a verdict.** Verifier evidence carries `criteria_results`, not `verdict`; the verdict is derived by `running-gate` Tier 1 from the pass/fail pattern.
6. **Return.** The orchestrator runs `running-gate`; your verification entry is the Tier 1 input.

## Red Flags

| Excuse | Reality |
|---|---|
| "The implementer said it works — trust and skip" | Verification is independent by construction. The implementer's claim is evidence; yours is too, produced separately. |
| "The verification_plan is ambiguous — I'll interpret it" | Ambiguity is a plan failure, not a verifier license. Mark affected criteria `inconclusive` with a note; the gate will return `error` and the plan gets fixed. |
| "I'll report 'all pass' in prose without per-criterion details" | `criteria_results` must map every criterion. Prose-only summaries break Tier 1 aggregation. |
| "I'll run a faster substitute instead of the full plan" | The plan is the contract. Substitutions change what is being verified. If the plan is wrong, that is `inconclusive` + fix-the-plan, not a shortcut. |
| "A criterion is obviously fine; skip it" | Omission is `fail` by default. Every criterion is covered explicitly. |
| "I'll fix a small code issue I notice while verifying" | You are not the implementer here. Record the observation as a `fail` with detail; the verify-fix loop picks it up. |

## Invokes

| CLI command | Purpose |
|---|---|
| `geas evidence append --slot verifier --agent <concrete> --mission <id> --task <id>` | Append the verification-kind evidence entry. |

Read-only helpers:
| CLI command | Purpose |
|---|---|
| `geas evidence list --mission <id> --task <id>` | Walk the implementation evidence chain. |
| `geas mission state --mission <id>` | Confirm phase + task state. |

Sub-skills you do NOT invoke: none.

## Outputs

- One verification-kind evidence entry under `.geas/missions/{mission_id}/tasks/{task_id}/evidence/*.verifier.json`.
- Command logs / manual step notes captured in `methods_used` + `details`.
- No other artifacts.

## Failure Handling

- **`verification_plan` cannot be executed as written**: mark every unverified criterion `inconclusive`, explain in `rationale`. Gate returns Tier 1 `error`; plan is fixed, re-verification runs.
- **Tooling missing**: `inconclusive` with the missing tool named. Do not improvise replacements.
- **Base_snapshot mismatch**: stop; return with a note. Gate would return `block` anyway.
- **Implementation evidence absent**: stop; return to orchestrator. Verification without implementation is meaningless.
- **Three consecutive `error` verdicts from this plan**: escalate to `blocked`; the plan itself needs rewriting.

## Related Skills

- **Invoked by**: `running-gate` or orchestrator, after the implementer has appended implementation evidence and reviewer slots have been spawned.
- **Invokes**: none.
- **Do NOT invoke**: `reviewing-task` (reviewers are parallel peers, not verifier), `running-gate` (orchestrator runs it after you return), `implementing-task` (you are not the implementer).

## Remember

- Execute the plan exactly; ambiguity = `inconclusive`, not interpretation.
- Every criterion gets an explicit result with concrete details.
- Verifier evidence has `criteria_results`, no `verdict` — that is the gate's job.
- You cannot be implementer or reviewer on this task.
- Independent execution is the point; a verifier who copies the implementer's output has not verified.
