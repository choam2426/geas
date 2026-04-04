# Geas Architecture

## 1. Overview

Geas is a contract-based governance protocol for multi-agent AI development. It coordinates multiple AI agents through structured protocols, guaranteeing four control objectives (4 Pillars):

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

### Mission Phases

A mission progresses through four phases:

```
specifying --[gate 1]--> building --[gate 2]--> polishing --[gate 3]--> evolving
                                                                           |
                                                                       [gate 4]
                                                                           |
                                                                         close
```

Every phase always runs. Scale adapts to the request — a single feature gets a lightweight pass; a full product gets the full treatment.

Decision is a utility skill (`decision/`) for structured decision-making without code changes. It is not a separate execution mode.

> For details on missions and phases, see `protocol/02_MODES_MISSIONS_AND_RUNTIME.md`.

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
| implementing -> reviewed | worker-self-check.json + specialist reviews (in `.geas/evidence/{task_id}/`) |
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

When context compaction occurs, this hook automatically reads `run.json` and re-injects the current state (phase, task, remaining_steps, key rules.md content) into the conversation.

> For session recovery details, see `protocol/10_SESSION_RECOVERY_AND_RESUMABILITY.md`.

---

## 8. Plugin Structure

```
plugin/
  plugin.json              # Manifest
  skills/                    # Shared skills (27 total)
    # --- Contract Engine (core) ---
    intake/                  # Socratic requirements gathering
    task-compiler/           # mission spec -> TaskContract
    context-packet/          # Role-specific briefings
    implementation-contract/ # Pre-implementation agreement
    evidence-gate/           # Tier 0/1/2 verification
    verify-fix-loop/         # fail -> fix -> re-verify
    vote-round/              # Structured voting
    verify/                  # Verification utilities
    # --- Execution ---
    orchestrating/           # Orchestrator: 4-phase mission pipeline
      references/
        specifying.md        # Specifying phase procedure
        pipeline.md          # Per-task 14-step pipeline
        building.md          # Building phase management
        polishing.md         # Polishing phase procedure
        evolving.md          # Evolving phase procedure
    scheduling/              # Task scheduling and parallelism
    decision/                # Structured decision-making (utility skill)
    mission/                 # Mission lifecycle management
    # --- Memory & Evolution ---
    memorizing/              # Memory capture and promotion
    conformance-checking/    # Protocol conformance checks
    # --- Support ---
    briefing/                # Agent briefing assembly
    onboard/                 # Project onboarding
    setup/                   # Environment setup
    cleanup/                 # Session cleanup
    reporting/               # Status reporting
    run-summary/             # Run summary generation
    ledger-query/            # Ledger querying
    pivot-protocol/          # Pivot handling
    policy-managing/         # Policy management
    coding-conventions/      # Convention detection
    chaos-exercising/        # Chaos testing
    write-prd/               # PRD generation (standalone utility, not part of core pipeline)
    write-stories/           # Story generation (standalone utility, not part of core pipeline)
  agents/                    # Agent definitions (.md)
  hooks/
    hooks.json               # Hook configuration
    scripts/                 # 18 hook scripts (see below)
```

### Hooks (18 scripts)

Hooks are lifecycle event handlers that enforce governance without agent cooperation.

| Lifecycle Event | Scripts |
|----------------|---------|
| **SessionStart** | `session-init.sh`, `memory-review-cadence.sh` |
| **PreToolUse** | `checkpoint-pre-write.sh` |
| **PostToolUse (Write/Edit)** | `protect-geas-state.sh`, `verify-task-status.sh`, `check-debt.sh`, `stale-start-check.sh`, `lock-conflict-check.sh`, `memory-promotion-gate.sh`, `memory-superseded-warning.sh`, `checkpoint-post-write.sh`, `packet-stale-check.sh` |
| **PostToolUse (Bash)** | `integration-lane-check.sh` |
| **SubagentStart** | `inject-context.sh` |
| **SubagentStop** | `agent-telemetry.sh` |
| **Stop** | `verify-pipeline.sh`, `calculate-cost.sh` |
| **PostCompact** | `restore-context.sh` |

---

## 9. `.geas/` Directory Structure

`.geas/` is the per-project runtime state root. It is gitignored and created per project.

