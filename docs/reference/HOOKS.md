# Hooks Reference

Geas hooks are shell scripts that the Claude Code runtime executes automatically at defined lifecycle events. They enforce governance invariants, inject agent context, and record telemetry — without requiring the orchestrator to remember to call them.

Configuration: `plugin/hooks/hooks.json`
Scripts: `plugin/hooks/scripts/`
Shared library: `plugin/hooks/scripts/lib/geas-hooks.js`

---

## Hook Inventory

10 hooks (9 scripts + 1 shared library) across 6 lifecycle events.

| # | Event | Matcher | Script | Purpose |
|---|-------|---------|--------|---------|
| 1 | SessionStart | (all) | session-init.sh | Session initialization + memory review cadence |
| 2 | SubagentStart | (all) | inject-context.sh | Inject rules and agent memory into sub-agent |
| 3 | PreToolUse | Write | checkpoint-pre-write.sh | Backup run.json before write (two-phase checkpoint) |
| 4 | PostToolUse | Write\|Edit | protect-geas-state.sh | Scope guard, timestamp injection, spec freeze warning |
| 5 | PostToolUse | Write\|Edit | checkpoint-post-write.sh | Cleanup pending checkpoint after write |
| 6 | PostToolUse | Write\|Edit | packet-stale-check.sh | Warn on stale context packets |
| 7 | PostToolUse | Bash | integration-lane-check.sh | Warn on merge without integration lock |
| 8 | Stop | (all) | calculate-cost.sh | Token usage summary |
| 9 | PostCompact | (all) | restore-context.sh | Restore state after context compaction |

---

## Hook Lifecycle

The following diagram shows the order in which hooks fire during a typical Geas session.

```
Session begins
│
├─► SessionStart       → session-init.sh
│     Check .geas/ state, inject rules.md context,
│     warn about memory entries past review_after date
│
│   [For each sub-agent spawned]
│   │
│   ├─► SubagentStart  → inject-context.sh
│   │     Inject rules.md + policy overrides + agent memory into sub-agent context
│   │
│   │   [Before each Write tool call to run.json]
│   │   │
│   │   ├─► PreToolUse (Write) → checkpoint-pre-write.sh
│   │   │     Backup run.json before overwrite (two-phase checkpoint)
│   │   │
│   │   [After each Write or Edit tool call]
│   │   │
│   │   ├─► PostToolUse (Write|Edit) → protect-geas-state.sh
│   │   │     Timestamp injection, scope path warning, mission spec freeze guard
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
│   │         Re-inject run.json state, session context, L0 anti-forgetting
│
Session ends
│
└─► Stop               → calculate-cost.sh
      Token usage summary
```

---

## Hook Details

### Hook 1 — session-init.sh

| Field | Value |
|---|---|
| Event | `SessionStart` |
| Script | `plugin/hooks/scripts/session-init.sh` |
| Blocking | No (exits 0 in all cases) |
| Timeout | 10 s |

Runs once when a Claude Code session starts. Combines session initialization with memory review cadence checking (previously a separate hook).

**Session initialization:**

1. Reads `cwd` from the hook input JSON. If `cwd` is absent, exits immediately.
2. Checks for `.geas/` directory. If absent, exits silently (non-Geas project).
3. Checks for `.geas/state/run.json`. If missing, prints a warning and exits.
4. Loads session state from run.json and prints a resume summary to stderr:
   ```
   [Geas] Session resumed. Mission: <mission> | Phase: <phase> | Status: <status> | Tasks completed: <N>
   ```
5. Creates `.geas/rules.md` if it does not exist, using a built-in template.

**Agent memory check** (integrated):

6. Checks `.geas/memory/agents/` for agent note files.
7. Reports count of agent memory files found.

---

### Hook 2 — inject-context.sh

| Field | Value |
|---|---|
| Event | `SubagentStart` |
| Script | `plugin/hooks/scripts/inject-context.sh` |
| Blocking | No (exits 0 in all cases) |
| Timeout | 10 s |

Fires every time a sub-agent is spawned. Injects project-wide rules and per-agent memory into the sub-agent's starting context.

1. Reads `cwd` and `agent_type` from the hook input JSON. Strips plugin prefix (e.g., `geas:software-engineer` → `software-engineer`).
2. Checks for `.geas/` directory. If absent, exits silently.
3. Reads `.geas/rules.md` and includes it under `--- PROJECT RULES (.geas/rules.md) ---`.
4. Reads `.geas/state/policy-overrides.json`. Filters for active (non-expired) overrides and injects them as `--- ACTIVE POLICY OVERRIDES ---` with rule_id, action, reason, and expires_at for each override.
5. Reads `.geas/memory/agents/<agent_name>.md` if it exists and includes it under `--- YOUR MEMORY ---`.
6. Outputs `{"additionalContext": "..."}` on stdout for the runtime to merge into the sub-agent's system context.

