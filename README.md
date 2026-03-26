<div align="center">

**English** | **[한국어](README.ko.md)**

# Geas

### Decision. Traceability. Verification.

A harness that brings structure to multi-agent AI development — so every decision is deliberate, every action is traceable, and every output is verified.

[![Claude Code](https://img.shields.io/badge/Built_for-Claude_Code-6B4FBB?style=for-the-badge)](https://claude.ai/code)
[![License](https://img.shields.io/badge/License-BSL_1.1-orange?style=for-the-badge)](LICENSE)

</div>

---

## The Problem

Multi-agent AI systems are powerful, but they have a structural weakness: as the number of agents grows, so does the number of decisions — and no one is tracking them.

- **Who decided what?** Agent A picked the tech stack, Agent B designed the schema, Agent C implemented. But why those choices? No record.
- **Is the output correct?** Each agent says "done." No one verified whether the acceptance criteria were actually met.
- **Can you trace the process?** If something goes wrong, there is no audit trail. You cannot reconstruct how the system arrived at this result.

> In Celtic mythology, a **geas** is a binding obligation placed upon a hero — an unbreakable oath that defines what must and must not be done. Break the geas, and the consequences are severe.
>
> This project applies the same principle to AI agents. Every agent operates under a **contract** — verifiable acceptance criteria that must be fulfilled, boundaries that must not be crossed, and evidence that must be produced. No exceptions.

---

## The Solution

Geas brings three guarantees to multi-agent AI development:

### Decision

Every decision is structured, not implicit. Architecture choices go through **vote rounds**. Disagreements trigger **structured debates**. Trade-offs are recorded in **decision records**. Nothing is decided "because the model felt like it."

### Traceability

Every action produces a traceable artifact. Missions freeze into **seed specs**. Tasks compile into **contracts**. Agents write **evidence bundles**. State transitions log to an **append-only ledger**. You can reconstruct exactly what happened, who did it, and why.

### Verification

"Done" means the evidence gate passed — not "agent says done." Every task goes through a **3-tier gate**:

| Tier | Question | Method |
|------|----------|--------|
| **Mechanical** | Does the code work? | Build, lint, test |
| **Semantic** | Was the right thing built? | Acceptance criteria check |
| **Product** | Does it serve the mission? | Product review judgment |

---

## Quick Start

### Prerequisites

- [Claude Code CLI](https://claude.ai/code) installed and authenticated
- Optional: [Linear](https://linear.app) API key for collaboration visibility
- Optional: Python 3.6+ for Linear integration

### 1. Install the plugin

```bash
/plugin marketplace add choam2426/geas
/plugin install geas@choam2426-geas
```

Or type `/plugin` to open the interactive UI — add `choam2426/geas` in **Marketplaces**, then install from **Discover**.

### 2. Describe the mission

```text
Build me a real-time polling app with shareable invite links.
```

Compass takes over — refines requirements, compiles contracts, dispatches agents, verifies output.

### 3. Watch the process

- **With Linear**: follow the team's comments and status transitions on each issue.
- **Without Linear**: inspect `.geas/` for seeds, contracts, evidence, and decisions.

---

## How It Works

```text
User Intent (plain text)
    → Intake Gate (Socratic questioning → frozen seed.json)
    → Task Compiler (seed → TaskContracts with acceptance criteria)
    → Agent Execution (ContextPacket → work → EvidenceBundle)
    → Evidence Gate (3-tier: mechanical → semantic → product)
    → Pass: ship  /  Fail: verify-fix loop
```

Every artifact is written to `.geas/` — seeds, contracts, packets, evidence, decisions, and an append-only event ledger. This is the traceable record of the entire run.

---

## The Team

16 agents execute the contract pipeline, each under their own geas:

| Group | Agent | Role |
|-------|-------|------|
| **Leadership** | Compass | PM / Orchestrator |
| | Nova | CEO / Product judgment |
| | Forge | CTO / Architecture |
| **Design** | Palette | UI/UX Designer |
| | Psyche | Behavioral Strategist |
| **Engineering** | Pixel | Frontend |
| | Circuit | Backend |
| | Vault | DBA / Data Architect |
| | Keeper | Git / Release Manager |
| **Quality** | Sentinel | QA Engineer |
| | Echo | User Advocate |
| | Lens | Performance & Accessibility |
| **Operations** | Pipeline | DevOps |
| | Shield | Security |
| **Strategy** | Critic | Devil's Advocate |
| **Documentation** | Scroll | Tech Writer |

---

## Collaboration Surface

The harness posts agent activity to a collaboration surface where you can watch and intervene.

**Current**: [Linear](https://linear.app) (optional) | **Future**: custom dashboard

```
[Compass] Task started. Assigned to Pixel.
[Palette] Mobile-first layout. Vertical card stack.
[You] Use bar charts instead of pie charts.        ← your input
[Forge] Agreed. CSS-only bar chart approach.
[Pixel] Implementation complete. 5 components.
[Sentinel] QA: 5/5 criteria passed.
[Compass] Evidence Gate PASSED.
[Nova] Ship.
```

Your comments are included in the next agent's context. This is how you stay in the loop.

---

## Execution Modes

| Mode | Use when | Phases |
|------|----------|--------|
| **Full Team** | Starting a new product | Genesis → MVP → Polish → Evolution |
| **Sprint** | Adding a feature to an existing project | Design → Build → Review → QA |
| **Debate** | Making a decision before implementation | Structured multi-agent discussion |

---

## License

[Business Source License 1.1](LICENSE)

---

<div align="center">

**Install the plugin. Describe the mission. Verify the output.**

</div>
