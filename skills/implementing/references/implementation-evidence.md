# Implementation Evidence

Use this reference to write Implementation Evidence after implementation and self-check.

## Payload Shape

```yaml
summary: ""
changed_outputs: []
affected_scope: []
decisions: []
contract_deltas: []
self_checks: []
limits: []
reflection_candidates: []
```

## Field Guidance

| Field | Include |
| --- | --- |
| `summary` | What was done, written so a later reader can understand the Task result. |
| `changed_outputs` | Files, docs, code, generated artifacts, runtime paths, or external outputs changed or created. |
| `affected_scope` | Mission or Task scope areas affected by the work. |
| `decisions` | Important implementation choices and why they fit the contract. |
| `contract_deltas` | Any difference between the Task Contract and what implementation revealed. |
| `self_checks` | Checks performed by the implementer before handoff, with results. |
| `limits` | Work not completed, not checked, blocked, or uncertain from the implementer's perspective. |
| `reflection_candidates` | Lessons that may affect future Task Contracts, verification checks, or Memory. |

## Self-Check

Self-check should run before Evidence recording.

Use checks appropriate to the Task:

- Read changed files for obvious mistakes.
- Run local formatting or focused tests when within scope.
- Search for retired names, broken references, or TODO placeholders when relevant.
- Confirm deliverables listed in Task Contract exist.
- Confirm changed outputs belong to `scope_in`.
- Confirm adjacent work stayed in `scope_out`.

Self-check is not independent verification. Phrase it as implementer self-check, not as passed verification.

## Contract Delta Rules

Use `contract_deltas` when implementation reveals:

- A deliverable needs a different shape.
- A scope item is larger than expected.
- A verification check is missing or impossible.
- A review focus needs to change.
- A dependency was discovered.
- The Task touches Mission scope not represented in the contract.

Contract deltas do not authorize scope expansion. They give the calling context and the User a basis for revision or acceptance with limits.

## Evidence Quality Checklist

- Every changed output has a concrete reference.
- Summary names the Task result, not just the activity.
- Decisions explain why meaningful choices were made.
- Self-checks distinguish checked and unchecked areas.
- Limits are candid.
- Reflection candidates are reusable signals, not diary notes.
