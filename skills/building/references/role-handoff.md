# Role Handoff

Use this reference when building invokes an implementation, verification, review, or challenge role pass.

## Boundary

Role output is produced in the role context named by the handoff. The building context prepares the handoff packet, receives the role result, briefs the User when the result needs a User decision or exposes a missing capability, and applies User decisions. It does not impersonate the role.

The role reads every `read_first` path before working. If a required `read_first` path cannot be read, treat the role handoff as unavailable.

When role handoff is unavailable, surface the recovery choice:

- Retry the role handoff.
- Proceed without that role pass and name the missing role output.
- Stop before changing the Task state or Evidence path that needed the role pass.

## Handoff Packet

Include:

- `role`: `implementer`, `verifier`, `reviewer`, or `challenger`.
- `invocation_decision`: `role_required` or `role_optional`.
- `procedure`: `implementing`, `verifying`, `reviewing`, or `challenging`.
- `lenses`: zero or more focus lenses such as `documentation`, `software`, `runtime`, `security`, `compatibility`, `operations`, `data`, `product`, or `ux`.
- Mission id, current Task id, and Task phase.
- `read_first`: artifact paths the role must read before work.
  - Latest accepted Mission Spec.
  - Latest accepted Mission Design.
  - Current Task Contract.
  - Current Task State when it affects phase or resume behavior.
  - Implementation Evidence for verifier, reviewer, and challenger passes after implementation.
  - Verification Evidence for reviewer and challenger passes after verification.
  - Review Evidence for post-review challenger passes.
- Inputs to inspect.
- Expected output type and Evidence kind.
- Write authority: whether the role may record through the CLI or must return output for the caller to review.
- Return format: Evidence path, structured findings, or draft payload.
- Responsibility boundary and User decisions to surface.
