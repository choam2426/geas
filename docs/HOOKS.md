# Hooks Reference

## Overview

Hooks are shell scripts that Claude Code executes automatically at specific lifecycle events. They provide **mechanical enforcement** of Geas rules -- rather than relying on prompt instructions that agents can ignore or misinterpret, hooks intercept operations at the tool level and enforce constraints with real exit codes.

The Geas hook system serves three purposes:

1. **State continuity** -- restore context when a session starts so agents understand where the project left off.
2. **Evidence verification** -- confirm that agents actually produced the evidence artifacts the contract engine requires.
3. **State protection** -- prevent unauthorized or premature modifications to critical project state files.

Hooks do not replace prompt-based rules. They complement them: prompts tell agents what to do, hooks verify that they did it.


## Hook Configuration

All hooks are declared in `plugin/hooks/hooks.json`. The file follows Claude Code's hook specification:

```json
{
  "hooks": {
    "<EventName>": [
      {
        "matcher": "<regex pattern or empty string>",
        "hooks": [
          {
            "type": "command",
            "command": "<path to script>",
            "timeout": <seconds>
          }
        ]
      }
    ]
  }
}
```

### Fields

| Field | Description |
|-------|-------------|
| `EventName` | The lifecycle event that triggers the hook. One of: `SessionStart`, `SubagentStart`, `SubagentStop`, `PostToolUse`, `PostCompact`, `Stop`. |
| `matcher` | A regex pattern that filters when the hook runs. For `PostToolUse`, this matches against the tool name. An empty string matches everything. |
| `type` | Always `"command"` -- hooks are external shell commands. |
| `command` | Path to the script. Uses `${CLAUDE_PLUGIN_ROOT}` to resolve relative to the plugin directory. |
| `timeout` | Maximum execution time in seconds. If exceeded, the hook is killed and treated as a pass (exit 0). |

### Input

Every hook receives a JSON object on stdin containing at minimum:

- `cwd` -- the current working directory of the session.
- `tool_input` -- (PostToolUse only) the input parameters passed to the tool that was just invoked.


## Hook Reference

### 1. session-init.sh

| Property | Value |
|----------|-------|
| **Event** | `SessionStart` |
| **Matcher** | _(none -- runs on every session start)_ |
| **Timeout** | 10 seconds |
| **Script** | `plugin/hooks/scripts/session-init.sh` |

#### What it does

When a session begins, this hook checks whether the working directory is a Geas-managed project (has a `.geas/` directory) and restores context from the previous session.

**Step-by-step behavior:**

1. Parse `cwd` from stdin JSON.
2. Check if `.geas/` directory exists. If not, exit silently (not a Geas project).
3. Check if `.geas/state/run.json` exists. If not, print a reminder to run setup first.
4. Read `run.json` and print a status summary to stderr: mission, phase, status, and completed task count.
5. If a checkpoint file exists (`.geas/state/checkpoint.json`), read and include checkpoint information in the status summary.
6. If `.geas/rules.md` does not exist, create it from a built-in template containing evidence writing rules, Linear configuration, and code boundary rules.

#### Exit behavior

- **Always exits 0.** This hook never blocks. It is purely informational -- it injects context and creates missing configuration files.

#### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success. Session continues normally. |

---

### 2. inject-context.sh

| Property | Value |
|----------|-------|
| **Event** | `SubagentStart` |
| **Matcher** | _(none -- runs for all agents)_ |
| **Timeout** | 10 seconds |
| **Script** | `plugin/hooks/scripts/inject-context.sh` |

#### What it does

Before a sub-agent begins execution, this hook reads project-level rules and agent-specific memory files, then outputs them as additional context that is injected into the sub-agent's system prompt. This ensures every sub-agent starts with the project's current rules and any accumulated knowledge relevant to its role.

**Step-by-step behavior:**

1. Parse `cwd` and `agent_type` from stdin JSON.
2. Check if `.geas/` directory exists. If not, exit silently (not a Geas project).
3. Read `.geas/rules.md` if it exists. Prepend it to the context under a `--- PROJECT RULES ---` header.
4. Derive the agent-specific memory path: `.geas/memory/agents/{agent-type}.md`. If the file exists, append it to the context under a `--- YOUR MEMORY ---` header.
5. If any context was collected, output a JSON object with an `additionalContext` field containing the combined text.

#### Exit behavior

- **Always exits 0.** This hook never blocks. If any error occurs during file reading or JSON output, the script fails silently (errors are suppressed) and the sub-agent starts without additional context.

#### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success. Sub-agent receives the injected context (or starts without it if no files were found). |

#### Output

Unlike the other hooks which communicate through stderr warnings, this hook writes structured JSON to **stdout**:

