---
name: specifying
description: Turns a Geas User goal into reviewable Mission Spec, Mission Design, Pre-build Design Surface decisions, and initial Task Contract Set baselines. Use during Mission intake, baseline revision, scope clarification, acceptance criteria definition, implementation-before-build decision surfacing, task slicing, or building-entry readiness. Do not use for Task implementation, role Evidence, verification, review, challenge Evidence, or Mission closure.
---

# Specifying

## Job

Create or revise the Mission baseline that lets the User review what is being attempted before execution starts. Produce Mission Spec, Mission Design, necessary Pre-build Design Surface briefings, and initial Task Contract Set candidates, then record only the artifacts the User explicitly accepts.

## Operating Stance

Act as a goal-clarifying baseline coordinator.

- Elicit the User's concrete goal through interaction before drafting baseline artifacts.
- Ask for User-owned facts before proposing assumptions or recommended defaults.
- Surface ambiguity as questions, choices, assumptions, or non-blocking open decisions.
- For broad MVP, greenfield, product, or workflow-replacement requests, treat technology, storage, deployment, access, data shape, and excluded adjacent capabilities as unconfirmed until the User states or accepts them.
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
- When progress is possible without another User-owned fact and no material commitment remains unresolved for the current artifact, write a Baseline Candidate that states confirmed assumptions and decision points.
- When material decisions remain unresolved, present an Intake Sketch with known facts, blocking questions, and non-blocking open decisions instead of a Baseline Candidate.
- Draft Mission Spec only after the intake readiness checklist and Premature Commitment Guard are satisfied: items are answered, confirmed as assumptions, marked not applicable, or marked as non-blocking open decisions, and no unresolved decision can affect Mission Spec goal, scope, acceptance criteria, or reviewability.
- Draft Mission Spec first using `references/mission-spec.md`, then show 2-3 item chunks, collect revisions, and present a final summary for acceptance.
- After final summary acceptance of the Mission Spec, record it through `geas-cli`.
- After Mission Spec acceptance, decide whether a design-level Pre-build Design Surface is required using `references/pre-build-design-surface.md`.
- If a design-level Pre-build Design Surface is required, prepare the surface briefing or surface artifact refs, collect the User decisions needed for Mission Design drafting, and preserve unresolved decisions as stop conditions when they can affect Mission approach, final output shape, external interface contract, domain or structural model, key tradeoff, risks, assumptions, or change triggers.
- Draft Mission Design only after Mission Spec acceptance and after required design-level Pre-build Design Surface decisions are resolved or explicitly classified as non-blocking, using `references/mission-design.md`, then show 2-3 item chunks, collect revisions, and present a final summary for acceptance.
- After final summary acceptance of the Mission Design, record it through `geas-cli`.
- After the User accepts Mission Design, decide whether a contract-level Pre-build Design Surface is required using `references/pre-build-design-surface.md`.
- If a contract-level Pre-build Design Surface is required, prepare the surface briefing or surface artifact refs, collect the User decisions needed for Task Contract drafting, and preserve unresolved decisions as stop conditions when they can affect Task scope, dependencies, deliverables, acceptance criteria, verification checks, review focus, risk level, or first building Task.
- If a Pre-build Design Surface is skipped, state the baseline level and skip reason in the baseline briefing using the skip conditions in `references/pre-build-design-surface.md`.
- Draft the initial Task Contract Set only after the User accepts Mission Design and after required contract-level Pre-build Design Surface decisions are resolved or explicitly classified as non-blocking, using `references/task-contract.md`. Draft one Task Contract candidate per executable Task, with `task_id`, `depends_on`, and `mission_acceptance_refs` expressing the Set relationship.
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
- Treat Pre-build Design Surface choices as separate review inputs that must be reflected in the owning Mission Design or Task Contract Set drafts before acceptance.
- Do not ask the User to approve one bundle that combines Mission Spec, Mission Design, implementation choices, Task Contract Set, and building entry.
- Preserve draft payloads and open decisions when the User pauses before acceptance.

Briefing:
- For Mission Spec, Mission Design, and Task Contract Set agreement, show 2-3 related items or Task candidates at a time.
- For intake before Mission Spec, show an Intake Sketch when decisions remain: known User facts, unknowns that block drafting, choices that can be offered, and which later artifact would own each decision.
- For Pre-build Design Surface agreement, show the surface purpose, baseline level, refs or preview summary, options presented, decisions requested, selected decisions, and Mission Design or Task Contract implications.
- Each chunk includes current draft, decision to confirm, choices, and next step.
- Treat chunk confirmation as provisional review input, not artifact acceptance.
- After chunk revisions converge, present a final summary and ask whether to accept the whole artifact.
- Attempt `geas-cli` recording only after final summary acceptance.

