# Mission Judgment Briefing Reference

Use this reference when accepted Task Evidence is ready for Mission-level User judgment.

The briefing is not a runtime artifact. If the User decides, write the decision as Mission User Judgment.

Mission User Judgment path:

```text
.geas/missions/<mission-id>/user-judgment.md
```

## Briefing Shape

```markdown
## Mission Result Briefing

### Mission Criteria

- Mission Spec: <ref>
- Mission Plan: <ref>

### Task Evidence Read

- <task-id>: <Task Evidence ref> - <Task User Judgment decision>

### Mission Criteria Results

- AC-001: <satisfied | satisfied_with_limits | not_satisfied>
  - Task Evidence refs: <refs>
  - Unverified scope: <scope or none>
  - Remaining risks: <risks or none>

### Plan Deltas

<Where actual Task flow differed from Mission Plan and why it matters.>

### Accepted Limits Candidates

- Unverified scope: <items the User may accept>
- Remaining risks: <items the User may accept>

### Ledger Candidates

- Debt Ledger: <items needing User acceptance>
- Memory: <lessons to keep>
- Continuity Ledger: <open next actions, decisions, questions, handoff notes>

### User Decision Needed

Choose one:

- `accepted`: accept the Mission result. Put known limits under Accepted Limits.
- `additional_task`: continue with another Task before Mission completion.
- `canceled`: cancel Mission closure and preserve the reason.
```

## User Judgment Payload

```markdown
---
decision: accepted | additional_task | canceled
---

## Decision Trail

<Briefing presented and User response.>

## Accepted Limits

### Unverified Scope

<Accepted unverified scope, or none.>

### Remaining Risks

<Accepted remaining risks, or none.>

## Requested Actions

<Additional Task, criteria revision, cancellation handling, or none.>

## Notes

<Additional User notes.>
```

Write Mission Evidence only after this User Judgment exists.