```json
{
  "additionalContext": "--- PROJECT RULES (.geas/rules.md) ---\n...\n\n--- YOUR MEMORY (.geas/memory/agents/{agent-type}.md) ---\n..."
}
```

Claude Code reads this JSON and injects the `additionalContext` value into the sub-agent's prompt. If no context files exist, the hook produces no output.

---

### 3. protect-geas-state.sh

| Property | Value |
|----------|-------|
| **Event** | `PostToolUse` |
| **Matcher** | `Write\|Edit` |
| **Timeout** | 10 seconds |
| **Script** | `plugin/hooks/scripts/protect-geas-state.sh` |

#### What it does

Every time an agent uses the `Write` or `Edit` tool, this hook inspects the target file path and applies integrity checks.

**Three enforcement areas:**

1. **Timestamp injection** -- When any `.geas/**/*.json` file is written, the hook automatically injects a real UTC timestamp into the `created_at` field. Agents do not need to call `date -u` directly. Dummy timestamps (`:00:00Z` patterns) are also detected and replaced with real values.

2. **`.geas/spec/seed.json` protection** -- The seed file is frozen after intake. Any modification triggers a warning that the seed should not be changed.

3. **Prohibited path enforcement** -- Checks all Write|Edit operations against the current task's `prohibited_paths`. Warns (does not block) if a file matches a prohibited path pattern.

#### Exit behavior

- **Always exits 0.** This hook warns but never blocks. It trusts that warnings combined with prompt-level rules are sufficient to prevent most violations. A future version may escalate to blocking (exit 2) for critical state files.

#### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success (with or without warnings). Operation is allowed. |

#### Warning messages

| Message | Meaning |
|---------|---------|
| `seed.json was modified after intake` | The frozen seed specification was changed. |
| `File {path} matches prohibited_paths for {task-id}` | A Write/Edit target matches a prohibited path pattern for the current task. |

---

### 4. verify-task-status.sh

| Property | Value |
|----------|-------|
| **Event** | `PostToolUse` |
| **Matcher** | `Write\|Edit` |
| **Timeout** | 10 seconds |
| **Script** | `plugin/hooks/scripts/verify-task-status.sh` |

#### What it does

Every time an agent uses the `Write` or `Edit` tool on a `.geas/tasks/*.json` file where the task's status is set to `"passed"`, this hook checks that the 5 required evidence files exist:

- `forge-review.json` (Code Review by the Forge agent)
- `sentinel.json` (QA Testing by the Sentinel agent)
- `critic-review.json` (Critic Pre-ship Review)
- `nova-verdict.json` (Nova Product Review)
- `memory/retro/{task-id}.json` (Scrum Retrospective)

If any file is missing, the hook emits a warning.

#### Exit behavior

- **Always exits 0.** This hook warns but never blocks. It acts as an early warning for issues that **verify-pipeline** will later enforce at session exit.

#### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success (with or without warnings). Operation is allowed. |

#### Warning messages

| Message | Meaning |
|---------|---------|
| `{task-id} marked as passed but forge-review.json is missing` | Task promoted to "passed" without Code Review evidence. |
| `{task-id} marked as passed but sentinel.json is missing` | Task promoted to "passed" without QA Testing evidence. |
| `{task-id} marked as passed but critic-review.json is missing` | Task promoted to "passed" without Critic Pre-ship Review evidence. |
| `{task-id} marked as passed but nova-verdict.json is missing` | Task promoted to "passed" without Nova Product Review evidence. |
| `{task-id} marked as passed but retro/{task-id}.json is missing` | Task promoted to "passed" without Scrum Retrospective evidence. |

---

### 5. restore-context.sh

| Property | Value |
|----------|-------|
| **Event** | `PostCompact` |
| **Matcher** | _(none -- runs after every context compaction)_ |
| **Timeout** | 10 seconds |
| **Script** | `plugin/hooks/scripts/restore-context.sh` |

#### What it does

After Claude Code compacts the conversation context (to fit within the context window), critical Geas state may be lost. This hook re-injects essential state so the orchestrator can continue without losing track of the current run.

**Step-by-step behavior:**

1. Parse `cwd` from stdin JSON.
2. Check if `.geas/` directory exists. If not, exit silently.
3. Read `.geas/state/run.json` and `.geas/rules.md`.
4. Output the current run state and rules as `additionalContext` JSON, similar to `inject-context.sh`.

#### Exit behavior

- **Always exits 0.** This hook never blocks. It is purely informational -- it re-injects context after compaction.

#### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success. Session continues with restored context. |

---

### 6. track-cost.sh

| Property | Value |
|----------|-------|
| **Event** | `SubagentStop` |
| **Matcher** | _(none -- runs after every sub-agent completes)_ |
| **Timeout** | 10 seconds |
| **Script** | `plugin/hooks/scripts/track-cost.sh` |

