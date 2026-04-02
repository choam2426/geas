# Hooks Reference

Geas hooks are shell scripts that the Claude Code runtime executes automatically at defined lifecycle events. They enforce governance invariants, inject agent context, and record telemetry — without requiring the orchestrator to remember to call them.

Configuration: `plugin/hooks/hooks.json`
Scripts: `plugin/hooks/scripts/`

---

## Hook Inventory

18 hooks across 7 lifecycle events.

| # | Event | Matcher | Script | Purpose |
|---|-------|---------|--------|---------|
| 1 | SessionStart | (all) | session-init.sh | Session initialization |
| 2 | SessionStart | (all) | memory-review-cadence.sh | Detect expired memory review_after dates |
| 3 | PreToolUse | Write | checkpoint-pre-write.sh | Backup run.json before write (two-phase checkpoint) |
| 4 | PostToolUse | Write\|Edit | protect-geas-state.sh | Protect .geas/ state files |
| 5 | PostToolUse | Write\|Edit | verify-task-status.sh | Verify task status transitions |
| 6 | PostToolUse | Write\|Edit | check-debt.sh | Debt threshold warnings |
| 7 | PostToolUse | Write\|Edit | stale-start-check.sh | Warn on stale base_commit at task start |
| 8 | PostToolUse | Write\|Edit | lock-conflict-check.sh | Detect conflicting lock targets |
| 9 | PostToolUse | Write\|Edit | memory-promotion-gate.sh | Verify memory promotion conditions |
| 10 | PostToolUse | Write\|Edit | memory-superseded-warning.sh | Warn on stale memory in packets |
| 11 | PostToolUse | Write\|Edit | checkpoint-post-write.sh | Cleanup pending checkpoint after write |
| 12 | PostToolUse | Write\|Edit | packet-stale-check.sh | Warn on stale context packets |
| 13 | PostToolUse | Bash | integration-lane-check.sh | Warn on merge without integration lock |
| 14 | SubagentStart | (all) | inject-context.sh | Inject context into subagent |
| 15 | SubagentStop | (all) | agent-telemetry.sh | Record agent execution telemetry |
| 16 | Stop | (all) | verify-pipeline.sh | Verify pipeline completion |
| 17 | Stop | (all) | calculate-cost.sh | Calculate session cost |
| 18 | PostCompact | (all) | restore-context.sh | Restore state after context compaction |

---

## Hook Lifecycle

The following diagram shows the order in which hooks fire during a typical Geas session.

```
Session begins
│
├─► SessionStart       → session-init.sh
│     Check .geas/ state, inject rules.md context
│
├─► SessionStart       → memory-review-cadence.sh
│     Warn about memory entries past review_after date
│
│   [For each sub-agent spawned]
│   │
│   ├─► SubagentStart  → inject-context.sh
│   │     Inject rules.md + agent memory into sub-agent context
│   │
│   │   [Before each Write tool call to run.json]
│   │   │
│   │   ├─► PreToolUse (Write) → checkpoint-pre-write.sh
│   │   │     Backup run.json before overwrite (two-phase checkpoint)
│   │   │
│   │   [After each Write or Edit tool call]
│   │   │
│   │   ├─► PostToolUse (Write|Edit) → protect-geas-state.sh
│   │   │     Timestamp injection, prohibited path warning, seed.json guard
│   │   │
│   │   ├─► PostToolUse (Write|Edit) → verify-task-status.sh
│   │   │     Check 5 mandatory evidence files + rubric_scores validation
│   │   │
│   │   ├─► PostToolUse (Write|Edit) → check-debt.sh
│   │   │     Warn when HIGH debt items >= 3
│   │   │
│   │   ├─► PostToolUse (Write|Edit) → stale-start-check.sh
│   │   │     Warn if task base_commit differs from integration tip
│   │   │
│   │   ├─► PostToolUse (Write|Edit) → lock-conflict-check.sh
│   │   │     Detect overlapping lock targets between tasks
│   │   │
│   │   ├─► PostToolUse (Write|Edit) → memory-promotion-gate.sh
│   │   │     Verify evidence/signal thresholds for memory state promotion
│   │   │
│   │   ├─► PostToolUse (Write|Edit) → memory-superseded-warning.sh
│   │   │     Warn if stale/superseded memory appears in context packets
│   │   │
│   │   ├─► PostToolUse (Write|Edit) → checkpoint-post-write.sh
│   │   │     Remove pending checkpoint backup after successful write
│   │   │
│   │   └─► PostToolUse (Write|Edit) → packet-stale-check.sh
│   │         Warn if context packets may be stale after session recovery
│   │
│   │   [After each Bash tool call]
│   │   │
│   │   └─► PostToolUse (Bash) → integration-lane-check.sh
│   │         Warn if git merge/rebase runs without integration lock
│   │
│   │   [Context compaction fires]
│   │   │
│   │   └─► PostCompact → restore-context.sh
│   │         Re-inject run.json state, remaining_steps, NEXT STEP
│   │
│   └─► SubagentStop   → agent-telemetry.sh
│         Log agent spawn metadata to costs.jsonl
│
Session ends
│
├─► Stop               → verify-pipeline.sh   [BLOCKING]
│     Check all completed tasks have mandatory evidence
│
└─► Stop               → calculate-cost.sh
      Token usage + estimated cost summary
```

