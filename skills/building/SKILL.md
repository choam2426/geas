---
name: building
description: "Internal building-stage procedure. Use only inside an active Mission or explicit mission handoff to coordinate the Task loop, Task User Judgment, Task Evidence, task-end git checkpointing, and transition to the next Task or consolidating."
---

# Building

Use this skill to operate the Mission's `building` stage.

Building owns Task loop coordination. It dispatches Task phase skills, prepares Task Judgment briefings, records Task result User Judgment, records accepted Task Evidence, coordinates task-end git checkpoints, and decides the next Task or Mission transition.

## Core Rules

- Treat the latest Task Contract as the Task execution baseline.
- Keep Task phase work inside `implementing`, `verifying`, `reviewing`, and optional `challenging`.
- Record User Judgment only from the User's decision.
- Record Task Evidence only after `accepted` or `accepted_with_limits` Task User Judgment.
- Use the Geas CLI for runtime writes; do not hand-edit `.geas/` runtime artifacts.
- Use `../mission/references/briefings.md` for User-facing Task and checkpoint briefings.
- Use the Role Handoff Checklist in `../mission/references/dispatch.md` when invoking role agents, including Common Memory and the role-specific Memory for the invoked role.

## Workflow

1. Inspect the building state.
   - Read `.geas/run-state.yaml`, the current Mission baseline, current Task State, latest Task Contract, relevant Evidence, User Judgment, and Memory.
   - Load `references/task-loop.md`.
   - If state and artifacts disagree, brief the User and choose recovery from baselines, Evidence, and User Judgment.

2. Dispatch the current Task phase.
   - Use `implementing` for `unstarted` or `implementing`.
   - Use `verifying` for `verifying`.
   - Use `reviewing` for `reviewing`.
   - Use `challenging` only when the Task risk, Evidence gaps, or User request justifies it.
   - Let each phase skill prepare and record its own role Evidence through the CLI.

3. Prepare Task Judgment.
   - When the Task phase is `awaiting_user_judgment`, prepare the Task Judgment Briefing from `../mission/references/briefings.md`.
   - Present Evidence basis, criteria status, unverified scope, remaining risks, and User choices.

4. Close the Task after User decision.
   - Load `references/task-closure.md`.
   - Record Task result User Judgment.
   - For `accepted` or `accepted_with_limits`, record Task Evidence.
   - For `revise`, `deferred`, or `stopped`, preserve the correct resume point and brief what remains unaccepted.

5. Run the task-end git checkpoint.
   - After accepted Task Evidence is recorded, load `references/git-checkpoint.md`.
   - Recommend a checkpoint by default.
   - Commit automatically only when the User explicitly opted into task-end commits for the Mission or asks for a commit in the current turn.

6. Choose the next runtime step.
   - If another Task is ready, transition the Mission to `building` with that Task.
   - If required Tasks have accepted Task Evidence, transition the Mission to `consolidating`.
   - If the Mission baseline needs revision, transition the Mission to `specifying`.
   - Otherwise, brief the User on the safest resume point.

## References

- `references/task-loop.md`: Dispatch Task phases and choose the next Task or Mission transition.
- `references/task-closure.md`: Record Task User Judgment and Task Evidence after User review.
- `references/git-checkpoint.md`: Recommend or perform task-end git checkpoints.
- `../mission/references/briefings.md`: Prepare Task Judgment, Task Closure, and Git Checkpoint briefings.
- `../mission/references/dispatch.md`: Use role handoff rules and Memory handoff requirements.

