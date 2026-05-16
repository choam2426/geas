# Role Handoff Reference

## Purpose

Use this reference before calling `implementing`, `verifying`, `reviewing`, or `challenging`. A role handoff is a role subagent call. The role subagent runs in a separated context, and the handoff packet gives it enough context to work and stop safely without making `building` write the role output.

## Handoff Packet Shape

```markdown
Role handoff:
- Role Skill: implementing | verifying | reviewing | challenging
- Role decision: role_required | role_optional | role_omitted
- Decision basis:
  - <why this role is required, optional, or omitted>
- Omitted reason:
  - <only when role_omitted>
- Residual risk:
  - <risk accepted for omission, or none>
- Task id: <task-id>
- Current phase: <phase>
- Trigger: <why this role is being called now>
- read_first:
  - <accepted Mission Spec ref>
  - <accepted Mission Design ref>
  - <current Task Contract ref>
  - <phase-relevant Evidence refs>
- Target refs:
  - <changed outputs, target files, result refs, or draft payload paths>
- Environment context:
  - <toolchain, verification tools, runtime services, secrets/connectors, setup limits, environment gaps>
- Focus:
  - <specific work, checks, review focus, or challenge focus>
- Expected output:
  - <Implementation Evidence | Verification Evidence | Review Evidence | Challenger Evidence>
- Must stop if:
  - <unreadable read_first, contract delta, missing target, unavailable check, unsafe scope>
- Return to building with:
  - <Evidence ref or failure briefing>
  - <unverified scope>
  - <contract deltas or User decision points>
```

## `read_first` Rules

- Always include accepted Mission Spec and accepted Mission Design.
- Always include the current Task Contract.
- Include Implementation Evidence before verification, review, or challenge.
- Include Verification Evidence before review or challenge.
- Include Review Evidence before challenge when challenge follows review.
- Include prior User Judgment only when the role is revisiting accepted or revised work and that judgment affects the current focus.
- If any required `read_first` path cannot be read, do not call the role.

## Target Ref Rules

- Include changed outputs, target files, result refs, or draft payload paths needed to inspect the Task result.
- Require target refs for `verifying`, `reviewing`, and `challenging`.
- For `implementing`, include target refs when the Task Contract names existing files or artifacts to modify.
- If target refs are missing for a role that needs them, do not call the role.

## Environment Context Rules

- Include environment context when toolchain, verification tools, runtime services, secrets, connectors, or setup limits affect the role.
- Use `references/task-environment.md` for the environment context shape.
- If required environment setup is unavailable, do not call the role unless the User accepts that gap as unverified scope.
- Pass unavailable verification support as unverified scope instead of treating it as Evidence.

## Role Decision Rules

- Use `role_required` when the current phase requires the role or the User explicitly requested it.
- Use `role_optional` when the role can add judgment value but the Task Contract or current phase does not require it.
- Use `role_omitted` when the role is skipped.
- For `role_omitted`, preserve the omitted reason and residual risk so `building` can include them in Task judgment input.
- Do not use `role_omitted` for implementation, verification, or review when the current Task phase requires that role.

## Role Focus

- `implementing`: execute only inside the current Task Contract and report contract deltas instead of expanding scope.
- `verifying`: run or inspect the Task Contract verification checks and expose unverified scope.
- `reviewing`: inspect changed outputs, Implementation Evidence, Verification Evidence, and review focus.
- `challenging`: pressure-test assumptions, scope boundaries, verification gaps, operational risks, and User-level decision points.

## Handoff Boundaries

- Role handoff calls a role subagent with a separated execution context; it is not role-producing work performed inside the main coordinator session.
- The role subagent uses the handoff packet and `read_first` refs as its working context, not the main coordinator session's scratch context.
- If the caller cannot create the role subagent, the role has not been handed off.
- The role writes substantive role Evidence.
- `building` may render, preserve, or record a role payload returned by the role, but it does not invent missing role content.
- Omitted-role reasons are briefing inputs, not role Evidence.
- If no role subagent is available, `role_required` is a handoff failure.
- Only `role_optional` may be omitted when the omitted reason and residual risk are preserved.
- Role output produced by the main coordinator session in place of a role is not role Evidence.
- If a role reports contract delta, `building` treats it as Task result judgment input or a route to `specifying`.
- If a role cannot produce Evidence, `building` preserves the failure briefing and stops or asks the User for the next route.
