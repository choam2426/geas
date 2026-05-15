# Task Contract Reference

## Purpose

Use this reference after the User accepts Mission Design. The initial Task Contract defines the first executable Task unit that can later be implemented, verified, reviewed, and judged.

## Payload Shape

```markdown
---
name: <same mission name as Mission Spec>
task_id: <task-id>
mission_acceptance_refs: ["AC-001"]
depends_on: []
risk_level: low|medium|high
---

## Description
<The Task in one short paragraph.>

## Mission Relation
<How this Task advances the Mission acceptance criteria.>

## Scope
### In
- <Work included in this Task.>

### Out
- <Work excluded from this Task.>

## Deliverables
- <Concrete output or changed artifact.>

## Acceptance Criteria
- TC-AC-001: <Task-level acceptance condition.>

## Verification Checks
- VC-001: <Agent-side check that can produce Evidence.>

## Review Focus
- <What review should focus on.>

## Assumptions
- <Task assumption.>

## Constraints
- <Task constraint.>

## Risks
- <Task risk.>

## Change Triggers
- <Condition that requires Task Contract revision.>
```

## Drafting Rules

- Make the Task small enough for one User acceptance decision.
- Link the Task to Mission acceptance refs, but do not claim the whole Mission is complete.
- Put executable scope and dependencies here, not in Mission Design.
- Write verification checks as agent-side checks that can leave Evidence.
- Write review focus as inspection targets, not generic quality language.
- Keep out-of-scope work explicit when a nearby change is tempting.

## Review Checks

- The Task has concrete deliverables and a bounded scope.
- Each Task acceptance criterion has at least one verification check or visible reason it cannot be verified automatically.
- Review focus matches the risk and changed surface.
- Dependencies are explicit.
- Change triggers tell future agents when to return to specifying.