**Conditions:** Skips if `cwd` is empty or `.geas/` does not exist. Outputs nothing if no rules.md, policy overrides, or memory file is found.

---

### Hook 3 — checkpoint-pre-write.sh

| Field | Value |
|---|---|
| Event | `PreToolUse` |
| Matcher | `Write` |
| Script | `plugin/hooks/scripts/checkpoint-pre-write.sh` |
| Blocking | No (exits 0 in all cases) |
| Timeout | 10 s |

Fires before every `Write` tool call. Implements the first half of a two-phase checkpoint for `run.json`.

1. Checks if the write target is `.geas/state/run.json`. All other writes are ignored.
2. Copies `run.json` to `_checkpoint_pending` as a backup.

Works in tandem with `checkpoint-post-write.sh` (Hook 5).

**Conditions:** Only acts on writes to `.geas/state/run.json`. Skips if `run.json` does not exist yet.

---

### Hook 4 — protect-geas-state.sh

| Field | Value |
|---|---|
| Event | `PostToolUse` |
| Matcher | `Write\|Edit` |
| Script | `plugin/hooks/scripts/protect-geas-state.sh` |
| Blocking | No (exits 0 in all cases) |
| Timeout | 10 s |

Fires after every `Write` or `Edit` tool call. Three responsibilities:

**1. Scope path warning**

Reads the current task's `scope.paths` allowlist from the task file. If the written file does not match any glob pattern, prints:
```
[Geas] WARNING: Write to <rel_path> outside scope.paths in <task_id>
```
Paths inside `.geas/` itself are always exempt.

**2. Automatic timestamp injection**

For files matching `*/.geas/*.json`, injects a real UTC timestamp into `created_at` when the field is absent, empty, or contains a dummy value.

**3. Mission spec freeze guard**

If the written file matches `*/.geas/missions/*/spec.json`, prints:
```
[Geas] WARNING: Mission spec was modified. Mission specs should be frozen after intake. Use a vote round for scope changes.
```

---

### Hook 5 — checkpoint-post-write.sh

| Field | Value |
|---|---|
| Event | `PostToolUse` |
| Matcher | `Write\|Edit` |
| Script | `plugin/hooks/scripts/checkpoint-post-write.sh` |
| Blocking | No (exits 0 in all cases) |
| Timeout | 10 s |

Fires after every `Write` or `Edit`. Implements the second half of the two-phase checkpoint.

1. Checks if the write target is `.geas/state/run.json`. All other writes are ignored.
2. Removes `.geas/state/_checkpoint_pending` if it exists, confirming the write completed successfully.

Works in tandem with `checkpoint-pre-write.sh` (Hook 3).

---

### Hook 6 — packet-stale-check.sh

| Field | Value |
|---|---|
| Event | `PostToolUse` |
| Matcher | `Write\|Edit` |
| Script | `plugin/hooks/scripts/packet-stale-check.sh` |
| Blocking | No (exits 0 in all cases) |
| Timeout | 10 s |

Fires after every `Write` or `Edit` to `run.json`.

1. Checks if `recovery_class` is set (indicating a recovered session).
2. Checks for existing context packets for the current task.
3. Warns if packets exist in a recovered session:
   ```
   Warning: STALE PACKETS: Session recovered (<recovery_class>). Context packets for <task_id> may be stale.
   ```

**Conditions:** Only activates for writes to `.geas/state/run.json`. Skips if no `current_task_id` is set or no packets exist.

---

### Hook 7 — integration-lane-check.sh

| Field | Value |
|---|---|
| Event | `PostToolUse` |
| Matcher | `Bash` |
| Script | `plugin/hooks/scripts/integration-lane-check.sh` |
| Blocking | No (exits 0 in all cases) |
| Timeout | 10 s |

Fires after every `Bash` tool call. Enforces the single-flight integration lane rule.

1. Checks if the Bash command contains `git merge` or `git rebase`. All other commands are ignored.
2. Reads `.geas/state/locks.json` and looks for a held `integration` lock.
3. Warns if no integration lock is held:
   ```
   INTEGRATION LANE: No integration_lock held. Acquire integration_lock before merging.
   ```

---

### Hook 8 — calculate-cost.sh

| Field | Value |
|---|---|
| Event | `Stop` |
| Script | `plugin/hooks/scripts/calculate-cost.sh` |
| Blocking | No (exits 0 in all cases) |
| Timeout | 30 s |

Fires at session end. Parses sub-agent session JSONL files from `~/.claude/projects/` to produce a token usage summary.