Stop:
- Preserve the current draft candidate and explain what decision or input is missing.
- Preserve payload and `geas-cli` output when recording fails.
- Do not continue to the next baseline artifact or stage when the previous artifact has not been accepted and recorded, or when a blocking Pre-build Design Surface decision remains unresolved.

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
- User decisions from Pre-build Design Surface briefings
- refs to temporary HTML, diagram, prototype, comparison, or other decision surface artifacts
- relevant Memory

## Resources

| Resource | When to use | Purpose |
| --- | --- | --- |
| `references/intake-interview.md` | before artifact drafting | Elicit concrete goals, scan ambiguity, and prevent premature baseline drafting. |
| `references/mission-spec.md` | Mission Spec draft | Define Mission Spec payload shape and review checks. |
| `references/mission-design.md` | Mission Design draft | Define Mission Design payload shape and boundaries from the Task Contract Set. |
| `references/pre-build-design-surface.md` | after Mission Spec acceptance and before accepting the baseline artifact that would lock the decision | Decide whether to create or skip a temporary decision surface and map selected decisions into Mission Design or Task Contract Set inputs. |
| `references/task-contract.md` | initial Task Contract Set draft | Define Task slicing, acceptance criteria, verification checks, review focus, and Task relationships. |
| `references/baseline-readiness.md` | before building entry | Check accepted baseline and open decisions before execution starts. |

Use the `geas-cli` adapter Skill to record accepted Mission Spec, Mission Design, each Task Contract in the Task Contract Set, and stage transitions. If `geas-cli` does not report success, preserve the payload and stop.

No scripts or assets are required by default. A Pre-build Design Surface may point to temporary HTML, Mermaid, SVG, table, static mockup, or small JS editor artifacts, but those artifacts are decision surfaces rather than runtime records.

## Gotchas

- Do not treat one User approval as acceptance of Mission Spec, Mission Design, Pre-build Design Surface decisions, and Task Contract Set together.
- Do not end intake while readiness checklist items are still ambiguous; ask, offer choices, propose assumptions, or mark non-blocking open decisions first.
- Do not convert broad MVP or product requests into a preferred stack, storage model, deployment model, authentication boundary, offline/sync boundary, data model, or scope-out list before the User confirms those decisions or they are recorded as non-blocking open decisions owned by a later artifact.
- Do not show the whole baseline artifact at once when asking for agreement.
- Do not treat chunk-level confirmation as final artifact acceptance.
- Do not draft Mission Design before Mission Spec is accepted and blocking design-level Pre-build Design Surface decisions are resolved.
- Do not draft the Task Contract Set before Mission Design is accepted and blocking contract-level Pre-build Design Surface decisions are resolved.
- Do not skip a Pre-build Design Surface when unresolved implementation-before-build decisions would affect Mission Design, Task Contract scope, dependencies, deliverables, acceptance criteria, verification checks, review focus, or the first building Task.
- Do not treat a Pre-build Design Surface as runtime artifact, Evidence, User Judgment, or Task Contract source of truth.
- Do not leave selected design decisions only in an HTML, diagram, prototype, comparison, or briefing; reflect them in Mission Design or the Task Contract Set before accepting the owning artifact.
- Do not record drafts before explicit User acceptance.
- Do not let Mission Design become the Task graph source of truth; the Task Contract Set owns task slicing and dependencies.
- Do not write implementation, verification, review, challenge, Task Evidence, or Mission Evidence.
- Do not broaden scope silently when new work appears; surface a baseline revision decision.
- Do not require repo root docs as execution prerequisites for a distributed Skill.

## Stop Conditions

- User goal cannot be turned into a reviewable baseline without another decision.
- Required accepted baseline state is missing for a revision.
- A required Pre-build Design Surface cannot be prepared, read, or briefed well enough for User decision.
- A design-surface decision that affects Mission Design or the Task Contract Set remains unresolved.
- User has not accepted the artifact that would be recorded next.
- `geas-cli` recording does not report success.
- Baseline challenge is required or requested but `challenging` is unavailable.
- The next step would perform Task implementation, role Evidence writing, or User Judgment on behalf of the User.

## Boundary

`specifying` owns baseline drafting and baseline revision coordination. It does not implement tasks, verify outputs, review changes, write role Evidence, decide acceptance, close Missions, or replace User Judgment. Accepted baseline artifacts are recorded only after User acceptance and through `geas-cli`.
