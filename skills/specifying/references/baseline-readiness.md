# Baseline Readiness Reference

## Purpose

Use this reference before routing from `specifying` toward execution. The goal is to make sure the baseline is accepted, recorded, and reviewable before `building` starts.

## Readiness Checks

- Mission Spec has explicit User acceptance and a recorded ref.
- Mission Design has explicit User acceptance and a recorded ref.
- Initial Task Contract has explicit User acceptance and a recorded ref.
- Mission Spec, Mission Design, and Task Contract use the same mission name.
- The initial Task Contract has a task id, bounded scope, deliverables, acceptance criteria, verification checks, and review focus.
- Open questions are either resolved or listed as assumptions/risks accepted by the User.
- Any baseline challenge findings are resolved, accepted as risk, or explicitly deferred by the User.
- Open decisions are resolved, accepted by the User as non-blocking risk, or assigned to a later resolution point that cannot affect the initial Task Contract.
- The next action is `building`, not implementation inside `specifying`.

## Not Ready Conditions

- The User accepted one artifact but not the next artifact.
- A draft payload exists but has not been accepted.
- `geas-cli` did not report a successful record for an accepted artifact.
- Task Contract scope includes work not covered by Mission Spec or Mission Design.
- A challenge finding blocks User acceptance and has not been addressed, accepted, or deferred.
- An open decision can affect the initial Task Contract or first building step.

## Briefing Shape

```markdown
Baseline readiness:
- Mission Spec: <accepted/ref or missing>
- Mission Design: <accepted/ref or missing>
- Initial Task Contract: <accepted/ref or missing>
- Open decisions: <none, resolved, accepted non-blocking risk, or later resolution point>
- Risks accepted by User: <none or list>
- Next recommended stage: building | stop
```
