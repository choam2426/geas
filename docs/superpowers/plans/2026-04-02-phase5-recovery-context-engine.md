# Phase 5: Recovery and Context Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement session recovery, checkpoint safety, and context restoration so Geas sessions resume from any interruption with full state fidelity.

**Architecture:** New recovery-packet schema captures recovery decisions. Extended run-state schema adds recovery fields. Orchestrating skill gets a structured recovery decision table. Two-phase checkpoint hooks prevent corrupted state. restore-context.sh is enhanced with anti-forgetting guarantees. Session-latest.md and task-focus files provide human-readable context anchors.

**Tech Stack:** Markdown skills, JSON Schema draft 2020-12, Bash hook scripts, Python (in hooks), git

---

## File Structure

| File | Responsibility | Tasks |
|------|---------------|-------|
| `docs/protocol/schemas/recovery-packet.schema.json` | Recovery artifact schema | 1 |
| `plugin/skills/orchestrating/schemas/run-state.schema.json` | Extended run state | 1 |
| `plugin/skills/orchestrating/SKILL.md` | Recovery decision table + stale packet directive | 2 |
| `plugin/skills/initiative/SKILL.md` | session-latest.md + task-focus directives | 3 |
| `plugin/skills/sprint/SKILL.md` | session-latest.md + task-focus directives | 3 |
| `plugin/skills/setup/SKILL.md` | recovery + task-focus directories | 4 |
| `plugin/hooks/scripts/restore-context.sh` | Enhanced restore (L0, session-latest, memory) | 5 |
| `plugin/hooks/scripts/checkpoint-pre-write.sh` | **NEW** — PreToolUse backup | 6 |
| `plugin/hooks/scripts/checkpoint-post-write.sh` | **NEW** — PostToolUse cleanup | 6 |
| `plugin/hooks/scripts/packet-stale-check.sh` | **NEW** — stale packet detection | 6 |
| `plugin/hooks/hooks.json` | 3 new hooks + PreToolUse section | 6 |
| `CLAUDE.md` | Phase 5 complete | 7 |

---

### Task 1: Schemas — recovery-packet + extended run-state

**Goal:** Create recovery-packet schema and extend run-state schema.

**Files:**
- Create: `docs/protocol/schemas/recovery-packet.schema.json`
- Modify: `plugin/skills/orchestrating/schemas/run-state.schema.json`

- [ ] **Step 1: Create recovery-packet.schema.json**

Write to `docs/protocol/schemas/recovery-packet.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "RecoveryPacket",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "version", "artifact_type", "artifact_id", "producer_type", "created_at",
    "recovery_id", "recovery_class", "focus_task_id",
    "detected_problem", "recommended_action",
    "artifacts_found", "artifacts_missing"
  ],
  "properties": {
    "version": { "type": "string", "const": "1.0" },
    "artifact_type": { "type": "string", "const": "recovery_packet" },
    "artifact_id": { "type": "string" },
    "producer_type": { "$ref": "_defs.schema.json#/$defs/agentType" },
    "created_at": { "$ref": "_defs.schema.json#/$defs/isoUtcTimestamp" },
    "recovery_id": { "type": "string", "minLength": 1 },
    "recovery_class": {
      "type": "string",
      "enum": [
        "post_compact_resume",
        "warm_session_resume",
        "interrupted_subagent_resume",
        "dirty_state_recovery",
        "manual_repair_required"
      ]
    },
    "focus_task_id": { "type": ["string", "null"] },
    "detected_problem": { "type": "string", "minLength": 1 },
    "recommended_action": { "type": "string", "minLength": 1 },
    "artifacts_found": {
      "type": "array",
      "items": { "type": "string" }
    },
    "artifacts_missing": {
      "type": "array",
      "items": { "type": "string" }
    },
    "rewind_target": {
      "type": "string",
      "enum": ["ready", "implementing", "reviewed", "integrated"]
    },
    "resolution": { "type": "string" }
  }
}
```

- [ ] **Step 2: Extend run-state.schema.json**

Read `plugin/skills/orchestrating/schemas/run-state.schema.json`. Add three new properties to the `properties` object:

