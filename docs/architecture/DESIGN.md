# Geas Architecture

## 1. Overview

Geas is a governance protocol for multi-agent AI teams. Any group of AI agents working on a structured task — software development, research, content creation — can operate under Geas to produce governed, traceable, verified results that improve over time.

### The Problem

When multiple AI agents collaborate without structure, three things go wrong:

1. **No one verifies.** The agent says "done" and everyone moves on. There is no independent check that the work actually meets its contract.
2. **No one remembers.** Each session starts from zero. Lessons from past failures, successful patterns, and accumulated judgment are lost.
3. **No one governs.** Decisions happen implicitly. There is no record of who decided what, under what authority, or based on what evidence.

### The Solution

Geas introduces a **Contract Engine** — a set of domain-agnostic skills that enforce a governed pipeline for every unit of work:

- A **task contract** defines what will be done, how it will be verified, and who will review it.
- An **evidence gate** independently verifies that the work meets its contract. "Done" means "evidence proves it."
- A **closure packet** assembles the full story — implementation, reviews, gate results, risks — for a final product verdict.
- A **memory system** captures lessons and feeds them back into future work through rules and agent memory.

The Contract Engine is tool-agnostic and domain-agnostic. It does not know whether agents are writing code, running experiments, or drafting content. It only knows: was there a contract, was it verified, and what did the team learn?

### Design Philosophy (4 Pillars)

Every design decision must answer: **"Does this make the process more governed, traceable, verifiable, or capable of learning?"**

| Pillar | What it guarantees |
|---|---|
| **Governance** | Every decision follows a defined procedure with explicit authority |
| **Traceability** | Every action is recorded and auditable after the fact |
| **Verification** | Every deliverable is verified against its contract — not against an agent's claim |
| **Evolution** | The team improves across sessions through retrospectives, rules, memory, and debt tracking |

> For the concrete protocol bindings and design principles behind the 4 Pillars, see `protocol/00_PROTOCOL_FOUNDATIONS.md`.

---

## 2. Four-Layer Architecture

Geas separates concerns into four layers. The key insight: **only the contract engine needs to be stable.** Everything above and below it can be swapped without breaking the governance model.

```
┌───────────────────────────┐
│  Collaboration Surface    │  Dashboard, CLI, chat, IDE — how humans interact
├───────────────────────────┤
│  Agent Teams              │  Domain profiles fill specialist slots with concrete agents
├───────────────────────────┤
│  Contract Engine          │  12 core skills — the immutable governance pipeline
├───────────────────────────┤
│  Tool Adapters            │  File I/O, shell, MCP servers — how agents act on the world
└───────────────────────────┘
```

