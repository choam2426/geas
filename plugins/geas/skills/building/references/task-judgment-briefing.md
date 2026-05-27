# Task Judgment Briefing Reference

Use this reference after enough Role Evidence exists for the User to judge a Task result.

The briefing is not a runtime artifact. If the User decides, write the decision as User Judgment.

Task User Judgment path:

```text
.geas/missions/<mission-id>/tasks/<task-id>/user-judgment.md
```

## Briefing Shape

```markdown
## Task Result Briefing

### Task

- Task Contract: <ref>
- Task Direction: <ref or none>
- Mission criteria: <AC refs>

### Result Summary

<What changed or was produced.>

### Evidence Read

- Implementation Evidence: <refs>
- Verification Evidence: <refs>
- Review Evidence: <refs>
- Challenger Evidence: <refs or none>

### Criteria Results

- TC-AC-001: <satisfied | not satisfied | unclear>
  - Evidence refs: <refs>
  - Unverified scope: <scope or none>
  - Remaining risks: <risks or none>

### Accepted Limits Candidates

- Unverified scope: <items the User may choose to accept>
- Remaining risks: <items the User may choose to accept>

### User Decision Needed

Choose one:

- `accepted`: accept the Task result. Put known limits under Accepted Limits.
- `revise`: request rework, Task Contract revision, additional Task, or criteria review.
- `canceled`: cancel this Task result and preserve the reason.
```

## User Judgment Payload

```markdown
---
decision: accepted | revise | canceled
---

## Decision Trail

<Briefing presented and User response.>

## Accepted Limits

### Unverified Scope

<Accepted unverified scope, or none.>

### Remaining Risks

<Accepted remaining risks, or none.>

## Requested Actions

<Requested rework, criteria revision, additional Task, cancellation handling, or none.>

## Notes

<Additional User notes.>
```

Write User Judgment only from the User's explicit decision.
