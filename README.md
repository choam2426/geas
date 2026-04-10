**English** | **[한국어](README.ko.md)**

# Geas
### Make AI agents prove they're done.
**Governance protocol + Claude Code plugin for structured multi-agent work**

[![License](https://img.shields.io/badge/License-Apache_2.0-blue?style=for-the-badge)](LICENSE)
[![Release](https://img.shields.io/github/v/release/choam2426/geas?style=for-the-badge)](https://github.com/choam2426/geas/releases)

Geas turns a group of AI agents into a governed team. It replaces **"done" with evidence**, **informal review with explicit authority**, and **session amnesia with reusable memory**.

The current implementation runs as a **Claude Code plugin** with an optional **Tauri desktop dashboard**. It ships with **software** and **research** agent profiles, while the contract engine stays domain-agnostic so new profiles can be added without changing the governance model.

> Geas is not a "more agents" project. It is a control system for how agents coordinate, verify, and learn.

**14 agent types · 13 skills · 9 lifecycle hooks · 16 JSON Schemas**

---

## Why it exists

| Without structure | With Geas |
|---|---|
| Agents say **"done"** and move on | **Evidence Gate** checks artifacts, eval commands, and acceptance criteria |
| Design and review decisions disappear after compaction | **Closure Packets** preserve what happened, why it happened, and who approved it |
| Parallel work collides late | **Task contracts, scheduling, and lock checks** surface conflicts earlier |
| Everyone reviews, so nobody really owns the decision | **Authority agents** make approvals and final verdicts explicit |
| The same mistakes repeat next session | **Retrospectives, rules.md, and agent memory** carry lessons forward |

---

## What you get

- **Socratic intake** — Geas asks questions one at a time until the mission spec is clear. No ambiguous handoffs.
- **Task contracts** — Each unit of work gets a machine-readable contract with scope, acceptance criteria, reviewers, and eval commands before anyone writes code.
- **14-step execution pipeline** — Implementation → self-check → specialist review → evidence gate → challenger review → final verdict. Every step produces traceable artifacts.
- **Evidence Gate** — Three-tier verification (eval commands, acceptance criteria, rubric scoring). "Trust but verify" is replaced with "don't trust, verify."
- **Parallel scheduling** — Independent tasks run concurrently with lock-based conflict detection. Dependent tasks are sequenced automatically.
- **Challenger review** — An adversarial agent that asks "why might this still be wrong?" on high-risk tasks. Must raise at least one substantive concern.
- **Session recovery** — Checkpoint-based recovery handles interrupted sessions, context compaction, and dirty state. Pick up where you left off.
- **Memory system** — `rules.md` for cross-agent knowledge, per-agent memory notes for role-specific lessons. The team learns across sessions.
- **Real-time dashboard** — Tauri desktop app that watches `.geas/` state. Kanban board, timeline, debt tracking, toast notifications.

---

## Quick Start

### Install

```bash
/plugin marketplace add choam2426/geas
/plugin install geas@choam2426-geas
```

### Commands

| Command | What it does |
|---|---|
| `/geas:mission` | Start or resume a mission — the main entry point. Handles everything from requirements to delivery. |
| `/geas:help` | Show all available commands, the 4-phase workflow, and how the team model works. |

`/geas:mission` is all you need. Describe what you want to build, and Geas takes over: gathering requirements, compiling task contracts, routing agents, verifying evidence, and closing the mission. For trivial tasks (single file fix, obvious bug), it skips the full pipeline automatically.

Other commands (`/geas:intake`, `/geas:evidence-gate`, `/geas:scheduling`, etc.) are used internally by the orchestrator. Run `/geas:help` to see the full list.

### Dashboard (optional)

See the [Dashboard](#dashboard) section below.

---

## How a mission runs

### Four phases

Every mission passes through the same four phases. A small change gets a lightweight pass; a bigger effort gets the full treatment.

```mermaid
graph LR
    A[User Intent] --> B[Specifying]
    B --> C[Building]
    C --> D[Polishing]
    D --> E[Evolving]

    B -.- B1["Intake → Design Brief\n→ Task Compilation"]
    C -.- C1["Per-task pipeline × N\n(parallel when safe)"]
    D -.- D1["Risk review → Docs → Debt"]
    E -.- E1["Gap Assessment → Rules\n→ Memory → Summary"]
```

| Phase | What happens |
|---|---|
| **Specifying** | Define the mission, freeze the brief, and compile machine-readable task contracts. |
| **Building** | Run each task through a governed execution pipeline from contract to verdict. |
| **Polishing** | Resolve debt, documentation gaps, and quality issues surfaced during execution. |
| **Evolving** | Capture lessons, update rules, promote memory, and prepare the next mission. |

### Per-task pipeline

```text
Contract → Implementation → Self-check → Specialist review
→ Evidence Gate → Closure Packet → Challenger review
→ Final Verdict → Retrospective → Memory extraction
```

---

## Dashboard

A Tauri desktop app that reads `.geas/` state in real time. It watches for file changes — no polling, no agent interruption.

![Dashboard Overview](docs/images/dashboard.png)

### Views

**Project overview** — current mission, active agent, phase, task progress, last activity timestamp. Multiple projects in the sidebar.

**Kanban board** — tasks flow through the 7-state lifecycle columns. Click a card for contract details, evidence, and record sections.

![Kanban Board](docs/images/kanvanboard.png)

**Mission detail** — design brief, task list, gap assessment, debt register, mission summary. Everything the protocol produced for one mission.

**Memory browser** — `rules.md` content and per-agent memory notes. See what the team has learned.

**Timeline** — event log visualization. Every state transition, gate result, and agent spawn in chronological order.

**Tech debt panel** — debt items by severity and kind. Filter by status (open / resolved / deferred).

### Notifications

File-system watcher triggers toast notifications when tasks complete, gates pass or fail, or phases change. No need to switch windows to check progress.

![Task Completed](docs/images/toast.png)

### Install

Download the installer for your platform from [Releases](https://github.com/choam2426/geas/releases). Open the app, add a project directory that contains `.geas/`, and the dashboard starts reading state immediately.

---

## Team model

Geas uses a **slot-based role architecture**. Authority agents govern the process. Specialist agents do the domain work.

| Group | Agents |
|---|---|
| **Authority** (always active) | Product Authority, Design Authority, Challenger |
| **Software profile** | Software Engineer, QA Engineer, Security Engineer, Platform Engineer, Technical Writer |
| **Research profile** | Literature Analyst, Research Analyst, Methodology Reviewer, Research Integrity Reviewer, Research Engineer, Research Writer |

Domain profiles set default agent preferences, but the orchestrator can freely pick the best agent per task regardless of profile. A software mission can use research agents for literature review tasks, and vice versa.

---

## What Geas enforces

- **Contracts before implementation** — Every task gets a machine-readable agreement: scope, acceptance criteria, reviewers, eval commands, risks, and escalation policy.
- **Independent verification before closure** — The protocol does not trust any agent's claim of completion.
- **Adversarial review for risky work** — A Challenger asks, *"Why might this still be wrong?"*
- **Memory across sessions** — Retrospectives, rules, and agent memory make the team improve instead of reset.
- **Slot-based routing** — The contract engine works with abstract slots; domain profiles map those slots to concrete agents at runtime.

---

## When Geas is a good fit

- Multi-step implementation, refactors, or migrations
- High-risk work where explicit verification matters
- Parallel work across implementation, QA, security, operations, and docs
- Long-running work where traceability and memory matter
- Structured research or analysis that benefits from separated reviewer roles

Geas adds process. That means **more steps and more tokens** than direct prompting. It pays off when the cost of being wrong is higher than the cost of coordination. For trivial tasks, Geas detects the scope and skips the full pipeline automatically.

---

## Documentation

| Document | Description |
|---|---|
| [Architecture](docs/architecture/DESIGN.md) | System design, 4-layer architecture, and rationale |
| [Protocol](docs/protocol/) | 12 operational protocol documents |
| [Schemas](docs/protocol/schemas/) | 16 JSON Schema definitions (draft 2020-12) |
| [Agents](docs/reference/AGENTS.md) | 14 agent types and the slot-based authority model |
| [Skills](docs/reference/SKILLS.md) | 13 skills (12 core + 1 utility) |
| [Hooks](docs/reference/HOOKS.md) | 9 lifecycle hooks |

---

## License

[Apache License 2.0](LICENSE)

---

**Define the protocol. Describe the mission. Verify the output. Watch the team evolve.**
