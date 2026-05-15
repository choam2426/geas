---
name: building
description: Coordinates Geas Task execution loops from accepted Task Contract through role handoffs, Task result User Judgment input, Task Evidence, and next Task or consolidation routing. Use when a Mission is in building stage, Task State needs phase dispatch or recovery, Task result briefing is needed, or accepted Task results must be recorded. Do not use for writing implementation, verification, review, challenger Evidence, Mission baseline drafts, Mission closure, or User Judgment decisions.
---

# Building

## Job

Coordinate one Geas Task from accepted Task Contract through role Evidence, User Task result judgment, and Task Evidence. Keep role-producing output, Task Evidence, Task State, and User Judgment separate while preserving a recoverable Task loop.

## Workflow

Normal:
- Read the current Mission id, accepted Mission Spec, accepted Mission Design, current Task id, current Task Contract, Task State, and relevant Evidence refs.
- Before starting the Task loop, brief and record Task work options with `references/git-checkpoint.md`.
- Use `references/task-loop.md` to choose the next action from the current Task phase.
- For `unstarted` or implementation-ready work, request a transition to `implementing` through `geas-cli` when needed, then prepare an `implementing` handoff with `references/role-handoff.md`.
- For `verifying`, prepare a `verifying` handoff with the current Task Contract and Implementation Evidence.
- For `reviewing`, prepare a `reviewing` handoff with the current Task Contract, outputs, Implementation Evidence, and Verification Evidence.
- Before each role-producing step, decide `role_required`, `role_optional`, or `role_omitted` and preserve the basis.
- When risk, User request, or Evidence findings call for challenge before judgment, ask `geas-cli` to transition the Task to `challenging`, then prepare a `challenging` handoff.
- When challenge is optional and omitted, preserve the omitted reason and residual risk in the Task result judgment input.
- After role Evidence is recorded, continue from the Task State reported by `geas-cli`; do not infer acceptance from the role verdict.
- For `awaiting_user_judgment`, prepare Task result judgment input with `references/task-acceptance-input.md`.
- After the User provides a Task result decision, prepare the User Judgment payload with `references/task-acceptance-input.md`, then ask `geas-cli` to record it.
- If the recorded decision is `accepted` or `accepted_with_limits`, prepare Task Evidence with `references/task-evidence.md` and ask `geas-cli` to record it.
- If more accepted Task Contracts remain, prepare the next Task briefing and transition to `building` for that Task through `geas-cli`.
- If no Task remains and accepted Task Evidence exists for required Task Contracts, prepare a consolidation briefing and ask `geas-cli` to transition the Mission to `consolidating`.

Revision:
- If the User decision is `revise`, read `requested_actions` and choose the narrowest route that matches the request.
- For rework inside the current Task Contract, transition to the requested phase through `geas-cli` and preserve the Evidence refs that remain valid.
- For Task Contract changes, stop and route to `specifying` with the current Task Contract, Evidence refs, User Judgment ref, and requested changes.
- For Task discard, Mission baseline review, deferral, or stop, preserve the current state, User Judgment ref, and required next decision.
- Do not broaden Task scope, change acceptance criteria, or add Tasks inside `building` without a Task Contract revision through `specifying`.

Briefing:
- For long or decision-heavy Task result briefings, show 2-3 related items at a time.
- Each chunk includes current result, Evidence refs, unverified scope or risk, decision needed, and next step.
- Treat chunk confirmation as provisional review input, not User Judgment.
- Present a final summary before recording User Judgment or Task Evidence.

Work Options:
- Before Task work starts, ask whether to use the current worktree or a separate git worktree.
- Ask whether to keep the current branch, create or switch from `main`, or use a Task-specific branch.
- Ask whether to commit after each accepted Task, skip commits, or decide at each Task boundary.
- Treat work option and checkpoint output as operational support, not Evidence, User Judgment, or Task completion.

Stop:
- Preserve the current Task Contract ref, Task State, role handoff packet, Evidence refs, draft briefing, prepared payload, and `geas-cli` output when available.
- Stop when required input, role Skill, readable `read_first` path, User decision, or CLI write is unavailable.

