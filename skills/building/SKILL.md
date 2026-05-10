---
name: building
description: "Internal building-stage procedure. Use only inside an active Mission or explicit mission handoff to coordinate the Task loop, Task User Judgment, Task Evidence, task-end git checkpointing, and transition to the next Task or consolidating."
---

# Building

Use this skill to operate the Mission's `building` stage.

Building owns Task loop coordination. It dispatches Task phases through role handoffs, prepares Task Judgment briefings, records Task result User Judgment, records accepted Task Evidence, coordinates task-end git checkpoints, and decides the next Task or Mission transition.

## Core Rules

- Treat the latest Task Contract as the Task execution baseline.
- Keep Task phase work inside `implementing`, `verifying`, `reviewing`, and optional `challenging`.
- Treat Task phase dispatch as a role invocation decision. `implementing`, `verifying`, and `reviewing` phases require the matching role pass.
- Record User Judgment only from the User's decision.
- Record Task Evidence only after `accepted` or `accepted_with_limits` Task User Judgment.
- Use the Geas CLI for runtime writes; do not hand-edit `.geas/` runtime artifacts.
- If the CLI or a phase procedure is unavailable, prepare the intended payload or handoff packet, brief the unavailable capability, and wait for caller/User direction instead of simulating the missing procedure or role output.
- Use `references/briefings.md` for User-facing Task and checkpoint briefings.
- Use `references/role-handoff.md` when invoking role agents.
- Include `read_first` artifact paths in every role handoff and wait for the role to read them before producing phase output.

## Workflow

1. Inspect the building state.
   - Read recorded runtime state when present, or use caller-provided Mission and Task context.
   - Read the current Mission baseline, current Task State, latest Task Contract, relevant Evidence, User Judgment, and Memory.
   - Load `references/task-loop.md`.
   - If state and artifacts disagree, brief the User and choose recovery from baselines, Evidence, and User Judgment.

2. Dispatch the current Task phase.
   - For `unstarted` or `implementing`, prepare an `implementer` handoff with `invocation_decision: role_required`.
   - For `verifying`, prepare a `verifier` handoff with `invocation_decision: role_required`.
   - For `reviewing`, prepare a `reviewer` handoff with `invocation_decision: role_required`.
   - For `challenging`, prepare a `challenger` handoff with `invocation_decision: role_required` for the inserted challenge pass.
   - Use `challenger` as `role_optional` only at the post-review Challenger decision point before Task Judgment.
   - Use `references/role-handoff.md` for every role handoff packet, not only fallback cases, and include the required `read_first` paths.
   - Wait for the role result or Evidence path before moving to the next Task phase. Building does not write Implementation, Verification, Review, or Challenger Evidence itself.
   - If the required role handoff or phase procedure is unavailable, use `references/role-handoff.md` to surface recovery choices.

3. Prepare Task Judgment.
   - When the Task phase is `awaiting_user_judgment`, prepare the Task Judgment briefing from `references/briefings.md`.
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
- `references/briefings.md`: Prepare Task Judgment, Task Closure, and Git Checkpoint briefings.
- `references/role-handoff.md`: Prepare role handoff packets and fallback choices.