#### What it does

After a sub-agent completes, this hook logs the agent name, task ID, and model used to `.geas/ledger/costs.jsonl`. This data is consumed by the `run-summary` skill to produce a cost report section at the end of a run.

#### Exit behavior

- **Always exits 0.** This hook never blocks. It is purely a logging hook.

#### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success. Cost entry logged. |

---

### 7. verify-pipeline.sh

| Property | Value |
|----------|-------|
| **Event** | `Stop` |
| **Matcher** | _(none -- runs on every session stop)_ |
| **Timeout** | 30 seconds |
| **Script** | `plugin/hooks/scripts/verify-pipeline.sh` |

#### What it does

Before a session ends, this hook checks that all completed tasks have the mandatory evidence files. This is the **only hook that can block** -- it prevents a session from ending with incomplete verification.

**Step-by-step behavior:**

1. Parse `cwd` from stdin JSON.
2. Check if `.geas/` and `run.json` exist. If not, skip.
3. Read `status` from `run.json`. If already `"complete"`, skip (no re-check needed).
4. Read `phase` from `run.json`. Only enforce during `mvp`, `polish`, or `evolve` phases. During `genesis` phase, evidence requirements are not yet enforced.
5. Iterate over `completed_tasks` array. For each task, check for:
   - `forge-review.json` in `.geas/evidence/{task-id}/`
   - `sentinel.json` in `.geas/evidence/{task-id}/`
   - `critic-review.json` in `.geas/evidence/{task-id}/`
   - `nova-verdict.json` in `.geas/evidence/{task-id}/`
   - `memory/retro/{task-id}.json` in `.geas/`
6. If any evidence is missing, print the list and **block session exit**.

#### Exit behavior

- **Exits 0** if all evidence is present or if checks are not applicable (not a Geas project, already complete, genesis phase).
- **Exits 2** if mandatory evidence is missing. This blocks the session from ending -- the agent must complete the missing verification steps first.

#### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Pipeline is complete. Session may end. |
| `2` | **Blocking.** Mandatory evidence is missing. Session exit is prevented. |


## Lifecycle Diagram

The following diagram shows when each hook fires during a typical Geas session:

```
Session Start
    |
    v
[SessionStart] ---> session-init.sh
    |                  - Restore run.json state + checkpoint info
    |                  - Create rules.md if missing
    |                  - Print status summary
    v
Agent Work Loop
    |
    |--- Agent uses Write/Edit tool
    |       |
    |       v
    |   [PostToolUse] ---> protect-geas-state.sh
    |       |                - Inject timestamps into .geas/**/*.json
    |       |                - Check .geas/spec/seed.json for modification
    |       |                - Check prohibited_paths
    |       |                - (warn only, never blocks)
    |       |
    |       +-------------> verify-task-status.sh
    |       |                - Check 5 evidence files when task marked passed
    |       |                - (warn only, never blocks)
    |       v
    |   Tool operation proceeds
    |
    |--- Context compacted
    |       |
    |       v
    |   [PostCompact] ---> restore-context.sh
    |       |                - Re-inject run state and rules
    |       v
    |   Session continues with restored context
    |
    |--- Sub-agent dispatched
    |       |
    |       v
    |   [SubagentStart] ---> inject-context.sh
    |       |                  - Read .geas/rules.md
    |       |                  - Read .geas/memory/agents/{agent-type}.md
    |       |                  - Output additionalContext JSON
    |       v
    |   Sub-agent executes with injected context
    |       |
    |       v
    |   Sub-agent completes
    |       |
    |       v
    |   [SubagentStop] ---> track-cost.sh
    |       |                 - Log agent/task/model to costs.jsonl
    |       |                 - (never blocks)
    |       v
    |   Main agent decides: retry or continue
    |
    v
Session End Requested
    |
    v
[Stop] ---> verify-pipeline.sh
    |          - Check all completed_tasks have evidence
    |          - During mvp/polish/evolve phases only
    |          - BLOCKS (exit 2) if evidence missing
    |
    |--- exit 0 ---> Session ends
    |--- exit 2 ---> Session blocked, agent must fix
```

### Key interactions

- **session-init** sets the stage by restoring state and checkpoint info. Without it, agents start without context about previous work.
- **inject-context** ensures every sub-agent inherits project rules and its own accumulated memory. Without it, sub-agents start with no knowledge of project-specific constraints or lessons learned from previous runs.
- **protect-geas-state** enforces timestamp injection, seed protection, and prohibited path boundaries in real time as agents write files.
- **verify-task-status** catches premature task completion -- when a task is marked "passed" without the 5 required evidence files. It acts as an early warning for issues that **verify-pipeline** will later enforce.
- **restore-context** re-injects critical state after context compaction, preventing the orchestrator from losing track of the current run.
- **track-cost** logs agent, task, and model information after each sub-agent completes. This data feeds into the run-summary cost report.
- **verify-pipeline** is the final gate. Even if earlier warnings were ignored, this hook prevents the session from closing with incomplete evidence. It is the mechanical enforcement of the "Evidence over declaration" principle.