```
.geas/
  state/
    run.json                 # Session state, checkpoint, remaining_steps
    locks.json               # Lock manifest
    health-check.json        # Health signal calculation results
    memory-index.json        # Memory entry index
    session-latest.md        # Post-compact recovery context
    task-focus/{task_id}.md  # Per-task focus summaries

  missions/
    {mission_id}/
      design-brief.json        # Design brief (user-approved)
      phase-reviews/           # Per-mission phase review artifacts

  spec/
    mission-{n}.json         # Mission spec frozen at intake (immutable, path migration pending)

  tasks/
    {task_id}.json               # TaskContract (flat file per task)
    {task_id}/                   # Per-task artifacts (nested directory)
      worker-self-check.json
      specialist-review.json
      integration-result.json
      gate-result.json
      closure-packet.json
      challenge-review.json
      final-verdict.json
      retrospective.json

  evidence/
    {task_id}/
      architecture-authority-review.json
      qa-engineer.json
      challenge-review.json
      product-authority-verdict.json

  packets/
    {task_id}/
      {agent_type}.md            # Role-specific context packets

  evolution/
    rules-update-{seq}.json
    debt-register.json
    gap-assessment-{transition}.json
    phase-review-{transition}.json

  contracts/
    {task_id}.json             # Implementation contracts

  decisions/
    {dec_id}.json              # Decision records
    pending/                   # In-progress proposals

  recovery/
    recovery-{id}.json         # Recovery packets for session rewind

  memory/
    _project/conventions.md
    agents/{type}.md
    candidates/{memory_id}.json  # Memory candidates (pre-promotion)
    entries/{memory_id}.json     # Promoted memory entries
    logs/{task_id}-{memory_id}.json  # Application logs
    retro/{task_id}.json
    incidents/{id}.json

  summaries/
    mission-summary.md
    run-summary-{timestamp}.md

  ledger/
    events.jsonl             # Append-only audit trail

  rules.md                   # Continuously updated team rules
```

> For artifact details and schemas, see `protocol/11_RUNTIME_ARTIFACTS_AND_SCHEMAS.md`.

---

## 10. Tool-Agnostic Principle

Core skills (`plugin/skills/`) must not hardcode specific tools.

**Prohibited**: Assuming package managers, frameworks, databases, test tools, or build tools as defaults.

**Allowed**: Referencing `.geas/memory/_project/conventions.md` for project-specific commands, marker file detection (package.json, go.mod), listing multiple alternatives (e.g., "Jest, pytest").

How it works in practice: The architecture authority records project conventions in conventions.md during onboarding. TaskContract's eval_commands reference those conventions. Evidence Gate runs the project-specific commands. No skill definitions need to change.

---

## 11. Protocol Reference

The detailed operational protocol specifications live in `docs/protocol/`. This document is an architecture overview; the protocol documents are canonical for protocol-level rules.

| Topic | Reference |
|-------|-----------|
| Design principles, 4 Pillars | `protocol/00_PROTOCOL_FOUNDATIONS.md` |
| Agent types, authority boundaries | `protocol/01_AGENT_TYPES_AND_AUTHORITY.md` |
| Mission phases, mission model | `protocol/02_MODES_MISSIONS_AND_RUNTIME.md` |
| Task lifecycle, state machine | `protocol/03_TASK_MODEL_AND_LIFECYCLE.md` |
| Worktree, locks, parallelism | `protocol/04_BASELINE_WORKTREE_SCHEDULER_AND_PARALLELISM.md` |
| Gate, vote, verdict | `protocol/05_GATE_VOTE_AND_FINAL_VERDICT.md` |
| Specialist evidence matrix | `protocol/06_SPECIALIST_EVIDENCE_MATRIX.md` |
| Memory system | `protocol/07`, `08`, `09` |
| Session recovery | `protocol/10_SESSION_RECOVERY_AND_RESUMABILITY.md` |
| Artifacts, schemas | `protocol/11_RUNTIME_ARTIFACTS_AND_SCHEMAS.md` |
| Enforcement, metrics | `protocol/12_ENFORCEMENT_CONFORMANCE_AND_METRICS.md` |
| Evolution loop | `protocol/14_EVOLUTION_DEBT_AND_GAP_LOOP.md` |