---

## Hook 1 — session-init.sh

| Field | Value |
|---|---|
| Event | `SessionStart` |
| Script | `plugin/hooks/scripts/session-init.sh` |
| Blocking | No (exits 0 in all cases) |
| Timeout | 10 s |

### What it does

Runs once when a Claude Code session starts.

1. **Reads `cwd` from the hook input JSON.** If `cwd` is absent, exits immediately.
2. **Checks for `.geas/` directory.** If the directory does not exist, the project is not a Geas project — exits silently.
3. **Checks for `.geas/state/run.json`.** If missing, prints a warning to stderr (`[Geas] .geas/ directory exists but no run.json. Run setup first.`) and exits.
4. **Loads session state from run.json** and prints a resume summary to stderr:
   ```
   [Geas] Session resumed. Mission: <mission> | Phase: <phase> | Status: <status> | Tasks completed: <N>
   ```
   If a checkpoint is present, also prints:
   ```
   [Geas] Checkpoint: task=<task_id>, step=<pipeline_step>, agent=<agent_in_flight>
   ```
5. **Creates `.geas/rules.md` if it does not exist**, using a built-in template that covers evidence format requirements and prohibited path rules. Prints a notice to stderr when the file is created.

### Conditions

- Skips entirely if `cwd` is empty.
- Skips entirely if `.geas/` does not exist (non-Geas project).
- Skips run.json loading if `run.json` is absent, but still prints a warning.

---

## Hook 2 — memory-review-cadence.sh

| Field | Value |
|---|---|
| Event | `SessionStart` |
| Script | `plugin/hooks/scripts/memory-review-cadence.sh` |
| Blocking | No (exits 0 in all cases) |
| Timeout | 10 s |
| Added | Phase 1 (memory system) |

### What it does

Runs once at session start, after session-init. Scans the memory index for entries whose `review_after` date has passed.

1. **Reads `.geas/state/memory-index.json`.** If the file does not exist, exits silently.
2. **Iterates all entries** with state `provisional`, `stable`, or `canonical`.
3. **Compares each entry's `review_after` date** against the current UTC time.
4. **Prints a warning** listing up to 10 expired entries:
   ```
   Warning: MEMORY REVIEW DUE: 3 entries past review_after date:
     - mem-001 (stable, due 2026-03-15T00:00:00Z)
     - mem-002 (provisional, due 2026-03-20T00:00:00Z)
   Run batch review via /geas:memorizing.
   ```

### Conditions

- Skips if `.geas/state/memory-index.json` does not exist.
- Only checks entries in active states (provisional, stable, canonical).
- Shows at most 10 expired entries with a count of remaining.

---

## Hook 3 — checkpoint-pre-write.sh

| Field | Value |
|---|---|
| Event | `PreToolUse` |
| Matcher | `Write` |
| Script | `plugin/hooks/scripts/checkpoint-pre-write.sh` |
| Blocking | No (exits 0 in all cases) |
| Timeout | 10 s |
| Added | Phase 1 (checkpoint system) |

### What it does

Fires before every `Write` tool call. Implements the first half of a two-phase checkpoint for `run.json`.

