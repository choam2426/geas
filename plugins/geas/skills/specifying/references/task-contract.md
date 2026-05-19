# Task Contract Reference

## Purpose

Use this reference after the User accepts Mission Design and after required contract-level Pre-build Design Surface decisions are resolved or explicitly classified as non-blocking. The initial Task Contract Set defines the executable Task units that can later be implemented, verified, reviewed, and judged. Each Task Contract is still an individual Task artifact; the Set is the accepted group of those artifacts.

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
- Put executable scope and dependencies here, not in Mission Design or the Pre-build Design Surface.
- Reflect selected contract-level Pre-build Design Surface decisions in the relevant Task Contract fields instead of leaving them only in a surface file or briefing.
- Write verification checks as agent-side checks that can leave Evidence.
- Write review focus as inspection targets, not generic quality language.
- Keep out-of-scope work explicit when a nearby change is tempting.

## Task Slicing Rules

- Split work into separate Task Contracts when the User would need separate result acceptance decisions.
- Split work into separate Task Contracts when one result must be accepted before another can be judged or started.
- Split work into separate Task Contracts when risk level, verification method, review focus, deliverable type, or changed surface differs meaningfully.
- Keep one Task Contract only when the whole result can be judged together with the same acceptance criteria, checks, review focus, and risk level.

## Set Rules

- Draft one Task Contract candidate per executable Task in the initial Task Contract Set.
- Use `task_id` to identify each Task in the Set.
- Use `depends_on` to express ordering or acceptance dependencies between Tasks in the Set.
- Use `mission_acceptance_refs` to show which Mission acceptance criteria each Task covers.
- Let a small Mission have a Set with one Task Contract when one reviewable unit is enough.

## Review Checks

- The Task has concrete deliverables and a bounded scope.
- Each Task acceptance criterion has at least one verification check or visible reason it cannot be verified automatically.
- Review focus matches the risk and changed surface.
- Dependencies are explicit.
- Selected contract-level Pre-build Design Surface decisions that affect execution are reflected in scope, deliverables, criteria, checks, review focus, risks, dependencies, or change triggers.
- Blocking design-surface decisions are not left open for building.
- Change triggers tell future agents when to return to specifying.
- The Set covers the intended Mission scope without hiding separate acceptance decisions inside one Task.
