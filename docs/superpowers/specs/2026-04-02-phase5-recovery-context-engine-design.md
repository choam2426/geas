# Phase 5: Recovery and Context Engine — Design Spec

## Goal

Implement session recovery, checkpoint safety, and context restoration so that Geas sessions can resume from any interruption point with full state fidelity.

## Scope

### In scope
- New schema: `recovery-packet.schema.json`
- Extended `run-state.schema.json` (add recovery fields, scheduler_state, checkpoint_phase)
- Recovery decision table in orchestrating skill (5 recovery classes)
- session-latest.md + task-focus files maintenance (LLM-written, per step)
- restore-context.sh enhancement (anti-forgetting L0, session-latest, memory state)
- Two-phase checkpoint hook (PreToolUse + PostToolUse)
- Packet stale detection hook + orchestrating stale check directive
- Setup update (recovery + task-focus directories)

### Out of scope
- Phase 6 conformance suite automation
- Phase 6 chaos exercises (will USE recovery but not implemented here)
- Extended `run.json` protocol-level schema (keeping it as skill-local schema)

## Reference

- `docs/protocol/10_SESSION_RECOVERY_AND_RESUMABILITY.md`
- `docs/protocol/11_RUNTIME_ARTIFACTS_AND_SCHEMAS.md`
- `docs/protocol/04_BASELINE_WORKTREE_SCHEDULER_AND_PARALLELISM.md` (edge case 3: worktree recovery)

---

## 1. New Schema: recovery-packet.schema.json

Location: `docs/protocol/schemas/recovery-packet.schema.json`
Artifact location: `.geas/recovery/{recovery-id}.json`

Fields (from doc 10):
- Common meta: version, artifact_type "recovery_packet", artifact_id, producer_type, created_at
- `recovery_id`: unique identifier
- `recovery_class`: `post_compact_resume | warm_session_resume | interrupted_subagent_resume | dirty_state_recovery | manual_repair_required`
- `focus_task_id`: task being worked on when recovery triggered
- `detected_problem`: description of what was detected
- `recommended_action`: what the recovery procedure suggests
- `artifacts_found[]`: artifacts confirmed present
- `artifacts_missing[]`: artifacts confirmed absent
- `rewind_target`: state to rewind to (optional — only for dirty_state)
- `resolution`: what was actually done (optional — filled after recovery)

---

## 2. Extended run-state.schema.json

Location: `plugin/skills/orchestrating/schemas/run-state.schema.json` (skill-local)

Add to existing schema:
- `session_latest_path`: string (path to session-latest.md, default `.geas/state/session-latest.md`)
- `recovery_class`: enum (same as recovery-packet) or null (clean session)
- `scheduler_state`: `active | idle | paused` (from doc 04 edge case 1)
- In checkpoint object, add `checkpoint_phase`: `pending | committed`

---

## 3. Recovery Decision Table (orchestrating/SKILL.md)

Update Startup Sequence Step 0 with structured recovery logic:

```
1. Check for _checkpoint_pending file:
   └─ Exists → interrupted write. Restore run.json from _checkpoint_pending. Delete pending.

2. Read .geas/state/run.json:
   └─ Doesn't exist → fresh session (invoke setup)
   └─ status = "complete" → completed mission, await new work
   └─ status = "in_progress" → classify recovery:

3. Classify recovery class:
   ├─ agent_in_flight != null → interrupted_subagent_resume
   │   ├─ Check pending_evidence files exist → step completed, remove from remaining_steps
   │   └─ pending_evidence missing → re-execute step (spawn agent again)
   │
   ├─ parallel_batch != null → batch recovery (delegate to scheduling skill)
   │
   └─ agent_in_flight == null → warm_session_resume
       └─ Read remaining_steps → resume from first remaining step

4. Artifact consistency check:
   ├─ Read task contract, check expected artifacts for current state
   ├─ All present → continue from next step
   ├─ Some missing → rewind to last safe boundary
   └─ Inconsistent state → dirty_state_recovery
       ├─ Recoverable → write recovery-packet.json, rewind
       └─ Not recoverable → manual_repair_required

5. Write recovery-packet.json to .geas/recovery/{recovery-id}.json
6. Read session-latest.md for context restoration
7. Resume pipeline
```

**Safe boundaries** (from doc 10): step transitions where all artifacts from the previous step are confirmed written. Safe boundaries are: after implementation_contract approved, after implementation evidence verified, after code_review + testing complete, after gate pass, after closure packet assembled.

---

## 4. session-latest.md + task-focus Maintenance

### session-latest.md

Written by LLM (orchestrator) after each step completion. Location: `.geas/state/session-latest.md`

