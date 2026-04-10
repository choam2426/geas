# Orchestration Rules

These rules apply throughout all phases of the 4-phase execution flow.

### Sub-agent spawning
- Specialist agents (design-authority, implementer, quality-specialist, product-authority, etc.) are spawned as **1-level sub-agents**.
- Sub-agents do their work and return. No nesting — they do not spawn further agents.
- Use `Agent(agent: "{concrete-type}", prompt: "...")` to spawn. The concrete type is resolved from the slot via profiles.json (see Slot resolution below).
- Use `Agent(agent: "{concrete-type}", isolation: "worktree", prompt: "...")` for implementer agents.

### Worktree state access rule

Worktree-isolated agents (spawned with `isolation: "worktree"`) run in a separate git worktree directory. The `.geas/` directory is listed in `.gitignore` and is NOT replicated into the worktree. This means relative paths like `.geas/missions/...` will not resolve inside a worktree agent's working directory.

Before spawning any worktree agent, the orchestrator MUST:

1. Resolve `project_root` as the absolute path of the repository root (e.g., `git rev-parse --show-toplevel`). Do NOT use `pwd` alone — it may return a subdirectory if the orchestrator has changed directories.
2. Replace ALL `.geas/` references in the Agent() prompt with `{project_root}/.geas/` — using the actual resolved absolute path value.
3. This applies to BOTH read paths (context packets) and write paths (evidence files).

Example:
```
# Resolve project_root once at the start of the mission
project_root=$(git rev-parse --show-toplevel)   # e.g., /home/user/my-project

# Then in every worktree Agent() prompt, use absolute paths:
Agent(agent: "{worker}", isolation: "worktree", prompt: "Read /home/user/my-project/.geas/missions/.../tasks/{task-id}/packets/... Implement the feature. Write your evidence by running: geas evidence add --task {task-id} --agent {worker} --role implementer --set summary=... --set files_changed=...")
```

Non-worktree agents (spawned without `isolation: "worktree"`) run in the main session directory where `.geas/` is directly accessible. Their prompts may continue to use relative `.geas/` paths.

### Agent selection

The orchestrator selects the best agent for each task based on the task's `task_kind`, `scope.surfaces`, and required expertise. All agents from `agents/` are available regardless of domain.

Selection process:
1. Identify the slot needed (implementer, quality-specialist, risk-specialist, etc.)
2. If the mission has a `domain_profile`, use `references/profiles.json` as a **default preference** — not a restriction
3. Override the default when a task clearly needs a different agent (e.g., a research task within a software mission → use research-analyst instead of software-engineer)
4. When mixing domains, choose the agent whose expertise best matches the specific task
5. Spawn: `Agent(agent: "{concrete-type-kebab-case}", prompt: "...")`

Example: software mission has a literature review task → spawn `research-analyst` for that task, `software-engineer` for implementation tasks. The `domain_profile: "software"` guides defaults but does not prevent using research agents.

### Evidence verification
- After every Agent() return, **Read the expected evidence file** to verify it exists.
- If missing: the step failed. Retry once, then log error and proceed.
- Evidence paths: `.geas/missions/{mission_id}/tasks/{task-id}/evidence/{agent-name}.json`

### Event logging
- Log every transition via the CLI: `Bash("geas event log --type <event_type> [--task <id>] [--agent <name>] [--data '<json>']")`
- Timestamps are automatically managed. The CLI auto-injects `created_at` on new files, `updated_at` on existing file modifications, and `timestamp` on event ledger entries. Do NOT manually generate timestamps with `date -u` or similar commands.

**[MANDATORY] The following events must always be logged. Omitting any is a protocol violation:**
- `step_complete` — after each pipeline step completes (format defined in the execution pipeline)
- `task_started` / `task_resolved` — task lifecycle
- `phase_complete` — phase transitions
- `gate_result` — evidence gate outcomes (format defined in evidence-gate)
- `vote_round` — vote results (format defined in vote-round)

### Checkpoint management
**[MANDATORY]** Before EVERY Agent() spawn, update the checkpoint via CLI. This is not optional — session recovery depends on it.
  ```bash
  Bash("geas state checkpoint set --step specialist_review --agent design-authority")
  ```
- The CLI handles atomic writes and timestamps automatically.
- After agent returns: clear the checkpoint: `Bash("geas state checkpoint clear")`
- On task completion (sequential): clear checkpoint entirely: `Bash("geas state checkpoint clear")`

#### Batch checkpoint
During parallel batch execution (see `/geas:scheduling`):
- Set batch checkpoint: `Bash("geas state checkpoint set --step batch_active --agent null --batch task-001,task-002")`
- Before spawning any agent, the CLI auto-updates `last_updated`.
- After each task resolves: transition via `Bash("geas task transition --mission {mid} --id {tid} --to passed")`, then update run state via `Bash("geas state update --field completed_tasks --value '<json_array>'")`
- When all batch tasks resolved: `Bash("geas state checkpoint clear")`, scan for next batch.

### Task file status updates
**[MANDATORY]** When resolving a task (Ship verdict):
```bash
Bash("geas task transition --mission {mission_id} --id {task-id} --to passed")
```
The CLI validates the transition is legal (7-state model) and writes atomically.

This applies to every task — sequential or parallel. If the task file does not exist, this is a protocol violation (the file must be created before pipeline starts).

### Rules evolving
- `.geas/rules.md` is a living document. Changes go through a structured `rules-update.json` workflow.
- During per-task retrospectives, orchestration-authority produces `rule_candidates[]` in the record.json `retrospective` section. These are proposals, NOT direct modifications.
- Rule candidates accumulate during the Building phase. Batch approval happens in the Evolving phase (Step 4.2.5).
- Approved rules updates are applied to `.geas/rules.md` and recorded in `.geas/missions/{mission_id}/evolution/rules-update.json` with `status: "approved"`.
- Approval conditions (per doc 11): orchestration-authority + domain authority, OR evidence_refs >= 2 with contradiction_count = 0.
- After Phase 1 (Specifying): Orchestrator adds stack-specific rules before the rules-update workflow exists in the pipeline.

