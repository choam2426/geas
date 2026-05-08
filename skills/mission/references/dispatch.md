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
| `current_stage: building` | `building`. |
| `current_stage: consolidating` | `consolidating` until Mission User Judgment is ready. |

Building owns Task phase dispatch, Task Judgment, Task closure, task-end checkpoints, next Task selection, and transition to `consolidating`.

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
- Common Memory and the role-specific Memory for the role being invoked, when present.
- Mission context and artifact paths.
- Task context and artifact paths.
- Inputs to inspect.
- Output type and Evidence kind.
- Focus.
- Responsibility boundary.
- Decisions to surface.

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
