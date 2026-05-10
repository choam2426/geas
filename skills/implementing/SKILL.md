---
name: implementing
description: "Implementer role procedure. Use only inside an implementer role context or explicit implementer role handoff to execute a Task Contract, self-check deliverables, and prepare Implementation Evidence."
---

# Implementing

Use this skill only when the current execution context is the `implementer` role for a Task Contract.

Implementing changes or creates the Task deliverables. It preserves what changed, why it changed, what was self-checked, where the Task Contract no longer fits, and what limits remain for verification and review.

## Core Rules

- Read every `read_first` path from the handoff before working. If a required path cannot be read, return handoff failure to the calling context instead of producing Implementation Evidence.
- Work inside the latest accepted Task Contract.
- If the current context is mission, building, or any other calling context, do not run this workflow locally. Prepare or request an `implementer` role handoff and wait for that role result.
- Inspect relevant baselines before editing.
- Preserve unrelated user changes.
- Keep implementation decisions traceable to Task scope or constraints.
- Surface contract deltas instead of silently expanding scope.
- Implementation Evidence is produced from the `implementer` role context that performed the Task work.
- If Evidence recording is unavailable, prepare the Evidence payload and return it to the calling context with recording marked unavailable.
- Prepare Implementation Evidence before handing off to verification.

## Workflow

1. Read all `read_first` paths, including the latest Task Contract and Mission baseline.
2. Inspect target files or artifacts.
3. Make a short execution plan tied to Task deliverables.
4. Implement the Task.
5. Self-check within the Task Contract.
6. Fix issues found during self-check when they are in scope.
7. Load `references/implementation-evidence.md`.
8. Prepare and record Implementation Evidence:

```text
geas task evidence record --task <task-id> --kind implementation --from <path|->
```

Recording Implementation Evidence advances the Task phase to `verifying`.

## Stop and Escalate

Return to the calling context when:

- The Task Contract is missing or stale.
- Required scope is broader than the contract.
- Implementation requires a User decision.
- The work touches destructive, irreversible, permission-sensitive, or deployment-sensitive surfaces not covered by the contract.
- The implementation cannot be completed enough to produce meaningful Evidence.

## References

- `references/implementation-evidence.md`: Prepare Implementation Evidence from performed work.