## Dependencies

### Python (required)

All hooks use Python for JSON parsing instead of `jq`. This is a deliberate choice:

- Python is available on virtually all development machines.
- `jq` is not installed by default on macOS or Windows and requires separate installation.
- The Python invocations use only the standard library (`json`, `sys`, `os`, `glob`) -- no third-party packages are needed.

Python is invoked inline within the bash scripts using `python -c "..."` blocks. The scripts expect `python` to be on the PATH. If your system uses `python3` exclusively, ensure `python` is aliased or symlinked.

### Bash

All hooks are bash scripts and require a bash-compatible shell. On Windows, this is provided by Git Bash or WSL.

### File system

Hooks read from and check for files under the `.geas/` directory:

| Path | Purpose |
|------|---------|
| `.geas/state/run.json` | Current run state (mission, phase, status, task list) |
| `.geas/rules.md` | Agent rules template (created by session-init if missing, injected by inject-context) |
| `.geas/memory/agents/{agent-type}.md` | Per-agent accumulated memory (injected by inject-context) |
| `.geas/tasks/*.json` | TaskContract files (monitored by protect-geas-state) |
| `.geas/spec/seed.json` | Frozen project specification (monitored by protect-geas-state) |
| `.geas/evidence/{task-id}/*.json` | Evidence files (checked by verify-task-status and verify-pipeline) |
| `.geas/ledger/costs.jsonl` | Cost tracking log (written by track-cost, read by run-summary) |


## Troubleshooting

### Hook does not fire

**Symptom:** No `[Geas]` messages appear in output.

**Possible causes:**
- The working directory does not contain a `.geas/` directory. Hooks silently skip non-Geas projects.
- `hooks.json` is not loaded. Verify that the plugin is correctly registered with Claude Code.
- The `${CLAUDE_PLUGIN_ROOT}` variable is not set. This is set automatically by Claude Code when loading a plugin.

### "python: command not found"

**Symptom:** Hook fails silently or prints a shell error about python not being found.

**Fix:** Ensure `python` is on your PATH. On systems where only `python3` is available:
```bash
# Option 1: alias (add to ~/.bashrc or ~/.zshrc)
alias python=python3

# Option 2: symlink
sudo ln -s $(which python3) /usr/local/bin/python
```

### Hook timeout

**Symptom:** Hook appears to hang, then the session continues without output.

**Cause:** Hooks have a timeout (10 or 30 seconds). If Python or file I/O is slow (e.g., network-mounted `.geas/` directory), the hook may be killed before completing.

**Fix:** Move `.geas/` to local storage. Hook timeouts are configured in `hooks.json` and can be increased if needed.

### "Pipeline incomplete" blocks session exit

**Symptom:** Session refuses to end with the message `Pipeline incomplete. MANDATORY evidence missing`.

**Cause:** `verify-pipeline.sh` found completed tasks without the required evidence files: `forge-review.json`, `sentinel.json`, `critic-review.json`, `nova-verdict.json`, or `memory/retro/{task-id}.json`.

**Fix:** This is working as designed. Complete the missing verification steps:
1. Check which tasks are listed in the error message.
2. Run the missing steps (Code Review, QA Testing, Critic Pre-ship Review, Nova Product Review, or Scrum Retrospective) for those tasks.
3. Verify that evidence files are written to `.geas/evidence/{task-id}/` and `.geas/memory/retro/`.
4. Attempt to end the session again.

### Warnings about seed.json modification

**Symptom:** `[Geas] Warning: seed.json was modified after intake.`

**Cause:** An agent edited `.geas/spec/seed.json` after the intake phase. The seed is meant to be frozen once requirements gathering is complete.

**Fix:** If the modification was intentional (e.g., correcting a mistake discovered during development), the warning can be acknowledged. If it was accidental, restore the original seed from git history:
```bash
git checkout HEAD -- .geas/spec/seed.json
```

### Task marked "passed" without evidence

**Symptom:** `[Geas] Warning: {task-id} marked as passed but forge-review.json is missing`

**Cause:** An agent set a TaskContract's status to `"passed"` without the Code Review or QA evidence being present. This circumvents the Evidence Gate.

**Fix:** Do not manually set task status to `"passed"`. Let the Evidence Gate skill handle status transitions after verification is complete. If the status was set prematurely, revert it and run the missing verification steps.
