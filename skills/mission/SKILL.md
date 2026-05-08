---
name: mission
description: "Mission entrypoint and stage orchestrator. Use to start or resume a Mission, inspect runtime state, coordinate specifying, building, and consolidating stage skills, prepare User briefings, and close Missions with Evidence for User Judgment."
---

# Mission

Use this skill as the single Geas User entrypoint and Orchestrator procedure.

Mission owns state inspection, User briefing, stage dispatch, Mission closure, and the boundary between agent-side Evidence and User Judgment.

## Core Rules

- Start by inspecting context; do not dispatch from stale memory.
- Treat `run-state.yaml`, Mission baselines, Task Contract, Evidence, and User Judgment as the recovery basis.
- Keep runtime writes behind the Geas CLI.
- Use prompt-level handoff to internal skills and role prompts; product-specific plugin dispatch belongs to packaging.
- Present decisions, tradeoffs, unverified scope, and remaining risk to the User.
- Record User Judgment only from the User's decision.

## Workflow

1. Inspect runtime and workspace.
   - If `.geas/` is absent and the User wants Geas Mission work, run `geas init`.
   - If a Mission is active, read current run state, latest Mission Spec, latest Mission Design, current Task State, current Task Contract, relevant Evidence, User Judgment, and Memory.
   - Use `references/dispatch.md` for continuity and drift checks.

2. Brief the User.
   - Use `references/briefings.md`.
   - Name the current Mission stage or state.
   - Name the next intended procedure.
   - Surface decisions or drift before doing more work.

3. Dispatch the next procedure.
   - Use `specifying` for Mission baseline formation or baseline revision.
   - Use `building` for the building-stage Task loop.
   - Use `consolidating` for Mission-level judgment input.
   - Use role prompts from `agents/` when a separate role pass materially improves Evidence quality.

4. Let `building` own Task closure.
   - Task phase dispatch, Task Judgment briefing, Task result User Judgment, Task Evidence, task-end git checkpointing, and next Task selection happen in `building`.
   - Mission remains responsible for returning to `specifying` or `consolidating` when the stage-level runtime state requires it.

5. Close Mission when the User has judged the Mission result.
   - Use `references/mission-closure.md`.
   - Record Mission result User Judgment.
   - Record accepted Memory updates before Mission Evidence when applicable.
   - Record Mission Evidence.

## Internal Procedure Order

```text
specifying -> building -> consolidating -> Mission User Judgment -> Mission Evidence
```

Task loop:

```text
building dispatches implementation -> verification -> review -> optional challenge -> User Judgment -> Task Evidence
```

## References

- `references/dispatch.md`: Select and hand off to internal procedure skills.
- `references/briefings.md`: Prepare User-facing Mission and Task briefings.
- `references/mission-closure.md`: Prepare Mission closure after Mission User Judgment.
- `references/session-handoff.md`: Prepare specifying-to-building session handoffs.
