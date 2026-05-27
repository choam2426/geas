# Mission Evidence Reference

Use this reference after Mission result User Judgment exists and the User accepted Mission completion.

Write to:

```text
.geas/missions/<mission-id>/mission-evidence.md
```

## Payload Template

```markdown
---
user_judgment_ref: <Mission user judgment ref>
---

## Mission Result

<Mission result summary.>

## User Judgment Summary

<Mission User Judgment decision and accepted limits.>

## Mission Criteria Results

### AC-001: <criterion label>

- Result: satisfied | satisfied_with_limits | not_satisfied
- Evidence refs: <Task Evidence refs>
- Unverified scope: <scope or none>
- Remaining risks: <risks or none>

## Task Evidence References

- <task-id>: <Task Evidence ref>

## Mission Plan Deltas

<Where actual Task flow differed from Mission Plan and why.>

## Accepted Limits

### Unverified Scope

<Final accepted unverified scope, or none.>

### Remaining Risks

<Final accepted risks, or none.>

## Decisions And Tradeoffs

<Important User decisions, tradeoffs, and accepted costs.>

## Debt Ledger Updates

<Debt Ledger item refs and reasons, or none.>

## Memory Updates

<Memory item refs and reasons, or none.>

## Continuity Ledger Updates

<Continuity Ledger item refs and reasons, or none.>
```

## Rules

- Mission Evidence is not User Judgment.
- Mission Evidence references Task Evidence and ledger updates; it does not replace them.
- Use `satisfied_with_limits` when the User accepted known unverified scope or remaining risk.
- Do not write Mission Evidence when the Mission User Judgment requests additional Task work or cancellation.
- Do not overwrite existing `mission-evidence.md` without explicit User instruction.
