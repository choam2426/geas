# Baseline Review

Use this reference to check Mission Spec, Mission Design, and Task Contracts before recording or entering building.

## Review Goal

Baseline review makes sure the User can understand what will happen, what will stay out, how success will be judged, and where agent autonomy ends.

This is not User Judgment. It is a structured review moment before runtime baseline recording.

## Baseline Review Packet

Present:

- Mission goal in one sentence.
- Scope in/out.
- Mission acceptance criteria.
- Key Mission Design choices and alternatives.
- Task breakdown table with dependencies.
- Initial Task Cards.
- Spec self-check results.
- Readiness gate status with source: `confirmed`, `observed`, `delegated`, `deferred`, or `open`.
- Unresolved questions or deferred decisions.
- Transfer context: known constraints, current Task, and acceptance criteria that the next stage can use without reconstructing the conversation.
- Assumptions.
- Risks.
- Recommended first Task.
- Challenger recommendation, if any.

## Readiness Blockers

When any blocker is present, the review packet should offer a focused return to interview, design drafting, or task drafting before it offers `accept baseline`.

- A minimum readiness gate lacks a baseline value and lacks an explicit User decision to defer it.
- A minimum readiness gate is filled only by an agent-created candidate assumption.
- Mission Design does not show approach alternatives that differ in scope, risk, cost, or verification path, or does not state the reason for the selected approach.
- Acceptance criteria are not connected to verification checks, review focus, or named unverified scope.
- User-owned decisions are invisible, or agent-delegated decisions lack boundaries.
- Known constraints, current Task, or acceptance criteria cannot be passed to the next stage as a compact context pack.
- Initial Task Contracts do not identify the checks or review focus that will produce Evidence for User review.
- The User asked for a draft while gates are open and the response offers baseline acceptance instead of gate-closing choices.
- An Intake Sketch or Baseline Candidate is presented as a Baseline Review.
- Initial Task Cards are missing, or tasks are presented only as titles.
- Spec self-check results are missing from the review packet.

## Spec Self-Check

Run this check before presenting Baseline Review. It is a baseline review aid, not Evidence, not User Judgment, and not a runtime artifact.

| Axis | Check |
| --- | --- |
| Outcome to Acceptance | Each acceptance criterion supports the desired outcome, and the full set is enough for the User to judge the Mission result. |
| Boundary to Surface | Included scope maps to changed or produced surfaces, and excluded scope names adjacent work that stays outside the Mission. |
| Evidence to Review Cost | Verification checks, review focus, and expected unverified scope give the User a practical review path. |
| Decision Ownership | Agent-delegated decisions have boundaries, and user-owned decisions are visible before acceptance. |

When a self-check item finds a gap, present the gap as a revise target or gate-closing question before offering `accept baseline`.

## Task Cards

Present every initial Task as a reviewable card before baseline acceptance. A card includes:

- Goal: observable outcome for this Task.
- Scope: included and excluded surfaces or outcomes.
- Acceptance: criteria this Task must satisfy.
- Verification: checks, commands, inspections, or outputs expected for this Task.
- Review focus: quality, boundary, regression, or risk points the User or reviewer should inspect.
- Depends on: prior Task ids or `none`.

## Quality Checks

### Clarity

- The goal is an end state, not only an activity.
- Field language is understandable without reading the whole conversation.
- Key terms appear in Mission Design `key_concepts`.

### Coverage

- Every Mission acceptance criterion maps to at least one Task.
- Every Task maps back to Mission scope or acceptance criteria.
- Every included surface is owned by a Task.
- Excluded scope covers tempting adjacent work.

### Testability

- Acceptance criteria are checkable, reviewable, or observable.
- Known limits that cannot be checked are named as expected unverified scope or User decision points.
- Verification checks name concrete commands, tests, inspections, or outputs when possible.
- Review focus names quality and boundary risks.

### Responsibility

- User-owned decisions are visible.
- Agent-delegated decisions are bounded.
- Evidence will support User review rather than replace User Judgment.

### Runtime Readiness

- Payloads match `docs/runtime.md`.
- CLI commands match `docs/cli.md`.
- Task ids match `task-001` style and are unique.
- Dependencies point to existing task ids.

### Context Transfer

- Known constraints name the surfaces, files, commands, policy limits, or user decisions they constrain.
- Current Task is clear, including its dependency state.
- Acceptance criteria and verification checks travel together.
- Deferred User decisions are labeled so later stages can return to the User at the right moment.

## Challenger Recommendation

Recommend a Challenger pass when any condition is true:

- The Mission is important enough that a wrong baseline would be costly.
- The User asks for "perfect", "complete", "production-ready", "secure", "safe", or similarly high-stakes outcomes.
- Scope boundary is still soft after review.
- Acceptance criteria are hard to falsify.
- Work touches data, permissions, migration, deployment, public APIs, or security-sensitive behavior.
- The User delegates broad autonomy to the agent.
- The Task graph has dependencies whose failure would invalidate later work.

Ask the User whether to include Challenger. Make the cost explicit:

```text
I recommend a Challenger pass before we lock this baseline because the scope and acceptance criteria will drive several downstream files. It will add one adversarial review round, focused on hidden assumptions and long-term cost. Want to include it?
```

If the User accepts, run the challenge through `challenging` or a `challenger` role handoff. Present the result with `briefings.md` Baseline Challenge Briefing. Baseline challenge findings are not Challenger Evidence, not User Judgment, and not runtime artifacts.

Incorporate only User-accepted findings into the Mission Spec, Mission Design, or Task Contract drafts. If the User declines the challenge or discards a finding, proceed with the reviewed baseline and keep the remaining assumption visible where relevant.

## Record Sequence

After the User accepts the baseline:

1. Ensure runtime exists:

```text
geas init
```

2. Create a Mission if there is no active Mission:

```text
geas mission create
```

3. Record Mission Spec:

```text
geas mission spec record --from <path|->
```

4. Record Mission Design:

```text
geas mission design record --from <path|->
```

5. Record initial Task Contracts:

```text
geas task contract record --task <task-id> --from <path|->
```

6. Enter building when the first Task is ready:

```text
geas mission transition --to building --task <task-id>
```

Summarize CLI output paths for the User.
