# Task Evidence

Use this reference after Task User Judgment exists. Task Evidence is the Task closing summary that records what the User judged, which Evidence supported the decision, accepted limits, Task Memory reference, and next Task hints.

Task Evidence does not replace Role Evidence or User Judgment.

## Runtime Path

Write to:

```text
.geas/missions/<mission-id>/tasks/<task-id>/task-evidence.md
```

Write Task Evidence for Task User Judgment decision `accepted` or `canceled`. For `revise`, write User Judgment and route requested actions without treating the Task as closed.

## Frontmatter

```yaml
---
user_judgment_ref: <user-judgment.md>
---
```

## Payload Shape

```markdown
## Task Result

<Summary of the Task result the User judged.>

## User Judgment Summary

<Decision, decision trail, accepted limits, and requested actions from User Judgment.>

## Contract Criteria Results

- TC-AC-001:
  - Result: <satisfied, satisfied_with_limits, not_satisfied>
  - Evidence refs: <Role Evidence and output refs>
  - Unverified scope: <scope or `None.`>
  - Remaining risks: <risks or `None.`>

## Changed Outputs

- <path or artifact ref>: <summary>

## Evidence References

- Implementation Evidence: <refs>
- Verification Evidence: <refs>
- Review Evidence: <refs>
- Challenger Evidence: <refs or `None.`>

## Accepted Limits

- Unverified Scope: <accepted unverified scope or `None.`>
- Remaining Risks: <accepted risks or `None.`>

## Decision Notes

- <User decisions and tradeoffs fixed during the Task>

## Task Memory Reference

<`.geas/missions/<mission-id>/task-memory.md` ref or `None.`>

## Next Task Hints

- <handoff hint for later Task, or `None.`>

## Cancellation Summary

<For canceled Task records, state the cancellation reason and reverted or retained outputs. Otherwise `Not applicable.`>
```

## Write Failure

If direct writing fails, return the complete payload, intended path, reason, and needed next action.
