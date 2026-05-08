# Challenger Evidence

Use this reference to write Challenger Evidence.

## Payload Shape

```yaml
target: []
challenge_focus: []
findings:
  - finding: ""
    risk_type: assumption
    basis: ""
    escalation: ""
user_decisions_needed: []
deeper_checks_needed: []
verdict: passed
overall_recommendation: ""
```

Allowed `risk_type` values:

- `assumption`
- `scope`
- `verification_gap`
- `operational_risk`
- `tradeoff`
- `repeat_risk`

Allowed `verdict` values:

- `passed`
- `changes_requested`
- `escalated`

## Challenge Focus

Select focus from actual risk:

- Hidden assumptions.
- Scope boundaries.
- Acceptance criteria that are too vague or too broad.
- Verification checks that cannot prove the criteria.
- Evidence that overclaims.
- Data, permissions, deployment, migration, or security risk.
- Long-term maintenance cost.
- User-level tradeoffs.
- Repeat risks likely to affect later Missions.

## Finding Rules

Good Challenger findings:

- Name the hidden risk.
- Tie it to a contract, artifact, output, or Evidence basis.
- Explain why User Judgment may change.
- Suggest escalation, deeper checks, or revision.

Avoid findings based only on personal preference.

## No Finding Case

When no finding exists, write:

```yaml
findings: []
challenge_focus:
  - "Scope boundary and verification gap check against Task Contract and role Evidence."
overall_recommendation: "No additional challenge finding found within the stated focus; proceed to User Judgment with the listed unverified scope."
```

Still list `deeper_checks_needed` if confidence depends on checks that were outside the challenge scope.

## Verdict Rules

Use `passed` when:

- Challenge focus was covered.
- No finding requires revision before User Judgment.
- No required challenge focus has an unresolved User or Mission-level decision point inside the Task Contract.
- Any remaining uncertainty is outside the stated challenge focus and is visible as scope outside challenge, not as success.

Use `changes_requested` when:

- A baseline, implementation, verification, or review issue should be corrected within the Task.

Use `escalated` when:

- The issue belongs to User or Mission-level judgment.
- The Task Contract is too weak to judge the result.
- A risk is too costly to accept without explicit User decision.

## Quality Checklist

- Target includes the artifacts challenged.
- Focus is specific.
- Findings have basis.
- User decisions are clearly separated from deeper checks.
- Verdict is not presented as User Judgment.
