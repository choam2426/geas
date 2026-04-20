---
name: help
description: Explains geas usage, available commands, workflows, and multi-agent process.
---

# Geas Help

Welcome to Geas — a governance framework for multi-agent AI work. Every decision follows a governed process, every action is traceable, every output is verified against a contract, and the team evolves across sessions.

---

## Inputs

- **User question or keyword** — natural language query about geas usage, commands, workflows, or concepts

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
| `/geas:task-compiler` | Compile user stories into task contracts with acceptance criteria and scope. |
| `/geas:implementation-contract` | Pre-implementation agreement between worker and reviewers. |
| `/geas:evidence-gate` | Tier 0/1/2 verification of task evidence. Returns pass/fail/block/error. |
| `/geas:verify-fix-loop` | Bounded fix-verify cycle with retry budget. |
| `/geas:vote-round` | Structured agent voting on proposals. |
| `/geas:memorizing` | Promote mission learnings into `.geas/memory/shared.md` and per-agent-type memory files during the consolidating phase. |
| `/geas:scheduling` | Parallel task batch construction and scheduling. |

---

## The 4-Phase Workflow

Every mission follows four phases in order:

### 1. Specifying

Define WHAT and WHY. This phase produces user-approved artifacts:

- **Mission Spec** — frozen requirements gathered through `/geas:intake`
- **Task set** — compiled by `/geas:task-compiler` into task contracts with acceptance criteria

### 2. Building

Execute the task set. Each task follows the 9-state lifecycle in protocol 03:

1. Task transitions through states: `drafted` -> `ready` -> `implementing` -> `reviewed` -> `verified` -> `passed` (terminal states also include `blocked`, `escalated`, `cancelled`)
2. Workers are assigned via slot resolution (domain profiles map abstract roles to concrete agent types)
3. Implementation contracts are agreed before work starts
4. Evidence is collected at each step and verified through the Evidence Gate

### 3. Polishing

Integration testing, cross-task verification, and quality hardening. Ensures the full mission output works together, not just individual tasks.

### 4. Consolidating

Retrospective and learning. The orchestrator:

- Aggregates debt candidates and gap signals from task evidence.
- Updates shared + agent memory via `/geas:memorizing`.
- Writes `debts.json` (project-level), `gap.json`, and `memory-update.json` via the CLI.
- Decision Maker issues the mission verdict.

---

## How Agents Work

Geas uses a **slot-based agent model**. The contract engine defines abstract protocol slots (orchestrator, decision-maker, design-authority, challenger, implementer, verifier, risk-assessor, operator, communicator), and domain profiles resolve these to concrete agent types.

### Agent Categories

- **Authority slots** (4): orchestrator, decision-maker, design-authority, challenger
- **Worker / reviewer slots** (5): implementer, verifier, risk-assessor, operator, communicator

Concrete agents for each slot come from the project's domain profile (e.g., software: software-engineer, platform-engineer, qa-engineer, security-engineer, technical-writer).

### Key Principles

- **Agents are templates, not identity** — the agent roster is one configuration; the contract engine works with any setup.
- **Evidence over declaration** — "agent says done" is never enough; the Evidence Gate must verify.
- **Contract-driven** — every task has a task contract with scope, acceptance criteria, and a verification plan.
- **Memory persists** — agents learn across sessions through `.geas/memory/shared.md` (project-wide) and `.geas/memory/agents/{agent_type}.md` (per concrete agent type).

### Multi-Agent Process

1. The orchestrator (`/geas:mission`) runs in the main session.
2. Specialist agents are spawned as 1-level sub-agents — they do their work and return.
3. No nesting — sub-agents do not spawn further agents.

---

## Getting Started

1. **Start a new project**: Just describe your mission in natural language. Geas will run `/geas:setup` automatically if needed.
2. **Intake**: The orchestrator runs `/geas:intake` to gather requirements through a Socratic dialogue.
3. **Execution**: Tasks are compiled, assigned, implemented, and verified through the governed pipeline.
4. **Learning**: During the consolidating phase, retrospective findings update the team's memory for next time and unresolved items land in `debts.json`.

---

## Key Concepts

- **Task contract**: machine-readable work agreement with scope, acceptance criteria, and a verification plan.
- **Evidence Gate**: 3-tier verification (Tier 0 precheck, Tier 1 mechanical, Tier 2 contract+rubric).
- **Memory**: conventions all agents follow live in `.geas/memory/shared.md` (project-wide) and `.geas/memory/agents/{agent_type}.md` (per concrete agent type); updated by `/geas:memorizing` during the consolidating phase.
- **Debt ledger**: `.geas/debts.json` is project-level — every entry records its origin `introduced_by` and, on resolution, `resolved_by` as mission/task references.
- **.geas/ directory**: runtime state directory (gitignored). All writes go through the CLI.
- **CLI-only writes**: all `.geas/` file modifications must use `geas` CLI commands, never direct Write/Edit.
