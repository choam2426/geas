# Hooks Reference

Hooks are Claude Code runtime scripts that the harness executes at defined lifecycle events. Geas uses them to surface `.geas/` state at session start, inject memory into sub-agents, and block raw writes into the runtime tree. Hooks are best-effort — if a hook fails or is absent, the mission still proceeds. The canonical runtime tree is owned by the `geas` CLI; hooks only observe and surface state.

Configuration: `plugins/geas/hooks/hooks.json`
Scripts: `plugins/geas/hooks/scripts/`
Shared helper: `plugins/geas/hooks/scripts/lib/geas-hooks.js`

For the broader automation story (what `.geas/events.jsonl` records, and which CLI commands emit events), see `architecture/CLI.md` §14.7 and `architecture/DESIGN.md`.

---

## 1. Hook Inventory

Three scripts across three lifecycle events. The v3 surface is intentionally small — v2 hooks for checkpoint, policy protection, packet staleness, integration lock, restore, and cost tallying were removed in G7 because each wrote outside the `.geas/` registry or duplicated CLI-owned concerns.

| # | Event | Matcher | Script | Purpose |
|---|---|---|---|---|
| 1 | `SessionStart` | (all) | `session-init.sh` | Print a one-line context summary from `.geas/` state to stderr. |
| 2 | `SubagentStart` | (all) | `inject-context.sh` | Inject shared memory and per-agent memory into the new sub-agent's context. |
| 3 | `PreToolUse` | `Write|Edit` | `geas-write-block.js` | Block any direct `Write` / `Edit` tool call that targets `.geas/`. |

Deleted in G7 (do not re-add without re-opening the migration-strategy design):

- `calculate-cost.sh` (Stop) — token-usage tallying was outside the `.geas/` registry.
- `checkpoint-pre-write.sh`, `checkpoint-post-write.sh` (PreToolUse / PostToolUse Write on `run.json`) — v2-only two-phase checkpoint for a file that no longer exists.
- `packet-stale-check.sh` (PostToolUse Write|Edit) — checked a v2 "context packet" concept not present in v3.
- `protect-geas-state.sh` (PostToolUse Write|Edit) — overlapped with `geas-write-block.js` (PreToolUse) and did the same job weaker.
- `integration-lane-check.sh` (PostToolUse Bash) — warned about merges without an integration lock; v3 has no lock-manifest surface.
- `restore-context.sh` (PostCompact) — restored context from v2-only `run.json`.

---

## 2. Hook Lifecycle

```
Session begins
│
├─► SessionStart              → session-init.sh
│     Read .geas/ state, print a one-line summary to stderr
│     (missions count + latest + phase; memory; open debts).
│     No writes.
│
│   [For each sub-agent the orchestrator spawns]
│   │
│   ├─► SubagentStart         → inject-context.sh
│   │     Read .geas/memory/shared.md + agents/{type}.md.
│   │     Emit { "additionalContext": "..." } to stdout.
│   │
│   │   [Before each Write or Edit tool call]
│   │   │
│   │   ├─► PreToolUse        → geas-write-block.js
│   │   │     If file_path is under .geas/, emit a "decision":"block"
│   │   │     JSON with an error message directing to the CLI.
│   │   │     Otherwise exit 0 silently.
```

There are no `PostToolUse`, `Stop`, or `PostCompact` hooks in v3.

---

## 3. Per-hook Details

### 3.1 `SessionStart` — `session-init.sh`

**When it runs.** Every session start.

**Reads.**
- `.geas/missions/` — counts entries matching `mission-*` and finds the lexicographically latest one to read its phase.
- `.geas/missions/{latest}/mission-state.json` — `phase` field, if present.
- `.geas/memory/shared.md` — existence only.
- `.geas/memory/agents/` — counts `*.md` files.
- `.geas/debts.json` — counts entries with `status == "open"`.

**Writes.** None. Read-only.

**Output.** A single `[Geas]` line to stderr summarizing the state, e.g.:

```
[Geas] Session resumed. Missions: 3 | latest: mission-20260420-ab12cd34 (building) | Memory: shared=yes, agent notes=2 | Open debts: 1
```

If `.geas/` is missing or the summary is empty, the script exits silently.

**Failure handling.** Best-effort. Any I/O or parse error is swallowed; the session continues without a summary line.

### 3.2 `SubagentStart` — `inject-context.sh`

**When it runs.** Every time the harness spawns a sub-agent.

**Reads.**
- `.geas/memory/shared.md` — full body (injected for every sub-agent).
- `.geas/memory/agents/{agent_type}.md` — injected only when the harness supplies an `agent_type` for the sub-agent and the matching file exists.

The hook intentionally does not inject mission or task context. Mission / task context flows through the orchestrator's explicit TaskContract and agent prompt, not through hooks.

**Writes.** None.

**Output.** JSON on stdout:

```json
{ "additionalContext": "--- SHARED MEMORY ... ---\n\n...\n\n--- YOUR MEMORY ... ---\n\n..." }
```

Or nothing if neither memory source has content.

**Failure handling.** Best-effort. If `.geas/` is missing or memory files are unreadable, the hook exits without emitting context; the sub-agent starts with whatever the orchestrator supplied.

### 3.3 `PreToolUse` (`Write|Edit`) — `geas-write-block.js`

**When it runs.** Before every `Write` or `Edit` tool call.

**Reads.** The hook input payload on stdin: `cwd` and `tool_input.file_path`.

