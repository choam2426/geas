# Geas Architecture

## 1. Overview

Geas is a contract-driven governance harness for multi-agent AI development. It coordinates teams of AI agents through structured protocols where every decision follows a governed process, every action is traceable through an append-only ledger, every output is verified against a formal contract, and the team evolves across sessions through retrospectives and living rules.

The core insight is that the value of multi-agent development is not the number of agents -- it is that a governed process replaces ad-hoc "agent says done" with evidence-backed verification. The contract engine is the invariant; the agents, collaboration surface, and tooling are all replaceable.

When making any design decision, ask: **"Does this make the multi-agent process more governed, traceable, verifiable, or capable of learning?"**

---

## 2. Four Pillars

| Pillar | Definition | Concrete Example |
|--------|-----------|-----------------|
| **Governance** | Every decision follows a defined process with explicit authority. | Compass orchestrates the pipeline; Nova has ship/iterate/cut authority; Critic must participate in every vote round. No agent self-approves their own work. |
| **Traceability** | Every action is recorded and auditable after the fact. | All transitions are logged to `.geas/ledger/events.jsonl` with real UTC timestamps. Checkpoint state in `run.json` tracks which pipeline step is active and which agent is in flight. DecisionRecords capture the *why* behind escalations. |
| **Verification** | Every output is verified against its contract -- "done" means "contract fulfilled." | The Evidence Gate runs three tiers: mechanical (build/lint/test commands exit 0), semantic (acceptance criteria met, rubric scores above threshold), and product (Nova judgment). A Ship Gate requires four independent evidence files before a task can be marked passed. |
| **Evolution** | The team gets smarter over time. | Scrum retrospectives are mandatory for every task. Lessons go to `.geas/memory/retro/`. Rules.md is a living document updated after each task. Conventions.md captures project-specific patterns discovered during execution. |

---

## 3. Four-Layer Architecture

```
+---------------------------+
| Collaboration Surface     |  <-- replaceable (Dashboard, CLI, ...)
+---------------------------+
| Agent Teams               |  <-- replaceable (Geas-12, Lean-4, Custom)
+---------------------------+
| Contract Engine           |  <-- CORE (Intake, TaskContract, Evidence Gate)
+---------------------------+
| Tool Adapters             |  <-- replaceable (Claude Code, ...)
+---------------------------+
```

### Layer Descriptions

