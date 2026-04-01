# Geas Architecture

## 1. Overview

Geas is a contract-based governance harness for multi-agent AI development. It coordinates multiple AI agents through structured protocols, guaranteeing four control objectives (4 Pillars):

- **Governance** -- Every decision follows a defined procedure with explicit authority.
- **Traceability** -- Every action is recorded and auditable after the fact.
- **Verification** -- Every deliverable is verified against its contract. "Done" means "contract satisfied."
- **Evolution** -- The team grows across sessions through retrospectives, rule updates, memory promotion, debt tracking, and gap assessments.

The value of multi-agent is not the number of agents. It is replacing "the agent says it is done" with evidence-based verification. The Contract Engine is the immutable core; agents, collaboration surfaces, and tools are all replaceable.

When making any design decision, always ask: **"Does this change make the multi-agent process more governed, traceable, verifiable, or capable of learning?"**

> For the concrete protocol bindings and design principles behind the 4 Pillars, see `protocol/00_PROTOCOL_FOUNDATIONS.md`.

---

## 2. Four-Layer Architecture

```
+---------------------------+
| Collaboration Surface     |  <-- Replaceable (Dashboard, CLI, ...)
+---------------------------+
| Agent Teams               |  <-- Replaceable (Geas-12, Lean-4, Custom)
+---------------------------+
| Contract Engine           |  <-- Core (immutable)
+---------------------------+
| Tool Adapters             |  <-- Replaceable (Claude Code, ...)
+---------------------------+
```

| Layer | Role | Replaceable? |
|-------|------|--------------|
| **Collaboration Surface** | The interface through which humans interact with the system. Dashboards, CLI, chat threads, etc. | Fully replaceable. |
| **Agent Teams** | The set of specialized agents that perform work. The default Geas-12 team is one configuration; other team compositions are possible. | Replaceable. The Contract Engine's data flow works with any agent configuration. |
| **Contract Engine** | The core set of skills that define the workflow: intake, task compilation, context packet, implementation contract, evidence gate, verify-fix loop, vote round. Tool-agnostic. | **Not replaceable** -- this is the immutable core. |
| **Tool Adapters** | Runtime tools agents use to do their work (file I/O, bash, MCP servers, etc.). | Fully replaceable. Core skills reference tools by functional category. |

---

## 3. Execution Model

### Top-Level Modes

| Mode | Purpose | Code changes |
|------|---------|-------------|
| `discovery` | Form direction, scope, structure, task inventory | Prohibited by default (spike exception) |
| `delivery` | Execute the task backlog: implement, verify, integrate | Allowed |
| `decision` | Structured decision-making without code | Prohibited |

### Missions and Phases

An Initiative mission progresses through four phases:

```
discovery --[gate 1]--> build --[gate 2]--> polish --[gate 3]--> evolution
                                                                    |
                                                               [gate 4]
                                                                    |
                                                                  close
```

Sprint is an execution pattern within delivery mode. It skips discovery and uses the existing seed as read-only context.

> For details on modes, missions, and phases, see `protocol/02_MODES_MISSIONS_AND_RUNTIME.md`.

---

## 4. Task Lifecycle

A task is the only closure unit in the protocol. It passes through 7 primary states and 4 auxiliary states:

```
drafted -> ready -> implementing -> reviewed -> integrated -> verified -> passed
                                                          (+ blocked, escalated, cancelled, paused[scheduler flag])
```

Each transition requires a mandatory artifact:

| Transition | Required artifact |
|------------|------------------|
| drafted -> ready | task-contract.json |
| ready -> implementing | implementation-contract.json (approved) |
| implementing -> reviewed | worker-self-check.json + specialist-review.json |
| reviewed -> integrated | integration-result.json |
| integrated -> verified | gate-result.json (pass) |
| verified -> passed | closure-packet.json + final-verdict.json (pass) |

> For the task state machine, transition conditions, and rewind rules, see `protocol/03_TASK_MODEL_AND_LIFECYCLE.md`.

---

## 5. Verification Flow

```
Implementation
    |
    v
Evidence Gate (Tier 0 -> Tier 1 -> Tier 2)
    |                          |
    | pass                     | fail -> Verify-Fix Loop (retry_budget decremented)
    v
Closure Packet assembly
    |
    v
Critical Reviewer Challenge (mandatory for high/critical)
    |
    v
Final Verdict (product_authority: pass / iterate / escalate)
    |
    v
Resolve -> passed
```

- **Tier 0** (Precheck): Artifact existence, task state eligibility, baseline checks
- **Tier 1** (Mechanical): build/lint/test/typecheck
- **Tier 2** (Contract + Rubric): Acceptance criteria, rubric scoring (1-5, per-dimension thresholds)
- **block**: Structural precondition not met (retry_budget not decremented)
- **fail**: Quality issue (retry_budget decremented by 1, enters verify-fix loop)
- **Final Verdict iterate**: Product judgment (retry_budget not decremented; 3 cumulative iterations trigger escalation)

> For details on Evidence Gate, rubric scoring, vote round, closure packet, and final verdict, see `protocol/05_GATE_VOTE_AND_FINAL_VERDICT.md`.

---

## 6. Memory and Evolution

A key differentiator of Geas is that **the team learns across sessions**.

### Memory System

Memory is not a repository -- it is a **behavior modification device**. Through rules.md, agent_memory, risk_memory, and context packets, it changes behavior on the next task.

The memory lifecycle has 9 states:

```
candidate -> provisional -> stable -> canonical
                 ↕               ↕
            under_review    under_review
                 ↓               ↓
         decayed / superseded / archived / rejected
```

