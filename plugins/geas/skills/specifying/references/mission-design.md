# Mission Design Reference

## Purpose

Use this reference after the User accepts the Mission Spec and after required design-level Pre-build Design Surface decisions are resolved or explicitly classified as non-blocking. Mission Design explains the approach and major decisions, but it is not the source of truth for Task slicing or Pre-build Design Surface decisions.

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
- Resolve design-level Pre-build Design Surface decisions before the User accepts Mission Design when prose alone would make User judgment expensive.
- Mark contract-level decision points that should be resolved through a Pre-build Design Surface before Task Contract Set drafting.
- Include alternatives only when they explain a meaningful tradeoff.
- Record change triggers that would invalidate the design or require baseline revision.
- Do not imply that design acceptance means Pre-build Design Surface decisions or Task Contract Set acceptance.

## Review Checks

- The plan explains why this approach is fit for the accepted Mission Spec.
- Risks and assumptions are visible enough for User review.
- Open decision points are not hidden inside the plan.
- The design does not silently expand Mission scope.
- Design-level Pre-build Design Surface decisions that affect the approach, output shape, external interface contract, domain or structural model, or key tradeoff are reflected in the design.
- Design-level Trigger Lens Scan results classify each lens, and every design-level `surface` or `direct question` result is resolved before Mission Design acceptance.
- The design identifies whether Task Contract Set drafting can proceed directly or requires a contract-level Pre-build Design Surface first.
- The Task Contract Set can be drafted from this design and any selected Pre-build Design Surface decisions without treating the design or surface as the Task graph.
