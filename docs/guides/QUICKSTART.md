# Quick Start

## What is Geas?

Geas is a contract-driven multi-agent AI development harness built for Claude Code. It brings four guarantees to any AI team: **Governance** (every decision follows a defined process), **Traceability** (every action produces a traceable artifact), **Verification** (output is proven against acceptance criteria — not just declared done), and **Evolution** (the team accumulates knowledge across sessions). You describe a mission; Geas runs a governed pipeline of 12 specialist agents that design, build, review, and verify — and records everything.

## Prerequisites

- [Claude Code CLI](https://claude.ai/code) installed and authenticated
- A Git repository (new or existing)

## Install

```bash
/plugin marketplace add choam2426/geas
/plugin install geas@choam2426-geas
```

## Start a Mission

Run `/geas:mission` and describe what you want to build, add, or decide.

```
/geas:mission Build me a real-time polling app with shareable invite links
```

Geas handles the rest — it asks clarifying questions, detects the right mode, and runs the full pipeline.

### How mode detection works

You don't need to pick a mode yourself. Geas reads your intent and routes automatically:

| Your intent | Detected mode | What happens |
|---|---|---|
| Build a new product from scratch | **Initiative** | 4 phases: Discovery → MVP → Polish → Evolution |
| Add a feature to an existing project | **Sprint** | Bounded pipeline: Design → Build → Review → QA → Evidence Gate |
| Make a technical or product decision | **Debate** | Structured discussion, no code — outputs a DecisionRecord |

### Examples

```
/geas:mission Build a CLI tool that converts Markdown to PDF
```
→ Initiative: new product from scratch

```
/geas:mission Add dark mode toggle to the settings page
```
→ Sprint: bounded feature addition

```
/geas:mission Should we migrate from REST to GraphQL?
```
→ Debate: structured decision-making

## What Happens During Execution

Agents spawn and work autonomously. For each task the pipeline is:

```
Design → Tech Guide → Implementation Contract → Implementation
  → Code Review → QA → Evidence Gate → Critic → Nova → Retro
```

Evidence is collected at every step. The Evidence Gate requires all three tiers to pass before a task closes: **Mechanical** (build, lint, test), **Semantic** (acceptance criteria met), and **Product** (serves the mission). You can interject at any point — your input is treated as highest-priority stakeholder feedback.

## The .geas/ Directory

After execution your project contains a `.geas/` directory — the full traceable record of the run:

```
.geas/
├── spec/         — frozen mission specification (seed.json)
├── tasks/        — TaskContracts with acceptance criteria
├── evidence/     — structured proof of work per task
├── decisions/    — vote records and decision records
├── memory/       — retrospective lessons and per-agent memory
└── ledger/       — append-only event log
```

This directory is gitignored by default. It belongs to the project, not the repository.

## Next Steps

- [Initiative Guide](INITIATIVE.md) — full walkthrough for new products
- [Sprint Guide](SPRINT.md) — feature addition in detail
- [Architecture](../architecture/DESIGN.md) — how the contract engine works
- [Agents](../reference/AGENTS.md) — meet the 12-agent team