## Inputs

Required:

- current Mission id and stage
- accepted Mission Spec ref
- accepted Mission Design ref
- current Task id
- current Task Contract ref
- current Task State
- relevant role Evidence refs for the current phase
- changed output, target, or result refs required by the next role

Required for User judgment:

- Task result judgment input shown to the User
- User decision and any accepted limits, risks, or requested actions
- User Judgment payload path before calling `geas-cli`

Optional:

- User request for challenge, checkpoint, deferral, or stop
- User-selected Task work options
- relevant Memory
- previous User Judgment refs
- baseline or Task Contract revision request

## Resources

| Resource | When to use | Purpose |
| --- | --- | --- |
| `references/task-loop.md` | Task phase selection and recovery | Choose phase dispatch, transition, stop, or revision route. |
| `references/role-handoff.md` | before role-producing Skill calls | Build handoff packets with `read_first`, focus, expected output, and stop conditions. |
| `references/task-acceptance-input.md` | before User Task result judgment | Prepare Evidence summary, unverified scope, risks, choices, and final summary. |
| `references/task-evidence.md` | after accepted Task result User Judgment | Prepare Task Evidence payload shape and criteria result summary. |
| `references/git-checkpoint.md` | before Task work and when checkpointing | Choose worktree, branch, and Task commit policy; keep git actions separate from Evidence and User Judgment. |

Use the `geas-cli` adapter Skill for Task phase transitions, User Judgment records, Task Evidence records, and Mission stage transitions. If `geas-cli` does not report success, preserve the payload and stop.

No scripts or assets are required. Task dispatch depends on runtime state, role outputs, and User decisions rather than deterministic local computation.

## Gotchas

- Do not write Implementation Evidence, Verification Evidence, Review Evidence, or Challenger Evidence here.
- Do not treat Task State, CLI success, Evidence verdict, recommendation, or checkpoint success as User Judgment.
- Do not write Task Evidence before Task result User Judgment is recorded.
- Do not write Task Evidence for `revise`, `deferred`, or `stopped` decisions.
- Do not start Task work on `main` without explicit User decision.
- Do not commit before Task result User Judgment and Task Evidence are recorded.
- Do not include unrelated work in a Task commit.
- Do not treat Task Evidence as a replacement for role Evidence.
- Do not broaden Task scope or change Task acceptance criteria inside `building`; route Task Contract changes to `specifying`.
- Do not call role-producing Skills without `read_first` refs for accepted Mission Spec, accepted Mission Design, current Task Contract, and phase-relevant Evidence.
- Do not call verification, review, or challenge without target/output refs needed to inspect the Task result.
- Do not omit an optional role without an omitted reason and residual risk briefing.
- Do not continue when a role handoff fails or a required `read_first` path cannot be read.
- Do not show a long Task result briefing all at once when chunked review would reduce User judgment cost.
- Do not treat chunk-level confirmation as final User Judgment.
- Do not require repo root docs as execution prerequisites for a distributed Skill.

## Stop Conditions

- Accepted Mission Spec, accepted Mission Design, current Task Contract, or Task State is missing.
- Task work options are required but not selected.
- Current Task phase cannot be mapped to a route in `references/task-loop.md`.
- Required role-producing Skill is unavailable.
- Required `read_first` path is unreadable.
- Target, output, or result refs required by the next role are missing.
- Role Evidence required for the next phase is missing.
- User result judgment is required but has not been provided.
- `geas-cli` transition, judgment record, Evidence record, or Mission transition does not report success.
- User requested Task Contract change, Task discard, Mission baseline review, deferral, or stop.
- The next action would require `building` to write role Evidence, decide User Judgment, or close the Mission.

## Boundary

`building` coordinates Task execution state, role handoffs, Task result judgment input, Task Evidence after User Judgment, and next Task or consolidation routing. It does not implement changes, verify outputs, review work, challenge artifacts, revise Mission baseline artifacts, decide acceptance, or close Missions.
