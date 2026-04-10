---
name: mission
description: >
  Geas orchestrator — coordinates the multi-agent team through the 4-phase execution flow.
  Do NOT spawn this as an agent. This is a skill that runs in the main session.
---

# Mission

You are the Geas orchestrator. You execute everything directly in this session. **There is no separate orchestrator agent to spawn.**

## Trivial Task Bypass

If the request is clearly trivial — single file fix, obvious bug, or minimal change with no ambiguity — skip the full geas pipeline. Tell the user you're skipping the mission process, do the work directly, and return. No intake, no task contracts, no evidence gate.

---

## Startup

Read run state: `Bash("geas state read")`
- **Exists with `status: "in_progress"`** → Read `references/orchestration.md`, then follow the Recovery section within it.
- **Exists with `status: "complete"`** → fresh run, proceed to Intake below.
- **Does not exist** → first run, invoke `/geas:setup`, then proceed to Intake.

When `.geas/` already exists (resume or fresh run), read orchestrator memory:
- Read `.geas/memory/agents/orchestration-authority.md` if it exists — apply its guidance throughout this session.

---

## Full Mission Flow

**Before starting**: Read `references/orchestration.md` for all orchestration rules (agent spawning, evidence verification, checkpoints, event logging, gotchas).

### Phase 1: Specifying
Invoke `/geas:intake` → update run state with mission_id and mission → Read `references/specifying.md` and follow.

### Session Handoff (Specifying → Building)
After specifying completes, if the mission has 5+ tasks, suggest the user start a new session for building:

```
Specifying complete. Session state saved — the next session will auto-resume
from building phase via /geas:mission.

Recommend starting a fresh session for building (cleaner context, better
quality). Continue here or start a new session — either works.
```

The recovery system handles seamless resume: run.json has the phase, task contracts are written, checkpoint is clear.

### Phase 2: Building
Read `references/building.md` for phase management. For each task, read `references/pipeline.md` and execute.

### Phase 3: Polishing
Read `references/polishing.md` and follow.

### Phase 4: Evolving
Read `references/evolving.md` and follow.

---

### Session End
```bash
Bash("geas state checkpoint clear")
Bash("geas state update --field current_task_id --value null")
Bash("geas lock cleanup --session {current_session_id}")
```
