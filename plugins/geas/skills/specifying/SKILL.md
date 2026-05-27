---
name: specifying
description: Turns a Geas User goal into reviewable Mission Spec and Mission Plan, then writes accepted Mission criteria artifacts directly into `.geas/`. Use for Mission intake, Mission criteria clarification, Mission Plan drafting, and Mission-level criteria revision. Do not use for Task Direction, Task Contract, implementation, verification, review, challenge Evidence, Task Evidence, Mission Evidence, or deciding User Judgment.
---

# Specifying

Convert the User request into accepted Mission criteria and planning context. Keep draft artifacts, User review briefings, accepted runtime writes, and User Judgment separate.

## Core Rules

- Read `references/intake-interview.md` before drafting Mission Spec from an unclear request.
- Use Mission Spec for goal, background, scope, constraints, assumptions, risks, and Mission acceptance criteria.
- Use Mission Plan for approach, key context, impact surface, Task structure, validation and review strategy, User decision points, risks, change triggers, and continuity requirements.
- Keep Task Structure at the planning level. It names reviewable Task candidates and judgment points but does not create Task Direction or Task Contract artifacts.
- Route Task Direction and Task Contract work to `building` Task specifying.
- Use the Mission directory selected by `mission`. Do not create Mission ids or Mission directories in this skill.
- Write accepted artifacts directly to `.geas/` only after User acceptance of that artifact.
- If the User has not accepted a draft, return the draft payload and User-facing review briefing instead of writing it as runtime truth.

## Workflow

1. Read the User request, selected `mission_id`, relevant project files, Memory, Debt Ledger, Continuity Ledger, and current Mission artifacts when this is a revision.
2. Run intake with `references/intake-interview.md` when the request is unclear, broad, or likely to hide Mission-level decisions.
3. Clarify only decisions that affect Mission Spec first: goal, background, included scope, excluded scope, Mission acceptance criteria, constraints, assumptions, and risks.
4. Draft Mission Spec with `references/mission-spec.md`.
5. Present a User-facing Mission Spec review briefing and wait for explicit acceptance or requested revision.
6. After Mission Spec acceptance, write it to `.geas/missions/<mission-id>/mission-spec.md`.
7. Draft Mission Plan with `references/mission-plan.md`, using the accepted Mission Spec as the source of truth.
8. In Mission Plan, define Task Structure as candidates for later Task Workflow: purpose, Mission criteria refs, likely ordering, dependencies, judgment points, expected validation/review strategy, and places where Task Direction may be needed.
9. Present a User-facing Mission Plan review briefing and wait for explicit acceptance or requested revision.
10. After Mission Plan acceptance, write it to `.geas/missions/<mission-id>/mission-plan.md`.
11. Return a building route briefing with Mission Spec and Mission Plan refs, Task Structure summary, open Mission-level decisions, and first Task candidate from the Mission Plan.

## Direct Runtime Writes

- Mission Spec: `.geas/missions/<mission-id>/mission-spec.md`
- Mission Plan: `.geas/missions/<mission-id>/mission-plan.md`
- Continuity Ledger updates for open questions or next action: `.geas/continuity.md`

Mission criteria artifacts use fixed filenames as the current accepted artifacts. If a directory or filename cannot be determined safely, or if replacing an existing artifact would discard unreflected context, do not write; return the payload and stop briefing.

If no selected Mission directory is available for a new Mission, return a stop briefing that routes back to `mission` for Mission id and directory creation. Do not invent a semantic id from the User request.

## Output

Return:

- draft or accepted artifact payloads
- User-facing review briefing for each artifact needing acceptance
- direct write paths for accepted artifacts
- building route briefing when Mission criteria are ready
- open decisions and their owning artifact
- record failure or stop reason, with preserved payload

## Boundaries

- Do not accept Mission Spec or Mission Plan on behalf of the User.
- Do not write Task Direction or Task Contract.
- Do not turn Mission Plan Task Structure into executable Task criteria; Task Contract is written later by `building` Task specifying.
- Do not perform implementation, verification, review, challenge, Task result summarization, Task Evidence, Mission Evidence, Debt finalization, or User Judgment.

`specifying` owns Mission Spec and Mission Plan drafting and accepted Mission criteria writes. It does not create Task Direction, create Task Contract, execute Tasks, or decide acceptance.
