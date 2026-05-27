---
name: consolidating
description: Synthesizes accepted Task Evidence against Mission Spec and Mission Plan, prepares Mission result User Judgment briefing, writes User-provided Mission Judgment, Mission Evidence, Debt Ledger, Memory, and Continuity Ledger updates. Use when Task Evidence is ready for Mission-level judgment or Mission closure records. Do not use for Task implementation, Role Evidence, Task Evidence authoring, criteria drafting, or deciding User Judgment.
---

# Consolidating

Close or continue a Mission from accepted Task outcomes. Compare Task Evidence to Mission criteria, brief the User for Mission judgment, and write closure and continuity artifacts after the User decides.

## Core Rules

- Read Mission Spec, Mission Plan, accepted Task Evidence, Task result User Judgments, Role Evidence refs, Task Memory, Debt Ledger, Memory, and Continuity Ledger before summarizing.
- Compare results to Mission Spec acceptance criteria and Mission Plan expectations.
- Treat Mission result User Judgment as a User decision only.
- Write Mission result User Judgment only from explicit User input.
- Write Mission Evidence only after Mission result User Judgment.
- Write Debt Ledger, Memory, and Continuity Ledger updates as their own runtime artifacts; Mission Evidence only references and summarizes those updates.

## Workflow

1. Read Mission Spec, Mission Plan, Task Evidence, Task User Judgments, related Role Evidence, Task Memory, Debt Ledger, Memory, and Continuity Ledger.
2. Confirm each Task Evidence has a User Judgment ref.
3. Compare Task Evidence to Mission Spec criteria and Mission Plan continuity requirements.
4. Prepare Mission result judgment briefing with `references/mission-judgment-briefing.md`.
5. Ask the User for Mission result decision when no explicit decision exists.
6. Write Mission result User Judgment to `.geas/missions/<mission-id>/user-judgment.md` after the User decides.
7. For an accepted Mission result, update Debt Ledger, Memory, and Continuity Ledger with `references/reflection-memory.md`.
8. Write Mission Evidence with `references/mission-evidence.md` to `.geas/missions/<mission-id>/mission-evidence.md`.
9. For additional Task requests, route to `specifying` with the accepted Mission refs and requested actions.
10. For cancellation, write the User Judgment and Continuity Ledger notes; do not write Mission Evidence as accepted completion.

## Direct Runtime Writes

- Mission User Judgment: `.geas/missions/<mission-id>/user-judgment.md`
- Mission Evidence: `.geas/missions/<mission-id>/mission-evidence.md`
- Debt Ledger: `.geas/debts.md`
- Memory: `.geas/memory/common.md` or `.geas/memory/roles/<role>.md`
- Continuity Ledger: `.geas/continuity.md`

If any ledger write cannot be safely applied, return the ledger payload, target path, reason, and next operator/User action.

## Output

Return:

- Mission result judgment briefing
- Mission criteria results
- accepted limits and remaining risks
- Mission User Judgment payload and write path when User decided
- Debt Ledger, Memory, and Continuity Ledger update payloads
- Mission Evidence payload and write path when eligible
- next Task or closure briefing
- stop reason with preserved payloads when a required input or write target is missing

## Boundaries

- Do not decide Mission acceptance.
- Do not write Role Evidence or Task Evidence.
- Do not change Mission Spec, Mission Plan, Task Direction, or Task Contract directly.
- Do not treat Task Evidence existence, Role Evidence verdict, recommendation, or artifact write success as Mission result User Judgment.

`consolidating` prepares Mission-level judgment input and writes closure records after User decision.
