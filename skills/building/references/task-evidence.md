# Task Evidence Reference

## Purpose

Use this reference only after Task result User Judgment has been recorded with decision `accepted` or `accepted_with_limits`. Task Evidence is the Task closing summary, not a replacement for role Evidence.

## Payload Shape

```markdown
---
name: <same mission name as Mission Spec>
task_id: <task-id>
evidence_type: task
task_contract_ref: <task-contract-ref>
user_judgment_ref: <task-result-user-judgment-ref>
---

## Summary
<Task result summary.>

## User Judgment Summary
<User decision and accepted limits, if any.>

## Criteria Results
### TC-AC-001: <criterion label>
- Result: satisfied | satisfied_with_limits | not_satisfied
- Evidence refs:
  - <implementation, verification, review, or challenger evidence refs>
- Unverified scope:
  - <none or accepted scope>
- Remaining risks:
  - <none or accepted risk>

## Accepted Unverified Scope
- <User-accepted unverified scope, or none.>

## Accepted Remaining Risks
- <User-accepted remaining risks, or none.>
```

## Writing Rules

- Summarize the Task so a later agent can resume without rereading every role Evidence first.
- Tie each Task acceptance criterion to Evidence refs.
- Include older Evidence refs when they remain valid after rework.
- Put accepted unverified scope and remaining risks only when the User accepted them.
- Use `satisfied` when the criterion is met without accepted limits.
- Use `satisfied_with_limits` when the criterion is closed because the User accepted explicit limits or risks.
- Use `not_satisfied` only when preserving a non-accepted or unresolved result for context; do not record Task Evidence as final success on that basis.

## Record Gate

- User Judgment ref exists.
- User Judgment decision is `accepted` or `accepted_with_limits`.
- Task Contract ref matches the Task being closed.
- Required role Evidence refs exist.
- Criteria Results cover the Task Contract acceptance criteria.
- `geas-cli` records the payload with `task evidence record --kind task`.

## Gotchas

- Do not record Task Evidence for `revise`, `deferred`, or `stopped`.
- Do not hide failed, skipped, or unavailable checks; include them as accepted limits only when the User accepted them.
- Do not treat Task Evidence as Mission Evidence.
- Do not treat Task Evidence as User Judgment.