1. **Checks if the write target is `.geas/state/run.json`.** All other writes are ignored.
2. **Copies `run.json` to `_checkpoint_pending`** as a backup. If the subsequent write fails or corrupts the file, the pending backup can be used for recovery.

This hook works in tandem with `checkpoint-post-write.sh`, which removes the pending file after a successful write.

### Conditions

- Only acts on writes to `.geas/state/run.json`.
- Skips if `run.json` does not exist yet (first write).

---

## Hook 4 — protect-geas-state.sh

| Field | Value |
|---|---|
| Event | `PostToolUse` |
| Matcher | `Write\|Edit` |
| Script | `plugin/hooks/scripts/protect-geas-state.sh` |
| Blocking | No (exits 0 in all cases) |
| Timeout | 10 s |

### What it does

Fires after every `Write` or `Edit` tool call. Has three distinct responsibilities.

**1. Prohibited path warning**

Reads the current task's `prohibited_paths` list from `.geas/tasks/<current_task_id>.json`. If the written file matches any of those glob patterns (via `fnmatch`), it prints a warning to stderr:
```
[Geas] WARNING: Write to <rel_path> matches prohibited path "<pattern>" in <task_id>
```
Paths inside `.geas/` itself are always exempt from this check.

**2. Automatic timestamp injection**

If the written file path matches `*/.geas/*.json`, the hook reads the file and inspects the `created_at` field. It injects a real UTC timestamp (`YYYY-MM-DDTHH:MM:SSZ`) when:
- `created_at` is absent or empty, or
- `created_at` looks like a dummy value (ends with `:00:00Z` or `:00:00.000Z`).

This means agents never need to manually set `created_at`; the hook corrects it automatically after the write.

**3. seed.json freeze guard**

If the written file path matches `*/.geas/spec/seed.json`, it prints a warning to stderr:
```
[Geas] Warning: seed.json was modified. Seed should be frozen after intake. Use /geas:pivot-protocol for scope changes.
```

### Conditions

- Skips immediately if `cwd` or `file_path` cannot be parsed from the hook input.
- Prohibited path check skips if there is no active `current_task_id` in `run.json`, or if the task file does not exist.
- Timestamp injection only applies to files under `.geas/` with a `.json` extension.
- seed.json warning fires on any write to that exact path, regardless of content.

---

## Hook 5 — verify-task-status.sh

| Field | Value |
|---|---|
| Event | `PostToolUse` |
| Matcher | `Write\|Edit` |
| Script | `plugin/hooks/scripts/verify-task-status.sh` |
| Blocking | No (exits 0 in all cases) |
| Timeout | 10 s |

### What it does

Fires after every `Write` or `Edit` tool call, but only acts when a task file is being written.

1. **Filters to `.geas/tasks/*.json` files only.** All other writes are ignored immediately.
2. **Reads the task file.** If `status` is `"passed"`, checks for the presence of 5 mandatory evidence artifacts:

   | File | Role |
   |---|---|
   | `.geas/evidence/<tid>/architecture-authority-review.json` | Code Review (Architecture Authority) |
   | `.geas/evidence/<tid>/qa-engineer.json` | QA Testing (QA Engineer) |
   | `.geas/evidence/<tid>/challenge-review.json` | Pre-ship Review (Critical Reviewer) |
   | `.geas/evidence/<tid>/product-authority-verdict.json` | Product Review (Product Authority) |
   | `.geas/tasks/<tid>/retrospective.json` | Process Lead Retrospective |

   For each missing file, it prints a warning to stderr.

3. **Validates `rubric_scores` in sentinel and forge-review evidence** (recent addition). If `qa-engineer.json` or `architecture-authority-review.json` exists but does not contain a non-empty `rubric_scores` field, prints:
   ```
   [Geas] Warning: <tid> qa-engineer.json is missing rubric_scores
   [Geas] Warning: <tid> architecture-authority-review.json is missing rubric_scores
   ```

### Conditions

- Only activates for writes to `.geas/tasks/*.json`.
- Only checks evidence when the task `status` field equals `"passed"`.
- rubric_scores check only runs if the respective evidence file already exists.

---

## Hook 6 — check-debt.sh

