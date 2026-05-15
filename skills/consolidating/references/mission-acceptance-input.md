# Mission Acceptance Input Reference

## Purpose

Use this reference when a Mission has accepted Task Evidence and the User needs a Mission result judgment input. This briefing is not a runtime artifact; it is the User-facing input for Mission result User Judgment.

## Required Inputs

- accepted Mission Spec
- accepted Mission Design
- accepted Task Evidence refs
- Task result User Judgment refs
- relevant role Evidence refs
- Mission criteria labels or equivalent acceptance criteria
- known gaps, accepted unverified scope, remaining risks, debt candidates, memory candidates, and follow-up candidates

## Briefing Shape

```markdown
Mission result judgment input:
- Mission: <mission-id or name>
- Result summary: <what the Mission produced and what is ready for judgment>
- Mission criteria:
  - <AC-001>: <satisfied | satisfied_with_limits | not_satisfied | unclear>
- Task Evidence refs:
  - <task-id>: <Task Evidence ref> - <accepted | accepted_with_limits>
- Role Evidence refs:
  - <role>: <Evidence ref or omitted reason>
- Mission Design deltas:
  - <expected design point and actual result>
- Gaps:
  - <baseline item not satisfied, unclear, or unverified>
- Accepted Task unverified scope:
  - <scope and source Task Evidence ref>
- Accepted Task remaining risks:
  - <risk and source Task Evidence ref>
- Debt candidates:
  - <candidate title, impact, and source refs>
- Memory candidates:
  - <candidate guideline, scope, and source refs>
- Follow-up candidates:
  - <candidate next work outside current Mission scope>
- Choices:
  - accept
  - accept with limits
  - revise
  - defer
  - stop
- Recommended next step:
  - <record judgment, route to building, route to specifying, defer, or stop>
```

## Chunked Briefing

- For long or decision-heavy Mission result input, show 2-3 related items at a time.
- Good chunks are Mission result and design deltas, criteria results and Evidence refs, gaps and accepted limits, reflection candidates, and final choices.
- Each chunk includes current synthesis, decision needed, available choices or revision options, and next step.
- Chunk confirmation means the User has reviewed that part; it is not Mission result User Judgment.
- After chunk review, present a final summary before preparing the User Judgment payload.

## Choice Mapping

- `accept`: User Judgment decision `accepted`; no accepted Mission result limits are needed. The User may still accept separate Debt, Memory, or follow-up candidates as closure records.
- `accept with limits`: User Judgment decision `accepted_with_limits`; list accepted gaps, unverified scope, and remaining risks that limit the Mission result. Debt, Memory, and follow-up candidate acceptance remains separate and can happen with either accepted Mission decision.
- `revise`: User Judgment decision `revise`; put concrete requested actions in `Requested Actions`.
- `defer`: User Judgment decision `deferred`; preserve why and when to revisit.
- `stop`: User Judgment decision `stopped`; preserve stop reason and state.

## User Judgment Payload Shape

Prepare this payload only after the User has made a Mission result decision.

```markdown
---
name: <same mission name as Mission Spec>
judgment_type: mission-result
decision: accepted | accepted_with_limits | revise | deferred | stopped
---

## Decision Trail
<Briefly summarize the Mission result input, choices shown, final summary, and User decision.>

## Accepted Unverified Scope
- <User-accepted unverified scope, or none.>

## Accepted Remaining Risks
- <User-accepted remaining risks, or none.>

## Requested Actions
- <additional Task, Task Contract update, Mission baseline revision, deferral, stop, or none.>

## Notes
<User notes, accepted gaps, debt or follow-up acceptance, deferral condition, or stop reason.>
```

## Payload Rules

`consolidating` prepares the decision trail from the briefing and User response, but the decision itself must come from the User.

- Use `accepted` only when the User accepts the Mission result without extra limits.
- Use `accepted_with_limits` only when the User accepts named gaps, unverified scope, or remaining risks as limits on the Mission result.
- Treat Debt, Memory, and follow-up candidate acceptance as closure decisions that can accompany either `accepted` or `accepted_with_limits`.
- Use `revise` when the User asks for additional Task work, Task Contract update, Mission baseline review, or result changes.
- Use `deferred` when the User postpones Mission result judgment.
- Use `stopped` when the User stops the Mission path.
- Do not include `task_id` in a Mission result User Judgment payload.
- Do not convert Task Evidence, role verdict, recommendation, or chunk confirmation into User Judgment.

## Record Gate

Before asking `geas-cli` to record Mission result User Judgment:

- The final User decision is present.
- The decision is one of `accepted`, `accepted_with_limits`, `revise`, `deferred`, or `stopped`.
- The payload reflects the final summary shown to the User.
- Accepted limits and requested actions match the User's words.
- Mission Evidence recording has not started.
