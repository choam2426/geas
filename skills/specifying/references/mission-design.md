# Mission Design

Use this reference to turn an accepted Mission Spec into a Task structure and execution strategy.

## Purpose

Mission Design explains how the Mission will be executed. It should make the approach, alternatives, concepts, task graph, assumptions, and risks visible before building starts.

Draft Mission Design only from an accepted Mission Spec. If the Spec is still a draft, return to Mission Spec review before designing the Task graph.

After User review, record the accepted payload with:

```text
geas mission design record --from <path|->
```

## Payload Shape

```yaml
approach_strategy: ""
alternatives_considered:
  - approach: ""
    benefit: ""
    cost: ""
    decision_reason: ""
key_concepts: []
scope_in: []
scope_out: []
task_breakdown:
  - task_id: "task-001"
    description: ""
    mission_coverage: []
    depends_on: []
    reason: ""
assumptions: []
risks: []
```

## Work Designer Invocation

Before drafting Mission Design, make a role invocation decision.

Use `work-designer` as `role_required` when the Mission Design must create or change any of:

- Approach strategy.
- Task graph or single-task vs multi-task split.
- Dependency order.
- Review-cost or User-judgment boundaries.
- Alternatives with real scope, risk, cost, or verification tradeoffs.
- Key concepts that later roles must share.

Use `role_omitted` only when the accepted Mission Spec or an explicit User decision already supplies the approach and Task graph, and the specifying context is only formatting an already-decided design. Name the omission reason in the Mission Design Review.

When `work-designer` is required and handoff is unavailable, surface the recovery choice:

- Retry the role handoff.
- Proceed without the independent design pass and name the missing role output.
- Stop before recording Mission Design.

## Authorship

When `work-designer` is `role_required`, the work-designer is the author of the Mission Design draft and initial Task Contract candidates.

The specifying context may render the returned draft for User review and serialize accepted payloads for recording. It must not add substantive approach, alternatives, task graph, dependencies, Task Contract candidate fields, acceptance criteria, verification checks, review focus, assumptions, or risks.

If the work-designer result is incomplete, return to the work-designer, ask the User for a decision, or stop before recording. Do not fill the missing content locally.

If Challenger findings are accepted against a work-designer-authored draft, return those findings to the work-designer for a revised Mission Design payload or Task Contract candidates before presenting the next review.

## Design Procedure

Use this procedure inside the `work-designer` role context, or in the specifying context only when `role_omitted` has a named omission reason.

1. Read the accepted Mission Spec.
2. Identify the smallest set of Task outcomes that can satisfy the Mission acceptance criteria.
3. Group work by User judgment boundary, so the User can accept or request rework for each Task result without rechecking unrelated outputs.
4. Identify dependencies that affect execution order.
5. Define key concepts that future roles need to interpret consistently.
6. Compare at least one plausible alternative for meaningful structure decisions.
7. Surface risks created by the chosen task graph.
8. Present the design for User review.

## Review Before Recording

Before recording, present the Mission Design draft and ask the User to accept or revise the Design only. This acceptance does not approve initial Task Contracts.

Record only the accepted Mission Design. After it is recorded, use its `task_breakdown` entries as the basis for Task Contract drafting.

## Task Breakdown Rules

Good Task nodes:

- Cover one coherent part of the Mission.
- Produce reviewable deliverables.
- Have acceptance criteria that can be tested or reviewed.
- Have dependencies that can be checked from Task Evidence or accepted User Judgment.
- Can be accepted, revised, deferred, or stopped as one User decision.
- Keep unverified scope and remaining risks separable in Evidence.
- Avoid mixing unrelated User judgments.

Use multiple Tasks when:

- Different outcomes need different verification methods.
- One part can be accepted while another may need rework.
- Work touches different risk profiles, such as docs vs. runtime writes vs. permissions.
- The User may want to stop after a partial outcome.
- The combined result would be too large for one practical User review.

Use one Task when:

- The work has one coherent acceptance boundary.
- Splitting would increase User review cost without improving Evidence quality.

## Alternatives

Record alternatives when there is a real tradeoff. Examples:

- One large Task vs. several Task Contracts.
- Implement first vs. update docs first.
- Research-heavy specifying vs. direct baseline draft.
- Challenger in specifying vs. challenge after review.

Do not manufacture alternatives for obvious decisions.

## Work Designer Handoff

When invoking the `work-designer` role, pass:

- `read_first`: accepted Mission Spec artifact path.
- Known User decisions and constraints.
- Candidate task boundaries.
- Risks and ambiguities.
- Required output: Mission Design payload and initial Task Contract candidates, including Task Cards with Goal, Scope, Acceptance, Verification, Review focus, Risk level, and Depends on.
- Lenses, if useful, such as `documentation`, `software`, `runtime`, or `product`.

If the role cannot read the accepted Mission Spec path, treat the handoff as unavailable and use the recovery choices above.

The calling context remains responsible for User review and recording. It does not replace, complete, or substantively revise the work-designer result with a locally written equivalent when `role_required`.
