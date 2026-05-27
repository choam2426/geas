# Task Direction Reference

Use this reference during Task specifying when a Task needs a User direction choice before a Task Contract can define executable scope and acceptance criteria.

Task Direction is free-form and is written under:

```text
.geas/missions/<mission-id>/tasks/<task-id>/directions/
```

## Suitable Forms

- Markdown comparison or decision note
- HTML prototype or visual decision surface
- Mermaid diagram
- UI mockup
- Data shape example
- Export or report sample
- Short briefing with concrete options

## Required Content

Every Task Direction must make the User decision portable into a Task Contract:

- Decision question
- Options or proposed direction
- Relevant constraints
- Expected Task Contract implications
- Risks and tradeoffs
- User-selected direction when accepted
- Source refs used to prepare it

## Acceptance Boundary

Task Direction acceptance is not Task result User Judgment. It only fixes a direction that a later Task Contract can cite through `task_direction_ref`.

## Direct Write Check

Before writing, confirm:

- User accepted the direction or explicitly asked to preserve it as the selected direction.
- Mission id and Task id are known.
- The file path is inside the Task `directions/` directory.
- The filename does not overwrite a prior direction artifact unless the User requested replacement.

If the direction is still under discussion, return it as a draft and do not write it as accepted Task Direction.