1. `session_latest_path`: `{ "type": ["string", "null"], "default": ".geas/state/session-latest.md" }`
2. `recovery_class`: `{ "type": ["string", "null"], "enum": ["post_compact_resume", "warm_session_resume", "interrupted_subagent_resume", "dirty_state_recovery", "manual_repair_required", null] }`
3. `scheduler_state`: `{ "type": "string", "enum": ["active", "idle", "paused"], "default": "active" }`

Add to the `checkpoint` sub-object:
4. `checkpoint_phase`: `{ "type": "string", "enum": ["pending", "committed"], "default": "committed" }`

- [ ] **Step 3: Commit**

```bash
git add docs/protocol/schemas/recovery-packet.schema.json plugin/skills/orchestrating/schemas/run-state.schema.json
git commit -m "feat: add recovery-packet schema and extend run-state schema"
```

---

### Task 2: Recovery decision table in orchestrating

**Goal:** Add structured recovery logic to orchestrating startup sequence.

**Files:**
- Modify: `plugin/skills/orchestrating/SKILL.md`

- [ ] **Step 1: Add recovery decision table to Step 0**

Find the Startup Sequence Step 0 (~line 108). After the existing three conditions (fresh run, resume, first run) and after Lock Initialization (~line 126), insert a new section:

```markdown
#### Recovery Decision Table

When `run.json` exists with `status: "in_progress"`, classify the recovery:

**Step 1 — Check for interrupted checkpoint:**
- If `.geas/state/_checkpoint_pending` exists → the last run.json write was interrupted. Copy `_checkpoint_pending` to `run.json`. Delete `_checkpoint_pending`. Continue with the restored state.

**Step 2 — Read checkpoint and classify:**

| Condition | Recovery Class | Action |
|-----------|---------------|--------|
| `agent_in_flight` is not null | `interrupted_subagent_resume` | Check if `pending_evidence` files exist. If yes → step completed, remove from `remaining_steps`, proceed to next. If no → re-execute the step (re-spawn the agent). |
| `parallel_batch` is not null | `interrupted_subagent_resume` (batch) | Delegate to `/geas:scheduling` recovery section. Check `completed_in_batch` vs `parallel_batch` to determine remaining tasks. |
| `agent_in_flight` is null, `remaining_steps` is non-empty | `warm_session_resume` | Read `remaining_steps`. Resume from the first remaining step. Read `session-latest.md` for context. |
| `remaining_steps` is empty, task status is not `"passed"` | `dirty_state_recovery` | Artifact consistency check (see below). |

**Step 3 — Artifact consistency check (for dirty_state_recovery):**
1. Read the current task's TaskContract and determine expected artifacts for its state
2. Check each expected artifact exists:
   - All present → task is further along than checkpoint shows. Update `remaining_steps` and continue.
   - Some missing → rewind to last **safe boundary**:
     - After `implementation_contract` approved
     - After implementation evidence verified
     - After `code_review` + `testing` complete
     - After gate pass
     - After closure packet assembled
   - Inconsistent state (conflicting artifacts) → `manual_repair_required`
3. Write `.geas/recovery/{recovery-id}.json` conforming to `docs/protocol/schemas/recovery-packet.schema.json`
4. Update `run.json`: set `recovery_class` field
5. Log: `{"event": "recovery", "recovery_class": "...", "recovery_id": "...", "focus_task_id": "...", "timestamp": "<actual>"}`

**Step 4 — If `manual_repair_required`:**
- Write recovery-packet.json with `detected_problem` and `artifacts_found`/`artifacts_missing`
- Present the situation to the user: "Session state is inconsistent and cannot be automatically recovered. Recovery packet written to .geas/recovery/{id}.json. Manual intervention required."
- Do NOT proceed with the pipeline.

#### Stale Packet Check

After recovery completes and before resuming the pipeline:
1. Check if context packets exist for the focus task at `.geas/packets/{task-id}/`
2. If packets exist: compare their timestamps against the last event in `events.jsonl`
3. If packets are older than the last event → packets are stale. Regenerate by invoking `/geas:context-packet` before spawning the next agent.
4. Also regenerate after: revalidation, rewind, rules.md update, memory state change to under_review/superseded.
```

- [ ] **Step 2: Add session-latest responsibility**

After the recovery decision table, add:

