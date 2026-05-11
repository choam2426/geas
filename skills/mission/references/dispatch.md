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

CLI commands in this reference name the CLI surface; execute runtime writes through `geas-cli` using the bundled script invocation rule.

| Runtime Signal | Procedure |
| --- | --- |
| `.geas/` absent and User wants Mission work | Run the CLI surface command `geas init` through `geas-cli`, then continue. |
| No active Mission and User wants new Mission | `specifying`. |
| `current_stage: specifying` | `specifying`. |
| `current_stage: building` | `building`. |
| `current_stage: consolidating` | `consolidating` until Mission User Judgment is ready. |

Building owns Task phase dispatch, Task Judgment, Task closure, task-end checkpoints, next Task selection, and transition to `consolidating`.

If the selected procedure is unavailable, do not simulate its output. Prepare the prompt-level handoff packet, brief the missing capability, and offer retry with the procedure available, proceed without that procedure when safe, or stop.

## Prompt-Level Handoff

Procedure invocation is a prompt-level handoff. Include:

- Procedure name or requested capability.
- Mission id and current stage.
- Task id and phase when relevant.
- `read_first`: artifact paths the receiving procedure or role must read before work.
  - Latest accepted Mission Spec when present.
  - Latest accepted Mission Design when present.
  - Current Task Contract when task-scoped.
  - Relevant Evidence when evidence-scoped.
  - Current draft target when draft-scoped.
- User decisions and constraints.
- Required output payload.
- CLI command expected after User review.
- Role prompt path and lens when a role agent should be used.
- Boundaries and decisions to raise back to the User.

This handoff is context, not a runtime artifact.

## Role Invocation Flow

Before a calling context reaches a role-producing step, decide one of:

- `role_required`: the role output is needed before changing the baseline, Task state, or Evidence path.
- `role_optional`: the role can improve confidence, but the caller may continue without it after naming the missing role output.
- `role_omitted`: the role is not needed because the current artifact already supplies the role's decision surface.

Use `role_required` for:

- Work design that creates or changes approach, Task graph, dependency order, or review-cost tradeoffs.
- Implementation, verification, or review phases that produce Task Evidence.
- Challenger passes the User requested or the procedure marked necessary before recording.

Use `role_omitted` only when the caller can name the accepted artifact or User decision that already covers the role's responsibility. Surface the omission reason in the briefing or review packet. Do not silently omit a role-producing step.

## Role Execution Boundary

Role output is produced in the role context named by the handoff.

The calling context prepares the handoff packet, receives the role result, briefs the User, and applies User decisions. It does not impersonate the role or replace the role result with a locally written equivalent.

The role reads every `read_first` path before working. If a required `read_first` path cannot be read, treat the role handoff as unavailable.

## Artifact Authorship Boundary

When a role is `role_required` for an artifact, draft, candidate payload, or Evidence payload, that role is the artifact author for that output.

The calling context may:

- Prepare the handoff packet.
- Render the returned payload for User review.
- Serialize an accepted payload into the CLI input shape.
- Record accepted payloads through the CLI.
- Apply purely mechanical formatting that does not add scope, criteria, checks, risks, decisions, or findings.

The calling context must not:

- Fill missing substantive fields in a role-authored artifact.
- Convert role notes into new artifact content without a returned payload.
- Revise a role-authored artifact after Challenger findings are accepted.
- Present a coordinator-authored draft as if it came from the role.

If a role-authored payload is missing required content, return to the role author, ask the User for a decision, or stop before recording.

Accepted Challenger findings return to the current artifact author for revision. The Challenger does not rewrite the artifact, and the calling context does not apply substantive findings directly unless the current artifact is explicitly coordinator-authored or the User delegates a mechanical edit.

When role handoff is unavailable, surface the recovery choice to the User:

- Retry the role handoff.
- Proceed without that role pass and name the missing role output.
- Stop before changing the baseline, Task, or Evidence path that needed the role pass.

## Role Handoff Checklist

When using an Agent role, pass:

- `role`: `work-designer`, `implementer`, `verifier`, `reviewer`, or `challenger`.
- `invocation_decision`: `role_required` or `role_optional`.
- `role_prompt_path`: prompt file or role instruction path to use.
- `procedure_skill`: procedure skill the role should run, such as `specifying`, `implementing`, `verifying`, `reviewing`, or `challenging`.
- `lenses`: zero or more lenses such as `documentation`, `software`, `runtime`, `security`, `compatibility`, `operations`, `data`, `research`, `product`, `ux`.
- Common Memory and the role-specific Memory for the role being invoked, when present.
- `read_first`: artifact paths the role must read before work, including latest accepted Mission Spec and Mission Design when present, current Task Contract when task-scoped, relevant Evidence when evidence-scoped, and current draft target when draft-scoped.
- Mission and Task context summaries that help navigation.
- Inputs to inspect.
- Expected output type and Evidence kind.
- Artifact author responsibility: draft payload, candidate payload, Evidence payload, or advisory findings.
- Write authority: whether the role may record through the CLI or must return output for the caller to review.
- Return format: Evidence path, briefing input, structured findings, or draft payload.
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
