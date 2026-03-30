# Geas User Guide

A step-by-step guide to using the Geas harness for contract-driven, multi-agent AI development.

Geas brings structure to AI-driven development: every decision follows a process, every action is traceable, every output is verified against a contract, and the team gets smarter over time. This guide walks you through installation, your first mission, and the key concepts you will encounter along the way.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Installation](#2-installation)
3. [Your First Mission (Initiative)](#3-your-first-mission-initiative)
4. [Adding a Feature (Sprint)](#4-adding-a-feature-sprint)
5. [Making a Decision (Debate)](#5-making-a-decision-debate)
6. [Understanding .geas/](#6-understanding-geas)
7. [MCP Server Recommendations](#7-mcp-server-recommendations)
8. [Resuming a Session](#8-resuming-a-session)
9. [Hooks -- Mechanical Enforcement](#9-hooks----mechanical-enforcement)
10. [FAQ / Troubleshooting](#10-faq--troubleshooting)

---

## 1. Prerequisites

Before you begin, make sure you have the following:

**Required:**

- [Claude Code CLI](https://claude.ai/code) installed and authenticated. This is the runtime that Geas operates within.

**Optional:**

- Python 3.10+ -- required for the hook system that enforces pipeline integrity.

---

## 2. Installation

### Install from the Plugin Marketplace

Run these two commands inside Claude Code:

```bash
/plugin marketplace add choam2426/geas
/plugin install geas@choam2426-geas
```

Alternatively, type `/plugin` to open the interactive UI. Add `choam2426/geas` under **Marketplaces**, then install from the **Discover** tab.

### Verify the Installation

After installation, you can confirm the plugin is loaded by checking that Geas skills are available. Type a natural-language request like:

```text
Build me a task management app.
```

If Geas is installed correctly, Compass (the orchestrator) will take over and begin the intake process. You should see Socratic questions about your project requirements rather than Claude jumping straight into code.

You can also verify the plugin registered its agents by checking the Claude Code plugin list.

---

## 3. Your First Mission (Initiative)

Initiative mode is for building a new product from scratch. It runs through four phases: Genesis, MVP Build, Polish, and Evolution.

### What to Type

Just describe what you want to build in plain language:

```text
Build me a real-time polling app with shareable invite links.
```

That is all you need. Compass detects that this is a new product and activates Initiative mode automatically. Here is what happens step by step.

### Step-by-step Walkthrough

#### Setup: Initializing the Project

On the first run, Compass invokes the setup skill automatically. This creates the `.geas/` runtime directory in your project root with the following structure:

```
.geas/
  spec/          -- frozen requirements
  state/         -- execution state (run.json)
  tasks/         -- compiled TaskContracts
  packets/       -- agent briefings
  evidence/      -- agent outputs and verification results
  decisions/     -- decision records
  ledger/        -- append-only event log
  memory/        -- project conventions, retrospectives, and per-agent memory
    _project/    -- project-wide conventions
    retro/       -- retrospective lessons per task
    agents/      -- per-agent memory (grows across sessions)
```

Setup also creates `.geas/rules.md`, a shared rules document that every agent reads before doing any work. This file contains evidence-writing rules and code boundary constraints. It is a living document that evolves as the project progresses.

#### Intake Gate: Defining the Mission

Before any agent writes code, the Intake Gate runs. Its job is to surface hidden assumptions and produce a frozen specification.

Compass asks you questions in a brainstorming-style, one question at a time. Rather than scoring answers on a numeric scale, Intake uses a **completeness checklist** to track which areas are covered:

- Scope (what is in, what is explicitly out)
- Target user
- Constraints (tech stack, hosting, budget)
- Acceptance criteria (how will you know this is done)

Each question builds on your previous answers. Once the checklist is sufficiently complete, Compass produces a summary for your confirmation.

Once you confirm the summary, the specification is written to `.geas/spec/seed.json` and frozen. This seed becomes the source of truth for the entire run.

If you prefer to skip the questions, you can say "just build it" -- but the seed will note the unresolved ambiguities.

#### Mode Detection

After the seed is frozen, Compass determines the execution mode:

| Your Intent | Detected Mode |
|-------------|---------------|
| New product or broad mission | Initiative |
| Adding a feature to an existing project | Sprint |
| Decision-only discussion, no code | Debate |

You can also force a mode directly by invoking `/geas:initiative`, `/geas:sprint`, or `/geas:debate`.

#### Phase 1: Genesis

Genesis establishes the vision, architecture, and task plan.

**1. Nova's Vision.** Nova (the CEO/Product agent) reads the seed and delivers a product vision: MVP scope, user value proposition, and strategic direction. Output is written to `.geas/evidence/genesis/nova.json`.

**2. Forge's Architecture.** Forge (the CTO/Architecture agent) reads the seed and Nova's vision, then proposes the tech stack and architecture. Conventions are written to `.geas/memory/_project/conventions.md` and a DecisionRecord is created.

**3. Vote Round.** Compass solicits votes from affected agents (typically Circuit, Palette, and Critic) on the architecture proposal. Critic serves as the mandatory devil's advocate, stress-testing the proposal for hidden risks and trade-offs. If all agree, Genesis proceeds. If any disagree, a structured debate runs -- back-and-forth rounds of argument, with Nova as tiebreaker after three unresolved rounds.

**4. Task Compilation.** The seed and architecture are compiled into 5-10 granular TaskContracts, each with:
- A specific, verifiable goal
- Acceptance criteria (minimum 3 per task)
- Path boundaries (prohibited files that the worker must not touch)
- Eval commands (build, lint, test)
- A retry budget and escalation policy

**5. MCP Server Recommendations.** Based on the chosen tech stack, Compass recommends MCP servers that can help the team (see [Section 8](#8-mcp-server-recommendations)). You can connect them now or skip.

**6. Genesis closes.** Run state is updated and the project moves to MVP Build.

#### Phase 2: MVP Build

Every task goes through the full pipeline. No step is skipped, no task is batched.

For each TaskContract, in dependency order:

1. **Design (Palette)** -- If the task has a user-facing interface, Palette writes a design spec with layout, interactions, and component hierarchy. Skipped for backend-only tasks.

2. **Tech Guide (Forge)** -- Forge writes a technical approach document: which patterns to use, what to watch out for, how this task connects to the architecture. Skipped for trivial tasks (config changes, version bumps).

3. **Implementation (Pixel/Circuit)** -- The assigned worker implements the feature in a worktree-isolated environment. They read their ContextPacket (a focused briefing assembled from the seed, design spec, tech guide, and prior evidence) and produce an EvidenceBundle documenting what they built.

4. **Code Review (Forge)** -- Forge reviews the implementation against acceptance criteria and architecture conventions. This step is mandatory for every task.

5. **Testing (Sentinel)** -- Sentinel runs QA against the acceptance criteria and eval commands. This step is mandatory for every task.

6. **Evidence Gate** -- A 3-tier verification gate:
   - **Tier 1 -- Mechanical**: Does the code build? Does it pass lint? Do tests pass?
   - **Tier 2 -- Semantic**: Are all acceptance criteria met? Does the evidence support each one?
   - **Tier 3 -- Product**: Nova reviews the feature for mission alignment and quality.

   If the gate fails, the verify-fix loop kicks in: the responsible agent (Pixel for frontend issues, Circuit for backend issues) gets a fix-specific ContextPacket and tries again. This repeats up to the task's retry budget (default 3). If the budget is exhausted, it escalates -- Forge reviews the design, or Nova makes a strategic call (continue, cut, or pivot).

7. **Critic Pre-ship Review (Critic)** -- Before Nova renders a verdict, Critic reviews the accumulated evidence and challenges anything suspicious: unverified assumptions, missing edge cases, or acceptance criteria that passed too easily. Critic's feedback is written to `.geas/evidence/{task-id}/critic-review.json`.

8. **Nova Product Review** -- Nova reads all evidence (including Critic's challenges) and delivers a verdict: Ship, Iterate, or Cut.

9. **Ship Gate** -- Before marking a task as passed, Compass verifies that `forge-review.json`, `sentinel.json`, `critic-review.json`, and `nova-verdict.json` all exist, plus `memory/retro/{task-id}.json` after retrospective. If any is missing, the missing step runs before proceeding.

10. **Keeper Commit** -- Once the Ship Gate passes, Keeper commits the task's changes with a structured commit message that references the task ID and acceptance criteria.

11. **Scrum Retrospective** -- After the Ship Gate, Scrum runs a retrospective on the completed task: what went well, what went wrong, and what conventions should be extracted. Lessons are written to `.geas/memory/retro/` and relevant conventions are merged into `.geas/rules.md`.

After each task, `.geas/rules.md` is updated with any new conventions discovered during execution.

**Tech Debt Tracking** -- During execution, agents (Forge, Critic, Scrum) may report `tech_debt` items in their evidence when they identify shortcuts, deferred improvements, or known issues. Compass collects these into `.geas/debt.json`, a persistent tracker that carries debt visibility across sessions. ContextPackets include a "Known Tech Debt" section so agents are aware of existing debt when working on related areas. The `run-summary` skill includes a Tech Debt Report at the end of each run.

#### Phase 3: Polish

After all MVP tasks are complete:

- **Shield** (Security agent) runs a security review of the entire project.
- **Scroll** (Documentation agent) writes README and documentation.

Issues found are fixed before closing the phase.

#### Phase 4: Evolution

A final improvement pass within the original scope:

- Remaining items from `scope_in` are addressed.
- Items in `scope_out` are rejected.
- Keeper creates a release commit or tag, consolidating the project's deliverables.
- Nova delivers a final strategic briefing with recommendations for next steps.

The run status is set to `"complete"`.

### What Appears in .geas/

After a full run, you will find artifacts at every step:

```
.geas/
  spec/seed.json                          -- frozen requirements
  state/run.json                          -- final run state (status: complete)
  tasks/task-001.json ... task-N.json     -- all TaskContracts
  evidence/genesis/nova.json              -- Nova's vision
  evidence/genesis/forge.json             -- Forge's architecture
  evidence/genesis/vote-circuit.json      -- vote results
  evidence/genesis/vote-critic.json       -- Critic's devil's advocate vote
  evidence/task-001/palette.json          -- design spec
  evidence/task-001/pixel.json            -- implementation evidence
  evidence/task-001/forge-review.json     -- code review
  evidence/task-001/sentinel.json         -- QA results
  evidence/task-001/critic-review.json    -- Critic's pre-ship review
  evidence/task-001/nova-verdict.json     -- product review
  evidence/polish/shield.json             -- security review
  evidence/polish/scroll.json             -- documentation review
  evidence/evolution/nova-final.json      -- final briefing
  packets/task-001/palette.md             -- design context packet
  packets/task-001/pixel.md               -- implementation context packet
  decisions/dec-001.json                  -- architecture decision record
  ledger/events.jsonl                     -- every state transition
  memory/_project/conventions.md          -- project conventions
  memory/retro/task-001.json             -- retrospective lessons per task
  memory/agents/pixel.md                 -- per-agent memory (grows across sessions)
  memory/agents/circuit.md               -- per-agent memory
  rules.md                                -- shared agent rules
  config.json                             -- runtime config
```

---

## 4. Adding a Feature (Sprint)

### When to Use Sprint

Use Sprint when you are adding a bounded feature to an existing project. The codebase already exists, the architecture is established, and you need to build one specific thing.

Sprint skips the Genesis phase entirely. There is no vision, no architecture proposal, no vote round. Instead, it goes straight to Design, Build, Review, QA.

### What to Type

Describe the feature you want to add:

```text
Add a dark mode toggle to the settings page.
```

If the project already has a `.geas/` directory from a previous run, Compass detects the existing project and selects Sprint mode automatically. If it is the first run, Compass will run setup and intake first (with lighter Socratic questioning -- one round, focused on what the feature does, what it touches, and what must not change).

### How Sprint Differs from Initiative

| Aspect | Initiative | Sprint |
|--------|-----------|--------|
| Genesis phase | Yes (vision, architecture, votes) | No |
| Intake depth | Deep (brainstorming-style, full checklist) | Light (focused on feature scope and constraints) |
| Task count | 5-10 tasks | Usually 1 task |
| Conventions | Forge scans and writes from scratch | Uses existing `.geas/memory/_project/conventions.md` |

If `conventions.md` does not exist yet (your first Sprint in a project), Forge is spawned to scan the codebase and write conventions before the pipeline starts.

### The Sprint Pipeline

1. **Compile TaskContract** -- The feature is compiled into a single TaskContract with acceptance criteria, path boundaries, and eval commands.

2. **Design (Palette)** -- If the feature has a user-facing interface. Skipped for backend-only work.

3. **Tech Guide (Forge)** -- Technical approach guidance. Skipped for trivial changes.

4. **Implementation** -- The assigned worker (Pixel or Circuit) builds the feature in worktree isolation.

5. **Code Review (Forge)** -- Mandatory. Forge reviews the implementation.

6. **Testing (Sentinel)** -- Mandatory. Sentinel runs QA.

7. **Evidence Gate** -- Same 3-tier gate as Initiative (mechanical, semantic, product).

8. **Critic Pre-ship Review (Critic)** -- Mandatory. Critic reviews all evidence and challenges readiness before Nova's verdict. Evidence written to `.geas/evidence/{task-id}/critic-review.json`.

9. **Nova Product Review** -- Ship, Iterate, or Cut verdict.

10. **Ship Gate** -- All four mandatory evidence files (`forge-review.json`, `sentinel.json`, `critic-review.json`, `nova-verdict.json`) must exist before the task is marked passed.

---

## 5. Making a Decision (Debate)

### When to Use Debate

Use Debate when you need to make a technical or product decision before writing any code. No implementation happens in Debate mode. The output is a DecisionRecord, not a feature.

Examples:
- "Should we use PostgreSQL or MongoDB for this project?"
- "REST API or GraphQL?"
- "Monorepo or separate repos?"

### What to Type

```text
We need to decide between Next.js and Remix for the frontend framework.
```

Or invoke it directly:

```text
/geas:debate Should we use SSR or client-side rendering for the dashboard?
```

### How Debate Works

1. **Frame the Question.** Compass formulates your question as a clear decision with 2-3 options and confirms with you.

2. **Spawn Debaters.** Multiple agents argue for and against each option:
   - Forge argues the technical merits of one option
   - Critic challenges assumptions and argues the alternative
   - Circuit evaluates from a backend/scalability perspective
   - Palette evaluates from a UX/frontend perspective

3. **Synthesize.** Compass presents a summary: arguments, trade-offs, and each agent's recommendation.

4. **Decision.** You make the final call. A DecisionRecord is written to `.geas/decisions/{dec-id}.json` capturing the question, options, arguments, and reasoning.

Debate produces no code. The DecisionRecord becomes input for future Initiative or Sprint runs.

---

## 6. Understanding .geas/

The `.geas/` directory is the runtime state store for a Geas-managed project. It is gitignored by default (setup adds it to `.gitignore`). Here is what each part contains.

### Directory Structure

```
.geas/
  spec/
    seed.json                -- Frozen requirements specification
  tasks/
    task-001.json            -- TaskContract: goal, criteria, boundaries, status
    task-002.json
  evidence/
    genesis/
      nova.json              -- Nova's vision document
      forge.json             -- Forge's architecture proposal
      vote-circuit.json      -- Circuit's vote on architecture
      vote-critic.json       -- Critic's vote (devil's advocate)
    task-001/
      palette.json           -- Design spec
      pixel.json             -- Implementation evidence
      forge-review.json      -- Code review results
      sentinel.json          -- QA test results
      critic-review.json     -- Critic's pre-ship review
      nova-verdict.json      -- Product review verdict
    polish/
      shield.json            -- Security review
      scroll.json            -- Documentation review
  packets/
    task-001/
      palette.md             -- Design context briefing
      pixel.md               -- Implementation context briefing
      forge-review.md        -- Review context briefing
      sentinel.md            -- QA context briefing
  state/
    run.json                 -- Current execution state
  ledger/
    events.jsonl             -- Append-only event log
  decisions/
    dec-001.json             -- Architecture decision record
  memory/
    _project/
      conventions.md         -- Project-specific conventions
    retro/
      task-001.json          -- Retrospective lessons for each task
    agents/
      pixel.md               -- Per-agent memory (grows across sessions)
      circuit.md             -- Per-agent memory
  rules.md                   -- Shared agent rules (living document)
  config.json                -- Runtime configuration
```

### Key Files Explained

**`spec/seed.json`** -- The frozen mission specification produced by the Intake Gate. Contains the refined mission statement, target user, scope (in and out), acceptance criteria, constraints, and a completeness checklist. Once confirmed, this file should not be modified. If scope changes are needed, a pivot protocol is triggered instead.

**`tasks/*.json`** -- TaskContracts. Each one is a machine-readable work agreement: a specific goal, verifiable acceptance criteria, file path boundaries, eval commands, retry budget, escalation policy, and current status (`pending`, `in_progress`, `passed`, `failed`, `escalated`).

**`evidence/{task-id}/*.json`** -- EvidenceBundles written by agents. Every agent that works on a task writes a JSON file here documenting what they did, which files they changed, and what they found. This is the traceable record of agent work. The Evidence Gate reads these files to determine whether a task passes.

**`packets/{task-id}/*.md`** -- ContextPackets. Focused, role-specific briefings generated by Compass before dispatching each agent. Rather than making agents scan the whole codebase, packets contain only the context that specific agent needs.

**`state/run.json`** -- The current execution state. Contains the mission name, current mode (initiative/sprint/debate), current phase (genesis/mvp/polish/evolve), current task ID, list of completed tasks, and overall status. This is what allows session resumption.

**`ledger/events.jsonl`** -- An append-only log of every state transition: task started, gate passed, phase completed, escalation triggered. Each entry has an actual timestamp. This is the audit trail.

**`decisions/*.json`** -- DecisionRecords. Created during vote rounds, debates, escalations, and pivots. Each captures the context, options considered, decision made, reasoning, and trade-offs accepted.

**`rules.md`** -- The shared rules document that every agent reads before starting work. Contains evidence-writing rules, code boundary rules, and project-specific conventions discovered during execution. This file is a living document -- it evolves as the project progresses.

**`memory/_project/conventions.md`** -- Project-specific conventions written by Forge after scanning the codebase. Includes directory structure, naming patterns, test patterns, and architectural decisions.

**`memory/retro/*.json`** -- Retrospective records written by Scrum after each task completes. Captures what went well, what went wrong, and conventions to extract. Lessons from retrospectives feed back into `rules.md`.

**`memory/agents/*.md`** -- Per-agent memory files that persist across sessions. Each agent accumulates knowledge about the project: patterns it has learned, mistakes it has made, and preferences it has developed. The `inject-context` hook injects the relevant agent's memory at sub-agent startup.

---

## 7. MCP Server Recommendations

### What MCP Servers Are

MCP (Model Context Protocol) servers give agents access to external tools and data sources during execution. Geas ships with two built-in MCP servers and recommends additional ones based on your project's tech stack.

### Built-in MCP Servers

These are always available when the Geas plugin is installed:

| Server | Purpose |
|--------|---------|
| **Context7** | Up-to-date documentation and code examples for libraries. Agents use this to reference current API docs instead of relying on training data. |
| **Playwright** | Browser automation. Sentinel can use this to test UI behavior and verify visual output. |

### Contextual Recommendations

After Forge proposes the tech stack during Genesis, Compass analyzes it and recommends additional MCP servers:

| Detected in Stack | Recommended Server | Why |
|--------------------|--------------------|-----|
| PostgreSQL | PostgreSQL MCP | Circuit can query database schemas directly |
| MongoDB | MongoDB MCP | Circuit can explore collections |
| Web frontend | MDN MCP | Pixel can reference web standards |
| Has deploy target | Lighthouse MCP | Sentinel can audit performance and accessibility |
| GitHub hosted | GitHub MCP | Keeper can manage PRs and issues |

Compass presents recommendations like this:

```
Recommended MCP servers for your tech stack:
- [PostgreSQL MCP] -- Circuit can query DB schemas directly
  Install: claude mcp add postgres -- npx -y @modelcontextprotocol/server-postgres <connection-string>

Would you like to connect? (optional, you can proceed without them)
```

You can connect them or skip. Connected servers are recorded in `.geas/config.json`.

### Installing an MCP Server

Each recommendation includes the install command. For example:

```bash
claude mcp add postgres -- npx -y @modelcontextprotocol/server-postgres postgresql://localhost:5432/mydb
claude mcp add --transport http mdn https://mcp.mdn.mozilla.net/
claude mcp add --transport http github https://mcp.github.com/anthropic
```

---

## 8. Resuming a Session

Geas is designed to survive session interruptions. If Claude Code exits (timeout, crash, user closes terminal), you can pick up where you left off.

### How It Works

When a session starts, the `session-init` hook checks for `.geas/state/run.json`. If it exists and the status is `"in_progress"`, Compass reads the current phase, current task, and list of completed tasks. It then resumes from the exact point where work stopped.

The run state file tracks:

```json
{
  "version": "1.0",
  "status": "in_progress",
  "mission": "Real-time polling app",
  "mode": "initiative",
  "phase": "mvp",
  "current_task_id": "task-003",
  "completed_tasks": ["task-001", "task-002"],
  "decisions": ["dec-001"],
  "created_at": "2026-03-26T10:00:00Z"
}
```

### What Resumption Looks Like

When you start a new Claude Code session in a project with an active Geas run, you will see a status summary:

```
[Geas] Resuming session
  Mission: Real-time polling app
  Mode: initiative
  Phase: mvp
  Status: in_progress
  Completed: 2 of 7 tasks
```

You do not need to repeat your mission description or re-run intake. Just say "continue" or describe what you want to do next, and Compass picks up from where it left off.

### Edge Cases

- **Session ended with `status: "complete"`**: Compass treats this as a fresh start. You can begin a new mission or run a Sprint to add features.
- **No `run.json` exists**: First run. Setup is invoked automatically.
- **Partially completed task**: The task's evidence directory is checked. If some evidence exists but the pipeline is incomplete, Compass resumes from the last completed step.

---

## 9. Hooks -- Mechanical Enforcement

Hooks are shell scripts that Claude Code runs automatically at specific lifecycle events. They provide mechanical enforcement of Geas rules -- rather than relying on prompt instructions that agents could ignore, hooks intercept operations at the tool level and enforce constraints with real exit codes.

### What Hooks Do

| Hook | When It Fires | What It Does |
|------|---------------|--------------|
| **session-init** | Session start (`SessionStart`) | Restores context from `run.json` and checkpoint, creates `rules.md` if missing, prints status summary |
| **inject-context** | Sub-agent start (`SubagentStart`) | Injects `rules.md` and per-agent memory (`memory/agents/{agent}.md`) into the sub-agent's context |
| **protect-geas-state** | After any Write/Edit (`PostToolUse`) | Injects timestamps into `.geas/**/*.json`, warns if `seed.json` is modified after intake, checks `prohibited_paths` |
| **verify-task-status** | After any Write/Edit (`PostToolUse`) | Checks that 5 required evidence files exist when a task is marked "passed" |
| **restore-context** | After context compaction (`PostCompact`) | Re-injects run state and rules after context window compaction |
| **agent-telemetry** | After a sub-agent completes (`SubagentStop`) | Logs agent, task, and model to `costs.jsonl` for distribution analysis |
| **check-debt** | After any Write/Edit (`PostToolUse`) | Monitors writes to `.geas/debt.json` and warns when 3+ HIGH-severity tech debt items are open |
| **verify-pipeline** | Before session exit (`Stop`) | Checks all completed tasks for mandatory evidence. **This is the only hook that can block session exit.** |
| **calculate-cost** | Before session exit (`Stop`) | Parses subagent session JSONL files to calculate token usage and estimated cost. Writes `.geas/ledger/cost-summary.json`. |

### What You Might See

- **Status summary at session start**: Normal. The session-init hook is printing the current project state and checkpoint information.
- **Agent receiving project rules and memory**: Normal. The inject-context hook is providing the sub-agent with `rules.md` and its per-agent memory file before it starts work.
- **Warnings about premature task completion**: The verify-task-status hook detected a task marked "passed" without the required 5 evidence files. Compass will ensure missing steps run.
- **"Pipeline incomplete" blocking session exit**: The verify-pipeline hook found completed tasks without mandatory evidence files (`forge-review.json`, `sentinel.json`, `critic-review.json`, `nova-verdict.json`, or `memory/retro/{task-id}.json`). You must complete the missing verification steps before the session can end.
- **Warnings about seed.json modification**: Something tried to change the frozen specification. Usually a mistake.
- **Warnings about HIGH-severity tech debt**: The check-debt hook detected 3 or more HIGH-severity items in `.geas/debt.json`. Consider prioritizing debt resolution.
- **Context restored after compaction**: Normal. The restore-context hook re-injected run state after a context compaction event.

For the full technical reference on hooks, including exit codes, timeout behavior, and troubleshooting, see [HOOKS.md](HOOKS.md).

---

## 10. FAQ / Troubleshooting

### "Compass agent not found"

Compass is a skill, not an agent. It runs directly in the main Claude Code session. There is no separate Compass agent to spawn. If you see this error, verify that the Geas plugin is installed correctly.

### Hook errors on Windows

Hooks are bash scripts that require Python for JSON parsing. On Windows:

- Ensure Python 3.10+ is installed and `python` is on your PATH.
- Hooks run in bash (provided by Git Bash or WSL).
- If only `python3` is available, alias or symlink it:
  ```bash
  alias python=python3
  ```

### "rules.md not found"

This file should be auto-created on session start by the `session-init` hook. If it is missing:

1. Check that the Geas plugin is installed and hooks are loading (`hooks.json` must be registered).
2. Check that Python is available (hooks use it for JSON parsing).
3. As a workaround, the setup skill also creates `rules.md`. Run setup manually if needed.

### Pipeline steps skipped

If you notice that Code Review (Forge) or Testing (Sentinel) did not run for a task:

1. Check hook error output -- a failing hook might have interrupted the pipeline.
2. Verify the plugin version is current.
3. Check `.geas/ledger/events.jsonl` for error events.
4. The `verify-pipeline` hook will catch this at session exit and block until the missing steps are completed.

### Evidence Gate keeps failing

If a task repeatedly fails the Evidence Gate:

1. Check which tier is failing (mechanical, semantic, or product).
2. **Mechanical failure**: The code does not build, lint, or pass tests. Check the eval commands in the TaskContract (`tasks/{task-id}.json`).
3. **Semantic failure**: Acceptance criteria are not met. Review the criteria -- they may be too strict or the implementation may be missing a requirement.
4. The verify-fix loop has a retry budget (default 3). After exhaustion, it escalates to Forge for architectural review or Nova for a strategic decision.

### "Pipeline incomplete" blocks session exit

This is the `verify-pipeline` hook working as designed. It found completed tasks without mandatory evidence files (`forge-review.json`, `sentinel.json`, `critic-review.json`, `nova-verdict.json`, or `memory/retro/{task-id}.json`).

To resolve:
1. Read the error message to see which tasks are affected.
2. Run the missing steps (Code Review, QA Testing, Critic Pre-ship Review, Nova Product Review, or Scrum Retrospective) for those tasks.
3. Verify the evidence files appear in `.geas/evidence/{task-id}/` and `.geas/memory/retro/`.
4. Try ending the session again.

### How to reset and start fresh

Delete the `.geas/` directory and start a new session:

```bash
rm -rf .geas/
```

This removes all runtime state, evidence, decisions, and the event ledger. Your source code is not affected. The next time you describe a mission, Geas will run setup from scratch.

### Agent produces no output

If a sub-agent completes but does not write an evidence file:

1. Compass will typically detect the missing evidence and retry the agent once.
2. Check if the agent encountered an error (tool permission denied, file path issue, etc.).
3. Ensure `.geas/rules.md` exists -- agents read it first and may fail silently if it is missing.
4. The `verify-pipeline` hook will catch missing evidence at session exit.
