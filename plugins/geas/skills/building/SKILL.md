---
name: building
description: Coordinates Geas building work from Mission Plan Task Structure through Task specifying, optional Task Direction, Task Contract acceptance, role handoffs, Task result judgment briefing, User Judgment recording, Task Evidence, Task Memory, and next Task or Mission consolidation routing. Use when Mission Spec and Mission Plan are accepted and a Task needs to be specified, executed, judged, or recorded. Do not use for writing role Evidence itself, Mission Spec or Mission Plan drafting, Mission closure, or deciding User Judgment.
---

# Building

Coordinate building from one Task candidate to one judged Task result. `building` performs Task specifying, then coordinates role-producing skills, summarizes results for the User, writes User-provided judgments, writes Task Evidence after judgment, and updates Task Memory.

## Core Rules

- Read Mission Spec, Mission Plan, current Task candidate or current Task Contract, Task Direction if referenced, related Role Evidence, Task Memory, Memory, Debt Ledger, and Continuity Ledger before choosing the next action.
- Determine the next action from missing or present artifacts and User decisions.
- Start each new Task with Task specifying. Task Direction and Task Contract acceptance happen before implementation.
- Use Task Direction when User direction changes outputs, tradeoffs, accepted risks, or Evidence expectations before Task Contract can be precise.
- Write one Task Contract for the current executable Task after User acceptance.
- Dispatch role-producing skills in this order when required by the Task Contract: implementing, verifying, reviewing, optional challenging.
- Use a separated handoff packet with `read_first` refs for every role-producing skill.
- Include Task Memory, common Memory, and the receiving role's Memory in each role handoff when those files exist.
- Treat Role Evidence verdicts and recommendations as User Judgment inputs only.
- Write Task result User Judgment only from an explicit User decision.
- Write Task Evidence only after Task result User Judgment exists.
- Update Task Memory after User Judgment when later Tasks can benefit from the accepted context.

## Workflow

1. Read Mission Spec, Mission Plan, current Task Memory, relevant Memory, Debt Ledger, and Continuity Ledger.
2. Select the next Task candidate from Mission Plan Task Structure, User request, Task Evidence already recorded, Task Memory, and Continuity Ledger.
3. Create the Task directory when the Task id is known and no existing Task directory owns that work.
4. Run Task specifying for the selected Task:
   - Restate the Task purpose and Mission relation from Mission Plan.
   - Read accepted prior Task Evidence and Task Memory that affect Starting Context.
   - Decide whether Task Direction is needed before Task Contract.
   - If Task Direction is needed, prepare it with `references/task-direction.md`, present it for User direction acceptance, and write the accepted direction under the Task `directions/` directory.
   - Draft Task Contract with `references/task-contract.md`, including `task_direction_ref` when a direction was accepted.
   - Present a User-facing Task Contract review briefing and wait for explicit acceptance or requested revision.
   - Write the accepted Task Contract to `.geas/missions/<mission-id>/tasks/<task-id>/task-contract.md`.
5. If environment details affect role work, prepare operational context with `references/task-environment.md`.
6. Before each role handoff, gather `read_first` refs for Mission Spec, Mission Plan, Task Contract, Task Direction when referenced, Task Memory, common Memory, the receiving role's Memory, Debt Ledger, Continuity Ledger, and role-relevant Evidence.
7. If Implementation Evidence is missing and implementation work is needed, prepare an `implementing` handoff with `references/role-handoff.md`.
8. If Verification Evidence is missing after implementation, prepare a `verifying` handoff.
9. If Review Evidence is missing after verification, prepare a `reviewing` handoff.
10. If the Task Contract, User request, Role Evidence, or risk profile calls for pressure testing, prepare a `challenging` handoff.
11. When enough Role Evidence exists for User judgment, prepare the Task result briefing with `references/task-judgment-briefing.md`.
12. After the User decides, write User Judgment to `.geas/missions/<mission-id>/tasks/<task-id>/user-judgment.md`.
13. For `accepted` or `canceled` Task judgments, write Task Evidence with `references/task-evidence.md`.
14. Update `.geas/missions/<mission-id>/task-memory.md` with `references/task-memory.md` when accepted Task context should affect later Tasks.
15. Route to the next Task candidate, Mission criteria revision through `specifying`, or Mission consolidation.

## Direct Runtime Writes

- Task Direction: `.geas/missions/<mission-id>/tasks/<task-id>/directions/<direction-output>`
- Task Contract: `.geas/missions/<mission-id>/tasks/<task-id>/task-contract.md`
- Task User Judgment: `.geas/missions/<mission-id>/tasks/<task-id>/user-judgment.md`
- Task Evidence: `.geas/missions/<mission-id>/tasks/<task-id>/task-evidence.md`
- Task Memory: `.geas/missions/<mission-id>/task-memory.md`
- Continuity Ledger: `.geas/continuity.md`

Do not overwrite existing Task Evidence without explicit User instruction. If a second Task result must be judged, preserve the old Task directory or create a new Task Contract rather than silently replacing the record.

## Output

Return:

- selected next action
- Task specifying briefing, role handoff packet, or Task result judgment briefing
- Task Direction payload and write path when needed
- Task Contract payload and write path when accepted
- User Judgment payload and write path when the User decided
- Task Evidence payload and write path when eligible
- Task Memory updates
- next Task or consolidation handoff packet
- stop reason with preserved payloads when a required artifact, readable path, User decision, or write target is missing

## Boundaries

- Do not write Implementation Evidence, Verification Evidence, Review Evidence, or Challenger Evidence.
- Do not decide Task acceptance.
- Do not treat a Role Evidence verdict, recommendation, test result, review result, or git checkpoint as User Judgment.
- Do not change Mission Spec or Mission Plan directly; route Mission criteria changes to `specifying`.
- Do not treat Task Direction acceptance or Task Contract acceptance as Task result User Judgment.
- Do not write Mission Evidence.

`building` owns Task specifying and Task flow coordination. It does not produce role work, close Missions, or replace User decisions.