> For a visual diagram of agent interactions within this architecture, see [DIAGRAMS.md — Agent Interactions](../ko/DIAGRAMS.md#4-에이전트-상호작용).

| Layer | Why it exists | Replaceable? |
|---|---|---|
| **Collaboration Surface** | Decouples the human experience from the agent workflow. A team using a dashboard and a team using a CLI both get the same governance guarantees. | Yes |
| **Agent Teams** | Decouples expertise from process. The Contract Engine does not care whether the quality specialist is a `qa_engineer` or a `methodology_reviewer` — it only cares that the quality slot produced a review. | Yes |
| **Contract Engine** | The invariant core. 12 skills that enforce the task lifecycle: intake, compilation, contracts, gates, verification, voting, memory, scheduling, setup, policy, and reporting. | **No** |
| **Tool Adapters** | Decouples agent capabilities from agent identity. An agent that uses `git` and an agent that uses a version-control API both satisfy the same contract. | Yes |

### Domain Profiles and Slot Resolution

Agent Teams are organized by **domain profile**. Each profile maps abstract specialist slots to concrete agent types:

```
Mission spec: { "domain_profile": "software" }
    ↓
Orchestrator reads profiles.json
    ↓
quality_specialist → qa_engineer → Agent(agent: "qa-engineer", ...)
```

The Contract Engine references only slot names (`implementer`, `quality_specialist`, `risk_specialist`, `operations_specialist`, `communication_specialist`). The Orchestrator resolves these to concrete agents at runtime. This is why the same 12 core skills work for software, research, or any future domain.

> For agent types, authority rules, and routing, see `protocol/01_AGENT_TYPES_AND_AUTHORITY.md`.

---

## 3. Execution Model

### Why Four Phases

Every mission follows the same four phases, regardless of scale. A single feature gets a lightweight pass; a full product gets the full treatment. The phases exist because rushing to implementation without specifying causes scope drift, and shipping without polishing causes debt accumulation.

```
Specifying ──→ Building ──→ Polishing ──→ Evolving ──→ Close
   │              │             │              │
 gate 1        gate 2        gate 3        gate 4
```

> For a visual diagram of the mission lifecycle and phase gates, see [DIAGRAMS.md — Mission Lifecycle](../ko/DIAGRAMS.md#1-미션-라이프사이클).

| Phase | Purpose | Exit condition |
|---|---|---|
| **Specifying** | Define WHAT and WHY. Produce mission spec, design brief, and task list. Architecture review required. | User-approved spec + design brief + compiled tasks |
| **Building** | Execute tasks through the per-task pipeline. Each task follows: contract → implement → review → gate → verdict. | All tasks passed or explicitly deferred |
| **Polishing** | Address debt, documentation gaps, and quality issues discovered during building. | Debt triaged, gap assessment complete |
| **Evolving** | Capture lessons. Retrospective, rules.md update, agent memory update, carry-forward backlog. | Evolution artifacts recorded, mission summary written |

Scale adapts automatically: lightweight missions may compress phases, but the sequence never changes.

> For details on missions and phases, see `protocol/02_MODES_MISSIONS_AND_RUNTIME.md`.

---

## 4. Task Lifecycle

A task is the only closure unit in the protocol. Nothing ships, completes, or counts as "done" except through a task reaching `passed`.

### Why 7 States

Each state represents a distinct checkpoint where different actors have responsibility. Collapsing states (e.g., merging review into implementation) would blur accountability. The 7-state model ensures that at any point, the system can answer: **who is responsible right now, and what must happen next?**

```
drafted → ready → implementing → reviewed → integrated → verified → passed
```

Auxiliary states: `blocked`, `escalated`, `cancelled`

> For the full state machine diagram including rewind paths and auxiliary states, see [DIAGRAMS.md — Task State Machine](../ko/DIAGRAMS.md#2-태스크-상태머신).

### Required Artifacts per Transition

No transition happens without evidence. This is the core enforcement mechanism — state changes are artifact-gated, not claim-gated.

Per-task artifacts are consolidated into a single `record.json` file with sections accumulated as the task progresses, plus an `evidence/` directory for specialist review artifacts.

| Transition | Guard condition | What it proves |
|---|---|---|
| drafted → ready | `contract.json` with required fields (task_kind, risk_level, gate_profile, vote_round_policy, base_snapshot, rubric) | Scope, criteria, and routing are defined |
| ready → implementing | `record.json:implementation_contract.status == "approved"` | Worker and reviewers agree on the plan |
| implementing → reviewed | `record.json:self_check` + `evidence/` with implementer role | Work is done and self-assessed |
| reviewed → integrated | `record.json:gate_result.verdict == "pass"` + `evidence/` with reviewer/tester role | Evidence gate confirms quality |
| integrated → verified | (none — orchestrator merge is the gate) | Change merged into baseline |
| verified → passed | `verdict.verdict == "pass"` + `gate_result` + `closure` (≥1 review) + `retrospective` + `challenge_review` (high/critical) | Decision Maker accepts, full record complete |

> Full state machine, rewind rules, and retry budgets: `protocol/03_TASK_MODEL_AND_LIFECYCLE.md`.

---

## 5. Verification Flow

Verification is the heart of Geas. The protocol does not trust any agent's claim of completion — it requires independent evidence.

```
Implementation complete
        │
        ▼
  Evidence Gate
  ┌─────────────────────┐
  │ Tier 0: Precheck    │──→ block (missing artifact, wrong state)
  │ Tier 1: Mechanical  │──→ fail (repeatable checks failed)
  │ Tier 2: Contract    │──→ fail (criteria unmet, rubric below threshold)
  └─────────────────────┘
        │ pass
        ▼
  Closure Packet assembly
        │
        ▼
  Challenger Review (mandatory for high/critical risk)
        │
        ▼
  Final Verdict (Decision Maker: pass / iterate / escalate)
        │ pass
        ▼
     Resolved
```

> For a detailed flow diagram including gate profiles and vote round handling, see [DIAGRAMS.md — Evidence Gate Flow](../ko/DIAGRAMS.md#3-에비던스-게이트-플로우).

### Gate Tiers

| Tier | Question it answers | Examples |
|---|---|---|
| **Tier 0** (Precheck) | Is the task even eligible for gating? | Required artifacts exist, task state is valid, baseline is fresh |
| **Tier 1** (Mechanical) | Do repeatable checks pass? | Software: build, lint, test. Research: citation validation, statistical reproducibility. Content: grammar, fact-check |
| **Tier 2** (Contract + Rubric) | Does the work fulfill its contract? | Acceptance criteria met, rubric scores above threshold (1-5 scale), known risks addressed |

### Gate Outcomes

| Outcome | Meaning | Retry budget impact |
|---|---|---|
| `pass` | Verified — advance to closure | None |
| `fail` | Quality issue — enter verify-fix loop | -1 |
| `block` | Structural problem — cannot proceed | None |
| `error` | Gate itself failed — investigate and re-run | None |

### Final Verdict

The gate says "evidence checks out." The Decision Maker says "the product should accept this." These are different judgments. A passing gate does not automatically mean ship — the Decision Maker evaluates the full closure packet including open risks, debt, and product fit.

- `pass` — done, task reaches `passed`
- `iterate` — verified but not good enough, rework needed (does not consume retry budget; 3 cumulative iterates trigger escalation)
- `escalate` — beyond local authority, escalate to user

> Full details: `protocol/05_GATE_VOTE_AND_FINAL_VERDICT.md`.

---

## 6. Memory and Evolution

### The Problem Memory Solves

Without memory, every session starts from zero. The team makes the same mistakes, misses the same edge cases, and rediscovers the same patterns. Memory exists so that **past experience changes future behavior** — not as a knowledge base, but as a behavior modification mechanism.

### How Memory Works

Memory influences behavior through concrete surfaces:

| Surface | Example |
|---|---|
| `rules.md` | "Auth endpoints must have rate limiting" — learned from a past gate failure |
| Agent memory | `.geas/memory/agents/{type}.md` — role-specific guidance read at invocation |
| Gate strictness | Tighter thresholds on surfaces with past failures |
| Scheduling caution | Avoid parallel combinations that previously caused conflicts |

### Memory Lifecycle

Memory earns trust through evidence, not through persistence. A lesson is not true because someone said it — it is trusted because it was validated.

```
rules.md        — project-wide knowledge (conventions + learned rules)
agents/{agent}.md — per-agent notes (role-specific lessons)
```

Memory is two files. `rules.md` holds all project knowledge and is injected into every agent context. Agent memory files hold role-specific notes and are injected into matching agents.

### Evolution Loop

After every completed task, the protocol extracts value:

1. **Retrospective** — what worked, what broke, what surprised
2. **Rule candidates** — patterns worth enforcing ("this type of failure keeps happening")
3. **Memory capture** — lessons recorded and linked to evidence
4. **Debt tracking** — compromises made visible and owned
5. **Gap assessment** — promised scope vs. delivered scope, honestly compared

The Evolving phase at mission end consolidates all of this. A mission that does not evolve is a mission that does not learn.

> Memory system: `protocol/07`. Evolution loop: `protocol/11`.

---

## 7. Context Loss Defense

LLM sessions hit context limits. When compaction occurs, the orchestrator loses its working memory — current phase, active task, remaining steps, open risks. Without defense, the session resumes in a confused state and makes incorrect decisions.

### Defense 1: Externalized State

`run.json` stores the full pipeline position on disk: current phase, active task, `remaining_steps[]` array, checkpoint metadata. Even after total context loss, reading this file tells the orchestrator exactly where it is and what to do next.

### Defense 2: Automatic Restoration

The `PostCompact` hook fires after every compaction event. It reads `run.json`, `session-latest.md`, `rules.md`, and the active task contract, then re-injects them as L0 (never-drop) context. The orchestrator resumes with:

- Current phase and task
- Next pipeline step
- Acceptance criteria and open risks
- Active rules and memory state

This is not a best-effort recovery — it is a protocol guarantee. The anti-forgetting layer ensures that compaction degrades context gracefully rather than catastrophically.

> Full recovery model: `protocol/08_SESSION_RECOVERY_AND_RESUMABILITY.md`.

---

## 8. Plugin Structure

```
plugin/
├── plugin.json                # Manifest
├── bin/
│   └── geas                   # Pre-built CLI bundle (single file)
├── skills/                    # 13 skills (12 core + 1 utility)
│   ├── mission/               # Orchestrator: 4-phase pipeline, slot resolution
│   ├── intake/                # Requirements gathering
│   ├── task-compiler/         # Mission spec → TaskContracts
│   ├── implementation-contract/
│   ├── evidence-gate/         # Tier 0/1/2 verification
│   ├── verify-fix-loop/
│   ├── vote-round/            # Structured voting and decisions
│   ├── memorizing/            # Memory lifecycle
│   ├── scheduling/            # Parallel task scheduling
│   ├── setup/                 # Project init + codebase discovery
│   ├── policy-managing/       # Rules override management
│   ├── reporting/             # Health signals, briefing, summaries
│   └── help/                  # Usage guide (utility, not core engine)
├── agents/
│   ├── authority/             # 3 spawnable (product-authority, design-authority, challenger)
│   ├── software/              # 5 specialists (software-engineer, qa-engineer, security-engineer, platform-engineer, technical-writer)
│   └── research/              # 6 specialists (literature-analyst, research-analyst, methodology-reviewer, research-integrity-reviewer, research-engineer, research-writer)
└── hooks/
    ├── hooks.json             # 10 lifecycle hooks across 7 event types
    └── scripts/               # Hook implementation scripts
```

> For a visual diagram of the complete per-task pipeline execution, see [DIAGRAMS.md — Pipeline Execution Flow](../ko/DIAGRAMS.md#5-파이프라인-실행-흐름).

Agent details: `reference/AGENTS.md`. Skill details: `reference/SKILLS.md`. Hook details: `reference/HOOKS.md`.

---

## 9. Runtime State (`.geas/`)

`.geas/` is the per-project runtime directory. It is gitignored and created by the setup skill. All runtime artifacts — task contracts, evidence, memory, event logs — live here.

```
.geas/
├── state/
│   ├── run.json                    # Mission state, checkpoint, remaining_steps
│   ├── locks.json                  # Lock manifest for parallelism
│   ├── session-latest.md           # Latest session summary
│   └── events.jsonl                # Append-only audit trail
├── missions/{mission_id}/
│   ├── spec.json                   # Mission spec (frozen after intake)
│   ├── design-brief.json           # Design brief
│   ├── decisions/                  # Vote round results
│   ├── evolution/                  # Debt register, gap assessments, rules updates
│   ├── phase-reviews/             # Phase transition reviews
│   └── tasks/{task_id}/
│       ├── contract.json           # Task contract (scope, criteria, routing)
│       ├── record.json             # Accumulated per-task record (all sections)
│       ├── packets/                # Context packets for workers
│       └── evidence/               # Role-based agent evidence
├── memory/
│   └── agents/{type}.md            # Per-agent persistent memory
├── recovery/                       # Recovery packets
└── rules.md                        # Conventions + team rules (unified)
```

> Artifact schemas: `protocol/09_RUNTIME_ARTIFACTS_AND_SCHEMAS.md`.

---

## 10. Tool-Agnostic Principle

Core skills must not assume any specific tool, framework, or package manager. This is what makes the Contract Engine domain-agnostic — the same evidence gate works whether the project uses pytest or a citation validator.

**How it works:** The setup skill detects project conventions during initialization and records them in `.geas/rules.md`. Skills read this file to know what commands to run. No skill definition needs to change when the project's stack changes.

**Prohibited in core skills:** Hardcoded tool names, framework assumptions, default package managers.

**Allowed:** References to `rules.md`, marker file detection (package.json, go.mod, pyproject.toml), multiple-alternative examples.

---

## 11. Protocol Reference

The protocol documents in `docs/protocol/` are canonical for all protocol-level rules. This document is an architecture overview — when in doubt, the protocol takes precedence.

| Topic | Document |
|---|---|
| Design principles, 4 Pillars | `00_PROTOCOL_FOUNDATIONS` |
| Agent types, authority, routing | `01_AGENT_TYPES_AND_AUTHORITY` |
| Mission phases, modes | `02_MODES_MISSIONS_AND_RUNTIME` |
| Task lifecycle, state machine | `03_TASK_MODEL_AND_LIFECYCLE` |
| Workspace, locks, parallelism | `04_BASELINE_WORKSPACE_SCHEDULER_AND_PARALLELISM` |
| Gate, vote, verdict | `05_GATE_VOTE_AND_FINAL_VERDICT` |
| Specialist evidence matrix | `06_SPECIALIST_EVIDENCE_MATRIX` |
| Memory system | `07_MEMORY_SYSTEM_OVERVIEW` |
| Session recovery | `08_SESSION_RECOVERY_AND_RESUMABILITY` |
| Artifacts, schemas | `09_RUNTIME_ARTIFACTS_AND_SCHEMAS` |
| Enforcement, metrics | `10_ENFORCEMENT_CONFORMANCE_AND_METRICS` |
| Evolution, debt, gap loop | `11_EVOLUTION_DEBT_AND_GAP_LOOP` |

> For visual diagrams of all major protocol flows, see [DIAGRAMS.md](../ko/DIAGRAMS.md).
