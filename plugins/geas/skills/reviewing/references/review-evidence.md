# Review Evidence

Use this reference after Task-scoped review. Review Evidence records review coverage, findings, remaining risks, recommendation, and an agent-side verdict.

Review Evidence is Role Evidence. It is not Verification Evidence, Challenger Evidence, Task Evidence, User Judgment, or acceptance.

## Runtime Path

Write to:

```text
.geas/missions/<mission-id>/tasks/<task-id>/review-evidence.md
```

`review-evidence.md` is the current Review Evidence for this Task scope. If replacing existing Evidence would discard context that has not been reflected in Task Evidence, Task Memory, or Continuity Ledger, stop and return the payload.

## Frontmatter

```yaml
---
verdict: passed | changes_requested | escalated
---
```

Use `passed` only when no blocking findings remain and review coverage is sufficient for User judgment input.

## Payload Shape

```markdown
## Summary

<Review result and important limits.>

## Target

- <outputs, Implementation Evidence, Verification Evidence, and refs reviewed>

## Review Focus Used

- <Task Contract review focus actually applied>

## Review Coverage

### Covered

- <scope reviewed>

### Not Covered

- <scope not reviewed and reason>

## Review Methods

- <reading order, comparison basis, inspection method>

## Findings

### RV-001: <short title>

- Finding: <confirmed issue>
- Severity: <critical, high, medium, low>
- Category: <correctness, scope, regression, evidence, maintainability, user impact, security, data, other>
- Affected refs: <paths or artifact refs>
- Basis: <evidence for the finding>
- Recommendation: <fix, rerun, revise Task Contract, ask User, or accept risk>

If there are no findings, write `None.`

## Remaining Risks

- <risk after review, or `None.`>

## Overall Recommendation

<passed, rework, rerun verification, challenge, User decision, or criteria revision recommendation.>

## Reflection Candidates

- Task Memory: <candidate or `None.`>
- Memory: <candidate or `None.`>
- Debt Ledger: <candidate or `None.`>
- Continuity Ledger: <candidate or `None.`>
```

## Checklist

- Findings cite affected refs and basis.
- Review coverage and not-covered scope are visible.
- Recommendation is not User Judgment.
- Review does not rewrite outputs or run verification as Verification Evidence.

## Write Failure

If direct writing fails, return the complete payload, intended path, reason, and needed next action.