```markdown
#### Session State Maintenance

The orchestrator is responsible for maintaining two context anchors:

1. **`.geas/state/session-latest.md`** — updated after each pipeline step completion. Contains mode, phase, focus task, last/next step, recent events, open risks, memory summary. See initiative/sprint skills for the exact format.

2. **`.geas/state/task-focus/{task-id}.md`** — updated after each step for the focus task. Contains task state, goal, progress, remaining steps, key risks. One file per active task.

These files are consumed by `restore-context.sh` during post-compact recovery.
```

- [ ] **Step 3: Commit**

```bash
git add plugin/skills/orchestrating/SKILL.md
git commit -m "feat: add recovery decision table and stale packet check to orchestrating"
```

---

### Task 3: session-latest.md + task-focus directives in pipelines

**Goal:** Add session-latest.md and task-focus file update directives to initiative and sprint.

**Files:**
- Modify: `plugin/skills/initiative/SKILL.md`
- Modify: `plugin/skills/sprint/SKILL.md`

- [ ] **Step 1: Add session-latest directive to initiative**

Find the step completion directive in initiative (~line 153, after "remove it from the front of the array and update run.json"). After the event logging block (~line 159), add:

```markdown
- **[MANDATORY] Session state update**: After each step completes and is logged, update the session context anchors:

  Write `.geas/state/session-latest.md`:
  ```markdown
  # Session State — {timestamp}

  **Mode:** {initiative}
  **Phase:** {current phase: discovery | build | polish | evolution}
  **Focus Task:** {task-id} — {title}
  **Task State:** {current state from task contract}
  **Last Step:** {step just completed}
  **Next Step:** {first item in remaining_steps, or "phase transition"}

  ## Recent Events
  - {last 3 events from .geas/ledger/events.jsonl}

  ## Open Risks
  - {from closure packet open_risks, or "none yet"}

  ## Active Memory
  - {count} active memory entries, {count} under review
  ```

  Write `.geas/state/task-focus/{task-id}.md`:
  ```markdown
  # {task-id}: {title}

  **State:** {current state}
  **Goal:** {from task contract}
  **Pipeline Progress:** {completed steps count} / {total steps count}
  **Last Step:** {step name} — {outcome}
  **Remaining:** {remaining_steps as comma-separated list}
  **Key Risks:** {from worker self-check known_risks or open_risks, or "none"}
  ```
```

- [ ] **Step 2: Add session-latest directive to sprint**

Find the step completion directive in sprint (~line 37, after "remove it from the front of the array and update run.json"). After the event logging block (~line 57), add the same directive as initiative (identical content, with `**Mode:** {sprint}` instead of `{initiative}`).

- [ ] **Step 3: Commit**

```bash
git add plugin/skills/initiative/SKILL.md plugin/skills/sprint/SKILL.md
git commit -m "feat: add session-latest.md and task-focus update directives to pipelines"
```

---

### Task 4: Setup — recovery and task-focus directories

**Goal:** Add recovery and task-focus directories to initial setup.

**Files:**
- Modify: `plugin/skills/setup/SKILL.md`

- [ ] **Step 1: Update mkdir command**

Find the mkdir command (~line 19). Add `.geas/recovery .geas/state/task-focus` to the end:

The updated command should include:
```bash
mkdir -p .geas/spec .geas/state .geas/tasks .geas/contracts .geas/packets .geas/evidence .geas/decisions .geas/decisions/pending .geas/ledger .geas/summaries .geas/memory/_project .geas/memory/retro .geas/memory/agents .geas/memory/candidates .geas/memory/entries .geas/memory/logs .geas/recovery .geas/state/task-focus
```

- [ ] **Step 2: Commit**

```bash
git add plugin/skills/setup/SKILL.md
git commit -m "feat: add recovery and task-focus directories to setup"
```

---

### Task 5: Enhance restore-context.sh

**Goal:** Upgrade restore-context.sh with session-latest.md injection, anti-forgetting L0 guarantees, and memory state summary.

**Files:**
- Modify: `plugin/hooks/scripts/restore-context.sh`

- [ ] **Step 1: Read and rewrite restore-context.sh**

Read the current `plugin/hooks/scripts/restore-context.sh` (~81 lines). Rewrite the Python section to add three new capabilities:

