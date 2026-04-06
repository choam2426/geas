# Skills Reference

Geas skills are organized into two categories:

- **Core (13)** — contract engine skills. Domain-agnostic, tool-agnostic. These implement the governed execution pipeline.
- **Utility - Software (2)** — planning aids for software projects.

Skills are invoked via `/geas:{name}`. Most skills are invoked by the orchestrator as part of the execution pipeline; a few are user-invocable (marked below). For full behavior details, read each skill's `SKILL.md`.

---

## Core Skills

| Skill | Description | Key Responsibility |
|-------|-------------|-------------------|
| `mission` | Orchestrator — 4-phase execution, slot resolution | Coordinates the multi-agent team through the full mission lifecycle |
| `intake` | Socratic requirements gathering | Freezes a mission spec through collaborative exploration |
| `task-compiler` | Mission spec to TaskContracts | Compiles stories into machine-readable work agreements with rubrics |
| `context-packet` | Role-specific briefings | Generates focused context for each worker, with memory retrieval |
| `implementation-contract` | Pre-implementation agreement | Worker proposes plan, reviewers approve before coding begins |
| `evidence-gate` | Tier 0/1/2 verification | Objectively verifies worker output against the TaskContract |
| `verify-fix-loop` | Fail, fix, re-verify | Bounded retry loop with escalation when budget exhausts |
| `vote-round` | Structured voting and decisions | Parallel agent voting on proposals; disagreement triggers decision |
| `memorizing` | Memory lifecycle | Candidate extraction, promotion, decay detection, application logging |
| `scheduling` | Parallel task scheduling | Batch construction, lock checks, safe parallel conditions |
| `setup` | Project init and codebase discovery | Initializes `.geas/` runtime directory and discovers project conventions |
| `policy-managing` | Rules.md overrides | Temporary rule overrides with reason, expiry, and audit trail |
| `reporting` | Health signals and dashboards | 8 health signals, debt/gap summary, session briefing |

### mission

Geas orchestrator. Coordinates the multi-agent team through domain-agnostic slot resolution. Manages setup, intake, routing, and the 4-phase execution flow (Specifying, Building, Polishing, Evolving). Resolves agent slots to concrete types via domain profiles before spawning. Runs directly in the main session — not a sub-agent.

**Invocation:** `/geas:mission` (user entry point)

### intake

Mission intake gate. Explores the user's intent through one-question-at-a-time dialogue, surfaces hidden assumptions and ambiguous scope, and freezes an immutable mission spec (`spec.json`). Large missions are decomposed into independent sub-missions. Supports "just build it" override for rapid starts.

**Invocation:** Called by `mission` during startup.

### task-compiler

Compiles user stories into TaskContracts — machine-readable work agreements with acceptance criteria, path boundaries, eval commands, and rubric dimensions. Assigns worker and reviewer slots by task type. Reads project conventions for eval commands; falls back to config file detection.

**Invocation:** Called by `mission` during Specifying and Building phases.

### context-packet

Generates role-specific briefings for workers. Each worker type receives only the context relevant to their role. Retrieves applicable memories and injects project conventions. Target: under 200 lines per packet.

**Invocation:** Called by `mission` before dispatching any worker.

### implementation-contract

Pre-implementation agreement. Worker drafts a concrete action plan (`planned_actions`, `edge_cases`, `demo_steps`), then quality specialist and design authority review before coding begins. Prevents wasted cycles from misunderstood requirements.

**Invocation:** Called by `mission` after tech guide and before implementation.

### evidence-gate

Objective verification gate. Tier 0 (Precheck) checks artifact existence and state eligibility. Tier 1 (Mechanical) executes eval commands. Tier 2 (Contract + Rubric) checks acceptance criteria and scores rubric dimensions. Returns `pass`, `fail`, `block`, or `error`. After gate pass, the flow continues to Closure Packet, Critical Reviewer challenge, and Final Verdict.

**Invocation:** Called by `mission` after implementation and specialist review steps.

### verify-fix-loop

Bounded fix-verify inner loop. On gate failure, spawns the appropriate fixer with a fix-specific context packet that includes blocking dimensions. Re-runs evidence-gate after each fix. When retry budget exhausts, follows the TaskContract's escalation policy.

**Invocation:** Called by `mission` when evidence-gate returns `fail`.

### vote-round

Structured parallel voting on major proposals. Multiple agents evaluate independently and vote (agree/disagree with rationale). Challenger always participates. Disagreement triggers a structured decision before proceeding. Absorbed the former `decision` and `pivot-protocol` skills.

**User-invocable:** Yes (`/geas:vote-round`)

### memorizing

