---
name: mission
description: Coordinates Geas Mission work as the user entrypoint start a Mission, recover current state, choose specifying/building/consolidating stage handoffs, and prepare User briefings. Use when the user asks to run, continue, inspect, close, or route a Geas Mission. Do not use for writing role Evidence or performing Task implementation, verification, review, or challenge work.
---

# Mission

## Job

Coordinate Geas Mission work from the User entrypoint. Read the request and runtime state, choose the next stage handoff or stop condition, and keep role output and User Judgment responsibilities separated. Do not turn a broad User request into Mission baseline content, implementation approach, technology choices, storage choices, deployment choices, or scope exclusions from this entrypoint.

## Workflow

Mission Applicability:
- Treat a request as direct work instead of Mission work when it is bounded, local, immediately executable, can be verified within the normal assistant turn, and does not need runtime state or stage handoff.
- Direct work examples include answering a question, editing one small function, fixing a narrow bug or typo, running a single check, or explaining a file.
- Keep Geas basics for direct work: state the working scope when needed, provide verification evidence, and disclose unverified scope.
- Treat a request as Mission work when the User explicitly asks to run, continue, inspect, close, or route a Mission, or when the request needs persistent state, staged contracts, multiple Task units, role handoffs, accumulated Evidence, session recovery, or an explicit User acceptance flow.
- When the User explicitly asks to run a small direct request as a Mission, ask for confirmation before initializing runtime or creating a Mission.

Normal:
- Apply Mission Applicability before checking runtime state.
- Read the User request and decide whether it is Mission work.
- If it is direct work, stop Mission routing and handle the request outside the Mission runtime flow.
- Ask for a User decision when the request could be either a direct answer or a Geas Mission.
- Check runtime status through the `geas-cli` adapter when state is needed.
- If there is no initialized runtime and the User wants Mission work, ask `geas-cli` to initialize runtime storage before creating a Mission.
- Continue after `geas-cli` status, init, or create only when the adapter reports success; otherwise preserve the CLI output and stop.
- If there is no active Mission and the User wants a new Mission, ask `geas-cli` to create one, then hand off to `specifying` after success.
- After creating or finding a Mission, do not propose or ask acceptance for baseline content from `mission`; let `specifying` elicit User-owned facts and draft accepted baselines.
- If `current_stage` is `specifying`, hand off to `specifying` with known baseline refs and the User request.
- If `current_stage` is `building`, hand off to `building` with current Mission and Task refs.
- If `current_stage` is `consolidating`, hand off to `consolidating` with accepted Task Evidence and Mission baseline refs.
- If the User asks to close the Mission and accepted Task Evidence exists, hand off to `consolidating` for Mission acceptance input.
- Return a User briefing that states current state, selected next stage, required decision, or stop condition without filling in the selected stage's baseline, design, contract, or execution decisions.

Handoff:
- Route only to `specifying`, `building`, or `consolidating`.
- Tell the selected stage why it was selected and what User request or runtime state triggered it.
- Pass the User's explicit facts, constraints, and request wording as input; do not add recommended implementation, storage, deployment, access-control, or scope-out assumptions in the handoff.
- Let the selected stage read its own required runtime refs before acting.
- For Task-scoped work, make `building` prepare role handoffs instead of calling role-producing Skills directly here.

User Decision:
- Ask whether to start a Mission when the User explicitly asks to run a too-small request as Mission work or when the request is ambiguous for Mission handling.
- Ask whether to continue, revise baseline, close Mission, or stop when runtime state and User request point to different next actions.
- Present Evidence refs and unverified scope as judgment inputs; do not make the User Judgment.

Stop:
- Preserve the current status output, draft briefing, and intended routing note when available.
- Report missing runtime, unavailable `geas-cli`, unavailable stage Skill, missing baseline state, or unclear User decision.

## Inputs

Required when available:

- User request
- runtime status from `geas-cli`
- active Mission id and current stage
- latest accepted Mission Spec and Mission Design refs
- current Task id, Task State, and Task Contract ref when stage is `building`
- relevant Evidence refs and User Judgment refs

Optional:

- Debt Ledger and Memory refs
- User-provided scope, urgency, constraints, or closure request
- draft routing note from a previous attempt

## Resources

No bundled resources are required in Phase 3. Use the `geas-cli` adapter Skill for runtime status, initialization, and Mission creation. Stage-owned transitions and record attempts belong to the selected stage and still go through `geas-cli`.

## Gotchas

- Do not write Mission Spec, Mission Design, Task Contract, role Evidence, Task Evidence, or Mission Evidence here.
- Do not propose default implementation approaches, technology stacks, storage models, deployment models, access-control boundaries, offline/sync boundaries, or excluded scope after Mission creation; route those decisions to `specifying`.
- Do not treat CLI success, Task State, Run State, Evidence verdict, or recommendation as User Judgment.
- Do not enter `building` without an accepted Mission baseline and current Task Contract path.
- Do not close a Mission or record Mission Evidence before Mission result User Judgment exists.
- Do not call role-producing Skills directly from `mission`; route Task work through `building`.
- Do not require repo root docs as execution prerequisites for a distributed Skill.

## Stop Conditions

- User has not decided whether the request is Mission work.
- Runtime status cannot be read and `geas-cli` is unavailable.
- `geas-cli` status, init, or create does not report success.
- Active state points to a stage Skill that is unavailable.
- Required accepted baseline state is missing.
- User asks to proceed outside the accepted Mission baseline.
- Mission closure is requested but there is no accepted Task Evidence to consolidate.
- Mission closure would skip `consolidating` or attempt to record Mission Evidence before Mission result User Judgment.
- The next action would require writing role output or User Judgment from this entrypoint.

## Boundary

`mission` selects and coordinates the next stage. It does not implement Task changes, verify results, review changes, challenge artifacts, write substantive stage artifacts, or decide acceptance. User Judgment comes from the User, and role-producing output comes from the responsible role Skill.
