---
name: reviewing
description: "Internal review procedure. Use only inside an active Mission or explicit mission handoff to inspect changes and Evidence for bugs, regressions, missing checks, responsibility drift, and User-level tradeoffs, then prepare Review Evidence."
---

# Reviewing

Use this skill to inspect Task results and Evidence for quality, boundary, risk, and consistency.

Reviewing prepares Review Evidence. It is distinct from verification: verification checks whether criteria were tested or confirmed; review evaluates quality, gaps, regression risk, boundary drift, and Evidence sufficiency.

## Core Rules

- Read Task Contract, changed outputs, Implementation Evidence, and Verification Evidence.
- Review from the Task Contract's `review_focus`.
- Apply lenses supplied by the calling procedure, usually `building`.
- Prioritize concrete findings with basis.
- Record scope reviewed and scope not reviewed.
- Treat verdict as agent-side input only.

## Workflow

1. Read baseline and Evidence.
2. Identify review focus and lenses.
3. Inspect changed outputs and supporting Evidence.
4. Check scope boundaries, missing tests, regression risks, consistency, maintainability, and User-level tradeoffs.
5. Decide verdict: `passed`, `changes_requested`, or `escalated`.
6. Load `references/review-evidence.md`.
7. Record Review Evidence:

```text
geas task evidence record --task <task-id> --kind review --from <path|->
```

Review Evidence moves the Task toward User Judgment unless `building` inserts an optional challenge pass.

## References

- `references/review-evidence.md`: Prepare Review Evidence from findings, risks, and remaining uncertainty.