Full memory lifecycle management. 9-state lifecycle (candidate through archived/rejected). 6-stage promotion pipeline with explicit criteria at each gate. Tracks application logging, runs decay detection, and flags harmful reuse.

**Invocation:** Called by `mission` after retrospective and during Evolving phase.

### scheduling

Protocol for parallel task management. Defines batch construction rules, pipeline interleaving, and checkpoint management. Safe parallel conditions: no path overlap in `scope.paths`, no shared interface locks, no integration dependencies. Task-level parallelism only.

**Invocation:** Called by `mission` during Building phase when multiple tasks are ready.

### setup

First-time project initialization. Creates the `.geas/` runtime directory structure, generates `rules.md` with baseline rules, discovers codebase conventions (stack, build commands, architecture), and writes `conventions.md`. Absorbed the former `onboard` skill. Idempotent — safe to call on an existing project.

**Invocation:** Called by `mission` on first run (when `run.json` does not exist).

### policy-managing

Override management for `.geas/rules.md`. Applies temporary overrides with a reason, expiry date, and approver — without modifying the canonical rules file. Preserves full override history for audit.

**User-invocable:** Yes (`/geas:policy-managing`)

### reporting

Debt/gap dashboard and health signal calculation. Produces `health-check.json` and a markdown summary. 8 health signals from protocol doc 12: gate pass rate, retry budget utilization, debt severity rollup, memory promotion rate, evidence completeness, lock contention, recovery frequency, rule freshness. Absorbed the former `briefing` and `run-summary` skills.

**User-invocable:** Yes (`/geas:reporting`)

---

## Utility Skills — Software

| Skill | Description | Key Responsibility |
|-------|-------------|-------------------|
| `write-prd` | PRD generation | Structured Product Requirements Document from a feature idea |
| `write-stories` | User story generation | Ordered user stories with acceptance criteria from a feature or mission |

### write-prd

Creates a structured Product Requirements Document (Problem, Objective, Target Users, Scope In/Out, User Flows, Requirements, Success Metrics, Open Questions). Requirements are traceable to user needs. Explicit about what is out of scope.

**Invocation:** Called by the Orchestrator during Specifying phase.

### write-stories

Breaks a feature or mission into user stories (As a / I want to / So that + Acceptance Criteria + Priority + Estimate). Stories are independent and testable. Ordered by priority. Acceptance criteria include edge cases, not just happy paths.

**Invocation:** Called by the Orchestrator during Specifying phase, after write-prd.

---

## Skill Dependencies

The execution pipeline invokes skills in a defined order. This diagram shows the primary call chain:

```
mission (orchestrator)
  |
  +-- setup               (first run only)
  +-- intake               (freeze mission spec)
  +-- task-compiler         (compile stories to TaskContracts)
  |
  +-- [per task, in pipeline order]:
  |     context-packet      (generate worker briefing)
  |     implementation-contract  (pre-implementation agreement)
  |     evidence-gate       (verify output)
  |       +-- verify-fix-loop  (on failure)
  |
  +-- vote-round            (major proposals, Specifying phase)
  +-- scheduling            (parallel batch construction, Building phase)
  +-- memorizing            (after retrospective + Evolving phase)
  +-- reporting             (phase transitions, session end)
  +-- policy-managing       (on-demand rule overrides)
```

Utility skills (`write-prd`, `write-stories`) are invoked by product-authority during Specifying, not directly by the orchestrator pipeline.

---

## Absorption Reference

Skills were consolidated from 27 to 15. The following table documents what was merged and what was deleted, for migration reference.

| Former Skill | Disposition | Notes |
|-------------|-------------|-------|
| `orchestrating` | Renamed to `mission` | Orchestrator is now the `mission` skill directly |
| `onboard` | Absorbed into `setup` | Codebase discovery is part of project initialization |
| `decision` | Absorbed into `vote-round` | Structured decisions are a voting use case |
| `pivot-protocol` | Absorbed into `vote-round` | Pivots are a decision type |
| `briefing` | Absorbed into `reporting` | Status briefings are part of health reporting |
| `run-summary` | Absorbed into `reporting` | Session summaries are part of health reporting |
| `verify` | Deleted | Mechanical checks absorbed into evidence-gate Tier 1 |
| `cleanup` | Deleted | Debt detection handled by evidence-gate and reporting |
| `coding-conventions` | Deleted | Conventions live in `.geas/memory/_project/conventions.md` |
| `ledger-query` | Deleted | Orchestrator queries the ledger directly |
| `conformance-checking` | Deleted | Development-time tool, not a runtime skill |
| `chaos-exercising` | Deleted | Development-time tool, not a runtime skill |
| `mission` (old wrapper) | Deleted | Former thin shell; orchestrator is now `mission` directly |
