# Mission Spec Reference

## Purpose

Use this reference when drafting or revising a Mission Spec. The Mission Spec fixes what the Mission is trying to accomplish before design or Task execution starts.

## Payload Shape

```markdown
---
name: <short mission name>
---

## Goal
<The user-visible goal in one or two paragraphs.>

## Background
<Why this Mission exists and what context matters.>

## Scope
### Included
- <In-scope work>

### Excluded
- <Out-of-scope work>

## Acceptance Criteria
- AC-001: <Condition the User can later judge against Evidence.>

## Completion Criteria
- <Condition that helps decide whether the Mission can move toward closure.>

## Constraints
- <Hard limits, environment limits, style rules, compatibility needs.>

## Assumptions
- <Assumption that must be visible to the User.>

## Risks
- <Risk that may affect acceptance, cost, or sequencing.>
```

## Drafting Rules

- Write acceptance criteria as observable conditions, not implementation tasks.
- Use completion criteria for Mission closure readiness, not as a substitute for User Judgment.
- Keep excluded scope explicit when User wording could imply adjacent work.
- State assumptions as reviewable claims, not hidden defaults.
- Include risks that may change sequencing, verification, or User acceptance.
- Do not define Task dependencies here; Task Contract owns Task slicing.

## Review Checks

- The User can tell what success means without reading implementation details.
- Every included scope item has at least one acceptance criterion or completion criterion, or a clear reason it does not need one.
- Excluded work blocks obvious scope creep.
- Constraints are testable or inspectable where possible.
- Open questions are surfaced before asking for acceptance.
