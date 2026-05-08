# Task Contract

Use this reference to draft Task Contracts from the Mission Design.

## Purpose

Task Contract turns a Mission Design task node into an execution baseline. It defines what the Task will do, what it will leave out, what it must deliver, how the result will be checked, and what Review Evidence should inspect.

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

## Drafting Procedure

1. Start from the Mission Design `task_breakdown` entry.
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
  - "The mission Skill dispatches stage Skills, and the building Skill coordinates implementation, verification, review, optional challenge, and Task Judgment without requiring a separate orchestrator Agent file."
  - "Each internal Skill includes only the CLI commands it directly uses."
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
  - "Search skills/ and skills/mission/references/agents/ for retired product prefixes and retired shared-reference directory names."
```

## Review Focus

Review focus describes what Reviewer should inspect beyond mechanical checks.

Examples:

- Boundary between Skill procedure and Agent role.
- Evidence vs. User Judgment language.
- Hidden scope expansion.
- Overly vague acceptance criteria.
- Missing unverified scope.
- Mismatch with `docs/cli.md`.

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