1. **session-latest.md injection**: Read `.geas/state/session-latest.md` if it exists, include its content in the restore output.

2. **Anti-forgetting L0 guarantee** (7 items from doc 10 that must ALWAYS be restored):
   - Mode and phase
   - Focus task state (id, title, current state)
   - Rewind reason (if recovery_class is set in run.json)
   - Required next artifact (first item in remaining_steps)
   - Open risks (from latest closure packet or "none")
   - Recovery outcome (if recovery_class is set)
   - 1-3 active rules from rules.md (first 10 lines) + 1-3 memory summaries from memory-index

3. **Memory state summary**: Read `.geas/state/memory-index.json`, count entries by state (active, under_review, decayed).

The enhanced script should:
- Keep all existing functionality (run.json state, checkpoint, task contract, rules)
- Add session-latest.md content (if file exists)
- Add memory state counts
- Add explicit L0 section header "## L0 Anti-Forgetting (always preserved)" marking the 7 items
- Output format remains JSON with `additionalContext` field

- [ ] **Step 2: Commit**

```bash
git add plugin/hooks/scripts/restore-context.sh
git commit -m "feat: enhance restore-context.sh with L0 anti-forgetting and memory state"
```

---

### Task 6: Hook scripts — two-phase checkpoint + packet stale

**Goal:** Create 3 new hook scripts and register them.

**Files:**
- Create: `plugin/hooks/scripts/checkpoint-pre-write.sh`
- Create: `plugin/hooks/scripts/checkpoint-post-write.sh`
- Create: `plugin/hooks/scripts/packet-stale-check.sh`
- Modify: `plugin/hooks/hooks.json`

- [ ] **Step 1: Create checkpoint-pre-write.sh**

```bash
#!/usr/bin/env bash
# checkpoint-pre-write.sh — backup run.json before write (two-phase checkpoint)
# Trigger: PreToolUse on Write matching .geas/state/run.json

set -euo pipefail

TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"

if [[ "$TOOL_INPUT" != *".geas/state/run.json"* ]]; then
  exit 0
fi

RUN_FILE=".geas/state/run.json"
PENDING_FILE=".geas/state/_checkpoint_pending"

if [[ -f "$RUN_FILE" ]]; then
  cp "$RUN_FILE" "$PENDING_FILE"
fi
```

- [ ] **Step 2: Create checkpoint-post-write.sh**

```bash
#!/usr/bin/env bash
# checkpoint-post-write.sh — cleanup pending checkpoint after successful write
# Trigger: PostToolUse on Write matching .geas/state/run.json

set -euo pipefail

TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"

if [[ "$TOOL_INPUT" != *".geas/state/run.json"* ]]; then
  exit 0
fi

PENDING_FILE=".geas/state/_checkpoint_pending"

if [[ -f "$PENDING_FILE" ]]; then
  rm "$PENDING_FILE"
fi
```

- [ ] **Step 3: Create packet-stale-check.sh**

```bash
#!/usr/bin/env bash
# packet-stale-check.sh — warn when context packets may be stale
# Trigger: PostToolUse on Write matching .geas/state/run.json

set -euo pipefail

TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"

if [[ "$TOOL_INPUT" != *".geas/state/run.json"* ]]; then
  exit 0
fi

RUN_FILE=".geas/state/run.json"
if [[ ! -f "$RUN_FILE" ]]; then
  exit 0
fi

python3 -c "
import json, os, glob

run = json.load(open('$RUN_FILE'))
checkpoint = run.get('checkpoint', {})
task_id = run.get('current_task_id', '')
recovery = run.get('recovery_class')

if not task_id:
    exit()

# Check if packets exist for this task
packets = glob.glob(f'.geas/packets/{task_id}/*.md')
if not packets:
    exit()

# Check if there's a rewind or recovery (staleness triggers)
step = checkpoint.get('pipeline_step', '')
remaining = checkpoint.get('remaining_steps', [])

# Warn if recovery class is set (session resumed — packets likely stale)
if recovery:
    print(f'Warning: STALE PACKETS: Session recovered ({recovery}). Context packets for {task_id} may be stale. Regenerate before spawning agents.')

# Warn if remaining_steps changed length significantly (rewind happened)
# This is a heuristic — exact staleness detection requires timestamp comparison
" 2>/dev/null
```