Content:
```markdown
# Session State — {timestamp}

**Mode:** {initiative | sprint}
**Phase:** {discovery | build | polish | evolution}
**Focus Task:** {task-id} — {title}
**Task State:** {current state}
**Last Step:** {completed step name}
**Next Step:** {next from remaining_steps, or "none"}

## Recent Events
- {last 3 events from events.jsonl}

## Open Risks
- {from closure packet or task contract, or "none"}

## Active Memory
- {count} active entries, {count} under review
```

### task-focus files

Written after each step for the current task. Location: `.geas/state/task-focus/{task-id}.md`

Content:
```markdown
# {task-id}: {title}

**State:** {current state}
**Goal:** {from task contract}
**Pipeline Progress:** {completed steps} / {total steps}
**Last Step:** {step name} — {outcome}
**Remaining:** {remaining_steps list}
**Key Risks:** {from self-check or open_risks}
```

For multi-task (parallel dispatch): each task in batch gets its own task-focus file.

### Where to add directives

- initiative/SKILL.md: after each step completion, before removing from remaining_steps: "Write session-latest.md and task-focus file"
- sprint/SKILL.md: same
- orchestrating/SKILL.md: document the format and responsibility

---

## 5. restore-context.sh Enhancement

Current: reads run.json, outputs basic state.
Enhanced with:

1. **session-latest.md injection**: if `.geas/state/session-latest.md` exists, include its content
2. **Anti-forgetting L0 guarantee** (doc 10 — 7 items always preserved):
   - Mode and phase
   - Focus task state
   - Rewind reason (if any)
   - Required next artifact
   - Open risks
   - Recovery outcome (if recovering)
   - 1-3 active rules or memories from rules.md + memory-index
3. **Memory state summary**: count of active/under_review/decayed entries from memory-index.json
4. **Recovery class note**: if run.json has recovery_class set, include it in the restore

---

## 6. Two-Phase Checkpoint Hook

Two scripts working together:

### checkpoint-pre-write.sh
- Trigger: **PreToolUse** on Write matching `.geas/state/run.json`
- Logic: if `run.json` exists, copy to `.geas/state/_checkpoint_pending`
- Purpose: backup before write (in case write is interrupted)

### checkpoint-post-write.sh
- Trigger: **PostToolUse** on Write matching `.geas/state/run.json`
- Logic: delete `.geas/state/_checkpoint_pending` if it exists
- Purpose: cleanup after successful write

Recovery (in orchestrating startup): if `_checkpoint_pending` exists, the last write was interrupted. Restore run.json from `_checkpoint_pending`.

Registration in hooks.json:
- New `PreToolUse` section (first use of this event type)
- Add to existing `PostToolUse` Write|Edit matcher

---

## 7. Packet Stale Detection Hook

### packet-stale-check.sh
- Trigger: PostToolUse on Write matching `.geas/state/run.json`
- Logic: if run.json checkpoint changed (rewind, revalidation, etc.), check if context packets exist for the focus task. If packets are older than the last event, warn.
- Output: warning about stale packets

### Orchestrating directive
Add to orchestrating/SKILL.md: "After session resume, revalidation, or rewind: check if existing context packets for the focus task are stale. If stale, regenerate by invoking context-packet skill before spawning the next agent."

---

## 8. Setup Update

Add to mkdir command:
- `.geas/recovery`
- `.geas/state/task-focus`

---

## 9. Affected Files Summary

| File | Change |
|------|--------|
| `docs/protocol/schemas/recovery-packet.schema.json` | **NEW** |
| `plugin/skills/orchestrating/schemas/run-state.schema.json` | Extended |
| `plugin/skills/orchestrating/SKILL.md` | Recovery decision table, session-latest docs, stale packet directive |
| `plugin/skills/initiative/SKILL.md` | session-latest.md + task-focus update directives |
| `plugin/skills/sprint/SKILL.md` | session-latest.md + task-focus update directives |
| `plugin/skills/setup/SKILL.md` | recovery + task-focus directories |
| `plugin/hooks/scripts/restore-context.sh` | Enhanced (session-latest, L0, memory) |
| `plugin/hooks/scripts/checkpoint-pre-write.sh` | **NEW** (PreToolUse) |
| `plugin/hooks/scripts/checkpoint-post-write.sh` | **NEW** (PostToolUse) |
| `plugin/hooks/scripts/packet-stale-check.sh` | **NEW** |
| `plugin/hooks/hooks.json` | 3 new hooks + new PreToolUse section |
| `CLAUDE.md` | Phase 5 complete, Phase 6 current |
