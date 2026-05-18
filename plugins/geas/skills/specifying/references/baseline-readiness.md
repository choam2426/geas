# Baseline Readiness Reference

## Purpose

Use this reference before routing from `specifying` toward execution. The goal is to make sure the baseline is accepted, recorded, and reviewable before `building` starts.

## Readiness Checks

- Mission Spec has explicit User acceptance and a recorded ref.
- Mission Design has explicit User acceptance and a recorded ref.
- Required Pre-build Design Surface decisions are resolved, reflected in the Task Contract Set, or explicitly accepted by the User as non-blocking.
- Skipped Pre-build Design Surface has a stated skip reason.
- Initial Task Contract Set has explicit User acceptance and recorded refs for each Task Contract.
- Mission Spec, Mission Design, and every Task Contract in the Set use the same mission name.
- Every Task Contract in the initial Set has a task id, bounded scope, deliverables, acceptance criteria, verification checks, and review focus.
- The first building Task is selected from the accepted Task Contract Set and has no unmet dependencies.
- Open questions are either resolved or listed as assumptions/risks accepted by the User.
- Any baseline challenge findings are resolved, accepted as risk, or explicitly deferred by the User.
- Open decisions are resolved, accepted by the User as non-blocking risk, or assigned to a later resolution point that cannot affect the initial Task Contract Set, Task dependencies, or first building Task.
- No decision remains only in a Pre-build Design Surface file, diagram, prototype, comparison, or briefing when it affects the Task Contract Set.
- The next action is `building`, not implementation inside `specifying`.

## Not Ready Conditions

- The User accepted one artifact but not the next artifact.
- A draft payload exists but has not been accepted.
- `geas-cli` did not report a successful record for an accepted artifact.
- Task Contract scope includes work not covered by Mission Spec or Mission Design.
- Required Pre-build Design Surface is skipped without a reason.
- A selected design-surface decision affects execution but is absent from the Task Contract Set.
- A challenge finding blocks User acceptance and has not been addressed, accepted, or deferred.
- An open decision can affect the initial Task Contract Set, dependencies, or first building step.
- No first building Task has been selected from the accepted Task Contract Set.

## Briefing Shape

```markdown
Baseline readiness:
- Mission Spec: <accepted/ref or missing>
- Mission Design: <accepted/ref or missing>
- Pre-build Design Surface: <not needed with reason, decisions reflected, non-blocking accepted risk, or blocking>
- Initial Task Contract Set: <accepted/recorded refs or missing>
- First building Task: <task-id or missing>
- Open decisions: <none, resolved, accepted non-blocking risk, or later resolution point>
- Risks accepted by User: <none or list>
- Next recommended stage: building | stop
```
