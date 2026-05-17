# Implementation Evidence

## Purpose

Implementation Evidence records what the implementer changed inside the Task Contract, why those choices were made, what was checked before handoff, and what limits remain for later verification, review, or User Judgment.

Implementation Evidence has no verdict. It is implementation context, not acceptance, verification, review, or Task completion.

## Payload Shape

```markdown
---
name: <mission-name>
task_id: <task-id>
evidence_type: implementation
task_contract_ref: <task-contract-ref>
---

## Summary

<Brief summary of the implementation work completed.>

## Changed Outputs

- <path-or-artifact-ref>: <what changed or was created>

## Affected Scope

- <feature, document area, workflow, behavior, or user path affected by the change>

## Implementation Decisions

- <decision>: <reason>

## Assumptions

- <assumption used while implementing, or "None">

## Contract Deltas

- <delta that may require Task Contract update, or "None">

## Self Checks

- <check performed>: <result or observed output>

## Limits

- <unchecked area, blocked check, environment gap, or remaining uncertainty>

## Reflection Candidates

- <candidate learning for a later Task or Mission reflection, or "None">
```

## Section Rules

`Summary` states the completed implementation work in a few sentences.

`Changed Outputs` names concrete files, generated artifacts, documents, or other output refs. Use stable paths or artifact refs when available.

`Affected Scope` describes the user-visible, code-level, document-level, or workflow area touched by the change.

`Implementation Decisions` records decisions that shaped the implementation. Include the reason, especially when another reasonable option existed.

`Assumptions` lists assumptions used while implementing. If an assumption affects correctness or scope, also list the related limit or contract delta.

`Contract Deltas` exposes non-blocking work that differs from or may refine the Task Contract. Use `None` only when the implementation stayed fully within the contract and raised no follow-up contract issue.

Blocking contract deltas do not belong in a recorded Implementation Evidence payload as completed work. Stop and return the stop report instead. Blocking deltas include required work outside the Task Contract, a new User decision, an uncovered dependency or configuration change, or any change that would alter accepted behavior, scope, acceptance criteria, or verification expectations.

`Self Checks` lists checks performed by the implementer before handoff. These checks can include targeted commands, inspection, local runs, formatting checks, or file review. They do not replace later Verification Evidence.

`Limits` lists unverified scope, checks not run, blocked environment support, secrets or services not available, and areas the caller should carry into verification or Task judgment input.

`Reflection Candidates` lists small follow-up lessons that may affect later contracts, implementation approach, verification checks, or Mission design.

## Record Gate

Before asking `geas-cli` to record Implementation Evidence, confirm:

- Every required `read_first` ref was read.
- The Task Contract ref and task id match the handoff.
- Changed outputs stay within the Task Contract and handoff focus.
- Self checks were performed or the reason they could not run is listed in `Limits`.
- Non-blocking contract deltas are listed explicitly.
- No blocking contract delta remains unresolved.
- No self check failure remains unresolved.
- Missing environment support appears in `Limits`.
- No verification verdict, review verdict, Task result decision, or User Judgment is included.

Record with the existing runtime write surface:

```text
task evidence record --kind implementation
```

If the CLI adapter requires a file path or task id argument, pass the prepared payload through that adapter without changing the Evidence meaning.

## Stop Report Shape

When implementation stops before Evidence can be recorded, return:

```markdown
## Implementation Stopped

- Task: <task-id or unknown>
- Reason: <missing ref, scope gap, environment gap, failed self check, required User decision, or record failure>
- Current Contract Allows: <short statement>
- Needed Delta or Decision: <short statement>
- Changed Outputs Already Made: <refs or "None">
- Preserved Payload: <payload ref, inline payload, or "None">
- Suggested Route: <return to coordinator, revise Task Contract, prepare environment, or continue with verification/review only after a valid Evidence ref exists>
```