Promotion criteria:
- candidate -> provisional: evidence 2+ OR incident 2+ OR authority approval
- provisional -> stable: application log 3+, contradiction 0, authority review
- stable -> canonical: application log 5+ across 3+ tasks, joint approval

### Evolution Loop

After every task completion:
1. **Retrospective**: process_lead extracts lessons, rule/memory/debt candidates
2. **Rules.md Update**: Verified lessons promoted to team rules
3. **Memory Promotion**: candidate -> provisional -> stable -> canonical
4. **Debt Tracking**: Record debt, classify, resolve per phase
5. **Gap Assessment**: Compare scope_in vs scope_out, forward-feed shortfalls

> For memory details, see `protocol/07`, `08`, `09`. For the evolution loop, see `protocol/14`.

---

## 7. Context Loss Defense

Long-running sessions hit context window limits. Geas uses two defenses:

### Defense 1: run.json Checkpoint

The `remaining_steps[]` array externalizes the current pipeline position to disk. Steps are removed from the array as they complete. Even after compaction, reading this file tells the orchestrator exactly what to do next.

### Defense 2: PostCompact Hook

When context compaction occurs, this hook automatically reads `run.json` and re-injects the current state (mode, phase, task, remaining_steps, key rules.md content) into the conversation.

> For session recovery details, see `protocol/10_SESSION_RECOVERY_AND_RESUMABILITY.md`.

---

## 8. Plugin Structure

```
plugin/
  plugin.json              # Manifest
  skills/                  # Shared skills
    intake/                # Socratic requirements gathering
    task-compiler/         # seed -> TaskContract
    context-packet/        # Role-specific briefings
    evidence-gate/         # Tier 0/1/2 + Closure Packet + Final Verdict
    implementation-contract/  # Pre-implementation agreement
    verify-fix-loop/       # fail -> fix -> re-verify
    vote-round/            # Structured voting
    compass/               # Orchestrator
    initiative/            # 4-phase mission (discovery -> build -> polish -> evolution)
    sprint/                # delivery mode: add features to existing project
    debate/                # decision mode: decision-making
    ...
  agents/                  # Agent definitions (.md)
  hooks/
    hooks.json             # Hook configuration
    scripts/               # Hook scripts
```

---

## 9. `.geas/` Directory Structure

`.geas/` is the per-project runtime state root. It is gitignored and created per project.

```
.geas/
  state/
    run.json                 # Session state, checkpoint, remaining_steps
    locks.json               # Lock manifest
    health-check.json        # Health signal calculation results

  spec/
    seed.json                # Mission spec frozen at intake (immutable)

  tasks/
    {task_id}/
      task-contract.json
      implementation-contract.json
      worker-self-check.json
      specialist-review.json
      integration-result.json
      gate-result.json
      closure-packet.json
      challenge-review.json
      final-verdict.json
      retrospective.json

  evolution/
    rules-update-{seq}.json
    debt-register.json
    gap-assessment-{transition}.json
    phase-review-{transition}.json

  memory/
    memory-index.json
    _project/conventions.md
    agents/{type}.md
    retro/{task_id}.json
    incidents/{id}.json

  summaries/
    session-latest.md
    task-focus/{task_id}.md
    mission-summary.md
    run-summary-{timestamp}.md

  ledger/
    events.jsonl             # Append-only audit trail

  rules.md                   # Continuously updated team rules
  debt.json                  # Legacy (migrating to evolution/debt-register.json)
```

> For artifact details and schemas, see `protocol/11_RUNTIME_ARTIFACTS_AND_SCHEMAS.md`.

---

## 10. Tool-Agnostic Principle

Core skills (`plugin/skills/`) must not hardcode specific tools.

**Prohibited**: Assuming package managers, frameworks, databases, test tools, or build tools as defaults.

**Allowed**: Referencing `.geas/memory/_project/conventions.md` for project-specific commands, marker file detection (package.json, go.mod), listing multiple alternatives (e.g., "Jest, pytest").

How it works in practice: Forge records project conventions in conventions.md during onboarding. TaskContract's eval_commands reference those conventions. Evidence Gate runs the project-specific commands. No skill definitions need to change.

---

## 11. Protocol Reference

The detailed operational protocol specifications live in `docs/protocol/`. This document is an architecture overview; the protocol documents are canonical for protocol-level rules.

| Topic | Reference |
|-------|-----------|
| Design principles, 4 Pillars | `protocol/00_PROTOCOL_FOUNDATIONS.md` |
| Agent types, authority boundaries | `protocol/01_AGENT_TYPES_AND_AUTHORITY.md` |
| Modes, missions, phases | `protocol/02_MODES_MISSIONS_AND_RUNTIME.md` |
| Task lifecycle, state machine | `protocol/03_TASK_MODEL_AND_LIFECYCLE.md` |
| Worktree, locks, parallelism | `protocol/04_BASELINE_WORKTREE_SCHEDULER_AND_PARALLELISM.md` |
| Gate, vote, verdict | `protocol/05_GATE_VOTE_AND_FINAL_VERDICT.md` |
| Specialist evidence matrix | `protocol/06_SPECIALIST_EVIDENCE_MATRIX.md` |
| Memory system | `protocol/07`, `08`, `09` |
| Session recovery | `protocol/10_SESSION_RECOVERY_AND_RESUMABILITY.md` |
| Artifacts, schemas | `protocol/11_RUNTIME_ARTIFACTS_AND_SCHEMAS.md` |
| Enforcement, metrics | `protocol/12_ENFORCEMENT_CONFORMANCE_AND_METRICS.md` |
| Migration roadmap | `protocol/13_MIGRATION_AND_IMPLEMENTATION_ROADMAP.md` |
| Evolution loop | `protocol/14_EVOLUTION_DEBT_AND_GAP_LOOP.md` |