**Writes.** None to disk.

**Decision.**
- If `file_path` resolves to a path under `.geas/` (relative to `cwd` or by substring match on the normalized absolute path), emit a JSON decision on stdout and exit 0:
  ```json
  {
    "decision": "block",
    "reason": "[Geas] BLOCKED: Direct Write/Edit to .geas/ is not allowed. All .geas/ file modifications must use geas CLI commands. Examples: geas mission create, geas task draft, geas evidence append, geas memory shared-set, geas debt register, geas event log. Invoke CLI commands instead."
  }
  ```
- Otherwise exit 0 silently (allow).

**Failure handling.** Any stdin / parse error results in exit 0 (allow). The hook fails open — a broken hook must not prevent legitimate edits outside `.geas/`. The CLI itself is the authoritative barrier; the hook is an early warning.

---

## 4. Events and Hook Boundary

`events.jsonl` is a separate channel from hooks. Hooks run inside the Claude Code harness and never write to `.geas/events.jsonl`. Events are emitted exclusively by the `geas` CLI when it performs a protocol waypoint (mission creation, task transition, evidence append, etc.). See `architecture/CLI.md` §14.7 for the full contract.

### 4.1 Automation-only scope

`events.jsonl` is automation-only: every entry corresponds to a CLI waypoint. Hooks do not contribute entries; user-side messages do not, either. If an operator needs to mark something the CLI did not observe directly, they use `geas event log` — which goes through the CLI, not through a hook.

### 4.2 Event kinds emitted by the CLI

| Kind | Emitter |
|---|---|
| `mission_created` | `geas mission create` |
| `mission_approved` | `geas mission approve` |
| `mission_design_set` | `geas mission design-set` |
| `mission_phase_advanced` | `geas mission-state update --phase` |
| `phase_review_appended` | `geas phase-review append` |
| `mission_verdict_appended` | `geas mission-verdict append` |
| `task_drafted` | `geas task draft` |
| `task_approved` | `geas task approve` |
| `task_state_changed` | `geas task transition` |
| `impl_contract_set` | `geas impl-contract set` |
| `self_check_appended` | `geas self-check append` |
| `evidence_appended` | `geas evidence append` |
| `gate_run_recorded` | `geas gate run` |
| `deliberation_appended` | `geas deliberation append` |
| `debt_registered` | `geas debt register` |
| `debt_status_updated` | `geas debt update-status` |
| `gap_set` | `geas gap set` |
| `memory_update_set` | `geas memory-update set` |
| `memory_shared_set` | `geas memory shared-set` |
| `memory_agent_set` | `geas memory agent-set` |
| `consolidation_scaffolded` | `geas consolidation scaffold` |
| user-supplied `kind` | `geas event log` |

### 4.3 Actor namespace

The `actor` field on each event accepts three kinds of values:

1. **Slot identifiers (kebab-case)** — any slot id defined by the protocol: `orchestrator`, `decision-maker`, `design-authority`, `challenger`, `implementer`, `verifier`, `risk-assessor`, `operator`, `communicator`, plus any concrete slot the domain profile defines.
2. **`user`** — a human decision captured in the log.
3. **`cli:auto`** — the CLI itself, when it auto-emits an event during a waypoint the user / orchestrator triggered.

The `:` in `cli:auto` is an intentional exception to the kebab-case slot-id convention. This exception applies only to events.jsonl (not to any protocol artifact), because events.jsonl is an implementation aux log, not a canonical protocol artifact. See `architecture/CLI.md` §14.7.

### 4.4 Best-effort semantics

Event writes never roll back their originating CLI command. If events.jsonl cannot be written (disk full, permission error), the CLI still returns `ok` on the waypoint. This mirrors the hook failure policy — telemetry is secondary to the primary write.

---

## 5. Extending Hooks

A project that wants additional lifecycle behavior on top of Geas can add its own hook scripts without modifying the plugin's `hooks.json`. The Claude Code harness merges user-level `settings.json` hooks with the plugin's hooks; both fire.

**Where to put user hooks.**
- User-level: `~/.claude/settings.json`.
- Project-level: `.claude/settings.json` in the project root.

**Naming conventions for clarity.**
- Prefix custom script names with the project or organization (`myorg-session-note.sh`) to avoid confusion with the Geas scripts.
- Keep the three v3 Geas scripts untouched. Do not add logic to `session-init.sh`, `inject-context.sh`, or `geas-write-block.js` — upstream changes will overwrite them.

**Rules for well-behaved custom hooks.**

1. **Read-only on `.geas/`**. Never write to `.geas/` from a hook. If you need to record something, shell out to `geas event log`.
2. **Fail open**. Exit 0 when the hook cannot complete its job, unless blocking is the point (as with `geas-write-block.js`).
3. **No long-running work**. The harness enforces a timeout; keep the hook under a second.
4. **Respect the `.geas/` block**. A custom `Write|Edit` hook that targets `.geas/` will be blocked by `geas-write-block.js` before the harness reaches it. Route writes through the CLI.

---

## 6. Cross-references

- `architecture/CLI.md` §14.7 — events.jsonl contract, event kinds, actor namespace.
- `architecture/DESIGN.md` — how automation, hooks, and the CLI relate.
- `SKILLS.md` — which skills invoke which CLI commands.
- `plugins/geas/hooks/hooks.json` — the current registration.
- `plugins/geas/hooks/scripts/` — the script bodies themselves.
