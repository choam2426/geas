# Mission Plan Reference

Use this reference after the User accepts Mission Spec. Mission Plan turns Mission criteria into a reviewable Task structure and continuity context.

Mission Plan is written to:

```text
.geas/missions/<mission-id>/mission-plan.md
```

## Payload Template

```markdown
## Plan Summary

<How this Mission will proceed.>

## Approach

<Chosen approach and why it fits the Mission Spec.>

## Key Context

<User intent, domain context, constraints, accepted decisions, and assumptions that later Tasks must keep.>

## Impact Surface

<Files, docs, modules, UI flows, data, dependencies, side effects, or operational areas likely affected.>

## Task Structure

- <task-id>: <reviewable Task purpose>
  - Mission criteria: <AC refs>
  - Expected Task Contract focus: <scope, deliverables, verification, review focus>
  - Depends on: <task ids or none>

## Validation And Review Strategy

<Verification, review, challenge, and manual inspection approach across Tasks.>

## User Decision Points

<When the workflow must return to the User and what the User should judge.>

## Risks And Mitigations

<Known risks and how the Task structure or review strategy reduces them.>

## Change Triggers

<Conditions that require Mission Spec, Mission Plan, Task Direction, or Task Contract revision.>

## Continuity Requirements

<Context, open questions, handoff notes, and next-action cues that should be preserved in Continuity Ledger.>
```

## Review Checklist

- The plan traces every Task to Mission Spec criteria.
- Each Task is small enough for one User result judgment.
- The first executable Task candidate is clear enough for `building` to start Task specifying.
- Required Task Direction artifacts are named when a User direction choice must precede a Task Contract.
- Risks and change triggers are explicit.
- Continuity requirements identify what later Tasks and resumed sessions need.

## Direct Write Check

Before writing, confirm:

- User accepted this Mission Plan draft.
- Mission directory was selected by `mission`.
- The target Mission directory exists.
- `mission-plan.md` is the accepted current Mission Plan for this Mission scope, and any replaced context is reflected in Evidence, User Judgment, or Continuity Ledger.

If any check fails, return the payload and a User-facing stop briefing.
