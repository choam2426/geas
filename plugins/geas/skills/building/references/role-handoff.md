# Role Handoff

Use this reference when `building` dispatches implementation, verification, review, or challenge work. The coordinator prepares the handoff packet and waits for the role result; it does not write the role output itself.

## Packet Shape

```markdown
## Role Handoff

- Role: <implementing | verifying | reviewing | challenging>
- Mission: <mission id and directory>
- Task: <task id and directory>
- Purpose: <why this role is being called now>
- Expected output: <Role Evidence payload and direct write path, or payload-only result>

## Read First

- <Mission Spec ref>
- <Mission Plan ref>
- <Task Contract ref>
- <Task Direction ref when referenced>
- <role-relevant Evidence refs>
- <Task Memory ref when present>
- <common Memory ref when present>
- <receiving role Memory ref when present>
- <Debt Ledger and Continuity Ledger refs when relevant>

## Target Outputs

- <files, artifacts, UI flows, command outputs, or documents to inspect or change>

## Role Instructions

- <role-specific constraints from Task Contract>
- <verification, review, or challenge focus>
- <stop conditions>

## Return Shape

- Handoff result: <completed, halted, or blocked by missing input>
- Written refs: <Role Evidence refs if written>
- Prepared payloads: <payloads if not written>
- Changed outputs: <implementation only>
- Findings or criteria results: <verification, review, challenge>
- Limits: <unverified or uncovered scope>
- Reflection candidates: <Task Memory, Debt Ledger, Memory, Continuity Ledger candidates>
```

## Required Read First

- Every role handoff includes Mission Spec, Mission Plan, and Task Contract.
- Include Task Direction when the Task Contract `task_direction_ref` is not empty.
- Include `.geas/missions/<mission-id>/task-memory.md` when it exists.
- Include `.geas/memory/common.md` when it exists.
- Include the receiving role's Memory when it exists:
  - `implementing`: `.geas/memory/roles/implementer.md`
  - `verifying`: `.geas/memory/roles/verifier.md`
  - `reviewing`: `.geas/memory/roles/reviewer.md`
  - `challenging`: `.geas/memory/roles/challenger.md`
- Include Implementation Evidence for verification, review, and challenge.
- Include Verification Evidence for review and challenge when available.
- Include Review Evidence for challenge when available.
- Include output refs whenever the role must inspect generated or changed artifacts.

## Stop Rule

If any `read_first` path cannot be read, the role stops and returns a handoff failure. The coordinator does not fill in missing substantive content.