| Field | Value |
|---|---|
| Event | `PostToolUse` |
| Matcher | `Write\|Edit` |
| Script | `plugin/hooks/scripts/check-debt.sh` |
| Blocking | No (exits 0 in all cases) |
| Timeout | 10 s |

### What it does

Fires after every `Write` or `Edit` tool call, but only acts on the debt ledger.

1. **Filters to `.geas/evolution/debt-register.json` only.** All other writes are ignored immediately.
2. **Reads the debt file** and counts items where `severity == "HIGH"` and `status == "open"`.
3. **Warns when the count reaches 3 or more:**
   ```
   [Geas] <N> HIGH tech debts open. Consider addressing before new features.
   ```
   The warning is printed to stderr and does not block the pipeline.

### Conditions

- Only activates for writes to `.geas/evolution/debt-register.json`.
- Warning threshold is 3 open HIGH items.

---

## Hook 7 — stale-start-check.sh

| Field | Value |
|---|---|
| Event | `PostToolUse` |
| Matcher | `Write\|Edit` |
| Script | `plugin/hooks/scripts/stale-start-check.sh` |
| Blocking | No (exits 0 in all cases) |
| Timeout | 10 s |
| Added | Phase 1 (worktree/parallelism) |

### What it does

Fires after every `Write` or `Edit` tool call, but only acts when a task file transitions to `implementing`.

1. **Filters to `.geas/tasks/*.json` files only.** All other writes are ignored.
2. **Reads the task file.** Only proceeds if `status` is `"implementing"`.
3. **Compares the task's `base_commit`** against the current `git rev-parse HEAD`.
4. **Warns if they differ:**
   ```
   STALE BASE_COMMIT: Task base_commit (<hash>) differs from integration tip (<hash>). Run revalidation before proceeding.
   ```

This catches situations where other tasks have been integrated since the task was compiled, meaning the worker may be building on a stale codebase.

### Conditions

- Only activates for writes to `.geas/tasks/*.json`.
- Only checks when `status` equals `"implementing"`.
- Skips if `base_commit` is empty or git is unavailable.

---

## Hook 8 — lock-conflict-check.sh

| Field | Value |
|---|---|
| Event | `PostToolUse` |
| Matcher | `Write\|Edit` |
| Script | `plugin/hooks/scripts/lock-conflict-check.sh` |
| Blocking | No (exits 0 in all cases) |
| Timeout | 10 s |
| Added | Phase 1 (worktree/parallelism) |

### What it does

Fires after every `Write` or `Edit` tool call, but only acts on the locks file.

1. **Checks for `.geas/state/locks.json`.** Exits silently if absent.
2. **Groups all held locks by `lock_type`.**
3. **Detects overlapping targets** between locks held by different tasks within the same lock type.
4. **Warns on conflict:**
   ```
   LOCK CONFLICT DETECTED:
   edit: TASK-001 vs TASK-002 on ['src/auth.ts']
   ```

This prevents two parallel tasks from silently modifying the same files.

### Conditions

- Only activates when `.geas/state/locks.json` exists.
- Only checks locks with `status == "held"`.
- Compares within the same `lock_type` only.

---

## Hook 9 — memory-promotion-gate.sh

| Field | Value |
|---|---|
| Event | `PostToolUse` |
| Matcher | `Write\|Edit` |
| Script | `plugin/hooks/scripts/memory-promotion-gate.sh` |
| Blocking | No (exits 0 in all cases) |
| Timeout | 10 s |
| Added | Phase 1 (memory system) |

### What it does

Fires after every `Write` or `Edit` tool call, but only acts on memory entry files.

1. **Filters to `.geas/memory/entries/*.json` files only.** All other writes are ignored.
2. **Reads the memory entry** and checks promotion conditions based on the current `state`:

   | State | Required conditions |
   |---|---|
   | `provisional` | 2+ `evidence_refs` or `evidence_count >= 2` |
   | `stable` | 3+ `successful_reuses` and 0 `contradiction_count` |
   | `canonical` | 5+ `successful_reuses` |

3. **Warns if conditions are not met:**
   ```
   Warning: MEMORY PROMOTION: stable promotion requires 3+ successful_reuses (has 1)
   Warning: MEMORY PROMOTION: stable promotion requires 0 contradictions (has 2)
   ```

### Conditions

