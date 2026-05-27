# Task Contract Reference

Use this reference during Task specifying after Mission Spec and Mission Plan are accepted, and after any needed Task Direction is accepted.

Write each Task Contract to:

```text
.geas/missions/<mission-id>/tasks/<task-id>/task-contract.md
```

## Payload Template

```markdown
---
task_direction_ref: "<directions/ref or empty string>"
mission_acceptance_refs:
  - AC-001
depends_on:
  - <task-id or none>
risk_level: low | medium | high
---

## Task Summary

<The outcome this Task should achieve.>

## Mission Relation

<How this Task contributes to Mission Spec criteria and Mission Plan Task Structure.>

## Starting Context

<Accepted prior Tasks, refs, files, docs, commands, and context to read first.>

## Scope

### In

- <included work>

### Out

- <excluded work>

## Deliverables

- <runtime artifact, code/doc output, changed behavior, or other result>

## Impact Surface

<Files, modules, docs, UI flows, data, dependencies, or side effects.>

## Acceptance Criteria

### TC-AC-001: <criterion>

<Concrete condition for User judgment.>

## Execution Guardrails

<Existing style, boundaries, no unrelated refactors, safety limits.>

## Verification Strategy

<Tests, commands, manual checks, regression checks, or evidence expected.>

## Review And Challenge Focus

<Quality, scope, user impact, edge cases, maintainability, operational risk, challenge triggers.>

## Assumptions

- <assumption or none>

## Risks

- <risk or none>

## Change Triggers

<Conditions requiring Task Direction, Task Contract, Mission Plan, or Mission Spec revision.>
```

## Task Sizing

- Split Tasks when User result judgment would differ by deliverable, risk, verification method, review focus, or dependency.
- Keep one Task when the whole result can be judged together using the same criteria and Evidence.
- Use `depends_on` only for Task results that must be accepted before this Task begins.

## Direct Write Check

- User accepted this Task Contract.
- Mission id and Task id are known.
- Mission Spec and Mission Plan refs are known.
- Referenced Task Direction exists when `task_direction_ref` is set.
- `task-contract.md` is the accepted current Task Contract for this Task scope, and any replaced context is reflected in Evidence, User Judgment, or Continuity Ledger.

If any check fails, return the payload and a User-facing stop briefing.
