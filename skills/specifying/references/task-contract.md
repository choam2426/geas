# Task Contract

Use this reference to prepare Task Contract review packets from the accepted Mission Spec, accepted Mission Design, and the current Task Contract author's draft candidates.

## Purpose

Task Contract defines the Task split and turns each Task into an execution baseline. It defines what the Task will do, what it will leave out, what it must deliver, which accepted Mission criteria or scope it serves, what it depends on, how the result will be checked, and what Review Evidence should inspect.

Prepare Task Contracts only after Mission Design is accepted or explicitly accepted as the basis for the current revision. If the Design is still a draft, return to Mission Design review before preparing Task Contracts.

After User review, record each accepted Task Contract with:

```text
geas task contract record --task <task-id> --from <path|->
```

## Payload Shape

```yaml
description: ""
mission_relation: ""
depends_on: []
scope_in: []
scope_out: []
deliverables: []
acceptance_criteria: []
verification_checks: []
review_focus: []
risk_level: low
risks: []
```

## Authorship

Before drafting initial Task Contracts, make a Task Contract role invocation decision.

- Use `work-designer` as `role_required` when Task Contracts must create or change Task split, Task ids, dependency order, User-judgment boundaries, acceptance/verification tradeoffs, review focus, or risk levels.
- Use `role_omitted` only when the User or accepted baseline already supplies the Task split and Task Contract content, and the specifying context is only formatting already-decided contracts. Name the omission reason in the Task Contract Review.
- If Challenger findings are accepted against Task Contract drafts, return them to the current Task Contract author for revision before presenting a new review.

The specifying context may format Task Cards, serialize accepted payloads, and record through the CLI. It must not add substantive scope, deliverables, acceptance criteria, verification checks, review focus, dependencies, risk level, or risks to a role-authored Task Contract candidate.

## Drafting Procedure

1. Read the accepted Mission Spec and Mission Design.
2. Identify the smallest set of Task outcomes that can satisfy the Mission acceptance criteria.
3. Group work by User judgment boundary, so the User can accept or request rework for each Task result without rechecking unrelated outputs.
4. Assign Task ids such as `task-001`, `task-002`, using the next available id in the Mission.
5. Identify dependencies that affect execution order.
6. Write each Task's intended result in one sentence.
7. Map each Task to Mission acceptance criteria or scope.
8. Define `scope_in` as surfaces or outcomes this Task owns.
9. Define `scope_out` as adjacent work this Task will not absorb.
10. Define deliverables as artifacts, files, behavior, docs, or decisions that will exist after the Task.
11. Check that the Task result can be accepted, revised, deferred, or stopped as one User decision.
12. Write acceptance criteria that can be judged independently.
13. Pair criteria with verification checks.
14. Write review focus for quality, boundary, risk, and consistency.
15. Set `risk_level` to `low`, `medium`, or `high`.
16. List Task-specific risks, including expected unverified scope or remaining risk that may need User judgment.

## Risk Level

`risk_level` is the Task's execution-time routing signal. It does not replace `risks`.

- `low`: Narrow, reversible changes with small review burden.
- `medium`: Code, schema, or multi-document changes that need normal verification and review.
- `high`: Changes with high failure cost, hard-to-reverse effects, or major impact on users, operations, data, security, deployment, or external behavior.

Use `high` as a standing reason to consider Task splitting, stronger verification, or a Challenger pass before Task Judgment.

## Acceptance Criteria

Each criterion should answer:

- What result is being judged?
- What observable basis will support the judgment?
- What threshold or condition matters?
- Which part of the Mission does it serve?

Use examples:

```yaml
acceptance_criteria:
  - "The entrypoint can route the agreed work through implementation, verification, review, optional challenge, and User judgment without requiring unrelated coordinator files."
  - "Each procedure document includes only the command examples it directly uses."
```

## Verification Checks

Verification checks describe agent-side checks. They can include:

- Structural file checks.
- CLI validation.
- Test commands.
- Static searches.
- Runtime dry-run only when the Mission includes it.
- Manual inspection steps that an agent can perform and report.

Example:

```yaml
verification_checks:
  - "Run skill validator for every Skill directory."
  - "Search the relevant procedure and role prompt files for retired product prefixes and retired shared-reference directory names."
```

## Review Focus

Review focus describes what Reviewer should inspect beyond mechanical checks.

Examples:

- Boundary between Skill procedure and Agent role.
- Evidence vs. User Judgment language.
- Hidden scope expansion.
- Overly vague acceptance criteria.
- Missing unverified scope.
- Mismatch with the CLI commands used by this Task.

## Split Heuristics

Split a Task when one of these is true:

- Different outputs need different User judgments.
- The Task has unrelated verification strategies.
- One part is high risk and should not hold lower-risk work hostage.
- A dependency must be accepted before later work can be meaningful.
- The User would need to review too much changed surface or too many unrelated criteria at once.
- Unverified scope from one part would obscure confidence in another part.

Keep a Task together when:

- The deliverables are tightly coupled.
- A single Evidence packet can lower User review cost.
- Splitting would create artificial handoff overhead.
- The whole result can be accepted, revised, deferred, or stopped as one decision.

## Work Designer Handoff

When invoking the `work-designer` role for Task Contracts, pass:

- `read_first`: accepted Mission Spec and accepted Mission Design artifact paths.
- Known User decisions and constraints.
- Candidate Task boundaries, if any.
- Risks and ambiguities.
- Required output: Task Contract candidates and Task Cards with Goal, Scope, Acceptance, Verification, Review focus, Risk level, and Depends on.
- Lenses, if useful, such as `documentation`, `software`, `runtime`, or `product`.

If the role cannot read the accepted artifact paths, treat the handoff as unavailable and surface the recovery choices:

- Retry the role handoff.
- Proceed without the independent Task Contract author pass and name the missing role output.
- Stop before recording Task Contracts.

## Review Before Recording

Before recording, present the Task Contract drafts and ask the User to accept or revise Task Contracts only. Initial Task Contracts may be reviewed in one packet after Mission Design acceptance.

Record only accepted Task Contracts. This approval is separate from Mission Spec and Mission Design approval.

Record Task Contracts in dependency order. The CLI checks that `depends_on` entries point to recorded Task Contracts and that dependency cycles are not introduced.
