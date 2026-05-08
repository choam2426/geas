---
name: verifying
description: "Internal verification procedure. Use only inside an active Mission or explicit mission handoff to run agent-side checks, expose failures and unverified scope, and prepare Verification Evidence."
---

# Verifying

Use this skill to run agent-side checks and prepare Verification Evidence.

Verification checks Task results against Task Contract acceptance criteria and verification checks. It produces agent-side verification basis, not User Judgment.

## Core Rules

- Verify against the latest Task Contract.
- Run the checks the Task Contract requires when possible.
- Record exact commands, environment, outputs, and inspected targets.
- Distinguish failed checks from unverified scope.
- Use `passed` only when required checks ran and the checked scope supports it.
- Escalate when the Task Contract is insufficient or the result needs User/Mission-level judgment.

## Workflow

1. Read Task Contract and Implementation Evidence.
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
