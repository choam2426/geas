# Task Memory Reference

Use this reference after Task result User Judgment when later Tasks in the same Mission should inherit a working context.

Task Memory path:

```text
.geas/missions/<mission-id>/task-memory.md
```

## Item Shape

```markdown
### TM-001: <title>

- Status: active | superseded | promoted | dropped
- Category: user_preference | accepted_limit | working_context | avoid_next_time | verification_habit | reporting_hint
- Summary: <portable context for later Tasks>
- Applies To: <Task ids, scope, condition, or Mission-wide>
- Source Refs: <User Judgment, Task Evidence, Role Evidence refs>
- Accepted By: user | orchestrator
- Expires When: <condition or "Mission ends">
```

## Rules

- Use User acceptance for items that affect intent, scope, criteria, risk acceptance, or User preference.
- The coordinator may accept workflow-performance items such as verification habits or reporting hints.
- Do not use Task Memory to change Mission Spec, Mission Plan, Task Direction, or Task Contract silently.
- Promote only repeated or long-lived lessons to Memory during consolidation.
