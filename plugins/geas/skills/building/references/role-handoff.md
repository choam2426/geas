# Role Handoff Reference

## Purpose

Use this reference before calling `implementing`, `verifying`, `reviewing`, or `challenging`. A role handoff is a role subagent call. The handoff packet is the prompt sent to the role subagent. The role subagent runs in a separated context, and the handoff packet gives it enough context to work and stop safely without making `building` write the role output.

## Dispatch Sequence

1. Build the handoff packet as the prompt for the named Role Skill.
2. Include required `read_first`, target refs, focus, expected output, and stop conditions.
3. Dispatch the packet to the separated role subagent or role session.
4. Wait for the role result or handoff failure before continuing the Task loop.
5. Treat the handoff as incomplete when no separated role subagent or role session was created.

## Handoff Packet Shape

```markdown
Role handoff:
- Role Skill: implementing | verifying | reviewing | challenging
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

## Dispatch Rules

- A role handoff packet is sent only when the Task loop is dispatching that role.
- Once a role handoff packet is created, the role is required for that dispatch.
- When Task State routes to `implementing`, `verifying`, or `reviewing`, the matching role handoff is the required dispatch target for that phase.
- Do not include any dispatch-choice field in the handoff packet.
- If the Task loop does not route to challenge, preserve the challenge-not-routed reason in Task judgment input instead of creating a role handoff packet.

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
- Challenge-not-routed reasons are briefing inputs, not role Evidence.
- If no role subagent is available, the handoff fails.
- Role output produced by the main coordinator session in place of a role is not role Evidence.
- If a role reports contract delta, `building` treats it as Task result judgment input or a route to `specifying`.
- If a role cannot produce Evidence, `building` preserves the failure briefing and stops or asks the User for the next route.