- Only activates for writes to `.geas/memory/entries/*.json`.
- Checks are state-specific — each promotion level has its own thresholds.

---

## Hook 10 — memory-superseded-warning.sh

| Field | Value |
|---|---|
| Event | `PostToolUse` |
| Matcher | `Write\|Edit` |
| Script | `plugin/hooks/scripts/memory-superseded-warning.sh` |
| Blocking | No (exits 0 in all cases) |
| Timeout | 10 s |
| Added | Phase 1 (memory system) |

### What it does

Fires after every `Write` or `Edit` tool call, but only acts on context packet files.

1. **Filters to `.geas/packets/*.md` files only.** All other writes are ignored.
2. **Reads `.geas/state/memory-index.json`** to build a map of memory IDs to their current state.
3. **Scans the packet content** for memory ID references (pattern: `[mem-*]`).
4. **Warns if any referenced memory has a stale state** (superseded, under_review, decayed, archived, or rejected):
   ```
   Warning: STALE MEMORY: mem-003 has state "superseded" — should not be in active packet
   ```

This prevents agents from acting on outdated memory that has been replaced or invalidated.

### Conditions

- Only activates for writes to `.geas/packets/*.md`.
- Skips if `.geas/state/memory-index.json` does not exist.
- Only flags memory in non-active states.

---

## Hook 11 — checkpoint-post-write.sh

| Field | Value |
|---|---|
| Event | `PostToolUse` |
| Matcher | `Write\|Edit` |
| Script | `plugin/hooks/scripts/checkpoint-post-write.sh` |
| Blocking | No (exits 0 in all cases) |
| Timeout | 10 s |
| Added | Phase 1 (checkpoint system) |

### What it does

Fires after every `Write` or `Edit` tool call. Implements the second half of the two-phase checkpoint for `run.json`.

1. **Checks if the write target is `.geas/state/run.json`.** All other writes are ignored.
2. **Removes `.geas/state/_checkpoint_pending`** if it exists, confirming the write completed successfully.

This hook works in tandem with `checkpoint-pre-write.sh`. Together they ensure that if a write to `run.json` fails mid-operation, the backup remains available for recovery.

### Conditions

- Only acts on writes to `.geas/state/run.json`.
- No-op if no pending checkpoint exists.

---

## Hook 12 — packet-stale-check.sh

| Field | Value |
|---|---|
| Event | `PostToolUse` |
| Matcher | `Write\|Edit` |
| Script | `plugin/hooks/scripts/packet-stale-check.sh` |
| Blocking | No (exits 0 in all cases) |
| Timeout | 10 s |
| Added | Phase 1 (session recovery) |

### What it does

Fires after every `Write` or `Edit` tool call, but only acts when `run.json` is written.

1. **Filters to `.geas/state/run.json` only.** All other writes are ignored.
2. **Reads `run.json`** and checks if `recovery_class` is set (indicating a recovered session).
3. **Checks for existing context packets** for the current task under `.geas/packets/<task_id>/`.
4. **Warns if packets exist in a recovered session:**
   ```
   Warning: STALE PACKETS: Session recovered (<recovery_class>). Context packets for <task_id> may be stale. Regenerate before spawning agents.
   ```

After session recovery, previously generated context packets may reference outdated state. This hook ensures agents are not spawned with stale briefings.

### Conditions

- Only activates for writes to `.geas/state/run.json`.
- Skips if no `current_task_id` is set.
- Skips if no context packets exist for the current task.
- Only warns when `recovery_class` is non-null.

---

## Hook 13 — integration-lane-check.sh

| Field | Value |
|---|---|
| Event | `PostToolUse` |
| Matcher | `Bash` |
| Script | `plugin/hooks/scripts/integration-lane-check.sh` |
| Blocking | No (exits 0 in all cases) |
| Timeout | 10 s |
| Added | Phase 1 (worktree/parallelism) |

### What it does

Fires after every `Bash` tool call. Enforces the single-flight integration lane rule.

1. **Checks if the Bash command contains `git merge` or `git rebase`.** All other commands are ignored.
2. **Reads `.geas/state/locks.json`** and looks for a held `integration` lock.
3. **Warns if no integration lock is held:**
   ```
   INTEGRATION LANE: No integration_lock held. Acquire integration_lock before merging to ensure single-flight integration.
   ```

