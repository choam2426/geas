# Mission Design Reference

## Purpose

Use this reference after the User accepts the Mission Spec. Mission Design explains the approach and major decisions, but it is not the source of truth for Task slicing.

## Payload Shape

```markdown
---
name: <same mission name as Mission Spec>
---

## Plan Summary
<How the Mission will be approached.>

## Approach Strategy
<The chosen strategy and why it fits the Mission Spec.>

## Alternatives Considered
- <Alternative and why it was not chosen.>

## Key Concepts
- <Term or concept the User and agents need to share.>

## Scope
### In
- <Design-level work included.>

### Out
- <Design-level work excluded.>

## Plan Outline
- <Major execution step or area.>

## Decision Points
- <Decision the User may still need to make later.>

## Assumptions
- <Design assumption.>

## Risks
- <Design risk.>

## Change Triggers
- <Condition that should return to baseline revision.>
```

## Drafting Rules

- Tie the approach to Mission Spec acceptance criteria.
- Keep Task order and Task dependencies out unless they are design constraints; the initial Task Contract Set owns executable Task slicing and dependencies.
- Include alternatives only when they explain a meaningful tradeoff.
- Record change triggers that would invalidate the design or require baseline revision.
- Do not imply that design acceptance means Task Contract Set acceptance.

## Review Checks

- The plan explains why this approach is fit for the accepted Mission Spec.
- Risks and assumptions are visible enough for User review.
- Open decision points are not hidden inside the plan.
- The design does not silently expand Mission scope.
- The Task Contract Set can be drafted from this design without treating the design as the Task graph.
