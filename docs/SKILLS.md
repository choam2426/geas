# Skill Reference

## Overview

Skills are the building blocks of the Geas framework. Each skill is a self-contained instruction set defined in a `SKILL.md` file with YAML frontmatter (`name`, `description`) inside its own subdirectory under `plugin/skills/`.

Skills are invoked in two ways:

1. **Auto-triggered** -- Claude matches the skill's `description` field against the user's natural language input and activates the most relevant skill automatically.
2. **Explicitly invoked** -- Other skills or the orchestrator call a skill directly using `/geas:<skill-name>` syntax (e.g., `/geas:intake`, `/geas:task-compiler`).

Skills do not hold state themselves. All runtime state lives in the `.geas/` directory (gitignored, per-project). Skills read from and write to `.geas/` subdirectories: `spec/`, `state/`, `tasks/`, `packets/`, `evidence/`, `decisions/`, `ledger/`, and `memory/`.

---

## Skill Chain

When a user describes a mission, the following chain executes:

```
User input
  |
  v
mission              Entry point -- triggers Geas
  |
  v
compass              Orchestrator -- setup, intake, mode detection
  |                  SubagentStart hook auto-injects rules.md + agent memory
  |
  +---> setup        First-run: dependencies, .geas/ init
  |
  +---> intake       Socratic questioning, produces seed.json
  |
  +---> [mode detection]
        |
        +---> initiative     New product (Genesis -> MVP -> Polish -> Evolution)
        +---> sprint        Bounded feature addition to existing project
        +---> debate        Decision-only discussion, no code
```

Within `initiative` and `sprint`, the contract engine skills run per task:

```
task-compiler  -->  context-packet  -->  [agent work]  -->  evidence-gate
                                                                |
                                                          pass? |
                                                          no  --+--> verify-fix-loop --> re-gate
                                                          yes --+--> done (next task)
```

---

## Skills by Category

### Entry

