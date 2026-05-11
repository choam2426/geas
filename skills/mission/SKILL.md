---
name: mission
description: "Mission entrypoint and stage coordinator. Use to start or resume a Mission, inspect runtime state, coordinate available specifying, building, and consolidating stage procedures, prepare User briefings, and close Missions with Evidence for User Judgment."
---

# Mission

Use this skill as the single Geas User entrypoint and stage coordination procedure.

Mission owns state inspection, User briefing, stage dispatch, Mission closure, and the boundary between agent-side Evidence and User Judgment.

## Core Rules

- Start by inspecting context; do not dispatch from stale memory.
- Treat `run-state.yaml`, Mission baselines, Task Contract, Evidence, and User Judgment as the recovery basis.
- Before any runtime write, load `geas-cli` and follow its bundled script invocation rule.
- Keep runtime writes behind the Geas CLI; do not invoke a bare `geas` command or hand-edit `.geas/` runtime artifacts.
- If the CLI or required procedure is unavailable, prepare the draft or handoff packet that would be recorded, brief the unavailable capability, and wait for caller/User direction instead of inventing a runtime write.
- Use prompt-level handoff to internal skills and role prompts; product-specific plugin dispatch belongs to packaging.
- At each role-producing step, decide `role_required`, `role_optional`, or `role_omitted` from `references/dispatch.md`.
- When a role pass is required or chosen, hand off with the role prompt and procedure skill; Mission receives the role output instead of producing it directly.
- Include `read_first` artifact paths in every role handoff. The role must read those paths before producing output.
- Present decisions, tradeoffs, unverified scope, and remaining risk to the User.
- Record User Judgment only from the User's decision.

## Workflow

1. Inspect runtime and workspace.
   - If `.geas/` is absent and the User wants Geas Mission work, run the CLI surface command `geas init` through `geas-cli`.
   - If a Mission is active, read current run state, latest Mission Spec, latest Mission Design, current Task State, current Task Contract, relevant Evidence, User Judgment, and Memory.
   - Use `references/dispatch.md` for continuity and drift checks.

2. Brief the User.
   - Use `references/briefings.md`.
   - Name the current Mission stage or state.
   - Name the next intended procedure.
   - Surface decisions or drift before doing more work.

3. Dispatch the next procedure.
   - Use an available specifying procedure for Mission baseline formation or baseline revision.
   - Use an available building procedure for the building-stage Task loop.
   - Use an available consolidating procedure for Mission-level judgment input.
   - If the required procedure is unavailable, prepare a prompt-level handoff packet and brief the User on the missing capability.
   - Use role prompts from `references/agents/` only through an explicit role invocation decision.

4. Let the building procedure own Task closure when available.
   - Task phase dispatch, Task Judgment briefing, Task result User Judgment, Task Evidence, task-end git checkpointing, and next Task selection happen in the building procedure.
   - Mission remains responsible for returning to baseline revision or consolidation when the stage-level runtime state requires it.

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