- [ ] **Step 4: Make scripts executable**

```bash
chmod +x plugin/hooks/scripts/checkpoint-pre-write.sh
chmod +x plugin/hooks/scripts/checkpoint-post-write.sh
chmod +x plugin/hooks/scripts/packet-stale-check.sh
```

- [ ] **Step 5: Register hooks in hooks.json**

Read `plugin/hooks/hooks.json`. Make these changes:

1. Add a new **`PreToolUse`** section (this event type is not yet used). Add it before the existing `PostToolUse` section:
   ```json
   "PreToolUse": [
     {
       "matcher": "Write",
       "hooks": [
         {
           "type": "command",
           "command": "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/checkpoint-pre-write.sh",
           "timeout": 10
         }
       ]
     }
   ],
   ```

2. Add `checkpoint-post-write.sh` and `packet-stale-check.sh` to the existing `PostToolUse` `"Write|Edit"` matcher's hooks array:
   ```json
   {
     "type": "command",
     "command": "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/checkpoint-post-write.sh",
     "timeout": 10
   },
   {
     "type": "command",
     "command": "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/packet-stale-check.sh",
     "timeout": 10
   }
   ```

- [ ] **Step 6: Commit**

```bash
git add plugin/hooks/scripts/checkpoint-pre-write.sh plugin/hooks/scripts/checkpoint-post-write.sh plugin/hooks/scripts/packet-stale-check.sh plugin/hooks/hooks.json
git commit -m "feat: add two-phase checkpoint hooks and packet stale detection"
```

---

### Task 7: CLAUDE.md update

**Goal:** Update CLAUDE.md for Phase 5 completion.

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update completed phases and current phase**

Find the "Completed phases" and "Current phase" sections. Update:

```markdown
### Completed phases

- **Phase 1 (Minimum Enforceable State)**: 7-state task model, worker self-check, gate/verdict separation, closure packet, critical reviewer, debate→decision rename
- **Phase 2 (Baseline, Stale, Parallelism)**: revalidation-record/lock-manifest schemas, staleness detection, lock lifecycle, safe parallel conditions, compass→orchestrating + parallel-dispatch→scheduling renames
- **Phase 3 (Evolution Core)**: structured retrospective (after Resolve, Ship only), rules-update workflow, debt-register.json, gap-assessment.json, phase-review wiring, evolution exit gate, Sprint Wrap-Up
- **Phase 4 (Memory Core)**: memorizing skill (9-state lifecycle, 6-stage promotion), memory retrieval scoring in context-packet, application logging, memory-index, memory hooks
- **Phase 5 (Recovery and Context Engine)**: recovery-packet schema, extended run-state, recovery decision table, session-latest.md + task-focus maintenance, two-phase checkpoint hooks, enhanced restore-context.sh with L0 anti-forgetting

### Current phase: Phase 6 — Refinement

Priority items:
1. Conformance suite automation
2. Chaos exercises (5 scenarios)
3. Memory review cadence tooling
4. Policy registry tuning
5. Debt/gap dashboard
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for Phase 5 — recovery, Phase 6 current"
```

---

## Verification Checklist

After all 7 tasks complete:

- [ ] `docs/protocol/schemas/recovery-packet.schema.json` exists with 5 recovery classes
- [ ] `run-state.schema.json` has `session_latest_path`, `recovery_class`, `scheduler_state`, `checkpoint_phase`
- [ ] Orchestrating has recovery decision table with 4-step logic
- [ ] Orchestrating has stale packet check directive
- [ ] Initiative has session-latest.md + task-focus update directive after step completion
- [ ] Sprint has the same directives
- [ ] Setup creates `.geas/recovery` and `.geas/state/task-focus` directories
- [ ] restore-context.sh includes session-latest.md, L0 anti-forgetting, memory state
- [ ] `checkpoint-pre-write.sh` exists (PreToolUse) — backs up run.json
- [ ] `checkpoint-post-write.sh` exists (PostToolUse) — removes backup
- [ ] `packet-stale-check.sh` exists — warns on stale packets after recovery
- [ ] hooks.json has new `PreToolUse` section + 2 new PostToolUse entries
- [ ] CLAUDE.md shows Phase 5 completed, Phase 6 current