This prevents concurrent merge operations that could corrupt the integration branch.

### Conditions

- Only activates for Bash commands containing `git merge` or `git rebase`.
- Warns (but does not block) if `locks.json` is missing entirely.
- Warns if no lock of type `integration` with status `held` exists.

---

## Hook 14 — inject-context.sh

| Field | Value |
|---|---|
| Event | `SubagentStart` |
| Script | `plugin/hooks/scripts/inject-context.sh` |
| Blocking | No (exits 0 in all cases) |
| Timeout | 10 s |

### What it does

Fires every time a sub-agent is spawned. Injects project-wide rules and per-agent memory into the sub-agent's starting context.

1. **Reads `cwd` and `agent_type` from the hook input JSON.** The `agent_type` field may carry a plugin prefix (e.g., `geas:nova`); the hook strips it to get the bare agent name (`nova`).
2. **Checks for `.geas/` directory.** If absent, exits silently.
3. **Reads `.geas/rules.md`** and includes it in the context block under the header `--- PROJECT RULES (.geas/rules.md) ---`.
4. **Reads `.geas/memory/agents/<agent_name>.md`** if it exists and includes it under the header `--- YOUR MEMORY (.geas/memory/agents/<agent_name>.md) ---`. This gives each agent role-specific memory that persists across sessions.
5. **Outputs a JSON object** to stdout:
   ```json
   { "additionalContext": "..." }
   ```
   The runtime merges this into the sub-agent's system context before it receives its first message.

### Conditions

- Skips if `cwd` is empty or `.geas/` does not exist.
- Agent memory injection is skipped if the memory file does not exist for that agent name.
- Outputs nothing (no JSON) if neither rules.md nor a memory file is found.

---

## Hook 15 — agent-telemetry.sh

| Field | Value |
|---|---|
| Event | `SubagentStop` |
| Script | `plugin/hooks/scripts/agent-telemetry.sh` |
| Blocking | No (exits 0 in all cases) |
| Timeout | 10 s |

### What it does

Fires whenever a sub-agent finishes. Records agent spawn metadata to the ledger for distribution analysis. Note: this hook does **not** record actual token counts — that is done by `calculate-cost.sh` at session end.

1. **Reads `cwd` and `agent_type`** from the hook input. Strips the plugin prefix (e.g., `geas:nova` -> `nova`).
2. **Reads `run.json`** to get the current `task_id` and `phase`.
3. **Determines the model** from a hardcoded mapping:
   - `opus`: nova, forge, circuit, pixel, critic
   - `sonnet`: all other agents
4. **Appends a JSONL entry** to `.geas/ledger/costs.jsonl`:
   ```json
   {
     "event": "agent_complete",
     "agent": "nova",
     "task_id": "TASK-001",
     "phase": "build",
     "model": "opus",
     "timestamp": "2026-03-30T12:00:00Z"
   }
   ```
   The directory is created if it does not exist.

### Conditions

- Skips if `cwd` is empty or `run.json` does not exist.
- Appends to `costs.jsonl` regardless of whether a task is active (`task_id` may be empty string).

---

## Hook 16 — verify-pipeline.sh

| Field | Value |
|---|---|
| Event | `Stop` |
| Script | `plugin/hooks/scripts/verify-pipeline.sh` |
| **Blocking** | **Yes — exits 2 to block session exit** |
| Timeout | 30 s |

### What it does

Fires when the session is about to end. This is the only hook in the system that can **block the pipeline** by returning exit code 2.

1. **Checks for `.geas/` and `run.json`.** Exits 0 (allow) if absent — non-Geas projects are not affected.
2. **Skips if no tasks have been completed yet** (`completed_tasks` is empty). Nothing to verify.
3. **Iterates every task ID in `completed_tasks`** and checks for the 5 mandatory evidence files:

   | File | Description |
   |---|---|
   | `.geas/evidence/<tid>/architecture-authority-review.json` | Code Review |
   | `.geas/evidence/<tid>/qa-engineer.json` | QA Testing |
   | `.geas/evidence/<tid>/challenge-review.json` | Critical Reviewer Pre-ship Challenge |
   | `.geas/evidence/<tid>/product-authority-verdict.json` | Final Verdict (Product Authority) |
   | `.geas/tasks/<tid>/retrospective.json` | Process Lead Retrospective |

