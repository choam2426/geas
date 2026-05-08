---
name: mission
description: "Mission entrypoint and orchestrator. Use to start or resume a Mission, inspect runtime state, coordinate internal procedure skills, prepare User briefings, and close Tasks or Missions with Evidence for User Judgment."
---

# Mission

Use this skill as the single Geas User entrypoint and Orchestrator procedure.

Mission owns state inspection, User briefing, procedure dispatch, Task closure, Mission closure, and the boundary between agent-side Evidence and User Judgment.

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
   - Use `implementing`, `verifying`, `reviewing`, and optionally `challenging` during building.
   - Use `consolidating` for Mission-level judgment input.
   - Use role prompts from `agents/` when a separate role pass materially improves Evidence quality.

4. Close Task when the User has judged the Task result.
   - Use `references/task-closure.md`.
   - Record `geas judgment record --target task-result --task <task-id> --from <path|->`.
   - If accepted, record `geas task evidence record --task <task-id> --kind task --from <path|->`.
   - If revise, route to the appropriate Task phase or baseline update.

5. Close Mission when the User has judged the Mission result.
   - Use `references/mission-closure.md`.
   - Record Mission result User Judgment.
   - Record accepted Memory updates before Mission Evidence when applicable.
   - Record Mission Evidence.

## Internal Procedure Order

```text
specifying -> building task loop -> consolidating -> Mission User Judgment -> Mission Evidence
```

Task loop:

```text
implementation -> verification -> review -> optional challenge -> User Judgment -> Task Evidence
```

## References

- `references/dispatch.md`: Select and hand off to internal procedure skills.
- `references/briefings.md`: Prepare User-facing Mission and Task briefings.
- `references/task-closure.md`: Prepare Task closure after Task User Judgment.
- `references/mission-closure.md`: Prepare Mission closure after Mission User Judgment.
