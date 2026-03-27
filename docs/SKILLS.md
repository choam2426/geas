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
  +---> setup        First-run: dependencies, Linear config, .geas/ init
  |
  +---> intake       Socratic questioning, produces seed.json
  |
  +---> [mode detection]
        |
        +---> full-team     New product (Genesis -> MVP -> Polish -> Evolution)
        +---> sprint        Bounded feature addition to existing project
        +---> debate        Decision-only discussion, no code
```

Within `full-team` and `sprint`, the contract engine skills run per task:

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
| [compass](#compass) | Coordinates the entire multi-agent team -- manages setup, intake, mode detection, and delegation | Called by `mission` via `/geas:compass` | `.geas/state/run.json` (if resuming) | Delegates to `full-team`, `sprint`, or `debate` |

### Core (Contract Engine)

| Skill | Description | Invocation | Inputs | Outputs |
|-------|-------------|------------|--------|---------|
| [intake](#intake) | Socratic requirements gathering -- surfaces hidden assumptions and freezes a seed spec | Called by `compass` via `/geas:intake` | User's mission string | `.geas/spec/seed.json` |
| [task-compiler](#task-compiler) | Compiles a user story into a TaskContract with verifiable acceptance criteria | Called by `compass` during full-team or sprint | Seed spec, architecture context, user story | `.geas/tasks/{id}.json` |
| [context-packet](#context-packet) | Generates a role-specific briefing for a worker agent | Called by `compass` before dispatching any worker | TaskContract, prior evidence, Linear thread, seed spec | `.geas/packets/{task-id}/{worker}.md` |
| [evidence-gate](#evidence-gate) | Three-tier quality gate evaluating output against a TaskContract | Called by `compass` after collecting an EvidenceBundle | EvidenceBundle, TaskContract, gate level | Gate verdict (pass/fail/iterate) in `.geas/evidence/` |
| [verify-fix-loop](#verify-fix-loop) | Bounded fix-verify inner loop after evidence gate failure | Called by `compass` (or evidence-gate) on gate failure | Failed EvidenceBundle, TaskContract, gate verdict | Fixed evidence, or escalation DecisionRecord |
| [vote-round](#vote-round) | Structured agent voting and debate on major proposals | Called by `compass` after architecture/design proposals | Proposal (e.g., Forge's architecture), list of voters | Vote result summary; DecisionRecord on disagreement |

### Team (Execution Protocols)

| Skill | Description | Invocation | Inputs | Outputs |
|-------|-------------|------------|--------|---------|
| [full-team](#full-team) | 4-phase new product build: Genesis, MVP, Polish, Evolution. Critic votes in every vote round, performs pre-ship review. Keeper commits at Resolve/Evolution | Called by `compass` or explicitly via `/geas:full-team` | Seed spec from intake | Completed project with evidence trail |
| [sprint](#sprint) | Single-feature pipeline: Design, Build, Review, QA, Retrospective. Keeper commits at Resolve | Called by `compass` or explicitly via `/geas:sprint` | Seed spec, existing codebase conventions | Shipped feature with evidence trail |
| [debate](#debate) | Multi-agent structured debate for decisions, no code produced | Called by `compass` or explicitly via `/geas:debate` | User's question framed as 2-3 options | DecisionRecord in `.geas/decisions/` |

### Surface (Collaboration)

| Skill | Description | Invocation | Inputs | Outputs |
|-------|-------------|------------|--------|---------|
| [linear-cli](#linear-cli) | Python CLI wrapper for the Linear API | Called by any skill or agent needing Linear operations | Command + flags (e.g., `create-issue --title ...`) | Linear API response (JSON) |
| [linear-protocol](#linear-protocol) | Startup-specific conventions for using Linear — labels, comment format, workflow rules | Referenced by agents and skills for formatting guidance | N/A (reference document) | N/A (defines standards) |
| [setup](#setup) | First-time setup — validate Linear API key, check dependencies, configure Linear workspace, generate config files | Called by `compass` on first run via `/geas:setup` | User input (Linear API key, team selection) | `.geas/` directory structure, `.geas/config.json`, `.geas/rules.md` |

### Utility

| Skill | Description | Invocation | Inputs | Outputs |
|-------|-------------|------------|--------|---------|
| [briefing](#briefing) | Nova's structured status report on product health | At milestones, phase transitions, or on request | Run state, Linear issues, prior briefings | Status report (Linear comment + console) |
| [cleanup](#cleanup) | Entropy scan for AI slop, dead code, convention drift | After MVP or during Evolution | Source files, conventions.md | Tech-debt issues on Linear |
| [coding-conventions](#coding-conventions) | Universal coding standards for the AI startup workspace — stack-agnostic | Referenced by agents during implementation | N/A (reference document) | N/A (defines standards) |
| [ledger-query](#ledger-query) | Read-only search over `.geas/ledger/events.jsonl` | On demand for diagnostics, status, or history | Query type + optional filters | Formatted markdown tables |
| [onboard](#onboard) | Codebase discovery: scan structure, detect stack, map architecture | Auto-triggered in Sprint mode when no prior state exists | Project source files | `.geas/memory/_project/conventions.md` |
| [pivot-protocol](#pivot-protocol) | Strategic direction change when the current approach is failing | Triggered by repeated failures, Nova "Cut" verdict, or agent concern | Failure context, evidence, options | Nova's pivot decision, restructured Linear board |
| [run-summary](#run-summary) | Generate end-of-session summary — decisions, issues completed, agent stats, verify-fix loops. Post to Linear Document and console | At session end, handoff, or on request | Run state, agent log, Linear issues | Linear Document + console output |
| [verify](#verify) | Structured verification checklist — BUILD, LINT, TEST, ERROR_FREE, FUNCTIONALITY. Invoke to check code quality before declaring complete | Before declaring any feature complete | Project build/lint/test commands | Checklist verdict (PASS/FAIL per item) |
| [write-prd](#write-prd) | Create a Product Requirements Document from a feature idea or mission | On demand or during Genesis | Feature idea, problem statement, or mission | PRD in markdown |
| [write-stories](#write-stories) | Break a feature or mission into user stories with acceptance criteria | On demand or during planning | Feature description or mission statement | User stories in markdown |

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
3. **Mode detection** -- infer full-team, sprint, or debate from user intent; delegate accordingly.

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
1. Score readiness across 5 dimensions (Clarity, Scope, Users, Constraints, Acceptance), each 0-20.
2. If score < threshold (60 for Full Team, 40 for Sprint), ask Socratic questions (max 2 rounds).
3. Produce `seed.json` with acceptance criteria (>= 3), scope boundaries, and readiness breakdown.
4. Confirm with user before freezing.

---

### task-compiler

| | |
|---|---|
| **Name** | task-compiler |
| **Category** | Core (Contract Engine) |
| **Description** | Compiles a user story into a TaskContract -- a machine-readable work agreement with verifiable acceptance criteria, path boundaries, and eval commands. |
| **When invoked** | Called by `compass` during Full Team (after Genesis creates issues) and Sprint (for the feature). |
| **Inputs** | User story or feature description, seed spec, architecture context, existing task contracts. |
| **Outputs** | `.geas/tasks/{id}.json` (conforms to `schemas/task-contract.schema.json`). |

A TaskContract includes:
- Sequential task ID, title, goal
- Assigned worker and reviewer
- Allowed and prohibited file paths
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
| **Inputs** | TaskContract, prior evidence from upstream workers, Linear thread (if enabled), seed spec. |
| **Outputs** | `.geas/packets/{task-id}/{worker-name}.md` |

Packet content varies by worker role:
- **Designer (Palette)**: mission context, user requirements, UI patterns, design constraints.
- **Implementer (Pixel/Circuit)**: design spec, tech approach, allowed/prohibited paths, eval commands.
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

On pass: update TaskContract status, log event, post Linear comment.
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

### full-team

| | |
|---|---|
| **Name** | full-team |
| **Category** | Team (Execution Protocol) |
| **Description** | Start a new product with the full Geas team. Four phases: Genesis, MVP Build, Polish, Evolution. |
| **When invoked** | Called by `compass` when mode is "new product or broad mission," or explicitly via `/geas:full-team`. |
| **Inputs** | Seed spec from intake. |
| **Outputs** | Completed project with full evidence trail across all phases. |

Phases:

| Phase | Key activities |
|-------|---------------|
| **Genesis** | Seed check, Linear bootstrap, Nova vision, Forge architecture, vote round (Critic mandatory), compile TaskContracts, MCP server recommendations |
| **MVP Build** | Per-task pipeline: Design (Palette) -> Tech Guide (Forge) -> Implementation (worker in worktree) -> Code Review (Forge) -> Testing (Sentinel) -> Evidence Gate -> Critic Pre-ship Review -> Nova Product Review -> Ship Gate -> Retrospective (Scrum) -> Resolve (Keeper commits) |
| **Polish** | Security review (Shield), documentation (Scroll), fix issues found |
| **Evolution** | Scoped improvements within seed scope, Nova final briefing, Keeper release management |

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

Pipeline: Compile TaskContract -> Design (Palette) -> Tech Guide (Forge) -> Implementation (worktree) -> Code Review (Forge) -> Testing (Sentinel) -> Evidence Gate -> Nova Product Review -> Ship Gate -> Retrospective (Scrum) -> Resolve (Keeper commits).

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

### linear-cli

| | |
|---|---|
| **Name** | linear-cli |
| **Category** | Surface (Collaboration) |
| **Description** | Linear workspace CLI -- Python wrapper for the Linear API covering issues, projects, documents, teams, users, comments, labels, cycles, milestones, and attachments. |
| **When invoked** | Called by any skill or agent that needs to interact with Linear. All Linear operations go through this CLI. |
| **Inputs** | Command name and flags (e.g., `create-issue --title "..." --team-id UUID`). |
| **Outputs** | Linear API response as JSON. Errors to stderr. |

Command groups: Issues, Documents, Projects, Teams, Users, Comments, Labels, Workflow, Milestones, Attachments.

---

### linear-protocol

| | |
|---|---|
| **Name** | linear-protocol |
| **Category** | Surface (Collaboration) |
| **Description** | Startup-specific conventions for using Linear — labels, comment format, workflow rules. |
| **When invoked** | Referenced by agents and skills for formatting and workflow guidance. Not a procedural skill. |
| **Inputs** | N/A (reference document). |
| **Outputs** | N/A (defines standards). |

Key conventions:
- Comment format: `[AgentName] content`
- Workflow: Backlog -> Todo -> Waiting -> In Progress -> In Review -> Testing -> Done
- Issue title format: `[Label] Short description`
- Labels: type (feature, bug, design-spec, ...), area (frontend, backend, infra), role (needs-review, needs-qa)
- Estimates: Fibonacci scale (1, 2, 3, 5, 8, 13)

---

### setup

| | |
|---|---|
| **Name** | setup |
| **Category** | Surface (Collaboration) |
| **Description** | First-time setup — validate Linear API key, check dependencies, configure Linear workspace, generate config files. |
| **When invoked** | Called by `compass` automatically on the first run. Users do not normally invoke this directly. |
| **Inputs** | User input for Linear API key and team selection (optional). |
| **Outputs** | `.geas/` directory structure, `.geas/state/run.json`, `.geas/rules.md`, `.geas/config.json`. |

Setup phases:
1. **Phase A**: Create `.geas/` subdirectories (spec, state, tasks, packets, evidence, decisions, ledger, memory). Write initial `run.json` and `rules.md`.
2. **Phase B** (optional): Linear setup -- detect or request API key, select team, create labels and workflow states, save config.

---

### briefing

| | |
|---|---|
| **Name** | briefing |
| **Category** | Utility |
| **Description** | Nova Morning Briefing -- structured status report on what shipped, what's blocked, and what needs human attention. Designed to be read in under 60 seconds. |
| **When invoked** | At milestones (Genesis/MVP/Polish complete), at Evolution phase start, on explicit request. |
| **Inputs** | `.geas/state/run.json`, Linear issues and comments, prior briefings. |
| **Outputs** | Briefing posted as a Linear comment and printed to console. |

Sections: What Shipped, What's Blocked, Needs Human Attention, Product Health (mission alignment, quality, velocity, user value), Next Priority.

---

### cleanup

| | |
|---|---|
| **Name** | cleanup |
| **Category** | Utility |
| **Description** | Entropy scan -- detects AI slop, unused code, dead code, duplication, over-abstraction, and convention drift. Creates tech-debt issues on Linear. |
| **When invoked** | After Phase 2 (MVP), during Phase 4 (Evolution), or on explicit request. |
| **Inputs** | Project source files, `.geas/memory/_project/conventions.md`. |
| **Outputs** | Linear issues with `tech-debt` label, summary comment on project tracking issue. |

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
| **Outputs** | Nova's pivot decision (scope cut, feature drop, approach change, push through, or simplify). Restructured Linear board. |

---

### run-summary

| | |
|---|---|
| **Name** | run-summary |
| **Category** | Utility |
| **Description** | Generate end-of-session summary — decisions, issues completed, agent stats, verify-fix loops. Post to Linear Document and console. |
| **When invoked** | At end of every session, before session handoff, or on explicit request. |
| **Inputs** | `.geas/state/run.json`, `.geas/memory/_project/agent-log.jsonl`, Linear issues and comments. |
| **Outputs** | Linear Document (`Run Summary: <date>`) and identical console output. |

---

### verify

| | |
|---|---|
| **Name** | verify |
| **Category** | Utility |
| **Description** | Structured verification checklist — BUILD, LINT, TEST, ERROR_FREE, FUNCTIONALITY. Invoke to check code quality before declaring complete. |
| **When invoked** | Before declaring any feature complete. Also used in Forge pre-check mode (BUILD + LINT only). |
| **Inputs** | Project build/lint/test commands (from conventions.md or auto-detected from marker files). |
| **Outputs** | Per-item verdict (PASS/FAIL/SKIP/PENDING) and overall VERDICT. Posted as a Linear comment. |

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
| **When invoked** | On demand or during Genesis phase planning. |
| **Inputs** | Feature idea, problem statement, or mission (passed as arguments). |
| **Outputs** | PRD in markdown (Problem, Objective, Target Users, Scope, User Flows, Requirements, Success Metrics, Open Questions). |

---

### write-stories

| | |
|---|---|
| **Name** | write-stories |
| **Category** | Utility |
| **Description** | Breaks a feature or mission into user stories with acceptance criteria. |
| **When invoked** | On demand or during planning phases. |
| **Inputs** | Feature description, mission statement, or problem to solve (passed as arguments). |
| **Outputs** | User stories in markdown, each with "As a / I want to / So that" format, acceptance criteria checklist, priority (P0/P1/P2), and size estimate (S/M/L). |
