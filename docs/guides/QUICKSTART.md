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

## Choose Your Mode

### Initiative — Build Something New

For starting a product from scratch. Geas runs four phases: Genesis → MVP → Polish → Evolution.

1. Open an empty project directory in Claude Code
2. Describe your mission: `Build me a real-time polling app with shareable invite links`
3. Intake asks clarifying questions, then freezes requirements into `seed.json`
4. The team executes autonomously through all four phases

### Sprint — Add a Feature

For adding a single feature to an existing project. Full pipeline, bounded scope.

1. Open your existing project in Claude Code
2. Describe the feature: `Add CSV export to the reports page`
3. Geas onboards the codebase on first run (reads structure, builds context)
4. Sprint pipeline executes: Design → Build → Review → QA → Evidence Gate

### Debate — Make a Decision

For structured decision-making without writing any code.

1. Describe the question: `Should we use a monorepo or separate repositories?`
2. Agents debate with evidence, devil's advocacy included
3. Decision is recorded as a `DecisionRecord` in `.geas/decisions/`

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
