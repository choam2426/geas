# Dispatch

Use this reference to decide what procedure runs next and what context it receives.

## Inspect First

Every Mission invocation starts with inspection.

1. Check whether `.geas/` exists.
2. Read `.geas/run-state.yaml` when present.
3. If a Mission is active, read the latest versioned Mission Spec and Mission Design.
4. If a current Task is active, read latest Task Contract and Task State.
5. Read relevant role Evidence, Task Evidence, User Judgment, Mission Evidence, and Memory.
6. Compare state pointers with artifacts.
7. Determine the next procedure.

If state and artifacts disagree, treat it as drift. Brief the User and choose the recovery point from baselines, Evidence, and User Judgment rather than from state pointer alone.

## Stage Dispatch

| Runtime Signal | Procedure |
| --- | --- |
| `.geas/` absent and User wants Mission work | Run `geas init`, then continue. |
| No active Mission and User wants new Mission | `specifying`. |
| `current_stage: specifying` | `specifying`. |
| Current Task phase `unstarted` | Transition Task to `implementing`, then `implementing`. |
| Current Task phase `implementing` | `implementing`. |
| Current Task phase `verifying` | `verifying`. |
| Current Task phase `reviewing` | `reviewing`, then decide optional challenge. |
| Current Task phase `challenging` | `challenging`. |
| Current Task phase `awaiting_user_judgment` | Prepare Task Judgment Briefing from `briefings.md`, then `task-closure.md` after User decision. |
| Current Task phase `closed` and another Task is ready | `geas mission transition --to building --task <next-task-id>`. |
| All required Tasks have accepted Task Evidence | `geas mission transition --to consolidating`, then `consolidating`. |
| `current_stage: consolidating` | `consolidating` until Mission User Judgment is ready. |

## Task Phase Order

Default building order:

```text
unstarted -> implementing -> verifying -> reviewing -> optional challenging -> awaiting_user_judgment
```

Evidence recording usually advances the phase:

- `geas task evidence record --kind implementation` advances to `verifying`.
- `geas task evidence record --kind verification` with `passed` advances to `reviewing`.
- `geas task evidence record --kind verification` with `changes_requested` or `escalated` advances to `awaiting_user_judgment`.
- `geas task evidence record --kind review` advances to `awaiting_user_judgment`.
- `geas task evidence record --kind challenger` advances to `awaiting_user_judgment`.
- `geas task evidence record --kind task` closes the Task.

Use `geas task transition` for explicit User-directed rewinds or optional challenge insertion.

## Prompt-Level Handoff

Internal skill invocation in step 5 is a prompt-level handoff. Include:

- Procedure name.
- Mission id and current stage.
- Task id and phase when relevant.
- Latest baseline artifact paths.
- Evidence paths to read.
- User decisions and constraints.
- Required output payload.
- CLI command expected after User review.
- Role prompt path and lens when a role agent should be used.
- Boundaries and decisions to raise back to the User.

This handoff is context, not a runtime artifact.

## Role Handoff Checklist

When using an Agent role, pass:

- `role`: `work-designer`, `implementer`, `verifier`, `reviewer`, or `challenger`.
- `lenses`: zero or more lenses such as `documentation`, `software`, `runtime`, `security`, `compatibility`, `operations`, `data`, `research`, `product`, `ux`.
- Mission context and artifact paths.
- Task context and artifact paths.
- Inputs to inspect.
- Output type and Evidence kind.
- Focus.
- Responsibility boundary.
- Decisions to surface.

## Challenger Decision

Consider Challenger after Review Evidence and before Task User Judgment when:

- The Task touches runtime, CLI, schema, data, permission/security, deployment, migration, or critical baseline.
- Verification or Review Evidence has meaningful unverified scope.
- The Task result may silently expand Mission scope.
- There is a User-level tradeoff.
- The User requested high confidence or complete coverage.

In specifying, recommend Challenger to the User when baseline risk justifies extra depth. In building, call Challenger when the extra pass is within the Task's expected risk budget; ask the User first if it materially expands cost or scope.

## Drift Handling

Drift examples:

- State says `reviewing`, but Verification Evidence is missing.
- Current Task Contract does not match changed outputs.
- A Task is marked closed without Task Evidence.
- User Judgment exists but Evidence summary has not been recorded.
- Worktree changes do not map to any Task Contract.

Handle drift by:

1. Naming the mismatch.
2. Naming the safest known artifact basis.
3. Offering recovery choices: resume a phase, record missing Evidence, revise baseline, or stop.
4. Recording only after User-directed recovery decisions.
