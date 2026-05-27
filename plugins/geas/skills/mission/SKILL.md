---
name: mission
description: Coordinates Geas Mission work from the User entrypoint using Mission Spec, Mission Plan, Task Contract, Evidence, User Judgment, Task Memory, Debt Ledger, Memory, and Continuity Ledger artifacts. Use when the User asks to start, continue, inspect, route, or close a Geas Mission. Do not use for role implementation, role verification, role review, challenge work, or writing User decisions.
---

# Mission

Coordinate the Mission from the User-facing entrypoint. Read the current request and durable `.geas/` artifacts, choose the next route or stop condition, and keep artifact authorship, User Judgment, and direct runtime writes separate.

## Core Rules

- When resuming after context compaction, session transition, or agent tool change, use durable `.geas/` artifacts to reconstruct the current Mission state.
- Treat Mission Spec and Mission Plan as the current Mission criteria when they exist.
- Treat `task-contract.md` in a Task directory as the current Task criteria.
- Do not infer progress from an automatic pointer. Reconstruct the next action from artifact presence, User Judgment, Task Evidence, Task Memory, Debt Ledger, Memory, and Continuity Ledger.
- Never write User Judgment from an agent verdict or recommendation. Write User Judgment only from an explicit User decision.
- For a new Mission, create the Mission id in this skill before routing to `specifying`.
- Mission id format is `YYYYMMDD-<random>`, where `<random>` is exactly 6 lowercase letters or digits. Do not use semantic slugs as Mission ids.
- Write User-facing briefings in the User's language unless the User asks for another language.
- When a write is needed, write the prepared artifact directly to the runtime path defined by the artifact kind.
- If the exact runtime path or User decision is unavailable, return a stop briefing with the prepared payload and missing input.

## Workflow

1. Inspect `.geas/` for Mission directories, Mission Spec, Mission Plan, Task directories, Task Contracts, Role Evidence, User Judgments, Task Evidence, Task Memory, Debt Ledger, Memory, and Continuity Ledger.
2. Decide whether the request is direct work or Mission work. Use Mission work when the request needs persistent artifacts, multiple Task units, role handoffs, accumulated Evidence, recovery, or an explicit User acceptance flow.
3. For a new Mission, initialize the empty workspace scaffold if `.geas/` is missing, create a Mission id with the runtime format, create `.geas/missions/<mission-id>/`, and route to `specifying`.
4. For an existing Mission without accepted Mission Spec or Mission Plan, route to `specifying`.
5. For a Mission with accepted Mission Spec and Mission Plan but no current Task Contract for the next Task candidate, route to `building` for Task specifying.
6. For a Mission with a current Task Contract and missing Role Evidence, route to `building`.
7. For a Task with Role Evidence but no Task result User Judgment, route to `building` to prepare the Task result judgment briefing.
8. For a Task with accepted or canceled User Judgment but missing Task Evidence, route to `building` to prepare and write Task Evidence.
9. When required Task Evidence exists and Mission result judgment is needed, route to `consolidating`.
10. When artifacts conflict, return a stop briefing instead of guessing the next step.

## Route Output

When selecting the next skill, return only the route facts needed to continue:

- selected route
- User-facing briefing in the User's language
- mission_id and Mission directory when created or selected
- Task directory when a current Task is selected
- artifacts read
- artifacts written
- stop reason or missing User decision when routing cannot continue

Do not build a separate routing context packet for same-session skill routing. Continue with the selected Mission or Task directory in the current working context. Use role handoff packets only for separated role work where another agent must read `read_first` paths before acting.

## Direct Runtime Writes

Use these locations when this skill itself must create Mission scaffolding or continuity notes:

- Mission directory: `.geas/missions/<mission-id>/`
- Continuity Ledger: `.geas/continuity.md`
- Memory: `.geas/memory/common.md` or `.geas/memory/roles/<role>.md`
- Debt Ledger: `.geas/debts.md`

Create directories only for the selected Mission or Task. Runtime artifacts use fixed filenames; write only when the target is the accepted current artifact for that scope. If overwriting would discard unreflected context, preserve the payload and return a stop briefing.

For a new Mission, write only the Mission directory and optional workspace scaffold before handing off. Do not write Mission Spec, Mission Plan, Task artifacts, Evidence, or User Judgment in this skill.

If the generated Mission id already exists, generate a new id. If a unique runtime path cannot be formed safely, return a stop briefing instead of using a semantic fallback.

## Script

Use `scripts/geas-init` only to initialize an empty workspace scaffold:

```text
node <mission Skill directory>/scripts/geas-init [workspace]
```

The script creates missing `.geas/` directories and empty ledger files for Debt Ledger, Continuity Ledger, common Memory, role Memory, and `missions/`. It does not create Mission ids, Mission Spec, Mission Plan, Task directories, Task Contracts, Evidence, User Judgment, or workflow state. Existing files are left unchanged.

## Output

Return:

- selected route or stop condition
- User-facing briefing
- Mission or Task directory selected for the next route
- artifacts read
- artifacts written, when direct writes occurred
- prepared payloads that were not written
- missing inputs or record failure reason

## Boundaries

- Do not draft Mission Spec, Mission Plan, Task Direction, Task Contract, Role Evidence, Task Evidence, Mission Evidence, Debt, Memory, or User Judgment content for another skill.
- Do not treat Evidence verdict, recommendation, artifact existence, git output, tests, or automatic location guesses as User Judgment.
- Do not route to Task implementation without a current Task Contract. Route to `building` Task specifying when a Task candidate still needs Task Direction or Task Contract.
- Do not close a Mission without Mission result User Judgment and Mission Evidence.

`mission` routes and briefs. It does not implement, verify, review, challenge, decide acceptance, or replace the User's decision.