4. **If any files are missing**, prints to stderr:
   ```
   [Geas] Pipeline incomplete. MANDATORY evidence missing:
     - TASK-001: qa-engineer.json (QA Testing) missing
     - TASK-001: tasks/TASK-001/retrospective.json (Process Lead Retrospective) missing

   Execute the missing steps before completing the session.
   ```
   Then **exits with code 2**, which causes the runtime to block the session from closing.

5. **If all evidence is present**, exits 0 and allows the session to end normally.

### Exit codes

| Code | Meaning |
|---|---|
| 0 | Pipeline complete — session exit allowed |
| 2 | Evidence missing — session exit blocked |

### Conditions

- Non-Geas projects (no `.geas/`) are never blocked.
- Sessions with zero completed tasks are never blocked.

---

## Hook 17 — calculate-cost.sh

| Field | Value |
|---|---|
| Event | `Stop` |
| Script | `plugin/hooks/scripts/calculate-cost.sh` |
| Blocking | No (exits 0 in all cases) |
| Timeout | 30 s |

### What it does

Fires at session end (after `verify-pipeline.sh`). Parses sub-agent session JSONL files from `~/.claude/projects/` to calculate actual token usage and estimated cost.

1. **Locates the Claude project directory** by normalizing `cwd` into the project hash format Claude uses (e.g., `A:\geas-test3` -> `A--geas-test3`). Looks for a matching directory under `~/.claude/projects/`.
2. **Finds the most recently modified session** with a `subagents/` subdirectory.
3. **Parses all sub-agent JSONL files** in that directory. For each `assistant` message, accumulates:
   - `input_tokens`
   - `output_tokens`
   - `cache_creation_input_tokens`
   - `cache_read_input_tokens`
4. **Reads agent type from `.meta.json` sidecar files** to attribute token counts per agent role.
5. **Calculates estimated cost** using Opus pricing as an upper bound:
   - Input: $15 / 1M tokens
   - Output: $75 / 1M tokens
   - Cache creation: $3.75 / 1M tokens
   - Cache read: $1.50 / 1M tokens
6. **Writes `.geas/ledger/cost-summary.json`** with the full breakdown:
   ```json
   {
     "session_cost_usd": 1.23,
     "tokens": { "input": 0, "output": 0, "cache_creation": 0, "cache_read": 0 },
     "cost_breakdown_usd": { "input": 0, "output": 0, "cache_creation": 0, "cache_read": 0 },
     "agent_count": 8,
     "agents": { "nova": { "input": 0, "output": 0, "spawns": 2 }, ... },
     "calculated_at": "2026-03-30T12:00:00Z"
   }
   ```
   Agents are sorted by output tokens descending.
7. **Prints a summary line** to stderr:
   ```
   [Geas] Session cost: $1.23 (8 agents, 12,345 output tokens)
   ```

### Conditions

- Skips if `cwd` is empty or `.geas/` does not exist.
- Skips if the Claude project directory cannot be found under `~/.claude/projects/`.
- Skips if no session with a `subagents/` directory is found.
- Errors in individual JSONL parsing are silently ignored — the hook is best-effort.

---

## Hook 18 — restore-context.sh

| Field | Value |
|---|---|
| Event | `PostCompact` |
| Script | `plugin/hooks/scripts/restore-context.sh` |
| Blocking | No (exits 0 in all cases) |
| Timeout | 10 s |

### What it does

Fires whenever the Claude Code runtime compacts the context window. Compaction discards conversation history, which can cause the orchestrator to lose track of the current task and pipeline position. This hook re-injects the critical state.

1. **Checks for `.geas/` and `run.json`.** Exits silently if either is absent.
2. **Builds a context block** from `run.json` containing:
   - `Mode | Phase | Status`
   - `Mission`
   - `Current task ID`
   - `Completed tasks` (last 5 shown)
3. **Includes checkpoint data** if present:
   - `Pipeline step` (the step that was in progress)
   - `Agent in flight` (the agent that was executing)
   - **`Remaining steps`** — the ordered list of pipeline steps still to execute (recent addition)
   - **`NEXT STEP`** — the first item from `remaining_steps`, highlighted so the orchestrator immediately knows what to do next
