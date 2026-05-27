# Implementation Evidence

Use this reference after Task-scoped implementation work. Implementation Evidence records what changed, why, what was checked by the implementer, what remains uncertain, and which follow-up records may be needed.

Implementation Evidence is Role Evidence. It is not Verification Evidence, Review Evidence, Challenger Evidence, Task Evidence, User Judgment, Task Memory, Debt Ledger, Memory, or Continuity Ledger.

## Runtime Path

Write to:

```text
.geas/missions/<mission-id>/tasks/<task-id>/implementation-evidence.md
```

`implementation-evidence.md` is the current Implementation Evidence for this Task scope. If replacing existing Evidence would discard context that has not been reflected in Task Evidence, Task Memory, or Continuity Ledger, stop and return the payload.

## Payload Shape

```markdown
## Summary

<Independent summary of the implementation work.>

## Changed Outputs

- <path or artifact ref>: <what changed>

## Affected Scope

- <feature, document area, concept, user flow, data, or dependency affected>

## Implementation Decisions

- <decision>: <reason and tradeoff>

## Assumptions

- <assumption used while implementing>

## Contract Deltas

- <Task Contract point that changed or needs revision, or `None.`>

## Self Checks

- <command, inspection, or quick check>: <result and output ref>

## Limits

- <unverified scope, known limitation, or remaining uncertainty>

## Reflection Candidates

- Task Memory: <candidate or `None.`>
- Memory: <candidate or `None.`>
- Debt Ledger: <candidate or `None.`>
- Continuity Ledger: <candidate or `None.`>
```

## Checklist

- Mission Spec, Mission Plan, Task Contract, and Task Direction when referenced were read.
- Changed outputs stay inside Task Contract scope.
- Self-checks are not presented as independent verification.
- Contract Deltas are explicit when implementation revealed criteria changes.
- Reflection candidates cite the Evidence or output that supports them.

## Write Failure

If direct writing fails, return:

```text
Implementation Evidence write failed
- Intended path: <path>
- Reason: <filesystem, missing directory, replacement would discard context, permission, or other failure>
- Payload: <complete payload or payload path>
- Needed next: <retry write, revise Task Contract, ask User, or hand off to coordinator>
```
