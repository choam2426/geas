# Mission Design

Use this reference to turn an accepted Mission Spec into a Task structure and execution strategy.

## Purpose

Mission Design explains how the Mission will be executed. It should make the approach, alternatives, concepts, task graph, assumptions, and risks visible before building starts.

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

## Design Procedure

1. Read the accepted Mission Spec.
2. Identify the smallest set of Task outcomes that can satisfy the Mission acceptance criteria.
3. Group work by User judgment boundary, not by file type alone.
4. Identify dependencies that affect execution order.
5. Define key concepts that future roles need to interpret consistently.
6. Compare at least one plausible alternative for meaningful structure decisions.
7. Surface risks created by the chosen task graph.
8. Present the design for User review.

## Task Breakdown Rules

Good Task nodes:

- Cover one coherent part of the Mission.
- Produce reviewable deliverables.
- Have acceptance criteria that can be tested or reviewed.
- Have dependencies that can be checked from Task Evidence or accepted User Judgment.
- Avoid mixing unrelated User judgments.

Use multiple Tasks when:

- Different outcomes need different verification methods.
- One part can be accepted while another may need rework.
- Work touches different risk profiles, such as docs vs. runtime writes vs. permissions.
- The User may want to stop after a partial outcome.

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

When using the `work-designer` role, pass:

- Mission Spec draft or accepted artifact path.
- Known User decisions and constraints.
- Candidate task boundaries.
- Risks and ambiguities.
- Required output: Mission Design payload and initial Task Contract candidates.
- Lenses, if useful, such as `documentation`, `software`, `runtime`, or `product`.

The Orchestrator remains responsible for User review and CLI recording.
