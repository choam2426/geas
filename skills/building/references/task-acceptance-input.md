# Task Acceptance Input Reference

## Purpose

Use this reference when Task State is `awaiting_user_judgment` or when role Evidence requires a User decision. This briefing is not a runtime artifact; it is the User-facing input for Task result User Judgment.

## Required Inputs

- current Task Contract
- changed outputs or result refs
- Implementation Evidence
- Verification Evidence when available
- Review Evidence when available
- Challenger Evidence when available
- role-required, role-optional, or role-omitted decisions and omission reasons
- known unverified scope
- remaining risks
- contract deltas or requested actions surfaced by roles

## Briefing Shape

```markdown
Task result judgment input:
- Task: <task-id>
- Result summary: <what changed or was produced>
- Contract criteria:
  - <TC-AC-001>: <satisfied | satisfied_with_limits | not_satisfied | unclear>
- Evidence refs:
  - Implementation: <ref or missing>
  - Verification: <ref or missing>
  - Review: <ref or missing>
  - Challenge: <ref, omitted with reason, or missing>
- Role decisions:
  - <role>: <role_required | role_optional | role_omitted> - <basis, omitted reason, residual risk>
- Unverified scope:
  - <scope and reason>
- Remaining risks:
  - <risk and basis>
- Contract deltas:
  - <none or list>
- Choices:
  - accept
  - accept with limits
  - revise
  - defer
  - stop
- Recommended next step:
  - <judgment record, rework, specifying, pause, or stop>
```

## Chunked Briefing

- For long or decision-heavy results, show 2-3 related items at a time.
- Good chunks are result and changed outputs, criteria and Evidence, unverified scope and risks, choices and next step.
- Each chunk includes current result, decision needed, choices, and next step.
- Chunk confirmation means the User has reviewed that part; it is not User Judgment.
- After chunk review, present a final summary before preparing the User Judgment payload.

## Choice Mapping

- `accept`: User Judgment decision `accepted`; no accepted limits are needed.
- `accept with limits`: User Judgment decision `accepted_with_limits`; list accepted unverified scope and accepted remaining risks.
- `revise`: User Judgment decision `revise`; put concrete requested actions in `Requested Actions`.
- `defer`: User Judgment decision `deferred`; preserve why and when to revisit.
- `stop`: User Judgment decision `stopped`; preserve stop reason and state.

## User Judgment Payload Shape

Prepare this payload only after the User has made a Task result decision.

```markdown
---
name: <same mission name as Mission Spec>
judgment_type: task-result
task_id: <task-id>
decision: accepted | accepted_with_limits | revise | deferred | stopped
---

## Decision Trail
<Briefly summarize the Task result input, choices shown, and User decision.>

## Accepted Unverified Scope
- <User-accepted unverified scope, or none.>

## Accepted Remaining Risks
- <User-accepted remaining risks, or none.>

## Requested Actions
- <requested rework, Task Contract update, additional Task, deferral, stop, or none.>

## Notes
<User notes, preference, deferral condition, or stop reason.>
```

## Payload Rules

`building` prepares the decision trail from the briefing and User response, but the decision itself must come from the User. Do not convert a role verdict, recommendation, or chunk confirmation into User Judgment.
- Use `accepted` only when the User accepts the Task result without extra limits.
- Use `accepted_with_limits` only when the User accepts named unverified scope or remaining risks.
- Use `revise` when the User asks for rework, Task Contract update, additional Task, discard, or Mission baseline review.
- Use `deferred` when the User postpones judgment.
- Use `stopped` when the User stops the Task or Mission path.
- Keep omitted-role reasons and residual risks in `Decision Trail`, `Accepted Remaining Risks`, or `Requested Actions` as appropriate.
