# Mission Design

Use this reference to turn an accepted Mission Spec into a User-readable Mission plan.

## Purpose

Mission Design explains the plan for approaching the Mission before Task Contracts are drafted. It should make the plan summary, approach, alternatives, concepts, scope framing, plan outline, decision points, assumptions, risks, and change triggers visible before building starts.

Draft Mission Design only from an accepted Mission Spec. If the Spec is still a draft, return to Mission Spec review before designing the plan.

After User review, record the accepted payload with:

```text
geas mission design record --from <path|->
```

## Payload Shape

```yaml
plan_summary: ""
approach_strategy: ""
alternatives_considered:
  - approach: ""
    benefit: ""
    cost: ""
    decision_reason: ""
key_concepts: []
scope_in: []
scope_out: []
plan_outline:
  - focus: ""
    purpose: ""
    user_visible_result: ""
decision_points: []
assumptions: []
risks: []
change_triggers: []
```

## Planning Quality

A good Mission Design is useful to the User before it is useful to the agent. It gives the User a compact view of how the Mission will move forward, why this approach fits the accepted Spec, what alternatives were rejected, where judgment may return to the User, and what would force a baseline revision.

Write the plan at Mission level:

- Use `plan_summary` as the one-paragraph executive view.
- Use `approach_strategy` to explain the chosen way of working and why it fits the Mission.
- Use `plan_outline` for major plan focuses, not Task nodes.
- Use `decision_points` for User-owned or reset-worthy decisions.
- Use `change_triggers` for conditions that require returning to Mission Design or Task Contracts.
- Keep assumptions, risks, and scope boundaries readable without reconstructing the conversation.

## Boundary

Mission Design does not define Task ids, Task count, Task dependencies, Task-level mission coverage, Task deliverables, Task acceptance criteria, verification checks, review focus, risk level, or Task Cards. Those belong to Task Contract.

Mission Design may mention that the Mission is likely to need staged work or a careful Task split when this helps the User understand the plan. It must not record that split as the accepted Task graph.

## Work Designer Invocation

Before drafting Mission Design, make a role invocation decision.

Use `work-designer` as `role_required` when the Mission Design must create or change any of:

- Approach strategy.
- Plan outline.
- Scope framing.
- User decision points or reset triggers.
- Alternatives with real scope, risk, cost, or verification tradeoffs.
- Key concepts that later roles must share.

Use `role_omitted` only when the accepted Mission Spec or an explicit User decision already supplies the Mission plan, and the specifying context is only formatting an already-decided design. Name the omission reason in the Mission Design Review.

When `work-designer` is required and handoff is unavailable, surface the recovery choice:

- Retry the role handoff.
- Proceed without the independent design pass and name the missing role output.
- Stop before recording Mission Design.

## Authorship

When `work-designer` is `role_required`, the work-designer is the author of the Mission Design draft.

The specifying context may render the returned draft for User review and serialize accepted payloads for recording. It must not add substantive plan summary, approach, alternatives, concepts, scope framing, plan outline, decision points, assumptions, risks, or change triggers.

If the work-designer result is incomplete, return to the work-designer, ask the User for a decision, or stop before recording. Do not fill the missing content locally.

If Challenger findings are accepted against a work-designer-authored draft, return those findings to the work-designer for a revised Mission Design payload before presenting the next review.

## Design Procedure

Use this procedure inside the `work-designer` role context, or in the specifying context only when `role_omitted` has a named omission reason.

1. Read the accepted Mission Spec.
2. Summarize the Mission plan in User terms.
3. Select the approach strategy and explain why it fits the Mission acceptance criteria, scope, constraints, and review burden.
4. Define key concepts that future roles need to interpret consistently.
5. Set structural scope in and scope out for the plan.
6. Write a short plan outline showing major focuses, purposes, and User-visible results.
7. Compare at least one plausible alternative for meaningful structure decisions.
8. Surface decision points, assumptions, risks, and change triggers.
9. Present the design for User review.

## Review Before Recording

Before recording, present the Mission Design draft and ask the User to accept or revise the Design only. This acceptance does not approve initial Task Contracts.

Record only the accepted Mission Design. After it is recorded, use it as context for Task Contract drafting. Task splitting happens in the Task Contract step.

## Alternatives

Record alternatives when there is a real tradeoff. Examples:

- Direct implementation plan vs. research-first plan.
- Documentation-first plan vs. runtime-first plan.
- Narrow scope now vs. broader Mission baseline.
- Challenger in specifying vs. challenge after Task review.

Do not manufacture alternatives for obvious decisions.

## Work Designer Handoff

When invoking the `work-designer` role for Mission Design, pass:

- `read_first`: accepted Mission Spec artifact path.
- Known User decisions and constraints.
- Candidate approach or plan focuses.
- Risks and ambiguities.
- Required output: Mission Design payload.
- Lenses, if useful, such as `documentation`, `software`, `runtime`, or `product`.

If the role cannot read the accepted Mission Spec path, treat the handoff as unavailable and use the recovery choices above.

The calling context remains responsible for User review and recording. It does not replace, complete, or substantively revise the work-designer result with a locally written equivalent when `role_required`.
