**English** | **[한국어](README.ko.md)**

# Geas
### Make AI agents prove they're done.
**Governance protocol + Claude Code plugin for structured multi-agent work**

[![License](https://img.shields.io/badge/License-Apache_2.0-blue?style=for-the-badge)](LICENSE)
[![Release](https://img.shields.io/github/v/release/choam2426/geas?style=for-the-badge)](https://github.com/choam2426/geas/releases)

Geas turns a group of AI agents into a governed team. It replaces **"done" with evidence**, **informal review with explicit authority**, and **session amnesia with reusable memory**.

The current implementation runs as a **Claude Code plugin**. It ships with **software** and **research** profiles today, while the contract engine stays domain-agnostic so new profiles can be added without changing the governance model.

> Geas is not a “more agents” project. It is a control system for how agents coordinate, verify, and learn.

**14 agent types · 12 skills · 9 lifecycle hooks · 16 JSON Schemas**

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

## Quick Start

The current implementation is a **Claude Code plugin**. Install [Claude Code CLI](https://claude.ai/code), then:

```bash
/plugin marketplace add choam2426/geas
/plugin install geas@choam2426-geas
/geas:mission
```

Describe the mission. Geas will gather requirements, compile task contracts, route the right agents, and drive the work through the protocol.

---

## When Geas is a good fit

- Multi-step implementation, refactors, or migrations
- High-risk work where explicit verification matters
- Parallel work across implementation, QA, security, operations, and docs
- Long-running work where traceability and memory matter
- Structured research or analysis that benefits from separated reviewer roles

## When it is probably overkill

- Tiny one-file edits
- Disposable prototypes
- Lowest-token tasks where speed matters more than governance

Geas adds process. That means **more steps and more tokens** than direct prompting. It pays off when the cost of being wrong is higher than the cost of coordination.

---

## What Geas enforces

- **Contracts before implementation** — Every task gets a machine-readable agreement: scope, acceptance criteria, reviewers, eval commands, risks, and escalation policy.
- **Independent verification before closure** — The protocol does not trust any agent’s claim of completion.
- **Adversarial review for risky work** — A Challenger asks, *“Why might this still be wrong?”*
- **Memory across sessions** — Retrospectives, promoted memories, rules, and debt tracking make the team improve instead of reset.
- **Slot-based routing** — The contract engine works with abstract slots; domain profiles map those slots to concrete agents at runtime.

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

## Team model

Geas uses a **slot-based role architecture**. Authority agents govern the process. Specialist agents do the domain work.

| Group | Agents |
|---|---|
| **Authority** (always active) | Product Authority, Design Authority, Challenger |
| **Software profile** | Software Engineer, QA Engineer, Security Engineer, Platform Engineer, Technical Writer |
| **Research profile** | Literature Analyst, Research Analyst, Methodology Reviewer, Research Integrity Reviewer, Research Engineer, Research Writer |

A mission declares its domain profile. The Orchestrator resolves abstract slots such as `implementer`, `quality_specialist`, and `risk_specialist` into concrete agent types at runtime.

---

## See it in action

```text
[Orchestrator]     Specifying: intake complete. 2 tasks compiled.
[Orchestrator]     Building: starting task-001 (JWT auth API).
[Design Auth]      Tech guide: bcrypt + JWT, refresh token rotation.
[Orchestrator]     Implementation contract approved.
[SW Engineer]      Implementation complete. 4 endpoints. Workspace merged.
[SW Engineer]      Self-check: confidence 4/5. Token expiry edge case untested.
[Design Auth]      Review: approved.                                <- parallel
[QA Engineer]      Testing: 6/6 acceptance criteria passed.         <- parallel
[Orchestrator]     Evidence Gate: PASS. Closure packet assembled.
[Challenger]       Challenge: no rate limiting [BLOCKING].
[Orchestrator]     Vote round: iterate. Re-implementing.
[SW Engineer]      Rate limiter added. Re-verification passed.
[Product Auth]     Final Verdict: PASS.
[Orchestrator]     Committed. Retro: auth APIs need rate limiting — rule proposed.
[Orchestrator]     Polishing: risk review, docs, debt.
[Orchestrator]     Evolving: gap assessment, rules update, agent memory update.
[Orchestrator]     Mission complete. 2/2 tasks passed.
```

---

## Documentation

| Document | Description |
|---|---|
| [Architecture](docs/architecture/DESIGN.md) | System design, 4-layer architecture, and rationale |
| [Protocol](docs/protocol/) | 12 operational protocol documents |
| [Schemas](docs/protocol/schemas/) | 16 JSON Schema definitions (draft 2020-12) |
| [Agents](docs/reference/AGENTS.md) | 14 agent types and the slot-based authority model |
| [Skills](docs/reference/SKILLS.md) | 12 skills |
| [Hooks](docs/reference/HOOKS.md) | 9 lifecycle hooks |

---

## License

[Apache License 2.0](LICENSE)

---

**Define the protocol. Describe the mission. Verify the output. Watch the team evolve.**
