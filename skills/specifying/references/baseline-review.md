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
- Initial Task Contract summaries.
- Assumptions.
- Risks.
- Recommended first Task.
- Challenger recommendation, if any.

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
