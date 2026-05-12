# Baseline Readiness Review

Use this reference to check accepted Mission Spec, accepted Mission Design, and accepted Task Contracts before entering building.

## Review Goal

Baseline readiness review makes sure accepted baseline artifacts can guide building without forcing the next stage to reconstruct the conversation.

This is not User Judgment and not a new all-in-one baseline approval. It is a structured transition check after the artifact-specific review steps.

## Baseline Readiness Packet

Present:

- Recorded Mission Spec reference and one-sentence goal.
- Recorded Mission Design reference, plan summary, selected approach, and decision points.
- Recorded Task Contract references.
- Task Contract table with Task ids and dependencies from accepted Task Contracts.
- Initial Task Cards from accepted Task Contracts.
- Spec self-check results.
- Readiness gate status with source: `confirmed`, `observed`, `delegated`, `deferred`, or `open`.
- Unresolved questions or deferred decisions.
- Transfer context: known constraints, current Task, and acceptance criteria that the next stage can use without reconstructing the conversation.
- Assumptions.
- Risks.
- Recommended first Task.
- Session handoff option for continuing building in a fresh session from the recorded baseline.
- Challenger recommendation, if any.

## Readiness Blockers

When any blocker is present, the review packet should offer a focused return to interview, Mission Spec revision, Mission Design revision, or Task Contract revision before entering building.

- A minimum readiness gate lacks a baseline value and lacks an explicit User decision to defer it.
- A minimum readiness gate is filled only by an agent-created candidate assumption.
- Mission Design was drafted or recorded without an accepted Mission Spec as its basis.
- A Task Contract was drafted or recorded without an accepted Mission Design as context.
- One User choice is used to approve Mission Spec, Mission Design, and Task Contracts together.
- A role-required artifact review lacks draft source or coordinator edit summary.
- A role-required artifact was substantively authored, completed, or revised by the specifying context instead of the artifact author role.
- Initial Task Contracts were created after a role-required Task Contract pass without work-designer-provided Task Contract candidates.
- Mission Design does not show approach alternatives that differ in scope, risk, cost, or verification path, or does not state the reason for the selected approach.
- Mission Design records Task ids, Task dependencies, Task acceptance criteria, verification checks, review focus, or Task Cards instead of leaving them to Task Contracts.
- Acceptance criteria are not connected to verification checks, review focus, or named unverified scope.
- A Task Contract is too large or mixed for the User to judge from one Task result and Evidence packet.
- User-owned decisions are invisible, or agent-delegated decisions lack boundaries.
- Known constraints, current Task, or acceptance criteria cannot be passed to the next stage as a compact context pack.
- Initial Task Contracts do not identify the checks or review focus that will produce Evidence for User review.
- The User asked for a draft while gates are open and the response offers artifact acceptance instead of gate-closing choices.
- An Intake Sketch or Baseline Candidate is presented as a Baseline Readiness Review.
- Initial Task Cards are missing, or tasks are presented only as titles.
- Spec self-check results are missing from the readiness packet.

## Spec Self-Check

Run this check before presenting Baseline Readiness Review. It is a readiness review aid, not Evidence, not User Judgment, and not a runtime artifact.

| Axis | Check |
| --- | --- |
| Outcome to Acceptance | Each acceptance criterion supports the desired outcome, and the full set is enough for the User to judge the Mission result. |
| Boundary to Surface | Included scope maps to changed or produced surfaces, and excluded scope names adjacent work that stays outside the Mission. |
| Evidence to Review Cost | Verification checks, review focus, expected unverified scope, and Task size give the User a practical review path. |
| Decision Ownership | Agent-delegated decisions have boundaries, and user-owned decisions are visible before acceptance. |

When a self-check item finds a gap, present the gap as a revise target or gate-closing question before offering building transition.

## Task Cards

Present every initial Task as a reviewable card before Task Contract acceptance and again in compact form before building transition. A card includes:

- Goal: observable outcome for this Task.
- Scope: included and excluded surfaces or outcomes.
- Acceptance: criteria this Task must satisfy.
- Verification: checks, commands, inspections, or outputs expected for this Task.
- Review focus: quality, boundary, regression, or risk points the User or reviewer should inspect.
- Risk level: `low`, `medium`, or `high`, based on failure cost and review burden.
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
- Each Task can be judged from its own result and Evidence without bundling unrelated acceptance decisions.
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

- Payloads match the bundled payload shapes in the specifying references or the validation result returned by the recording tool.
- CLI commands match the Geas command surface used by this Skill, or recording is marked unavailable with a caller/User decision needed.
- Task ids match `task-001` style and are unique.
- Dependencies point to recorded Task Contracts and do not create dependency cycles.

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
I recommend a Challenger role pass before recording this draft because the scope and acceptance criteria will drive several downstream files. It will add one separate role review round, focused on hidden assumptions and long-term cost. Want to include it?
```

If the User accepts, prepare a `challenger` role handoff using the boundary below and the current draft as input. Do not load or execute the challenging procedure locally to author findings. Wait for the challenger role result before presenting `references/briefings.md` Baseline Challenge. Baseline challenge findings are not Challenger Evidence, not User Judgment, not runtime artifacts, and not revised artifact content.

When the User accepts challenge findings, send those findings to the current artifact author for revision. If the current artifact is coordinator-authored, the coordinator may revise it. If it is role-authored, return to the role author and wait for a revised payload. If the finding affects an already recorded artifact, return to that artifact's revision path and record a new accepted version before building. If the User declines the challenge or discards a finding, keep the remaining assumption visible where relevant.

## Challenge Handoff Boundary

The challenge output must be produced from the `challenger` role context when that role is available. The specifying context prepares the handoff packet, receives the result, and briefs the User. It does not impersonate the challenger.

The challenger reads every `read_first` path before working. If the challenge target is an unrecorded draft, prepare a readable draft payload path for `read_first` before handoff.

When role handoff is unavailable, surface the recovery choice:

- Retry the role handoff.
- Proceed without the challenge and name the missing challenge output.
- Stop before recording the draft that needed the challenge.

The handoff packet includes the current draft type, `read_first` paths for the current draft target and existing accepted artifacts, accepted User decisions, challenge focus, expected output shape from `references/briefings.md`, and decisions to surface.

## Record Sequence

Record artifacts only after their own review step has been accepted.

1. After Mission Spec acceptance, ensure runtime exists:

```text
geas init
```

2. Create a Mission if there is no active Mission:

```text
geas mission create
```

3. Record the accepted Mission Spec:

```text
geas mission spec record --from <path|->
```

4. After Mission Design acceptance, record the accepted Mission Design:

```text
geas mission design record --from <path|->
```

5. After Task Contract acceptance, record each accepted initial Task Contract:

```text
geas task contract record --task <task-id> --from <path|->
```

6. After Baseline Readiness Review and User choice to start building, enter building when the first Task is ready:

```text
geas mission transition --to building --task <task-id>
```

If the User chooses `handoff session`, prepare Session Handoff instead of transitioning to building in the current session.

Summarize CLI output paths for the User.