| Skill | Description | Invocation | Inputs | Outputs |
|-------|-------------|------------|--------|---------|
| [mission](#mission) | Entry point that activates the Geas multi-agent team | Auto-triggered when user describes a product idea, project goal, feature request, or structured discussion | User's natural language request | Delegates to `compass` |

### Orchestration

| Skill | Description | Invocation | Inputs | Outputs |
|-------|-------------|------------|--------|---------|
| [compass](#compass) | Coordinates the entire multi-agent team -- manages setup, intake, mode detection, and delegation | Called by `mission` via `/geas:compass` | `.geas/state/run.json` (if resuming) | Delegates to `initiative`, `sprint`, or `debate` |

### Core (Contract Engine)

| Skill | Description | Invocation | Inputs | Outputs |
|-------|-------------|------------|--------|---------|
| [intake](#intake) | Socratic requirements gathering -- surfaces hidden assumptions and freezes a seed spec | Called by `compass` via `/geas:intake` | User's mission string | `.geas/spec/seed.json` |
| [task-compiler](#task-compiler) | Compiles a user story into a TaskContract with verifiable acceptance criteria | Called by `compass` during initiative or sprint | Seed spec, architecture context, user story | `.geas/tasks/{id}.json` |
| [context-packet](#context-packet) | Generates a role-specific briefing for a worker agent | Called by `compass` before dispatching any worker | TaskContract, prior evidence, seed spec | `.geas/packets/{task-id}/{worker}.md` |
| [evidence-gate](#evidence-gate) | Three-tier quality gate evaluating output against a TaskContract | Called by `compass` after collecting an EvidenceBundle | EvidenceBundle, TaskContract, gate level | Gate verdict (pass/fail/iterate) in `.geas/evidence/` |
| [verify-fix-loop](#verify-fix-loop) | Bounded fix-verify inner loop after evidence gate failure | Called by `compass` (or evidence-gate) on gate failure | Failed EvidenceBundle, TaskContract, gate verdict | Fixed evidence, or escalation DecisionRecord |
| [vote-round](#vote-round) | Structured agent voting and debate on major proposals | Called by `compass` after architecture/design proposals | Proposal (e.g., Forge's architecture), list of voters | Vote result summary; DecisionRecord on disagreement |

### Team (Execution Protocols)

| Skill | Description | Invocation | Inputs | Outputs |
|-------|-------------|------------|--------|---------|
| [initiative](#initiative) | 4-phase new product build: Genesis, MVP, Polish, Evolution. Critic votes in every vote round, performs pre-ship review. Keeper commits at Resolve/Evolution | Called by `compass` or explicitly via `/geas:initiative` | Seed spec from intake | Completed project with evidence trail |
| [sprint](#sprint) | Single-feature pipeline: Design, Build, Review, QA, Retrospective. Keeper commits at Resolve | Called by `compass` or explicitly via `/geas:sprint` | Seed spec, existing codebase conventions | Shipped feature with evidence trail |
| [debate](#debate) | Multi-agent structured debate for decisions, no code produced | Called by `compass` or explicitly via `/geas:debate` | User's question framed as 2-3 options | DecisionRecord in `.geas/decisions/` |

### Surface (Collaboration)

| Skill | Description | Invocation | Inputs | Outputs |
|-------|-------------|------------|--------|---------|
| [setup](#setup) | First-time setup — check dependencies, create `.geas/` directory structure, generate config files | Called by `compass` on first run via `/geas:setup` | User input (optional configuration) | `.geas/` directory structure, `.geas/config.json`, `.geas/rules.md` |

### Utility

| Skill | Description | Invocation | Inputs | Outputs |
|-------|-------------|------------|--------|---------|
| [briefing](#briefing) | Nova's structured status report on product health | Nova agent skill; at milestones, phase transitions, or on request | Run state, prior briefings | Status report (console) |
| [cleanup](#cleanup) | Entropy scan for AI slop, dead code, convention drift | Forge agent skill; after MVP or during Evolution | Source files, conventions.md | Tech-debt entries in `.geas/debt.json` |
| [coding-conventions](#coding-conventions) | Universal coding standards for the AI startup workspace — stack-agnostic | Referenced by agents during implementation | N/A (reference document) | N/A (defines standards) |
| [ledger-query](#ledger-query) | Read-only search over `.geas/ledger/events.jsonl` | Scrum agent skill; on demand for diagnostics, status, or history | Query type + optional filters | Formatted markdown tables |
| [onboard](#onboard) | Codebase discovery: scan structure, detect stack, map architecture | Auto-triggered in Sprint mode when no prior state exists | Project source files | `.geas/memory/_project/conventions.md` |
| [pivot-protocol](#pivot-protocol) | Strategic direction change when the current approach is failing | Triggered by repeated failures, Nova "Cut" verdict, or agent concern | Failure context, evidence, options | Nova's pivot decision, updated run state and DecisionRecord |
| [run-summary](#run-summary) | Generate end-of-session summary — decisions, tasks completed, agent stats, verify-fix loops. Print to console and write to `.geas/` | Invoked by compass at initiative Phase 4 end / sprint end, or on request | Run state, agent log | Console output + `.geas/ledger/run-summary.json` |
| [verify](#verify) | Structured verification checklist — BUILD, LINT, TEST, ERROR_FREE, FUNCTIONALITY. Invoke to check code quality before declaring complete | Before declaring any feature complete | Project build/lint/test commands | Checklist verdict (PASS/FAIL per item) |
| [write-prd](#write-prd) | Create a Product Requirements Document from a feature idea or mission | Nova agent skill; invoked during initiative Genesis 1.4 | Feature idea, problem statement, or mission | `.geas/spec/prd.md` |
| [write-stories](#write-stories) | Break a feature or mission into user stories with acceptance criteria | Nova agent skill; invoked during initiative Genesis 1.4 | PRD or feature description | `.geas/spec/stories.md` |

---

## Skill Details

### mission

| | |
|---|---|
| **Name** | mission |
| **Category** | Entry |
| **Description** | Build a product, add a feature, or make a technical decision. Activates the Geas multi-agent team with contract-driven verification. |
| **When invoked** | Auto-triggered when the user describes a product idea, project goal, feature request, or asks for a structured discussion. |
| **Inputs** | User's natural language request. |
| **Outputs** | None directly. Immediately delegates to `/geas:compass`. |

---

### compass

| | |
|---|---|
| **Name** | compass |
| **Category** | Orchestration |
| **Description** | Geas orchestrator. Coordinates the multi-agent team. Runs directly in the main session (not as a sub-agent). |
| **When invoked** | Called by `mission`. This is a skill, not an agent -- never spawned as a sub-agent. |
| **Inputs** | `.geas/state/run.json` for resume detection. |
| **Outputs** | Delegates to the appropriate protocol after completing the startup sequence. |

Startup sequence:
1. **Environment check** -- look for `.geas/state/run.json` to determine fresh vs. resume run.
2. **Intake gate** -- invoke `/geas:intake` to produce `seed.json`.
3. **Mode detection** -- infer initiative, sprint, or debate from user intent; delegate accordingly.

Key rules:
- Sub-agents are spawned as 1-level agents (no nesting).
- The SubagentStart hook automatically injects `rules.md` and per-agent memory into every sub-agent. No manual "Read rules.md" instruction is needed in spawn prompts.
- After every agent return, verify the expected evidence file exists.
- Log every transition to `.geas/ledger/events.jsonl` with real timestamps.
- All git operations (commit, branch, PR) must be done by Keeper -- never commit directly.
- Never implement code directly -- orchestrate only.

---

### intake

| | |
|---|---|
| **Name** | intake |
| **Category** | Core (Contract Engine) |
| **Description** | Mission intake gate. Surfaces hidden assumptions via Socratic questioning, then freezes a seed spec before execution begins. |
| **When invoked** | Called by `compass` via `/geas:intake` before any execution mode. Skipped for Debate mode. |
| **Inputs** | Raw mission string from the user. |
| **Outputs** | `.geas/spec/seed.json` (conforms to `schemas/seed.schema.json`). |

Process:
1. Ask brainstorming-style questions, one at a time, building on previous answers.
2. Track completeness across key areas (scope, users, constraints, acceptance criteria) using a checklist.
3. Produce `seed.json` with acceptance criteria (>= 3), scope boundaries, and completeness checklist.
4. Confirm with user before freezing.

---

### task-compiler

| | |
|---|---|
| **Name** | task-compiler |
| **Category** | Core (Contract Engine) |
| **Description** | Compiles a user story into a TaskContract -- a machine-readable work agreement with verifiable acceptance criteria, path boundaries, and eval commands. |
| **When invoked** | Called by `compass` during Initiative (after Genesis creates issues) and Sprint (for the feature). |
| **Inputs** | User story or feature description, seed spec, architecture context, existing task contracts. |
| **Outputs** | `.geas/tasks/{id}.json` (conforms to `schemas/task-contract.schema.json`). |

A TaskContract includes:
- Sequential task ID, title, goal
- Assigned worker and reviewer
- Prohibited file paths
- Acceptance criteria (>= 3, verifiable)
- Eval commands (build, lint, test)
- Retry budget and escalation policy
- Dependencies on other tasks

---

### context-packet

| | |
|---|---|
| **Name** | context-packet |
| **Category** | Core (Contract Engine) |
| **Description** | Generates a role-specific ContextPacket for a worker -- a compressed briefing that replaces "read ALL comments" with focused, relevant context only. |
| **When invoked** | Called by `compass` before dispatching any worker for a task. |
| **Inputs** | TaskContract, prior evidence from upstream workers, seed spec. |
| **Outputs** | `.geas/packets/{task-id}/{worker-name}.md` |

Packet content varies by worker role:
- **Designer (Palette)**: mission context, user requirements, UI patterns, design constraints.
- **Implementer (Pixel/Circuit)**: design spec, tech approach, prohibited paths, eval commands.
- **Reviewer (Forge)**: files changed, architecture decisions, acceptance criteria.
- **Tester (Sentinel)**: acceptance criteria, eval commands, expected behavior, edge cases.
- **Product (Nova)**: feature goal, all evidence bundles, mission alignment.

Each packet must stay under 200 lines.

---

### evidence-gate

| | |
|---|---|
| **Name** | evidence-gate |
| **Category** | Core (Contract Engine) |
| **Description** | Three-tier quality gate. Evaluates an EvidenceBundle against its TaskContract. Ensures "done" means "contract fulfilled." |
| **When invoked** | Called by `compass` after collecting an EvidenceBundle from a worker. |
| **Inputs** | EvidenceBundle (`.geas/evidence/{task-id}/{worker}.json`), TaskContract, gate level. |
| **Outputs** | Gate verdict (pass/fail/iterate) with per-tier results. |

Three tiers:
| Tier | What it checks | When to run |
|------|---------------|-------------|
| **Tier 1: Mechanical** | Run eval commands (build, lint, test). Stop on first failure. | Implementation tasks, QA testing, feature/phase completion |
| **Tier 2: Semantic** | Check each acceptance criterion against evidence. All must be met. | All task types |
| **Tier 3: Product** | Nova ship/iterate/cut judgment on mission alignment and quality. | Feature completion, phase completion, pivot decisions |

On pass: update TaskContract status, log event.
On fail: check retry budget, invoke `/verify-fix-loop` or escalate.

---

### verify-fix-loop

| | |
|---|---|
| **Name** | verify-fix-loop |
| **Category** | Core (Contract Engine) |
| **Description** | Bounded fix-verify inner loop. Reads TaskContract for retry budget, dispatches fixer (Pixel/Circuit), re-runs evidence gate. Max iterations from contract (default 3). |
| **When invoked** | Called when the evidence gate fails and retries remain. |
| **Inputs** | TaskContract (retry budget, escalation policy), failed EvidenceBundle, gate verdict details. |
| **Outputs** | Updated evidence on success; DecisionRecord on escalation. |

Loop:
1. Identify the fixer (Pixel for frontend, Circuit for backend).
2. Spawn fixer with fix-specific ContextPacket in worktree isolation.
3. Re-run evidence gate (Tier 1 + Tier 2).
4. Pass: exit to Nova product review. Fail: next iteration or escalate.

Escalation policies: `forge-review` (default), `nova-decision`, `pivot`.

---

### vote-round

| | |
|---|---|
| **Name** | vote-round |
| **Category** | Core (Contract Engine) |
| **Description** | Structured agent voting after major proposals. Triggers debate if disagreement found. |
| **When invoked** | Called by `compass` after architecture proposals (Forge), design system proposals (Palette), or cross-cutting decisions. |
| **Inputs** | Proposal details, list of 2-3 voter agents (never the proposer). |
| **Outputs** | Vote result summary comment. DecisionRecord if escalated to Nova. |

Process:
1. Spawn 2-3 voters who each post agree/disagree with rationale.
2. All agree: proceed immediately.
3. Any disagree: enter structured debate (max 3 rounds). Nova breaks ties.

Not used for: individual feature specs, per-feature tech guides, single-domain implementation details, bug fixes.

---

### initiative

| | |
|---|---|
| **Name** | initiative |
| **Category** | Team (Execution Protocol) |
| **Description** | Start a new product with the full Geas team. Four phases: Genesis, MVP Build, Polish, Evolution. |
| **When invoked** | Called by `compass` when mode is "new product or broad mission," or explicitly via `/geas:initiative`. |
| **Inputs** | Seed spec from intake. |
| **Outputs** | Completed project with full evidence trail across all phases. |

Phases:

| Phase | Key activities |
|-------|---------------|
| **Genesis** | Seed check, Nova vision, PRD & user stories (Nova), Forge architecture, vote round (Critic mandatory), compile TaskContracts from stories, MCP server recommendations |
| **MVP Build** | Per-task pipeline: Design (Palette) -> Tech Guide (Forge) -> Implementation (worker in worktree) -> Code Review (Forge) -> Testing (Sentinel) -> Evidence Gate -> Critic Pre-ship Review -> Nova Product Review -> Ship Gate -> Retrospective (Scrum) -> Resolve (Keeper commits) |
| **Polish** | Security review (Shield), documentation (Scroll), fix issues found |
| **Evolution** | Scoped improvements within seed scope, Nova final briefing, Keeper release management, run-summary |

Every task gets the full pipeline. Code Review and Testing are mandatory for every task, not just the first. Critic performs a pre-ship review (step 2.7) before Nova's verdict. Keeper handles commits at Resolve and release management at Evolution.

---

### sprint

| | |
|---|---|
| **Name** | sprint |
| **Category** | Team (Execution Protocol) |
| **Description** | Add a bounded feature to an existing project. One feature, one pipeline. Skips Genesis. |
| **When invoked** | Called by `compass` when mode is "bounded feature in existing project," or explicitly via `/geas:sprint`. |
| **Inputs** | Seed spec from intake, existing codebase conventions (`.geas/memory/_project/conventions.md`). |
| **Outputs** | Shipped feature with full evidence trail. |

Pipeline: Compile TaskContract -> Design (Palette) -> Tech Guide (Forge) -> Implementation (worktree) -> Code Review (Forge) -> Testing (Sentinel) -> Evidence Gate -> Critic Pre-ship Review -> Nova Product Review -> Ship Gate -> Retrospective (Scrum) -> Resolve (Keeper commits) -> Run Summary.

On Evidence Gate failure, verify-fix-loop spawns the original worker agent to fix (never fix code directly).

If conventions.md is missing, Forge is spawned for onboarding first.

---

### debate

| | |
|---|---|
| **Name** | debate |
| **Category** | Team (Execution Protocol) |
| **Description** | Structured multi-agent debate for technical or product decisions. No code produced. |
| **When invoked** | Called by `compass` when mode is "decision-only discussion," or explicitly via `/geas:debate`. |
| **Inputs** | User's question, framed as 2-3 clear options. |
| **Outputs** | DecisionRecord in `.geas/decisions/{dec-id}.json`. |

Flow: Frame question -> Spawn debaters (Forge, Critic, Circuit, Palette) -> Synthesize arguments -> User decides -> Write DecisionRecord.

---

### setup

| | |
|---|---|
| **Name** | setup |
| **Category** | Surface (Collaboration) |
| **Description** | First-time setup — check dependencies, create `.geas/` directory structure, generate config files. |
| **When invoked** | Called by `compass` automatically on the first run. Users do not normally invoke this directly. |
| **Inputs** | User input (optional configuration). |
| **Outputs** | `.geas/` directory structure, `.geas/state/run.json`, `.geas/rules.md`, `.geas/config.json`. |

Setup phases:
1. **Phase A**: Create `.geas/` subdirectories (spec, state, tasks, packets, evidence, decisions, ledger, memory). Write initial `run.json` and `rules.md`.
2. **Phase B** (optional): Additional configuration — connect external services, save config.

---

### briefing

| | |
|---|---|
| **Name** | briefing |
| **Category** | Utility |
| **Description** | Nova Morning Briefing -- structured status report on what shipped, what's blocked, and what needs human attention. Designed to be read in under 60 seconds. |
| **When invoked** | At milestones (Genesis/MVP/Polish complete), at Evolution phase start, on explicit request. |
| **Inputs** | `.geas/state/run.json`, prior briefings. |
| **Outputs** | Briefing printed to console. |

Sections: What Shipped, What's Blocked, Needs Human Attention, Product Health (mission alignment, quality, velocity, user value), Next Priority.

---

### cleanup

| | |
|---|---|
| **Name** | cleanup |
| **Category** | Utility |
| **Description** | Entropy scan -- detects AI slop, unused code, dead code, duplication, over-abstraction, and convention drift. Creates tech-debt entries in `.geas/debt.json`. |
| **When invoked** | After Phase 2 (MVP), during Phase 4 (Evolution), or on explicit request. |
| **Inputs** | Project source files, `.geas/memory/_project/conventions.md`. |
| **Outputs** | Tech-debt entries in `.geas/debt.json` with categorized findings. |

Scan categories: unnecessary comments, dead code, duplication, over-abstraction, convention drift, AI boilerplate.

---

### coding-conventions

| | |
|---|---|
| **Name** | coding-conventions |
| **Category** | Utility |
| **Description** | Universal coding standards for the AI startup workspace — stack-agnostic. |
| **When invoked** | Referenced by agents during implementation. Not a procedural skill. |
| **Inputs** | N/A (reference document). |
| **Outputs** | N/A (defines standards). |

Covers: code quality, error handling, structure, git practices, UI standards (if applicable).

---

### ledger-query

| | |
|---|---|
| **Name** | ledger-query |
| **Category** | Utility |
| **Description** | Structured read-only search over `.geas/ledger/events.jsonl`. Cross-references TaskContracts, EvidenceBundles, and DecisionRecords. |
| **When invoked** | On demand -- diagnosing pipeline issues, generating status reports, reviewing agent performance, answering project history questions. |
| **Inputs** | Query type: `timeline <task-id>`, `phase <name>`, `failures`, `agent <name>`, or `status`. |
| **Outputs** | Formatted markdown tables with cross-referenced data. |

Strictly read-only. Never modifies any file.

---

### onboard

| | |
|---|---|
| **Name** | onboard |
| **Category** | Utility |
| **Description** | Codebase discovery protocol -- scans project structure, detects stack, maps architecture. Produces a conventions file so the team can work immediately. |
| **When invoked** | Auto-triggered in Sprint mode when no existing `.geas/state/run.json` or conventions file is found. |
| **Inputs** | Project source files and configuration files. |
| **Outputs** | `.geas/memory/_project/conventions.md`, `.geas/memory/_project/state.json`. |

Steps: Structure scan (detect stack from marker files) -> Architecture mapping (entry points, routing, DB, key modules) -> Convention detection (linter config, naming patterns, import style) -> Write conventions file.

Skipped entirely on repeat Sprints if conventions.md already exists.

---

### pivot-protocol

| | |
|---|---|
| **Name** | pivot-protocol |
| **Category** | Utility |
| **Description** | Defines when and how to pivot during product development. A pivot is a strategic direction change, not a code fix. |
| **When invoked** | Triggered by repeated test failures (>50%), technical infeasibility, fundamental architecture problems, Nova "Cut" verdict, or agent concerns. |
| **Inputs** | Full failure context, evidence, and available options. |
| **Outputs** | Nova's pivot decision (scope cut, feature drop, approach change, push through, or simplify). Updated run state and DecisionRecord. |

---

### run-summary

| | |
|---|---|
| **Name** | run-summary |
| **Category** | Utility |
| **Description** | Generate end-of-session summary — decisions, tasks completed, agent stats, verify-fix loops. Print to console and write to `.geas/`. |
| **When invoked** | Invoked by compass at initiative Phase 4 end and sprint end. Also at session handoff or on explicit request. |
| **Inputs** | `.geas/state/run.json`, `.geas/memory/_project/agent-log.jsonl`. |
| **Outputs** | Console output and `.geas/ledger/run-summary.json`. |

---

### verify

| | |
|---|---|
| **Name** | verify |
| **Category** | Utility |
| **Description** | Structured verification checklist — BUILD, LINT, TEST, ERROR_FREE, FUNCTIONALITY. Invoke to check code quality before declaring complete. |
| **When invoked** | Before declaring any feature complete. Also used in Forge pre-check mode (BUILD + LINT only). |
| **Inputs** | Project build/lint/test commands (from conventions.md or auto-detected from marker files). |
| **Outputs** | Per-item verdict (PASS/FAIL/SKIP/PENDING) and overall VERDICT. |

| Item | What it checks |
|------|---------------|
| BUILD | Project compiles/bundles without errors |
| LINT | No lint violations |
| TEST | Unit and integration tests pass |
| ERROR_FREE | Dev server starts clean, no console errors |
| FUNCTIONALITY | Playwright E2E tests cover acceptance criteria (Sentinel only) |

---

### write-prd

| | |
|---|---|
| **Name** | write-prd |
| **Category** | Utility |
| **Description** | Create a Product Requirements Document from a feature idea or mission. |
| **When invoked** | Nova agent skill. During initiative Genesis phase 1.4 (after Nova vision), or on demand. |
| **Inputs** | Seed spec (`.geas/spec/seed.json`) and Nova's vision evidence. |
| **Outputs** | `.geas/spec/prd.md` — PRD in markdown (Problem, Objective, Target Users, Scope, User Flows, Requirements, Success Metrics, Open Questions). |

---

### write-stories

| | |
|---|---|
| **Name** | write-stories |
| **Category** | Utility |
| **Description** | Breaks a feature or mission into user stories with acceptance criteria. |
| **When invoked** | Nova agent skill. During initiative Genesis phase 1.4 (after PRD), or on demand. |
| **Inputs** | PRD (`.geas/spec/prd.md`) or feature description. |
| **Outputs** | `.geas/spec/stories.md` — User stories in markdown, each with "As a / I want to / So that" format, acceptance criteria checklist, priority (P0/P1/P2), and size estimate (S/M/L). Stories feed into task-compiler (step 1.7). |
