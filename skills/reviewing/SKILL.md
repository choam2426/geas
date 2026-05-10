---
name: reviewing
description: "Reviewer role procedure. Use only inside a reviewer role context or explicit reviewer role handoff to inspect changes and Evidence for bugs, regressions, missing checks, responsibility drift, and User-level tradeoffs, then prepare Review Evidence."
---

# Reviewing

Use this skill only when the current execution context is the `reviewer` role for a Task result and supporting Evidence.

Reviewing prepares Review Evidence. It is distinct from verification: verification checks whether criteria were tested or confirmed; review evaluates quality, gaps, regression risk, boundary drift, and Evidence sufficiency.

## Core Rules

- Read every `read_first` path from the handoff before reviewing. If a required path cannot be read, return handoff failure to the calling context instead of producing Review Evidence.
- Read Task Contract, changed outputs, Implementation Evidence, and Verification Evidence.
- If the current context is mission, building, or any other calling context, do not run this workflow locally. Prepare or request a `reviewer` role handoff and wait for that role result.
- Review from the Task Contract's `review_focus`.
- Apply lenses supplied by the calling procedure. If none are supplied, use the Task Contract review focus.
- Prioritize concrete findings with basis.
- Record scope reviewed and scope not reviewed.
- Review Evidence is produced from the `reviewer` role context that inspected the Task result and supporting Evidence.
- If Evidence recording is unavailable, prepare the Evidence payload and return it to the calling procedure with recording marked unavailable.
- Treat verdict as agent-side input only.

## Workflow

1. Read all `read_first` paths, including baseline and Evidence.
2. Identify review focus and lenses.
3. Inspect changed outputs and supporting Evidence.
4. Check scope boundaries, missing tests, regression risks, consistency, maintainability, and User-level tradeoffs.
5. Decide verdict: `passed`, `changes_requested`, or `escalated`.
6. Load `references/review-evidence.md`.
7. Record Review Evidence:

```text
geas task evidence record --task <task-id> --kind review --from <path|->
```

Review Evidence moves the Task toward User Judgment unless the calling procedure inserts an optional challenge pass.

## References

- `references/review-evidence.md`: Prepare Review Evidence from findings, risks, and remaining uncertainty.
