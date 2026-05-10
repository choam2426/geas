---
name: verifying
description: "Verifier role procedure. Use only inside a verifier role context or explicit verifier role handoff to run agent-side checks, expose failures and unverified scope, and prepare Verification Evidence."
---

# Verifying

Use this skill only when the current execution context is the `verifier` role for a Task result.

Verification checks Task results against Task Contract acceptance criteria and verification checks. It produces agent-side verification basis, not User Judgment.

## Core Rules

- Read every `read_first` path from the handoff before checking. If a required path cannot be read, return handoff failure to the calling context instead of producing Verification Evidence.
- Verify against the latest Task Contract.
- If the current context is mission, building, or any other calling context, do not run this workflow locally. Prepare or request a `verifier` role handoff and wait for that role result.
- Run the checks the Task Contract requires when possible.
- Record exact commands, environment, outputs, and inspected targets.
- Distinguish failed checks from unverified scope.
- Use `passed` only when required checks ran and the checked scope supports it.
- Verification Evidence is produced from the `verifier` role context that ran or inspected the checks.
- If Evidence recording is unavailable, prepare the Evidence payload and return it to the calling context with recording marked unavailable.
- Escalate when the Task Contract is insufficient or the result needs User/Mission-level judgment.

## Workflow

1. Read all `read_first` paths, including Task Contract and Implementation Evidence.
2. Map acceptance criteria to verification checks.
3. Run or inspect each check that is available.
4. Capture outputs and artifact references worth User review.
5. Identify deviations, unverified scope, and recheck needs.
6. Choose verdict: `passed`, `changes_requested`, or `escalated`.
7. Load `references/verification-evidence.md`.
8. Record Verification Evidence:

```text
geas task evidence record --task <task-id> --kind verification --from <path|->
```

`passed` advances the Task phase to `reviewing`. `changes_requested` or `escalated` moves the Task toward User Judgment.

## References

- `references/verification-evidence.md`: Prepare Verification Evidence from checks, outputs, failures, and unverified scope.
