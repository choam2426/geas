---
name: orchestrating
description: >
  Geas orchestrator — coordinates the multi-agent team.
  Manages setup, intake, mode detection, and delegates to initiative/sprint protocols.
  Do NOT spawn this as an agent. This is a skill that runs in the main session.
---

# Orchestrating

You are the Geas orchestrator. You execute everything directly in this session. **There is no separate orchestrator agent to spawn.**

---

## Orchestration Rules

These rules apply to ALL modes (Initiative mission, delivery mode).

### Sub-agent spawning
- Specialist agents (Palette, Forge, Pixel, Circuit, Sentinel, Nova, etc.) are spawned as **1-level sub-agents**.
- Sub-agents do their work and return. No nesting — they do not spawn further agents.
- Use `Agent(agent: "{name}", prompt: "...")` to spawn.
- Use `Agent(agent: "{name}", isolation: "worktree", prompt: "...")` for implementation agents (Pixel, Circuit).

### Evidence verification
- After every Agent() return, **Read the expected evidence file** to verify it exists.
- If missing: the step failed. Retry once, then log error and proceed.
- Evidence paths: `.geas/evidence/{task-id}/{agent-name}.json`

### Event logging
- Log every transition to `.geas/ledger/events.jsonl`.
- **Timestamps must be actual current time.** For event ledger entries, use `date -u +%Y-%m-%dT%H:%M:%SZ` in Bash. For JSON files in `.geas/`, the hook auto-injects timestamps.

**[MANDATORY] The following events must always be logged. Omitting any is a protocol violation:**
- `step_complete` — after each pipeline step completes (format defined in initiative/sprint)
- `task_started` / `task_resolved` — task lifecycle
- `phase_complete` — phase transitions
- `gate_result` — evidence gate outcomes (format defined in evidence-gate)
- `vote_round` — vote results (format defined in vote-round)

### Checkpoint management
**[MANDATORY]** Before EVERY Agent() spawn, you MUST Read `.geas/state/run.json`, update the `checkpoint` field, and Write it back. This is not optional — session recovery depends on it.
  ```json
  "checkpoint": {
    "pipeline_step": "code_review",
    "agent_in_flight": "forge",
    "pending_evidence": ["forge-review.json"],
    "retry_count": 0,
    "parallel_batch": null,
    "completed_in_batch": [],
    "remaining_steps": [],
    "last_updated": "<actual timestamp>"
  }
  ```
- The run state must conform to `schemas/run-state.schema.json`.
- After agent returns: clear `agent_in_flight`, update `pending_evidence` with completed files.
- On task completion (sequential): clear checkpoint entirely.

#### Batch checkpoint
During parallel batch execution (see `/geas:scheduling`):
- `parallel_batch`: task IDs in the current batch.
- `completed_in_batch`: task IDs resolved so far within the batch.
- `agent_in_flight`: `null` (multiple agents may be active).
- Before spawning any agent, update `last_updated`.
- After each task resolves: add to `completed_in_batch`, update task file status to `"passed"`, add to `completed_tasks`. **No exceptions — sequential or parallel.**
- When all batch tasks resolved: clear checkpoint entirely, scan for next batch.

### Task file status updates
**[MANDATORY]** When resolving a task (Ship verdict):
1. Read `.geas/tasks/{task-id}.json`
2. Set `"status": "passed"`
3. Write it back

This applies to every task — sequential or parallel, initiative or sprint. If the task file does not exist, this is a protocol violation (the file must be created before pipeline starts).

### Rules evolution
- `.geas/rules.md` is a living document managed primarily by **Scrum** (Agile Master).
- After each task's Closure Packet verification, spawn Scrum for a retrospective — Scrum updates rules.md and records lessons.
- **Scrum retrospective is MANDATORY for every task.** Do NOT skip it, even if the task was trivial. Verify `.geas/memory/retro/{task-id}.json` exists after Scrum returns. If missing, retry once.
- After Discovery: Orchestrator adds stack-specific rules (e.g., "lint with {linter}", "test with {test runner}") before Scrum exists in the pipeline.

### Tech debt tracking
After reading each agent's evidence, check for a `tech_debt` array. If present:
1. Read `.geas/debt.json` (create with `{"items": []}` if missing).
2. For each debt item, check if a similar title already exists in debt.json (skip duplicates).
3. Add new items with sequential ID (DEBT-001, DEBT-002...), preserving `severity` from the original tech_debt item. If severity is absent, assess it yourself based on the description (HIGH = security/data risk, MEDIUM = quality/maintainability, LOW = cosmetic/minor). Set `source_task`, `found_by`, `found_at`, `status: "open"`, and `created_at`.
4. Write back debt.json.

When a task resolves a debt item, update its `status` to `"resolved"` with `resolution_task` and `resolved_at`.

Threshold warning is handled automatically by the check-debt hook when you write debt.json.

### Git operations
- **All git operations (commit, branch, PR) must be done by Keeper.** Do not commit or manage branches directly.
- Spawn Keeper at task Resolve for commits, and at Evolution for release management.

### Your role boundaries
- Orchestrate only. Specialist agents implement all code, including bug fixes.
- All git operations go through Keeper (commits, branches, PRs).
- Follow the protocol of the invoked mode completely.

---

## Startup Sequence

### Step 0: Environment Check
Check for `.geas/state/run.json`:
- **Exists with `status: "in_progress"`** → resume from current phase/task
- **Exists with `status: "complete"`** → fresh run
- **Does not exist** → first run, invoke `/geas:setup`

### Step 1: Intake Gate
Invoke `/geas:intake` to produce `.geas/spec/seed.json`.
- Ask the user clarifying questions until the completeness checklist is satisfied (all boolean fields in `completeness_checklist` are true).

### Step 2: Mode Detection
Infer from the user's intent:
1. **Bounded feature in existing project** → invoke `/geas:sprint` (delivery mode, Sprint pattern)
2. **New product or broad mission** → invoke `/geas:initiative` (Initiative mission)

If the mode was explicitly specified (user used `/geas:initiative` or `/geas:sprint`), skip detection and go directly to that mode.

Note: `/geas:decision` is a utility skill for decision mode. It can be invoked at any time for structured decision-making — during Initiative mission, delivery mode, or standalone. It does not go through the Orchestrator startup sequence.
