---
name: help
description: Explains geas usage, available commands, workflows, and multi-agent process.
---

# Geas Help

Welcome to Geas -- a governance framework for multi-agent AI work. Every decision follows a governed process, every action is traceable, every output is verified against a contract, and the team evolves across sessions.

---

## Inputs

- **User question or keyword** — natural language query about geas usage, commands, workflows, or concepts
- **Context** — current `.geas/state/run.json` status (optional, for context-aware help)

## Output

- **Formatted explanation** — markdown response explaining the relevant geas concept, command usage, or workflow step
- No files written — this skill produces conversational output only

## [MANDATORY] Display Rule

You MUST output the full content of this skill file (from "Available Commands" onward) directly to the user as your response. Do NOT summarize, abbreviate, or say "displayed" without actually printing the content. The user must see the complete help text in the conversation.

---

## Available Commands

| Command | Purpose |
|---------|---------|
| `/geas:mission` | Start or resume a mission. The main orchestrator that coordinates the full lifecycle. |
| `/geas:intake` | Gather requirements interactively. Produces a frozen mission spec. |
| `/geas:setup` | First-time project initialization. Creates `.geas/` directory and config files. |
| `/geas:task-compiler` | Compile user stories into TaskContracts with acceptance criteria and scope. |
| `/geas:implementation-contract` | Pre-implementation agreement between worker and reviewers. |
| `/geas:evidence-gate` | Tier 0/1/2 verification of task evidence. Returns pass/fail/block/error. |
| `/geas:verify-fix-loop` | Bounded fix-verify cycle with retry budget. |
| `/geas:vote-round` | Structured agent voting on proposals. |
| `/geas:memorizing` | Extract learnings, update rules.md and agent memory notes. |
| `/geas:scheduling` | Parallel task batch construction and scheduling. |
| `/geas:policy-managing` | Manage rules.md overrides with expiry and audit history. |
| `/geas:reporting` | Health signals, status briefing, debt/gap dashboard. |

---

## The 4-Phase Workflow

Every mission follows four phases in order:

### 1. Specifying

Define WHAT and WHY. This phase produces three user-approved artifacts:

- **Mission Spec** -- frozen requirements gathered through `/geas:intake`
- **Design Brief** -- HOW the mission will be implemented, reviewed by design-authority
- **Task List** -- compiled by `/geas:task-compiler` into TaskContracts with acceptance criteria

### 2. Building

Execute the task list. Each task follows a 15-step pipeline:

1. Task transitions through states: `drafted` -> `ready` -> `implementing` -> `reviewed` -> `integrated` -> `verified` -> `passed`
2. Workers are assigned via slot resolution (domain profiles map abstract roles to concrete agent types)
3. Implementation contracts are agreed before work starts
4. Evidence is collected at each step and verified through the Evidence Gate

### 3. Polishing

Integration testing, cross-task verification, and quality hardening. Ensures the full mission output works together, not just individual tasks.

### 4. Evolving

Retrospective and learning. The team:

- Identifies debt and gaps
- Updates rules.md with learned conventions
- Writes agent memory notes for future sessions
- Produces a gap assessment for continuous improvement

---

## How Agents Work

Geas uses a **slot-based agent model**. The contract engine defines abstract roles (implementer, reviewer, tester, authority), and domain profiles resolve these to concrete agent types.

### Agent Categories

- **Authority agents** (3): orchestration-authority, design-authority, product-authority
- **Software specialists** (5): software-engineer, platform-engineer, quality-specialist, technical-writer, challenger
- **Research specialists** (6): research-analyst, data-scientist, domain-expert, methodology-specialist, research-writer, challenger

### Key Principles

- **Agents are templates, not identity** -- the 14-agent team is one configuration; the contract engine works with any setup
- **Evidence over declaration** -- "agent says done" is never enough; the Evidence Gate must verify
- **Contract-driven** -- every task has a TaskContract with scope, acceptance criteria, and evaluation commands
- **Memory persists** -- agents learn across sessions through rules.md and agent memory notes

### Multi-Agent Process

1. The orchestrator (`/geas:mission`) runs in the main session
2. Specialist agents are spawned as 1-level sub-agents -- they do their work and return
3. No nesting -- sub-agents do not spawn further agents
4. Worktree isolation keeps implementation work separate from the main branch

---

## Getting Started

1. **Start a new project**: Just describe your mission in natural language. Geas will run `/geas:setup` automatically if needed.
2. **Intake**: The orchestrator runs `/geas:intake` to gather requirements through a Socratic dialogue.
3. **Execution**: Tasks are compiled, assigned, implemented, and verified through the governed pipeline.
4. **Learning**: After the mission, retrospective findings update the team's memory for next time.

---

## Key Concepts

- **TaskContract**: Machine-readable work agreement with scope, acceptance criteria, and eval commands
- **Evidence Gate**: 3-tier verification (Tier 0 precheck, Tier 1 mechanical, Tier 2 contract+rubric)
- **rules.md**: Shared conventions all agents follow, updated through the memory system
- **.geas/ directory**: Runtime state directory (gitignored). All writes go through the CLI.
- **CLI-only writes**: All `.geas/` file modifications must use `geas` CLI commands, never direct Write/Edit
