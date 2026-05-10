# Task Contract

Use this reference to prepare Task Contract review packets from the accepted Mission Design and the current artifact author's Task Contract candidates.

## Purpose

Task Contract turns a Mission Design task node into an execution baseline. It defines what the Task will do, what it will leave out, what it must deliver, how the result will be checked, and what Review Evidence should inspect.

Prepare Task Contracts only from accepted Mission Design task nodes and the current artifact author's Task Contract candidates. If the Design is still a draft, return to Mission Design review before preparing Task Contracts.

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
risks: []
```

## Authorship

Task Contract authorship follows Mission Design authorship.

- If Mission Design used `work-designer` as `role_required`, draft Task Contracts from the work-designer's returned initial Task Contract candidates. If candidates are missing or incomplete, return to work-designer instead of filling the gap locally.
- If Mission Design used `role_omitted`, specifying may draft Task Contracts from the accepted Mission Design task nodes and must name the omission reason in the review packet.
- If Challenger findings are accepted against Task Contract drafts, return them to the current Task Contract author for revision before presenting a new review.

The specifying context may format Task Cards, serialize accepted payloads, and record through the CLI. It must not add substantive scope, deliverables, acceptance criteria, verification checks, review focus, dependencies, or risks to a role-authored Task Contract candidate.

## Drafting Procedure

1. Start from the accepted Mission Design `task_breakdown` entry.
2. Write the Task's intended result in one sentence.
3. Map the Task to Mission acceptance criteria or scope.
4. Carry dependencies from Mission Design.
5. Define `scope_in` as surfaces or outcomes this Task owns.
6. Define `scope_out` as adjacent work this Task will not absorb.
7. Define deliverables as artifacts, files, behavior, docs, or decisions that will exist after the Task.
8. Write acceptance criteria that can be judged independently.
9. Pair criteria with verification checks.
10. Write review focus for quality, boundary, risk, and consistency.
11. List Task-specific risks.

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

Keep a Task together when:

- The deliverables are tightly coupled.
- A single Evidence packet can lower User review cost.
- Splitting would create artificial handoff overhead.

## Review Before Recording

Before recording, present the Task Contract drafts and ask the User to accept or revise Task Contracts only. Initial Task Contracts may be reviewed in one packet after Mission Design acceptance.

Record only accepted Task Contracts. This approval is separate from Mission Spec and Mission Design approval.
