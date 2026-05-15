# Task Loop Reference

## Purpose

Use this reference to choose the next `building` action from Task State, role Evidence, and User decisions. The loop keeps phase routing separate from role output and User Judgment.

## Phase Dispatch

| Task phase | Required input | Building action | Expected next state |
| --- | --- | --- | --- |
| `unstarted` | current Task Contract | Ask `geas-cli` to transition to `implementing`, then prepare implementation handoff. | `implementing` |
| `implementing` | current Task Contract | Prepare implementation handoff. | Implementation Evidence is recorded by role. |
| `verifying` | Task Contract, Implementation Evidence | Prepare verification handoff. | Verification Evidence is recorded by role. |
| `reviewing` | Task Contract, Implementation Evidence, Verification Evidence | Prepare review handoff. | Review Evidence is recorded by role. |
| `challenging` | Task Contract, outputs, role Evidence | Prepare challenge handoff. | Challenger Evidence is recorded by role. |
| `awaiting_user_judgment` | Task Contract, role Evidence | Prepare Task result judgment input. | User Judgment is recorded. |
| `closed` | Task Evidence | Prepare next Task or consolidation briefing. | next Task or `consolidating` |

## Evidence-Driven Continuation

- After Implementation Evidence is recorded, continue from the Task State reported by `geas-cli`; normally this is `verifying`.
- After Verification Evidence with `passed`, continue from reported Task State; normally this is `reviewing`.
- After Verification Evidence with `changes_requested` or `escalated`, prepare Task result judgment input instead of forcing review.
- After Review Evidence, decide whether challenge is `role_required`, `role_optional`, or `role_omitted`.
- If challenge is required or the User chooses optional challenge, ask `geas-cli` to transition to `challenging`, then prepare challenge handoff.
- If challenge is omitted, preserve the omitted reason and residual risk, then prepare Task result judgment input.
- After Challenger Evidence, prepare Task result judgment input.
- After accepted or accepted-with-limits User Judgment, prepare Task Evidence.

## Revision Routes

Use `User Judgment.decision: revise` with `requested_actions` for these routes:

- `rework`: return to `implementing`, `verifying`, or `reviewing` without changing the Task Contract.
- `task_contract_update`: stop and route to `specifying` with requested Task Contract changes.
- `discard_task`: stop with User Judgment ref and requested discard action.
- `mission_baseline_review`: stop and route to `specifying` with the Mission-level concern.
- `additional_task`: stop and route to `specifying` so a new Task Contract can be accepted.

## Recovery Checks

- Task State points to a phase, but the required Evidence for that phase is missing: stop and report the missing ref.
- Task State is `awaiting_user_judgment`, but required role Evidence is missing: stop and request the missing role result or a User decision to revise.
- Task State is `closed`, but Task Evidence or User Judgment is missing: stop because the state pointer and artifacts disagree.
- Runtime state points to a different Task than the provided Task Contract: stop and preserve both refs.
- A role verdict says more work is needed: treat it as judgment input, not an automatic transition unless `geas-cli` state already moved.
- Challenge is required but Task State is not `challenging`: transition through `geas-cli` before handoff.
- Challenge is omitted without reason or residual risk: stop and complete the omission briefing before Task result judgment input.

## Stop Briefing Shape

```markdown
Task loop stopped:
- Task: <task-id>
- Phase: <phase>
- Required input missing: <none or list>
- Valid next routes: <handoff, User judgment, specifying, stop>
- Preserved refs: <Task Contract, Evidence, User Judgment, CLI output>
```
