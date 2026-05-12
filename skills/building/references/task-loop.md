# Task Loop

Use this reference to operate the current Task inside the Mission's `building` stage.

## Inputs

- Current Mission id.
- Current Task id from recorded runtime state or caller-provided Task context.
- Latest Mission Spec and Mission Design.
- Latest Task Contract.
- Current Task State.
- Role Evidence, Task Evidence, User Judgment, and Memory relevant to the Task.

## Phase Dispatch

Default Task phase order:

```text
unstarted -> implementing -> verifying -> reviewing -> optional challenging -> awaiting_user_judgment
```

Dispatch by current Task phase:

| Task phase | Building action |
| --- | --- |
| `unstarted` | Run `geas task transition --to implementing --task <task-id>`, then prepare an `implementer` handoff with `invocation_decision: role_required`. |
| `implementing` | Prepare an `implementer` handoff with `invocation_decision: role_required`. |
| `verifying` | Prepare a `verifier` handoff with `invocation_decision: role_required`. |
| `reviewing` | Prepare a `reviewer` handoff with `invocation_decision: role_required`. Review Evidence advances to `awaiting_user_judgment`; decide optional Challenger before asking for Task User Judgment. |
| `challenging` | Prepare a `challenger` handoff with `invocation_decision: role_required` for the inserted challenge pass. |
| `awaiting_user_judgment` | Prepare Task Judgment briefing from `briefings.md`, then use `task-closure.md` after User decision. |
| `closed` | Choose the next Task, transition to `consolidating`, or brief the User on the resume point. |

Building prepares role handoff packets, waits for role results or Evidence paths, and then continues phase coordination. It does not create Implementation, Verification, Review, or Challenger Evidence locally.

Evidence recording usually advances the phase:

- `geas task evidence record --kind implementation` advances to `verifying`.
- `geas task evidence record --kind verification` with `passed` advances to `reviewing`.
- `geas task evidence record --kind verification` with `changes_requested` or `escalated` advances to `awaiting_user_judgment`.
- `geas task evidence record --kind review` advances to `awaiting_user_judgment`.
- `geas task evidence record --kind challenger` advances to `awaiting_user_judgment`.
- `geas task evidence record --kind task` closes the Task.

Use `geas task transition` for explicit User-directed rewinds or optional challenge insertion.

## Challenger Decision

Consider Challenger after Review Evidence and before Task User Judgment when:

- The Task touches runtime, CLI, schema, data, permission/security, deployment, migration, or critical baseline.
- Verification or Review Evidence has meaningful unverified scope.
- The Task result may silently expand Mission scope.
- There is a User-level tradeoff.
- The User requested high confidence or complete coverage.

Review Evidence advances the Task to `awaiting_user_judgment`. If Challenger is justified before the User has made Task User Judgment, insert it with:

```text
geas task transition --to challenging --task <task-id>
```

Call Challenger when the extra pass is within the Task's expected risk budget. Ask the User first if it materially expands cost or scope. If Challenger is omitted, name the omission reason before Task Judgment.

Treat `risk_level: high` in the current Task Contract as a standing reason to insert Challenger before Task Judgment unless the User declines the extra pass or Review Evidence already covers the same risk with enough basis.

## Next Step Selection

After a Task is closed:

1. If another Task is ready and its dependencies are satisfied, run:

```text
geas mission transition --to building --task <next-task-id>
```

2. If required Tasks have accepted Task Evidence, run:

```text
geas mission transition --to consolidating
```

3. If the Task result shows the Mission baseline needs revision, run:

```text
geas mission transition --to specifying
```

4. If no safe transition is available, brief the User on the blocking condition and the safest artifact basis.

## Drift Handling

Handle drift by:

1. Naming the mismatch.
2. Naming the safest known artifact basis.
3. Offering recovery choices: resume a phase, record missing Evidence, revise baseline, or stop.
4. Recording only after User-directed recovery decisions.

Common drift examples:

- Task State says `reviewing`, but Verification Evidence is missing.
- Current Task Contract does not match changed outputs.
- A Task is marked closed without Task Evidence.
- User Judgment exists but Task Evidence has not been recorded.
- Worktree changes do not map to the current Task Contract.