### Tech debt tracking
After reading each agent's evidence, check for a `tech_debt` array. If present:
1. For each debt item, check if a similar title already exists (the CLI handles duplicate detection).
2. Add new items via CLI — auto-generates sequential IDs and updates rollups:
   ```bash
   Bash("geas debt add --mission {mission_id} --title '<title>' --severity <sev> --kind <kind> --task {task-id} --owner <agent_type> --description '<desc>'")
   ```
3. The CLI creates the debt-register.json with initial schema if missing, auto-generates DEBT-xxx IDs, and updates rollup counts.

When a task resolves a debt item:
```bash
Bash("geas debt resolve --mission {mission_id} --id DEBT-001")
```

Threshold warning is handled automatically by the check-debt hook when the CLI writes debt-register.json.

### Git operations
- Orchestrator handles all git operations directly (commit, branch, tag).
- Use conventional commit format at Resolve: `feat:`, `fix:`, `refactor:`, etc.
- Release management (version bump, tag, changelog) at Evolving.

### Your role boundaries
- Orchestrate only. Specialist agents implement all code, including bug fixes.
- Orchestrator handles git and retrospectives directly (no agent spawn needed).
- Follow the protocol of the 4-phase execution flow completely.

### Continuation Rule

Within a SINGLE TASK's pipeline, do NOT end your turn between steps. Run all 15 pipeline steps for one task in a single continuous turn.

Between tasks, a brief status update is acceptable but do NOT wait for user input unless:
- You need user input (ambiguous requirement, scope question), OR
- An error blocks progress (gate fail, hook block), OR
- **Design-brief approval** (user must approve design before task compilation)
- **Task list approval** (user must approve compiled tasks before building)

Design-brief and task list each require user approval. Do NOT batch these — present design-brief first, get approval, then compile tasks, then present task list for approval.

## Gotchas

These are recurring mistakes. Read before every mission.

1. **Claude Code TaskCreate ≠ geas TaskContract.** Claude Code's built-in TaskCreate tool creates UI-only progress items. Geas TaskContracts are `.geas/missions/{mission_id}/tasks/{task-id}/contract.json` files created via `/geas:task-compiler`. You MUST use task-compiler — never substitute Claude Code tasks for geas tasks.

2. **Lightweight mode ≠ skip pipeline.** Lightweight simplifies intake and design-brief (fewer questions, fewer fields). The Building pipeline (15 steps per task, state transitions, evidence, gate) is IDENTICAL across all modes. No mode allows skipping state transitions or evidence collection.

3. **Orchestrate only — never implement.** The orchestrator does NOT write code, even for "simple" fixes. Spawn an implementer agent. The only direct writes the orchestrator does are: git operations, retrospectives, closure packets, and session state.

4. **"User said commit" ≠ "skip remaining phases."** A user asking to commit means commit the current work. It does NOT mean skip Polishing, Evolving, or any remaining pipeline steps. Complete the full 4-phase flow.

## Recovery

### Recovery Decision Table

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
     - After `specialist_review` + `testing` complete
     - After gate pass
     - After closure packet assembled
   - Inconsistent state (conflicting artifacts) → `manual_repair_required`
3. Write recovery packet via CLI:
   ```bash
   Bash("geas recovery write --data '<recovery_packet_json>'")
   ```
   **Recovery-packet schema fields:**
   - `recovery_id`: unique string (e.g., `"recovery-{mission_id}-001"`)
   - `recovery_class`: one of `post_compact_resume`, `warm_session_resume`, `interrupted_subagent_resume`, `dirty_state_recovery`, `manual_repair_required`
   - `focus_task_id`: task being recovered (string or null)
   - `detected_problem`: what went wrong
   - `recommended_action`: what to do
   - `artifacts_found`: string array of existing artifact paths
   - `artifacts_missing`: string array of missing artifact paths
   - `rewind_target` (optional): one of `ready`, `implementing`, `reviewed`, `integrated`
   - `resolution` (optional): how it was resolved
4. Update run state: `Bash("geas state update --field recovery_class --value '<class>'")`
5. Log: `Bash("geas event log --type recovery --data '{\"recovery_class\":\"...\",\"recovery_id\":\"...\",\"focus_task_id\":\"...\"}'")` 

**Step 4 — If `manual_repair_required`:**
- Write recovery-packet.json with `detected_problem` and `artifacts_found`/`artifacts_missing`
- Present the situation to the user: "Session state is inconsistent and cannot be automatically recovered. Recovery packet written to .geas/recovery/{id}.json. Manual intervention required."
- Do NOT proceed with the pipeline.

### Stale Packet Check

After recovery completes and before resuming the pipeline:
1. Check if context packets exist for the focus task at `.geas/missions/{mission_id}/tasks/{task-id}/packets/`
2. If packets exist: compare their timestamps against the last event in `events.jsonl`
3. If packets are older than the last event → packets are stale. Regenerate via `geas packet create` before spawning the next agent.
4. Also regenerate after: revalidation, rewind, rules.md update, agent memory updated.

### Session State Maintenance

The orchestrator is responsible for maintaining two context anchors:

1. **`.geas/state/session-latest.md`** — updated after each pipeline step completion. Contains phase, focus task, last/next step, recent events, open risks, memory summary. See the execution pipeline skills for the exact format.

These files are consumed by `restore-context.sh` during post-compact recovery.