1. Locates the Claude project directory by normalizing `cwd` into the project hash format.
2. Finds the most recently modified session directory.
3. Parses all sub-agent JSONL files. Accumulates `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, and `cache_read_input_tokens`.
4. Reads agent type from `.meta.json` sidecar files.
5. Writes `.geas/ledger/token-summary.json` with the full breakdown (totals, per-agent, timestamp).
6. Prints a summary line to stderr:
   ```
   [Geas] Token summary: input=N output=N agents=N
   ```

**Conditions:** Skips if `.geas/` does not exist or the Claude project directory cannot be found.

---

### Hook 9 — restore-context.sh

| Field | Value |
|---|---|
| Event | `PostCompact` |
| Script | `plugin/hooks/scripts/restore-context.sh` |
| Blocking | No (exits 0 in all cases) |
| Timeout | 10 s |

Fires whenever the Claude Code runtime compacts the context window. Re-injects critical state so the orchestrator does not lose track of the current position.

1. Builds a context block from `run.json`: Phase, Status, Mission, Current task ID, Completed tasks (last 5).
2. Includes checkpoint data if present: pipeline step, agent in flight, remaining steps, and NEXT STEP (highlighted).
3. Includes recovery class if present.
4. Includes the current task contract (goal + acceptance criteria) if a task is active.
5. Reads `.geas/state/session-latest.md` and injects it as a `--- SESSION CONTEXT ---` section.
6. Reads the current task's `record.json` closure section for `open_risks` array.
7. Includes the first 30 lines of `.geas/rules.md` as `--- KEY RULES ---`.
8. Includes agent memory file count as `--- MEMORY STATE ---`.
9. Outputs an `## L0 ANTI-FORGETTING` section with 7 always-preserved items:
   - Phase and status
   - Focus task and goal
   - Rewind reason (recovery class or clean session)
   - Required next artifact (from remaining_steps)
   - Open risks (from record.json closure)
   - Recovery outcome
   - Active rules count + agent memory file count
10. Outputs `{"additionalContext": "..."}` on stdout.

**Conditions:** Skips if `cwd` is empty or `.geas/state/run.json` does not exist.

---

## Shared Library — geas-hooks.js

Path: `plugin/hooks/scripts/lib/geas-hooks.js`

All hook scripts use this shared Node.js module for common operations. Utility functions:

| Function | Description |
|---|---|
| `parseInput()` | Read stdin JSON, extract `cwd`, `filePath`, `agentType`, `command` |
| `geasDir(cwd)` | Return `.geas/` path for a given working directory |
| `readJson(path)` | Parse a JSON file, return `null` on error |
| `writeJson(path, data)` | Write JSON with 2-space indent, creates parent directories |
| `appendJsonl(path, obj)` | Append one JSON line to a JSONL file |
| `warn(msg)` | Print `[Geas] WARNING: <msg>` to stderr |
| `info(msg)` | Print `[Geas] <msg>` to stderr |
| `fnmatch(str, pattern)` | Glob matching with `*` and `?` |
| `matchScope(rel, paths)` | Check if a relative path matches any scope.paths entry |
| `outputContext(ctx)` | Output `{"additionalContext": "..."}` to stdout |
| `exists(path)` | Check if a file exists |
| `relPath(filePath, cwd)` | Get relative path normalized to forward slashes |

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
| 2 | Block (only meaningful for `Stop` hooks) |

For protocol details on hook failure handling, conformance checking, and metrics collection, see `protocol/10_ENFORCEMENT_CONFORMANCE_AND_METRICS.md`.

---

## State Files Referenced by Hooks

| Path | Used by |
|---|---|
| `.geas/state/run.json` | session-init, restore-context, checkpoint-pre-write, checkpoint-post-write, packet-stale-check |
| `.geas/state/_checkpoint_pending` | checkpoint-pre-write (creates), checkpoint-post-write (removes) |
| `.geas/memory/agents/*.md` | session-init (count check), inject-context, restore-context |
| `.geas/state/locks.json` | integration-lane-check |
| `.geas/rules.md` | session-init (creates), inject-context (reads), restore-context (reads) |
| `.geas/memory/agents/<name>.md` | inject-context |
| `.geas/missions/<mid>/tasks/<tid>/contract.json` | protect-geas-state |
| `.geas/missions/<mid>/spec.json` | protect-geas-state (freeze guard) |
| `.geas/state/policy-overrides.json` | inject-context |
| `.geas/state/session-latest.md` | restore-context |
| `.geas/ledger/token-summary.json` | calculate-cost (writes) |
| `.geas/missions/<mid>/tasks/<tid>/record.json` | restore-context (reads closure.open_risks) |
| `.geas/state/events.jsonl` | (event logging via CLI) |
