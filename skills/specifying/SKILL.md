---
name: specifying
description: Turns a Geas User goal into reviewable Mission Spec, Mission Design, and initial Task Contract Set baselines. Use during Mission intake, baseline revision, scope clarification, acceptance criteria definition, task slicing, or building-entry readiness. Do not use for Task implementation, role Evidence, verification, review, challenge Evidence, or Mission closure.
---

# Specifying

## Job

Create or revise the Mission baseline that lets the User review what is being attempted before execution starts. Produce Mission Spec, Mission Design, and initial Task Contract Set candidates, then record only the artifacts the User explicitly accepts.

## Operating Stance

Act as a goal-clarifying baseline coordinator.

- Elicit the User's concrete goal through interaction before drafting baseline artifacts.
- Ask for User-owned facts before proposing assumptions or recommended defaults.
- Surface ambiguity as questions, choices, assumptions, or non-blocking open decisions.
- Keep Mission Spec, Mission Design, and Task Contract Set acceptance separate.
- Use chunked briefing to reduce User review cost, then ask for final artifact acceptance.
- Route role-owned outputs to the owning role instead of filling them in here.

## Workflow

Normal:
- Read the User goal, current Mission state, and any accepted baseline artifacts for a revision.
- When the Mission depends on an existing workspace, run a lightweight project context scan with `references/intake-interview.md`.
- Run the intake loop in `references/intake-interview.md` before drafting artifacts.
- Identify ambiguity in goal, project context when relevant, outcome and experience shape when relevant, scope, success criteria, constraints, risks, excluded work, verification method, and required User decisions.
- Ask User-owned facts first, offer choices next, and propose candidate assumptions only when the intake gate allows it.
- When progress is possible without another question, write a Baseline Candidate that states assumptions and decision points.
- Draft Mission Spec only after the intake readiness checklist is answered, confirmed as assumptions, or marked as non-blocking open decisions.
- Draft Mission Spec first using `references/mission-spec.md`, then show 2-3 item chunks, collect revisions, and present a final summary for acceptance.
- After final summary acceptance of the Mission Spec, record it through `geas-cli`.
- Draft Mission Design only after Mission Spec acceptance, using `references/mission-design.md`, then show 2-3 item chunks, collect revisions, and present a final summary for acceptance.
- After final summary acceptance of the Mission Design, record it through `geas-cli`.
- Draft the initial Task Contract Set only after Mission Design acceptance, using `references/task-contract.md`. Draft one Task Contract candidate per executable Task, with `task_id`, `depends_on`, and `mission_acceptance_refs` expressing the Set relationship.
- Show the Task Contract Set in 2-3 Task or related-item chunks, collect revisions, and present a final Set summary for acceptance. A very small Mission can have a Set with one Task Contract.
- After final summary acceptance of the Task Contract Set, record each Task Contract through `geas-cli` with `task contract record --task <task-id>`.
- If any Task Contract record fails, preserve already recorded refs, the failed payload, and the `geas-cli` output, then stop.
- Check building-entry readiness with `references/baseline-readiness.md`.
- When the User chooses to enter execution and required baseline records exist, route back to `mission` or `building` for the next stage.

Challenge:
- If baseline risk is high, assumptions are weak, or the User asks for pressure testing, route a baseline challenge request to `challenging`.
- Use returned baseline challenge findings as User briefing input.
- Revise baseline candidates only through this Skill after the User chooses which findings to address.

User Decision:
- Ask the User to accept, revise, defer, or stop each baseline artifact or Task Contract Set separately.
- Treat acceptance of Mission Spec, Mission Design, and Task Contract Set as separate decisions.
- Preserve draft payloads and open decisions when the User pauses before acceptance.

Briefing:
- For Mission Spec, Mission Design, and Task Contract Set agreement, show 2-3 related items or Task candidates at a time.
- Each chunk includes current draft, decision to confirm, choices, and next step.
- Treat chunk confirmation as provisional review input, not artifact acceptance.
- After chunk revisions converge, present a final summary and ask whether to accept the whole artifact.
- Attempt `geas-cli` recording only after final summary acceptance.

Stop:
- Preserve the current draft candidate and explain what decision or input is missing.
- Preserve payload and `geas-cli` output when recording fails.
- Do not continue to the next baseline artifact or stage when the previous artifact has not been accepted and recorded.

## Inputs

Required:

- User goal or baseline revision request
- current Mission id and stage when runtime exists
- User decisions about acceptance, revision, deferral, or stop

Required for revision:

- accepted Mission Spec, Mission Design, or Task Contract Set being revised
- related Evidence, User Judgment, or change trigger that explains why the baseline must change

Optional:

- project context observations
- constraints, risks, excluded work, and verification preferences from the User
- baseline challenge findings
- relevant Memory

## Resources

| Resource | When to use | Purpose |
| --- | --- | --- |
| `references/intake-interview.md` | before artifact drafting | Elicit concrete goals, scan ambiguity, and prevent premature baseline drafting. |
| `references/mission-spec.md` | Mission Spec draft | Define Mission Spec payload shape and review checks. |
| `references/mission-design.md` | Mission Design draft | Define Mission Design payload shape and boundaries from the Task Contract Set. |
| `references/task-contract.md` | initial Task Contract Set draft | Define Task slicing, acceptance criteria, verification checks, review focus, and Task relationships. |
| `references/baseline-readiness.md` | before building entry | Check accepted baseline and open decisions before execution starts. |

Use the `geas-cli` adapter Skill to record accepted Mission Spec, Mission Design, each Task Contract in the Task Contract Set, and stage transitions. If `geas-cli` does not report success, preserve the payload and stop.

No scripts or assets are required. Baseline drafting is judgment-centered, and the outputs are Markdown payloads rather than reusable asset-based artifacts.

## Gotchas

- Do not treat one User approval as acceptance of Mission Spec, Mission Design, and Task Contract Set together.
- Do not end intake while readiness checklist items are still ambiguous; ask, offer choices, propose assumptions, or mark non-blocking open decisions first.
- Do not show the whole baseline artifact at once when asking for agreement.
- Do not treat chunk-level confirmation as final artifact acceptance.
- Do not draft Mission Design before Mission Spec is accepted.
- Do not draft the Task Contract Set before Mission Design is accepted.
- Do not record drafts before explicit User acceptance.
- Do not let Mission Design become the Task graph source of truth; the Task Contract Set owns task slicing and dependencies.
- Do not write implementation, verification, review, challenge, Task Evidence, or Mission Evidence.
- Do not broaden scope silently when new work appears; surface a baseline revision decision.
- Do not require repo root docs as execution prerequisites for a distributed Skill.

## Stop Conditions

- User goal cannot be turned into a reviewable baseline without another decision.
- Required accepted baseline state is missing for a revision.
- User has not accepted the artifact that would be recorded next.
- `geas-cli` recording does not report success.
- Baseline challenge is required or requested but `challenging` is unavailable.
- The next step would perform Task implementation, role Evidence writing, or User Judgment on behalf of the User.

## Boundary

`specifying` owns baseline drafting and baseline revision coordination. It does not implement tasks, verify outputs, review changes, write role Evidence, decide acceptance, close Missions, or replace User Judgment. Accepted baseline artifacts are recorded only after User acceptance and through `geas-cli`.
