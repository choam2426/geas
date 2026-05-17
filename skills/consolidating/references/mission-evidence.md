# Mission Evidence Reference

## Purpose

Use this reference after Mission result User Judgment is recorded with `accepted` or `accepted_with_limits`. Mission Evidence is the final Mission report and reopening anchor; it is not the User Judgment itself and it does not replace Task Evidence.

## Required Inputs

- accepted Mission Spec ref
- accepted Mission Design ref
- recorded Mission result User Judgment ref
- accepted Task Evidence refs
- relevant role Evidence refs
- recorded Debt refs or explicit none
- recorded Memory refs or explicit none
- final gaps, follow-ups, accepted unverified scope, and accepted remaining risks

## Payload Shape

```markdown
---
name: <same mission name as Mission Spec>
evidence_type: mission
mission_spec_ref: <Mission Spec ref>
mission_design_ref: <Mission Design ref>
user_judgment_ref: <Mission result User Judgment ref>
---

## Summary
<Mission result summary.>

## User Judgment Summary
<Decision and accepted limits from Mission result User Judgment.>

## Mission Criteria Results

### <AC-001>: <criterion label or summary>
- Result: <satisfied | satisfied_with_limits | not_satisfied>
- Evidence refs:
  - <Task Evidence or role Evidence ref>
- Unverified scope:
  - <scope, or none>
- Remaining risks:
  - <risk, or none>

## Mission Design Deltas
- <expected design point and actual result, or none>

## Accepted Unverified Scope
- <User-accepted unverified scope, or none>

## Accepted Remaining Risks
- <User-accepted remaining risks, or none>

## Gaps
- <gap, source refs, and accepted route or none>

## Debts
- <Debt ref and short summary, or none>

## Follow Ups
- <follow-up candidate and source refs, or none>

## Reflection Summary
<What was learned, what was accepted as debt, and what remains for future work.>

## Memory Updates
- <Memory ref and short summary, or none>
```

## Criteria Results

- Cover every Mission acceptance criterion.
- Use the Mission Spec criterion labels when available.
- Use `satisfied` when the criterion is met and no User-accepted limit remains.
- Use `satisfied_with_limits` when the criterion is accepted with named unverified scope or remaining risk.
- Use `not_satisfied` when the criterion is unmet, unverifiable, deferred, or requires revision.
- Reference Task Evidence first, then role Evidence when it explains the basis.
- Do not use missing verification as verification Evidence; list it as unverified scope.

## Writing Rules

- Write Mission Evidence only after Mission result User Judgment is recorded with `accepted` or `accepted_with_limits`.
- Record User-accepted Debt and Memory candidates before Mission Evidence when those candidates exist.
- Summarize Debt refs; do not make Mission Evidence the Debt source of truth.
- Summarize Memory refs and the behavior change they represent.
- Preserve accepted gaps and follow-ups separately.
- Keep Task-specific detail in Task Evidence and link to it from Mission Evidence.
- Keep agent recommendations out of User Judgment Summary unless the User accepted them.

## Record Gate

Before asking `geas-cli` to record Mission Evidence:

- Mission result User Judgment ref exists.
- User Judgment decision is `accepted` or `accepted_with_limits`.
- Mission Spec and Mission Design refs match the Mission being closed.
- Criteria results cover the Mission acceptance criteria.
- Accepted unverified scope and accepted remaining risks match the User Judgment.
- User-accepted Debt candidates are recorded or explicitly absent.
- User-accepted Memory candidates are recorded or explicitly absent.
- Gaps and follow-ups reflect the final User decision.

## Stop Report

If Mission Evidence cannot be recorded, return:

- prepared Mission Evidence payload
- Mission result User Judgment ref
- Debt and Memory record refs or missing record details
- attempted record command purpose
- failure output
- next required User or operator decision