4. **Includes the current task contract** (goal + acceptance criteria) if a task is active.
5. **Includes the first 30 lines of `.geas/rules.md`** under a `--- KEY RULES ---` header.
6. **Outputs a JSON object** to stdout:
   ```json
   { "additionalContext": "..." }
   ```

**Batch recovery:** When `parallel_batch` is non-null, the hook outputs the batch task list and `completed_in_batch` count. Compass uses this to determine which tasks need re-execution.

### Conditions

- Skips if `cwd` is empty or `.geas/run.json` does not exist.
- Checkpoint section is omitted if no checkpoint is recorded.
- Task contract section is omitted if no `current_task_id` is set or the task file does not exist.
- Rules section is omitted if `rules.md` does not exist.

---

## Customizing Hooks

Hooks are declared in `plugin/hooks/hooks.json`. The schema is:

```json
{
  "hooks": {
    "<EventName>": [
      {
        "matcher": "<tool_name_regex_or_empty>",
        "hooks": [
          {
            "type": "command",
            "command": "<absolute_path_or_env_var_path>",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

**Key fields:**

| Field | Description |
|---|---|
| `EventName` | One of: `SessionStart`, `PreToolUse`, `PostToolUse`, `SubagentStart`, `SubagentStop`, `PostCompact`, `Stop` |
| `matcher` | For `PreToolUse`/`PostToolUse`: a pipe-separated regex of tool names (e.g., `Write\|Edit`). Empty string matches all. |
| `command` | Shell command to run. `${CLAUDE_PLUGIN_ROOT}` resolves to the plugin directory. |
| `timeout` | Maximum seconds before the hook is killed. |

**To add a new hook:**

1. Write a script in `plugin/hooks/scripts/`.
2. Make it executable (`chmod +x`).
3. Add an entry to `hooks.json` under the appropriate event.
4. The script receives the hook payload as JSON on stdin. Output `{"additionalContext": "..."}` on stdout to inject context (SubagentStart and PostCompact only).

**Exit code conventions:**

| Code | Effect |
|---|---|
| 0 | Success, continue |
| 1 | Error (logged, but does not block) |
| 2 | Block the pipeline (only meaningful for `Stop` hooks) |

For protocol details on hook failure handling, conformance checking, and metrics collection, see `protocol/12_ENFORCEMENT_CONFORMANCE_AND_METRICS.md`.

---

## State Files Referenced by Hooks

| Path | Used by |
|---|---|
| `.geas/state/run.json` | session-init, restore-context, verify-pipeline, agent-telemetry, checkpoint-pre-write, checkpoint-post-write, packet-stale-check |
| `.geas/state/_checkpoint_pending` | checkpoint-pre-write (creates), checkpoint-post-write (removes) |
| `.geas/state/memory-index.json` | memory-review-cadence, memory-superseded-warning |
| `.geas/state/locks.json` | lock-conflict-check, integration-lane-check |
| `.geas/evolution/debt-register.json` | check-debt |
| `.geas/rules.md` | session-init (creates), inject-context (reads), restore-context (reads) |
| `.geas/memory/agents/<name>.md` | inject-context |
| `.geas/memory/entries/<id>.json` | memory-promotion-gate |
| `.geas/tasks/<tid>.json` | protect-geas-state, verify-task-status, stale-start-check |
| `.geas/evidence/<tid>/architecture-authority-review.json` | verify-task-status, verify-pipeline |
| `.geas/evidence/<tid>/qa-engineer.json` | verify-task-status, verify-pipeline |
| `.geas/evidence/<tid>/challenge-review.json` | verify-task-status, verify-pipeline |
| `.geas/evidence/<tid>/product-authority-verdict.json` | verify-task-status, verify-pipeline |
| `.geas/tasks/<tid>/retrospective.json` | verify-task-status, verify-pipeline |
| `.geas/spec/seed.json` | protect-geas-state (freeze guard) |
| `.geas/packets/<tid>/*.md` | memory-superseded-warning, packet-stale-check |
| `.geas/ledger/costs.jsonl` | agent-telemetry |
| `.geas/ledger/cost-summary.json` | calculate-cost |
