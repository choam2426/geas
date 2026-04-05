<div align="center">

**English** | **[한국어](README.ko.md)**

# Geas

### A governance protocol for multi-agent AI teams

[![License](https://img.shields.io/badge/License-Apache_2.0-blue?style=for-the-badge)](LICENSE)
[![Release](https://img.shields.io/github/v/release/choam2426/geas?style=for-the-badge)](https://github.com/choam2426/geas/releases)

</div>

Geas makes a team of AI agents behave like a governed organization — whether they are building software, conducting research, or creating content. Every decision follows a defined procedure, every action is traceable, every deliverable is verified against its contract, and the team improves across sessions.

---

## Why Geas Exists

Multi-agent work is fast and powerful. But without structure, it falls apart the same way every time:

- **"Done" without proof** — the agent says it's finished, but nobody verified against acceptance criteria
- **Lost decisions** — why this approach was chosen, what was discussed in review — gone after compaction
- **Parallel chaos** — multiple agents touch the same surfaces, and conflicts are discovered too late
- **Unclear authority** — agents debate, but nobody has defined decision-making power
- **Zero memory** — the same mistakes repeat across sessions because nothing is retained

When you scale from one agent to many, these problems do not add up. They multiply.

---

## How It Works

### Four Phases

Every mission runs four phases. Scale adapts to the request — a small change gets a lightweight pass; a larger effort gets the full treatment.

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
| **Specifying** | Define WHAT and WHY. Produce mission spec, design brief, task list. |
| **Building** | Execute each task through a governed pipeline: contract → implement → review → verify → verdict. |
| **Polishing** | Address debt, documentation gaps, and quality issues found during building. |
| **Evolving** | Capture lessons. Retrospective, memory promotion, rules update, carry-forward. |

### Per-Task Pipeline

Each task follows a governed pipeline from contract to closure:

```
Contract → Implementation → Self-check → Specialist review
→ Evidence Gate → Closure Packet → Challenger review
→ Final Verdict → Retrospective → Memory extraction
```

### Verification

The protocol does not trust any agent's claim of completion. It requires independent evidence.

- **Evidence Gate** — Tier 0 (artifact prechecks), Tier 1 (repeatable mechanical checks), Tier 2 (acceptance criteria + rubric scoring)
- **Challenger** — adversarial review for high-risk work: "why might this be wrong?"
- **Final Verdict** — Decision Maker judges the full closure packet: pass, iterate, or escalate

### Memory and Evolution

Every completed task feeds back into the system:

- **Retrospective** — what worked, what broke, what to change
- **Memory** — lessons earn trust through evidence, flow back through rules and context packets
- **Debt tracking** — compromises made visible and owned, not forgotten

---

## The Team

The protocol defines **14 agent types** organized by domain profile. Authority agents govern the process; specialist agents do the domain work.

| | Agents |
|---|---|
| **Authority** (always active) | Product Authority, Design Authority, Challenger |
| **Software profile** | Software Engineer, QA Engineer, Security Engineer, Platform Engineer, Technical Writer |
| **Research profile** | Literature Analyst, Research Analyst, Methodology Reviewer, Research Integrity Reviewer, Research Engineer, Research Writer |

A mission declares its domain profile. The Orchestrator (the mission skill itself) resolves abstract specialist slots to concrete agents at runtime — the same governance pipeline works for any domain.

[Full team reference →](docs/reference/AGENTS.md)

---

## See It In Action

```
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
[Orchestrator]     Evolving: gap assessment, rules update, memory promotion.
[Orchestrator]     Mission complete. 2/2 tasks passed.
```

---

## Quick Start

The current implementation is a **Claude Code plugin**. Install [Claude Code CLI](https://claude.ai/code), then:

```bash
/plugin marketplace add choam2426/geas
/plugin install geas@choam2426-geas
/geas:mission
```

Describe what you want to accomplish. The orchestrator drives the work following the Geas protocol.

---

## Documentation

| Document | Description |
|---|---|
| [Architecture](docs/architecture/DESIGN.md) | System design, 4-layer architecture, data flow |
| [Protocol](docs/protocol/) | 14 operational protocol documents |
| [Schemas](docs/protocol/schemas/) | 30 JSON Schema definitions (draft 2020-12) |
| [Agents](docs/reference/AGENTS.md) | 14 agent types with slot-based authority model |
| [Skills](docs/reference/SKILLS.md) | 15 skills (13 core + 2 utility) |
| [Hooks](docs/reference/HOOKS.md) | 16 lifecycle hooks |

---

## License

[Apache License 2.0](LICENSE)

---

<div align="center">

**Define the protocol. Describe the mission. Verify the output. Watch the team evolve.**

</div>