| Layer | Role | Replaceability |
|-------|------|----------------|
| **Collaboration Surface** | The interface humans use to interact with the system. Could be a dashboard, CLI, or chat thread. | Fully replaceable. Core skills must not hardcode surface assumptions. |
| **Agent Teams** | The set of specialist agents that execute work. The default Geas-12 team includes Nova (PM), Forge (Architect), Palette (Designer), Pixel (Frontend), Circuit (Backend), Sentinel (QA), Keeper (Git/Release), Shield (Security), Scroll (Docs), Critic (Devil's Advocate), Scrum (Agile Master), Pipeline (DevOps). | Replaceable by adapting pipeline skills. The default Geas-12 team is one configuration. Alternative teams require modifying the pipeline skills that reference agent names. The contract engine's data flow (TaskContract → Evidence → Gate) works with any agent setup. |
| **Contract Engine** | The core skills that define *how* work flows: intake, task compilation, context packets, implementation contracts, evidence gates, verify-fix loops, vote rounds. This layer is tool-agnostic. | **Not replaceable** -- this is the invariant. All other layers adapt to it. |
| **Tool Adapters** | The runtime tools agents use to do work (file I/O, bash, web search, MCP servers, browser automation). | Fully replaceable. Core skills reference capabilities by category, not by product name. |

### Plugin Structure

```
plugin/
  plugin.json              # Manifest (agents, skills, hooks, settings)
  skills/                  # Shared skills (core + team + surface)
    intake/                # Socratic requirements gathering
    task-compiler/         # seed -> TaskContracts
    context-packet/        # Role-specific briefings
    evidence-gate/         # 3-tier verification
    implementation-contract/  # Pre-implementation agreement
    verify-fix-loop/       # Fail -> fix -> re-verify with retry budget
    vote-round/            # Structured agent voting + debate
    compass/               # Orchestrator (runs in main session)
    initiative/            # 4-phase new product protocol
    sprint/                # Bounded feature addition protocol
    debate/                # Decision-only discussion, no code
    ...                    # Additional utility skills
  agents/                  # 12 agent definitions (.md with YAML frontmatter)
  hooks/
    hooks.json             # Hook configuration
    scripts/               # Hook implementation scripts
```

---

## 4. Data Flow

### Complete Task Lifecycle

A task flows through these artifacts, each conforming to a JSON Schema in the relevant `schemas/` directory:

```
User Request
    |
    v
+-----------+     Socratic Q&A     +------------+
|  Intake   | ------------------->  |  seed.json |  (immutable project identity)
+-----------+                       +------------+
                                         |
                                         v
                                  +--------------+
                                  | Task Compiler | --- stories/feature desc
                                  +--------------+
                                         |
                                         v
                                  +--------------+
                                  | TaskContract  |  (.geas/tasks/{task-id}.json)
                                  +--------------+  goal, acceptance_criteria,
                                         |          eval_commands, rubric,
                                         |          retry_budget, worker, reviewer
                                         v
                                  +---------------+
                                  | ContextPacket |  (.geas/packets/{task-id}/{role}.md)
                                  +---------------+  role-specific briefing
                                         |
                                         v
                                  +------------------------+
                                  | ImplementationContract |  (.geas/contracts/{task-id}.json)
                                  +------------------------+  planned_actions, edge_cases,
                                         |                    demo_steps, approved by
                                         |                    Sentinel + Forge
                                         v
                                  +----------------+
                                  | Implementation |  (worker in isolated worktree)
                                  +----------------+
                                         |
                                         v
                                  +----------------+
                                  | EvidenceBundle |  (.geas/evidence/{task-id}/{agent}.json)
                                  +----------------+  per-agent evidence files
                                         |
                                         v
                                  +--------------+     fail     +----------------+
                                  | Evidence Gate | ----------> | Verify-Fix Loop|
                                  +--------------+              +----------------+
                                    |    |                            |
                                    |    | (retry budget              |
                                    |    |  exhausted)                | (re-run gate)
                                    |    v                            |
                                    |  +----------------+             |
                                    |  | DecisionRecord | <-----------+
                                    |  +----------------+   (on escalation)
                                    |  (.geas/decisions/)
                                    |
                                    | pass
                                    v
                              +-------------+
                              | GateVerdict |  pass / fail / iterate
                              +-------------+
                                    |
                                    v
                              +------------+
                              | Ship Gate  |  4 evidence files required:
                              +------------+  forge-review, sentinel,
                                    |         critic-review, nova-verdict
                                    v
                              +-----------+
                              |  Resolve  |  status -> "passed"
                              +-----------+  Keeper commits, Scrum retros
```

### Artifact Summary

| Artifact | Location | Schema | Created By |
|----------|----------|--------|------------|
| seed.json | `.geas/spec/seed.json` | `intake/schemas/seed.schema.json` | Intake |
| TaskContract | `.geas/tasks/{task-id}.json` | `task-compiler/schemas/task-contract.schema.json` | Task Compiler |
| ContextPacket | `.geas/packets/{task-id}/{role}.md` | `context-packet/schemas/context-packet.schema.json` | Context Packet Generator |
| ImplementationContract | `.geas/contracts/{task-id}.json` | `implementation-contract/schemas/implementation-contract.schema.json` | Worker (approved by Sentinel + Forge) |
| EvidenceBundle | `.geas/evidence/{task-id}/{agent}.json` | `evidence-gate/schemas/evidence-bundle.schema.json` | Each agent after completing work |
| GateVerdict | Logged to events.jsonl | N/A (event format) | Evidence Gate |
| DecisionRecord | `.geas/decisions/{dec-id}.json` | `evidence-gate/schemas/decision-record.schema.json` | Evidence Gate (on escalation) |

---

## 5. `.geas/` Directory Structure

The `.geas/` directory is the runtime state root for a project. It is gitignored and created per-project.

```
.geas/
  state/
    run.json                 # Current run state: mode, phase, status,
                             # current_task_id, completed_tasks, checkpoint
                             # (including remaining_steps, agent_in_flight,
                             # pipeline_step, retry_count)

  spec/
    seed.json                # Frozen mission spec from intake (immutable)
    prd.md                   # Product Requirements Document (Initiative only)
    stories.md               # User stories broken from PRD (Initiative only)

  tasks/
    task-001.json            # TaskContract for each task
    task-002.json            # Contains goal, acceptance_criteria, eval_commands,
    ...                      # rubric, worker, reviewer, status, retry_budget

  contracts/
    task-001.json            # ImplementationContract per task
    ...                      # planned_actions, edge_cases, demo_steps, status

  packets/
    task-001/
      palette.md             # ContextPacket for designer
      pixel.md               # ContextPacket for frontend worker
      forge.md               # ContextPacket for architect
      forge-review.md        # ContextPacket for code review
      sentinel.md            # ContextPacket for QA
      ...

  evidence/
    discovery/                 # Discovery phase evidence (Initiative only)
      nova.json              # Vision and MVP scope
      forge.json             # Architecture decision
      vote-*.json            # Vote round results
    task-001/
      palette.json           # Design spec evidence
      pixel.json             # Implementation evidence
      forge-review.json      # Code review evidence
      sentinel.json          # QA/testing evidence
      critic-review.json     # Critic pre-ship review
      nova-verdict.json      # Product owner verdict
      keeper.json            # Commit evidence
    polish/
      shield.json            # Security review
      scroll.json            # Documentation review
    evolution/
      nova-final.json        # Final product review
      keeper-release.json    # Release management

  decisions/
    dec-001.json             # DecisionRecord — why a decision was made
    ...                      # Created on escalations, architecture choices, pivots

  ledger/
    events.jsonl             # Append-only event log (all transitions, gate results,
                             # step completions with real UTC timestamps)

  memory/
    _project/
      conventions.md         # Project-specific conventions (tech stack, commands,
                             # patterns — detected by Forge during onboarding)
    retro/
      task-001.json          # Retrospective lessons from Scrum
      ...

  rules.md                   # Living rules document — updated by Scrum after
                             # each task's retrospective

  debt.json                  # Tech debt tracker (DEBT-001, DEBT-002, ...)
                             # severity, source_task, status

  config.json                # Runtime config (connected MCP servers, etc.)
```

### Key Files

| File | Purpose | Updated By |
|------|---------|------------|
| `state/run.json` | Session state and checkpoint. Recovery anchor after compaction. | Compass (before/after every agent spawn) |
| `spec/seed.json` | Frozen mission identity. Never modified after creation. | Intake (once) |
| `rules.md` | Living conventions. Grows with every retrospective. | Scrum |
| `debt.json` | Tech debt backlog. Threshold warnings via hook. | Compass (after reading agent evidence) |
| `ledger/events.jsonl` | Audit trail. Append-only. | Compass (every transition) |

---

## 6. seed.json Design

### Purpose

The seed is the project's frozen identity -- what we are building, for whom, and within what boundaries. It is the single source of truth that all downstream artifacts (TaskContracts, ContextPackets, Nova verdicts) reference for mission alignment.

### Schema

Defined in `plugin/skills/intake/schemas/seed.schema.json`. Required fields:

| Field | Type | Description |
|-------|------|-------------|
| `version` | string (const "1.0") | Schema version |
| `mission` | string | Refined, unambiguous mission statement |
| `acceptance_criteria` | array (min 3) | Measurable criteria that define "done" |
| `scope_in` | array (min 1) | Features explicitly included |
| `scope_out` | array (min 1) | Features explicitly excluded (proves scope was considered) |
| `completeness_checklist` | object | Booleans confirming each section was user-approved |
| `created_at` | date-time | UTC timestamp when frozen |

Optional fields: `target_user`, `constraints`, `assumptions`, `ambiguity_notes`, `source`, `readiness_override`.

### Immutability

Once confirmed by the user, the seed is never modified during execution. If scope must change, the pivot-protocol skill is invoked instead.

### Source Field

The `source` field indicates how the seed was created:

| Value | Meaning |
|-------|---------|
| `"initiative"` | Full Socratic intake process. Comprehensive seed with all sections user-approved. |
| `"sprint"` | Minimal auto-generated seed. Created only when no seed exists (first Sprint on a project). Contains project identity detected from codebase onboarding. |

### Initiative vs Sprint Behavior

**Initiative** creates a full seed through multi-step Socratic intake:
1. Assess scope (decompose if too large)
2. Explore requirements (one question at a time, multiple choice preferred)
3. Propose 2-3 approaches with trade-offs
4. Build seed section-by-section with explicit user approval
5. Verify completeness checklist (all booleans true)
6. Freeze

**Sprint** treats the seed as read-only context:
- If `seed.json` exists (from prior Initiative or Sprint): read it for mission/constraints. Never modify it. Feature scope goes directly into the TaskContract.
- If `seed.json` does not exist (first time using Geas): create a minimal seed with `"source": "sprint"`, populated from codebase onboarding (detected stack, conventions, project identity).

This separation means the seed captures *project identity*, while the TaskContract captures *what to build right now*.

---

## 7. Context Decay Resistance

### The Problem

Long-running orchestration sessions hit context window limits. When the LLM compacts its context, pipeline state degrades:

- The orchestrator forgets which step it was on
- It skips mandatory steps (code review, testing, critic review)
- It loses track of which tasks are complete vs in-progress
- Agent definitions (YAML frontmatter + role description) survive compaction at ~100% fidelity because they are short and self-contained
- SKILL.md pipeline steps (long sequential procedures) degrade significantly because the compactor summarizes them, losing step ordering and mandatory markers

### The Solution

Geas uses a two-part defense:

#### Part 1: Checkpoint State in run.json

Before every agent spawn, Compass writes the full pipeline position to `.geas/state/run.json`:

```json
{
  "mode": "initiative",
  "phase": "mvp",
  "status": "in_progress",
  "current_task_id": "task-003",
  "completed_tasks": ["task-001", "task-002"],
  "checkpoint": {
    "pipeline_step": "code_review",
    "agent_in_flight": "forge",
    "pending_evidence": ["forge-review.json"],
    "retry_count": 0,
    "parallel_batch": null,
    "remaining_steps": ["testing", "evidence_gate", "critic_review", "nova_review", "retrospective", "resolve"],
    "last_updated": "2026-03-30T10:15:00Z"
  }
}
```

The `remaining_steps` array is the critical element. After each step completes, it is removed from the front. If the orchestrator loses context, it reads `remaining_steps` and knows exactly what comes next.

#### Part 2: PostCompact Hook (restore-context.sh)

A `PostCompact` hook fires automatically after every context compaction. It reads `run.json` and injects the current state back into the conversation as `additionalContext`:

- Mode, phase, status
- Current task ID and goal
- Acceptance criteria for the current task
- Pipeline step and agent in flight
- The `remaining_steps` array with an explicit `NEXT STEP` indicator
- The first 30 lines of `rules.md` (key conventions)

This means even after aggressive compaction, the orchestrator receives a structured state summary that tells it exactly where to resume.

#### Why Agent Definitions Survive but Pipelines Degrade

Agent definitions are small, self-contained markdown files (name, model, role description). They compress well and retain their meaning after compaction.

SKILL.md pipeline definitions are long sequential procedures with conditional logic, mandatory markers (`[MANDATORY]`), skip conditions, and cross-references. When compacted, the summarizer tends to:
- Merge adjacent steps
- Drop conditional skip logic
- Lose the `[MANDATORY]` annotations
- Summarize "11 steps" as "the pipeline runs design through resolve"

The checkpoint + restore-context approach sidesteps this entirely by externalizing the pipeline position to disk, where it is immune to compaction.

---

## 8. Tool-Agnostic Principle

### Rule

Core skills (`plugin/skills/`) must not hardcode specific tools, frameworks, package managers, databases, test runners, or build tools. This keeps the contract engine portable across any tech stack.

### What Is Prohibited

- Package manager names (npm, pnpm, yarn, bun) as assumed defaults
- Framework names (Next.js, React, Express, Django) as requirements
- Database names (PostgreSQL, MongoDB) as assumptions
- Test tool names (Playwright, Jest, pytest) as mandated tools
- Build tool names (webpack, vite) as prescribed choices

### What Is Allowed

| Pattern | Example | Rationale |
|---------|---------|-----------|
| Referencing conventions.md | "Run the build command from conventions.md" | Project-specific commands live in conventions.md, not in skill definitions |
| Marker file detection | "If package.json exists..." / "If go.mod exists..." | Detection targets for stack identification, not prescriptions |
| Multi-alternative examples | "e.g., Jest, pytest, or vitest" | Showing multiple options avoids prescribing one |
| MCP tool categories | "browser automation MCP" | Agent definitions may reference MCP categories but not specific product names as the only option |

### How This Works in Practice

1. **Forge onboards the project** during Discovery (Initiative) or pre-conditions (Sprint), writing discovered conventions to `.geas/memory/_project/conventions.md`
2. **TaskContracts reference conventions.md** for eval_commands (e.g., the test command, build command, lint command)
3. **Workers read their ContextPacket**, which includes relevant conventions
4. **Evidence Gate runs eval_commands** from the TaskContract -- these are project-specific commands, not hardcoded tool invocations

This means a Geas session on a Python/Django project uses `pytest` and `ruff` because conventions.md says so, while a TypeScript/Next.js project uses `vitest` and `eslint` -- all without changing any skill definition.

### CLAUDE.md Enforcement

The project's CLAUDE.md contains these rules explicitly. Any PR that adds a hardcoded tool reference to a core skill violates the architecture and should be rejected.
