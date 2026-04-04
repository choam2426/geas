# Skills Reference

All 27 skills in the Geas plugin. Skills are invoked either by users directly (`/geas:<name>`) or by the Orchestrator as part of execution protocols.

## Summary Table

| Skill | Category | User-Invocable | Invoked By | Key Output |
|-------|----------|----------------|------------|------------|
| [mission](#mission) | Entry | Yes | User directly | Invokes Orchestrator |
| [orchestrating](#orchestrating) | Entry | No | User (via `/geas:mission`) | 4-phase mission (Specifying → Building → Polishing → Evolving) |
| [setup](#setup) | Entry | No | Orchestrator (first run) | `.geas/` runtime directory |
| [intake](#intake) | Core - Contract Engine | No | Orchestrator | `.geas/missions/{mission_id}/spec.json` |
| [task-compiler](#task-compiler) | Core - Contract Engine | No | Orchestrator | `.geas/missions/{mission_id}/tasks/{id}.json` |
| [context-packet](#context-packet) | Core - Contract Engine | No | Orchestrator | `.geas/missions/{mission_id}/packets/{task-id}/{worker}.md` |
| [implementation-contract](#implementation-contract) | Core - Contract Engine | No | Orchestrator | `.geas/missions/{mission_id}/contracts/{task-id}.json` |
| [evidence-gate](#evidence-gate) | Core - Contract Engine | No | Orchestrator | Gate verdict + ledger event |
| [verify-fix-loop](#verify-fix-loop) | Core - Contract Engine | No | Orchestrator (via evidence-gate) | Fix iterations + DecisionRecord |
| [verify](#verify) | Core - Verification | No | Worker agents | Console checklist report |
| [vote-round](#vote-round) | Core - Verification | No | Orchestrator (at Specifying) | `.geas/missions/{mission_id}/decisions/{dec-id}.json` |
| [scheduling](#scheduling) | Core - Execution | No | Orchestrator | Batch construction, parallel dispatch |
| [decision](#decision) | Team - Execution | Yes | Orchestrator or User | `.geas/missions/{mission_id}/decisions/{dec-id}.json` |
| [memorizing](#memorizing) | Core - Memory | No | Orchestrator | Memory candidates, promotions, index |
| [write-prd](#write-prd) | Team - Planning | No | Product Authority (during Specifying) | `.geas/missions/{mission_id}/prd.md` |
| [write-stories](#write-stories) | Team - Planning | No | Product Authority (during Specifying) | `.geas/missions/{mission_id}/stories.md` |
| [onboard](#onboard) | Team - Planning | No | Orchestrator (first run) | `.geas/memory/_project/conventions.md` |
| [coding-conventions](#coding-conventions) | Utility | No | All agents | Reference guidance only |
| [briefing](#briefing) | Utility | No | Product Authority or Orchestrator | Console status report |
| [run-summary](#run-summary) | Utility | No | Orchestrator (end of session) | `.geas/summaries/run-summary-<date>.md` |
| [ledger-query](#ledger-query) | Utility | No | Orchestrator or User | Formatted query results (read-only) |
| [cleanup](#cleanup) | Utility | No | Orchestrator (post-Building / Evolving) | `.geas/missions/{mission_id}/evolution/debt-register.json` entries |
| [pivot-protocol](#pivot-protocol) | Utility | No | Orchestrator or any agent | `.geas/missions/{mission_id}/decisions/{dec-id}.json` |
| [conformance-checking](#conformance-checking) | Operational | Yes | User or Orchestrator | 18-scenario conformance report |
| [chaos-exercising](#chaos-exercising) | Operational | Yes | User | 5-scenario failure test results |
| [policy-managing](#policy-managing) | Operational | Yes | User or Orchestrator | `.geas/state/policy-overrides.json` |
| [reporting](#reporting) | Operational | Yes | User or Orchestrator | `.geas/state/health-check.json` |

---

## Entry Skills

### mission

Entry point -- receives user intent and invokes Orchestrator.

**User-Invocable:** Yes (`/geas:mission`)

**Invoked By:** User directly

**Inputs:**
- User natural language (mission statement, feature request, or decision question)

**Outputs:**
- None (delegates to Orchestrator immediately)

**Key Behaviors:**
- Thin entry shell -- receives user input and invokes `/geas:orchestrating`.
- Does NOT spawn an orchestrator agent. Orchestrating is a skill that runs in the main session, not a sub-agent.
- For decision-only requests (no code), routes to `/geas:decision`.

**Schemas:** None.

---

### orchestrating

Geas orchestrator -- coordinates the multi-agent team. Manages setup, intake, and the 4-phase mission pipeline (Specifying → Building → Polishing → Evolving). Phase details are in `references/` files. For decision-only requests, routes to `/geas:decision`.

**User-Invocable:** No (invoked via `/geas:mission`, which calls `/geas:orchestrating`)

**Invoked By:** The `mission` skill on every user request

**Inputs:**
- `.geas/state/run.json` -- checked at startup for resume vs fresh run
- `.geas/missions/{mission_id}/spec.json` -- mission context after intake
- `.geas/ledger/events.jsonl` -- event log for writing transitions
- `.geas/missions/{mission_id}/evolution/debt-register.json` -- tech debt tracking after each agent return

**Outputs:**
- `.geas/state/run.json` -- checkpoint updates before every agent spawn
- `.geas/ledger/events.jsonl` -- event entries for all state transitions
- `.geas/missions/{mission_id}/evolution/debt-register.json` -- new tech debt items extracted from evidence bundles

**Key Behaviors:**
- Before every `Agent()` spawn, reads and writes `.geas/state/run.json` with a checkpoint (`pipeline_step`, `agent_in_flight`, `pending_evidence`). Session recovery depends on this.
- After every agent return, reads the expected evidence file to verify it exists. Missing evidence = step failed; retries once then logs error.
- Routes startup to the 4-phase mission pipeline (Specifying → Building → Polishing → Evolving, scaled to the request) or to decision-only via `/geas:decision`. Phase procedures are in `references/specifying.md`, `references/building.md`, `references/polishing.md`, `references/evolving.md`. The per-task pipeline is in `references/pipeline.md`. For details, see `protocol/02_MODES_MISSIONS_AND_RUNTIME.md`.

**Schemas:** None owned directly; reads schemas from downstream skills.

---

### setup

First-time setup -- initialize `.geas/` runtime directory, generate config files.

**User-Invocable:** No

**Invoked By:** Orchestrator on the first run (when `.geas/state/run.json` does not exist)

**Inputs:** None (reads `.gitignore` to check for existing entries)

**Outputs:**
- `.geas/` directory tree: `state/`, `missions/{mission_id}/`, `ledger/`, `summaries/`, `memory/_project/`, `memory/agents/`
- `.geas/state/run.json` -- initial run state (`status: "initialized"`)
- `.geas/missions/{mission_id}/evolution/debt-register.json` -- empty tech debt register (`{"items": []}`)
- `.geas/rules.md` -- shared agent rules (evidence format, code boundaries)
- `.gitignore` -- `.geas/` entry appended if not present

**Key Behaviors:**
- Idempotent directory creation via `mkdir -p` -- safe to call on an existing project.
- Writes `rules.md` with the baseline evidence and code rules that all agents must follow; Process Lead updates this file over time via retrospectives.
- Users should not need to run this manually; Orchestrator triggers it automatically.

**Schemas:** None.

---

## Core - Contract Engine Skills

### intake

Mission intake gate -- collaborative exploration to freeze a mission spec. One question at a time, section-by-section approval.

**User-Invocable:** No

**Invoked By:** Orchestrator (Step 1 of Startup Sequence, before mode detection)

**Inputs:**
- User natural language (the raw mission statement)
- `.geas/missions/{mission_id}/spec.json` -- checked for existence (existing project variant skips creation if file already exists)

**Outputs:**
- `.geas/missions/{mission_id}/spec.json` -- frozen mission spec conforming to `schemas/mission-spec.schema.json`

**Key Behaviors:**
- Asks one question at a time (never batches questions) and tracks a mental completeness checklist: `mission`, `acceptance_criteria` (>=3), `scope_out` (>=1), `target_user`, `constraints`. Stops when all are satisfied.
- Presents 2-3 approach options with trade-offs before finalizing scope (new product); delivery on an existing project skips approach proposals and limits questions to feature scope.
- If the user says "just build it," sets `readiness_override: true`, fills best-effort values, and proceeds. Scope changes after freeze must go through `pivot-protocol`.

**Schemas:** `plugin/skills/intake/schemas/mission-spec.schema.json`

---

### task-compiler

Compile a user story into a TaskContract -- a machine-readable work agreement with verifiable acceptance criteria, path boundaries, and eval commands.

**User-Invocable:** No

**Invoked By:** Orchestrator during Specifying phase and at Building phase entry

**Inputs:**
- User story or feature description
- `.geas/missions/{mission_id}/spec.json` -- mission-level context
- `.geas/memory/_project/conventions.md` -- build/lint/test commands
- `.geas/missions/{mission_id}/tasks/` -- existing contracts for dependency checking and ID sequencing

**Outputs:**
- `.geas/missions/{mission_id}/tasks/{id}.json` -- TaskContract conforming to `schemas/task-contract.schema.json`
- `.geas/ledger/events.jsonl` -- `task_compiled` event appended

**Key Behaviors:**
- Assigns worker and reviewer by task type (frontend -> Frontend Engineer/Architecture Authority, backend -> Backend Engineer/Architecture Authority, design -> UI/UX Designer/Architecture Authority, etc.) and sets `scope.paths` that define where workers may modify files.
- Generates a `rubric` array with quality dimensions and thresholds: base dimensions (`core_interaction`, `feature_completeness`, `code_quality`, `regression_safety`) for all tasks, plus `ux_clarity` and `visual_coherence` for UI tasks.
- Reads eval commands from `conventions.md`; if none exist, detects from project config files (package.json, Makefile, pyproject.toml).

**Schemas:** `plugin/skills/task-compiler/schemas/task-contract.schema.json`

---

### context-packet

Generate a role-specific ContextPacket for a worker -- compressed briefing with focused, relevant context only.

**User-Invocable:** No

**Invoked By:** Orchestrator before dispatching any worker for a task

**Inputs:**
- `.geas/missions/{mission_id}/tasks/{task-id}.json` -- TaskContract
- `.geas/missions/{mission_id}/evidence/{task-id}/` -- upstream worker outputs
- `.geas/missions/{mission_id}/decisions/` -- relevant decision records
- `.geas/missions/{mission_id}/spec.json` -- mission context
- `.geas/missions/{mission_id}/contracts/{task-id}.json` -- implementation contract (for Architecture Authority and QA Engineer packets)
- `.geas/missions/{mission_id}/evolution/debt-register.json` -- open tech debt items relevant to the task

**Outputs:**
- `.geas/missions/{mission_id}/packets/{task-id}/{worker-name}.md` -- role-tailored markdown briefing (target: under 200 lines)

**Key Behaviors:**
- Each worker type receives only the context relevant to their role: UI/UX Designer gets design constraints and target-user context; Frontend Engineer/Backend Engineer get the design spec and eval commands; Architecture Authority gets files changed and the worker's `self_check.known_risks`; QA Engineer gets the implementation contract's `demo_steps` and `edge_cases` plus available QA tools.
- QA Engineer packets include a `## QA Tools Available` section listing only tools actually connected (from `.geas/config.json`), and a `## Rubric Scoring` section listing the dimensions the evaluator must score.
- Human-confirmed decisions carry the highest priority when extracted from decision records.

**Schemas:** `plugin/skills/context-packet/schemas/context-packet.schema.json`

---

### implementation-contract

Pre-implementation agreement -- worker proposes concrete action plan, QA Engineer and Architecture Authority approve before coding begins. Prevents wasted implementation cycles from misunderstood requirements.

**User-Invocable:** No

**Invoked By:** Orchestrator after Tech Guide (Architecture Authority) and before Implementation, for every task

**Inputs:**
- `.geas/missions/{mission_id}/tasks/{task-id}.json` -- TaskContract
- `.geas/missions/{mission_id}/packets/{task-id}/{worker}.md` -- worker's ContextPacket
- `.geas/missions/{mission_id}/evidence/{task-id}/palette.json`, `.geas/missions/{mission_id}/evidence/{task-id}/forge.json` -- prior design and tech guide evidence (if available)

**Outputs:**
- `.geas/missions/{mission_id}/contracts/{task-id}.json` -- implementation contract conforming to `schemas/implementation-contract.schema.json` (fields: `planned_actions`, `edge_cases`, `state_transitions`, `non_goals`, `demo_steps`, `status`)
- `.geas/ledger/events.jsonl` -- `implementation_contract` event with `approved` or `revision_requested`

**Key Behaviors:**
- Three-step process: worker drafts contract -> QA Engineer reviews for QA coverage (`demo_steps` must cover every acceptance criterion) -> Architecture Authority reviews for technical viability. Both must approve before implementation begins.
- Allows one revision cycle; after that, Architecture Authority makes the final call and implementation proceeds.
- `demo_steps` must cover every acceptance criterion -- a contract missing coverage for any criterion is considered incomplete.

**Schemas:** `plugin/skills/implementation-contract/schemas/implementation-contract.schema.json`

---

### evidence-gate

Evidence Gate v2 quality gate -- evaluates an EvidenceBundle against its TaskContract. The protocol uses a Tier 0 (Precheck) + Tier 1 (Mechanical) + Tier 2 (Contract + Rubric) structure. The former Tier 3 (Product) has been separated into an independent Final Verdict step. After gate pass, the flow proceeds to Closure Packet assembly -> Critical Reviewer pre-ship challenge -> Final Verdict. For details, see `protocol/05_GATE_VOTE_AND_FINAL_VERDICT.md`.

**User-Invocable:** No

**Invoked By:** Orchestrator after each implementation, code review, or QA step

**Inputs:**
- `.geas/missions/{mission_id}/evidence/{task-id}/{worker-name}.json` -- EvidenceBundle
- `.geas/missions/{mission_id}/tasks/{task-id}.json` -- TaskContract (acceptance criteria, eval commands, rubric, retry budget)

**Outputs:**
- Gate verdict (pass/fail/block/error) with tier breakdown. `iterate` is not a gate verdict; it is used only in the Final Verdict.
- `.geas/missions/{mission_id}/tasks/{task-id}.json` -- status updated to `"passed"` on pass
- `.geas/ledger/events.jsonl` -- detailed `gate_result` event with tier results
- `.geas/missions/{mission_id}/decisions/{dec-id}.json` -- DecisionRecord on escalation
- Triggers `verify-fix-loop` on fail (if retry budget remains)

**Key Behaviors:**
- Tier 0 (Precheck): Checks required artifact existence, task state eligibility, and baseline/integration preconditions. Does not proceed to later tiers on failure.
- Tier 1 (Mechanical): Actually executes each `eval_command` from the TaskContract and records exit codes. Does not assume pass. Stops on first failure.
- Tier 2 (Contract + Rubric): Checks each acceptance criterion from worker evidence, then scores rubric dimensions from Architecture Authority and QA Engineer's `rubric_scores`. All dimensions must meet their threshold; if worker `self_check.confidence` <= 2, every threshold is raised by 1.
- After gate pass: Closure Packet assembly -> Critical Reviewer pre-ship challenge (mandatory for high/critical risk) -> Final Verdict (product_authority issues pass/iterate/escalate). The former Tier 3 (Product) has been separated into this Final Verdict step.

**Schemas:** `plugin/skills/evidence-gate/schemas/evidence-bundle.schema.json`, `plugin/skills/evidence-gate/schemas/decision-record.schema.json`

---

### verify-fix-loop

Verify-Fix Loop -- bounded fix-verify inner loop. Reads TaskContract for retry budget, produces EvidenceBundle per iteration, writes DecisionRecord on escalation. Max iterations from contract (default 3).

**User-Invocable:** No

**Invoked By:** Orchestrator (triggered by evidence-gate on failure)

**Inputs:**
- `.geas/missions/{mission_id}/tasks/{task-id}.json` -- TaskContract (retry budget, escalation policy)
- `.geas/missions/{mission_id}/evidence/{task-id}/sentinel.json` -- failed EvidenceBundle with specific failures
- Gate verdict -- which tier failed and why (including `blocking_dimensions` from rubric)

**Outputs:**
- `.geas/missions/{mission_id}/packets/{task-id}/{fixer}-fix-{N}.md` -- fix-specific ContextPacket per iteration
- `.geas/missions/{mission_id}/evidence/{task-id}/{fixer}-fix-{N}.json` -- EvidenceBundle from each fix attempt
- `.geas/missions/{mission_id}/decisions/{dec-id}.json` -- DecisionRecord when budget exhausted
- `.geas/ledger/events.jsonl` -- escalation event

**Key Behaviors:**
- Each iteration: spawns the appropriate fixer (Frontend Engineer for frontend bugs, Backend Engineer for backend) with worktree isolation, merges the worktree branch, then re-runs evidence-gate (Tier 1 + Tier 2).
- Fix-specific ContextPackets include `blocking_dimensions` from the rubric evaluation so the fixer knows exactly which quality thresholds failed.
- When retry budget is exhausted, follows the TaskContract's `escalation_policy`: `forge-review` (architectural analysis with one additional attempt if fixable), `nova-decision` (strategic direction), or `pivot` (invoke pivot-protocol).

**Schemas:** Reads `task-contract.schema.json`; writes `decision-record.schema.json`.

---

## Core - Verification Skills

### verify

Structured verification checklist -- BUILD, LINT, TEST, ERROR_FREE, FUNCTIONALITY. Invoke to check code quality before declaring complete.

**User-Invocable:** No

**Invoked By:** Worker agents (Frontend Engineer, Backend Engineer, Architecture Authority, QA Engineer) before posting completion

**Inputs:**
- `.geas/memory/_project/conventions.md` -- project-specific commands (falls back to project config file detection)
- Project root marker files (`package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`) for stack detection

**Outputs:**
- Console checklist report (no files written)

**Key Behaviors:**
- Five-item checklist in order: BUILD, LINT, TEST, ERROR_FREE, FUNCTIONALITY. VERDICT is PASS only if all items are PASS (PENDING and SKIP do not block); FAIL if any item fails with specific file/line details.
- Architecture Authority pre-check mode runs only BUILD + LINT -- fast gate before handing off to QA Engineer for full QA.
- FUNCTIONALITY is QA Engineer's domain (E2E via browser automation MCP); other agents mark it as `PENDING (QA Engineer E2E)` rather than running it themselves.

**Schemas:** None.

---

### vote-round

Structured review protocol -- Architecture Authority proposes, Critical Reviewer challenges, Orchestrator synthesizes, user confirms. Produces a DecisionRecord.

**User-Invocable:** No

**Invoked By:** Orchestrator at major architectural or cross-cutting decisions (primarily Specifying step 1.5)

**Inputs:**
- Proposal from Architecture Authority (saved to `.geas/missions/{mission_id}/decisions/pending/{proposal-id}.md`)
- Challenge from the designated Critical Reviewer agent (appended to the same file)

**Outputs:**
- `.geas/missions/{mission_id}/decisions/{dec-id}.json` -- DecisionRecord conforming to `schemas/decision-record.schema.json`
- Cleans up `.geas/missions/{mission_id}/decisions/pending/{proposal-id}.md` after resolution

**Key Behaviors:**
- Four-step process: Architecture Authority writes a structured proposal (What / Why / Trade-offs / Alternatives) -> Critical Reviewer writes a structured challenge (Assessment / Concerns / Alternative / Recommendation) -> Orchestrator synthesizes both and presents options to the user -> user confirms or Orchestrator auto-decides in autonomous mode.
- Triggered for architecture/tech stack proposals and design system decisions; not triggered for individual feature specs, per-feature tech guides, bug fixes, or minor refactors.
- Critical Reviewer participation is mandatory -- skipping the Critical Reviewer step is not allowed even when the proposal seems obvious.

**Schemas:** `plugin/skills/evidence-gate/schemas/decision-record.schema.json`

---

## Team - Execution Skills

### decision

Run a structured multi-agent decision to make a technical or product decision before implementation. No code changes — utility skill only.

**User-Invocable:** Yes (`/geas:decision`)

**Invoked By:** Orchestrator (after mode detection) or directly by user

**Inputs:**
- User's question or decision to frame (natural language)

**Outputs:**
- `.geas/missions/{mission_id}/decisions/{dec-id}.json` -- DecisionRecord with the chosen direction

**Key Behaviors:**
- No code is produced. The entire output is a DecisionRecord.
- Spawns four debaters in parallel: Architecture Authority (argues for option A with technical rationale), Critical Reviewer (challenges option A / argues for option B), Backend Engineer (backend/scalability perspective), UI/UX Designer (UX/frontend perspective).
- Orchestrator synthesizes positions, presents trade-offs, asks the user for a final decision, then writes the DecisionRecord.

**Schemas:** `plugin/skills/evidence-gate/schemas/decision-record.schema.json`

---

## Team - Planning Skills

### write-prd

Create a Product Requirements Document from a feature idea or mission.

**User-Invocable:** No

**Invoked By:** Product Authority during Specifying (mission phase 1.3)

**Inputs:**
- `$ARGUMENTS` -- feature idea, problem statement, or mission
- `.geas/missions/{mission_id}/spec.json` -- mission context and accepted scope

**Outputs:**
- `.geas/missions/{mission_id}/prd.md` -- structured PRD (Problem, Objective, Target Users, Scope In/Out, User Flows, Functional/Non-Functional Requirements, Success Metrics, Open Questions)

**Key Behaviors:**
- Formats output as a structured markdown document with a standard section order -- Problem through Open Questions.
- Keeps requirements traceable to user needs; every requirement should have a clear user motivation.
- Explicit about what is out of scope to prevent scope creep during execution.

**Schemas:** None.

---

### write-stories

Break a feature or mission into user stories with acceptance criteria.

**User-Invocable:** No

**Invoked By:** Product Authority during Specifying (mission phase 1.3), immediately after write-prd

**Inputs:**
- `$ARGUMENTS` -- feature description, mission statement, or problem to solve
- `.geas/missions/{mission_id}/prd.md` -- PRD output used as input context

**Outputs:**
- `.geas/missions/{mission_id}/stories.md` -- ordered user stories in standard format (As a / I want to / So that + Acceptance Criteria + Priority + Estimate)

**Key Behaviors:**
- Each story must be independent (shippable alone) and testable (specific, verifiable acceptance criteria).
- Stories are ordered by priority (P0 first). Stories needing more than 3-5 acceptance criteria should be split.
- Acceptance criteria include edge cases (empty state, error state, max limits) -- not just happy path.

**Schemas:** None.

---

### onboard

Codebase discovery protocol -- scan project structure, detect stack, map architecture. Used automatically when execution on an existing project finds no existing state.

**User-Invocable:** No

**Invoked By:** Orchestrator during execution on an existing project when `.geas/memory/_project/conventions.md` does not exist

**Inputs:**
- Project root files: `package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `requirements.txt`
- Source directory structure (depth varies by project size)

**Outputs:**
- `.geas/memory/_project/conventions.md` -- stack, build commands, key paths, architecture notes, naming conventions
- `.geas/memory/_project/state.json` -- onboard metadata (mode, phase, project size, stack summary)

**Key Behaviors:**
- Run by Architecture Authority only (single agent, not parallel). Read-only reconnaissance -- no code changes.
- Scan depth adapts to project size: full scan for small (~50 files), focused scan of `src/` and entry points for medium (50-500 files), targeted scan of relevant directories for large (500+ files).
- Repeat execution behavior: if `conventions.md` already exists, skip onboarding entirely. Orchestrator reads it directly and proceeds to the execution pipeline.

**Schemas:** None.

---

## Utility Skills

### coding-conventions

Universal coding standards for the AI startup workspace -- stack-agnostic.

**User-Invocable:** No

**Invoked By:** Referenced by all agents as a standing guideline; not invoked as a step in any pipeline

**Inputs:** None

**Outputs:** None (reference document only -- no files written)

**Key Behaviors:**
- Defines universal standards that apply regardless of stack: TypeScript strict mode (if applicable), no `any` types, one responsibility per function/component, graceful error handling, atomic git commits, mobile-first accessible UI.
- The tech stack itself is NOT predefined here -- Architecture Authority proposes it, Product Authority validates, Orchestrator confirms, and the decision is recorded as a DecisionRecord. Architecture Authority then writes the project-specific `conventions.md`.
- Serves as the baseline that `conventions.md` extends and specializes.

**Schemas:** None.

---

### briefing

Product Authority Morning Briefing -- structured status report on what shipped, what's blocked, what needs human attention.

**User-Invocable:** No

**Invoked By:** Product Authority at milestones, start of Evolving, or on Orchestrator/human request

**Inputs:**
- `.geas/state/run.json` -- current phase and mission
- `.geas/missions/{mission_id}/tasks/` -- TaskContracts grouped by status
- `.geas/missions/{mission_id}/evidence/` -- recent activity and gate results
- Previous briefings (for delta tracking)

**Outputs:**
- Console output only (no file written)

**Key Behaviors:**
- Fixed five-section format: What Shipped, What's Blocked, Needs Human Attention, Product Health (mission alignment / quality / velocity / user value), Next Priority. Human should finish reading in under 60 seconds.
- Product Health includes QA Engineer's pass rate from the most recent test run; Product Authority makes a subjective user-value assessment ("Users can now do X").
- Every blocker entry includes a suggested action -- the briefing is actionable, not just descriptive.

**Schemas:** None.

---

### run-summary

Generate end-of-session summary -- decisions, issues completed, agent stats, verify-fix loops. Output to console and `.geas/` file.

**User-Invocable:** No

**Invoked By:** Orchestrator at end of Evolving phase, or on human request

**Inputs:**
- `.geas/state/run.json` -- phase, mode, mission
- `.geas/memory/_project/agent-log.jsonl` -- agent spawn history
- `.geas/missions/{mission_id}/tasks/` -- TaskContract statuses
- `.geas/missions/{mission_id}/decisions/` -- DecisionRecords made this session
- `.geas/ledger/events.jsonl` -- gate results, fix loops, escalations
- `.geas/ledger/costs.jsonl` -- agent spawn costs (optional)
- `.geas/missions/{mission_id}/evolution/debt-register.json` -- tech debt state (optional)

**Outputs:**
- `.geas/summaries/run-summary-<YYYY-MM-DD>.md` -- session audit trail
- Console output (identical to file content)

**Key Behaviors:**
- Covers: decisions made, issues completed (with verify-fix loop counts), issues in progress, agents spawned by name, open work.
- Includes a Cost Report table (spawns by agent, model, phase, and task) if `costs.jsonl` exists, and a Tech Debt Report (open by severity, new and resolved this session) if `debt-register.json` exists.
- Multiple summaries on the same date get a sequence suffix: `run-summary-2026-03-21-2.md`.

**Schemas:** None.

---

### ledger-query

Structured search over `.geas/ledger/events.jsonl` -- query by task, phase, agent, or failure. Cross-references TaskContracts, EvidenceBundles, and DecisionRecords. READ-ONLY, never modifies state.

**User-Invocable:** No

**Invoked By:** Orchestrator or human for diagnostics, status checks, and history review

**Inputs (read-only):**
- `.geas/ledger/events.jsonl` -- primary event log
- `.geas/missions/{mission_id}/tasks/{id}.json` -- cross-reference for contract status
- `.geas/missions/{mission_id}/evidence/{task-id}/{worker}.json` -- cross-reference for evidence files
- `.geas/missions/{mission_id}/decisions/{id}.json` -- cross-reference for decision records
- `.geas/state/run.json`, `.geas/missions/{mission_id}/spec.json` -- for `status` query type

**Outputs:**
- Formatted markdown query results printed to console (no files written)

**Key Behaviors:**
- Five query types: `timeline <task-id>` (all events for one task in chronological order), `phase <phase-name>` (all events within a phase with summary stats), `failures` (all gate failures, fix loops, escalations with resolution status), `agent <agent-name>` (all dispatches and evidence for one agent), `status` (current run state with last 10 events and active task list).
- Strictly read-only -- this skill never writes to any file under any circumstance.
- Limits output to 30 events for queries returning more than 50; skips malformed JSONL lines; shows `"(not found)"` for missing cross-reference files rather than failing.

**Schemas:** None (reads all contract-engine schemas but writes none).

---

### cleanup

Entropy scan -- detect AI slop, unused code, convention drift. Records findings in `.geas/missions/{mission_id}/evolution/debt-register.json`. Invoke after Building phase or during Evolving.

**User-Invocable:** No

**Invoked By:** Orchestrator after Phase 2 (Building), during Phase 4 (Evolving), or on explicit request from human or Architecture Authority

**Inputs:**
- All project source files (respects `.gitignore`; skips `node_modules`, `vendor`, `target`, `dist`, `build`, `.git`)
- `.geas/memory/_project/conventions.md` -- baseline for detecting convention drift

**Outputs:**
- `.geas/missions/{mission_id}/evolution/debt-register.json` -- new entries appended for each finding
- Console summary (files scanned, issue counts by severity, top 3 priorities)

**Key Behaviors:**
- Six scan categories: unnecessary comments (restating the code), dead code (unused exports, unreachable branches, commented-out blocks), duplication (10+ lines of substantially similar code across files), over-abstraction, convention drift (naming, import patterns, file structure), and AI boilerplate (verbose error handling, redundant type annotations, template remnants).
- Scan depth scales to project size: full scan for small projects; files changed in the current mission plus core modules for medium; only team-modified files and flagged areas for large.
- Related findings with the same root cause are grouped into one `debt-register.json` entry (not 20 entries for 20 comments in one file).

**Schemas:** None (writes entries to `.geas/missions/{mission_id}/evolution/debt-register.json`; structure is defined in the skill).

---

### pivot-protocol

When and how to pivot during product development.

**User-Invocable:** No

**Invoked By:** Orchestrator (when triggered by evidence-gate escalation policy `"pivot"`, Product Authority "Cut" verdict, or any team member surfacing a pivot signal)

**Inputs:**
- Full context from Orchestrator: what is wrong, what has been tried, available options
- `.geas/missions/{mission_id}/tasks/` -- existing TaskContracts to cancel or restructure
- `.geas/missions/{mission_id}/decisions/` -- prior decisions for context

**Outputs:**
- `.geas/missions/{mission_id}/decisions/{dec-id}.json` -- DecisionRecord with Product Authority's chosen pivot direction and rationale
- `.geas/missions/{mission_id}/tasks/` -- dropped TaskContracts cancelled; new TaskContracts created for the new approach

**Key Behaviors:**
- Triggers include: QA Engineer reporting >50% test failure on core features, a core feature declared technically infeasible, Architecture Authority finding a fundamental architecture problem, Product Authority issuing a "Cut" verdict, or multiple agents raising the same concern.
- Product Authority decides the pivot type from five options: scope cut, feature drop, approach change, push through, or simplify. Any team member may suggest a pivot -- no need to wait for failures.
- A pivot is a strategic direction change, not a code fix. Bug fixes, refactors, and design iterations are NOT pivots.

---

## Execution Skills

### scheduling

Protocol for orchestrator to manage multiple tasks simultaneously. Defines batch construction, pipeline interleaving, checkpoint management, and recovery.

**User-Invocable:** No

**Invoked By:** Orchestrator during Building phase when multiple tasks are ready for parallel execution

**Inputs:**
- `.geas/state/run.json` -- current session state and checkpoint
- `.geas/state/locks.json` -- active lock manifest
- `.geas/missions/{mission_id}/tasks/` -- TaskContracts with `scope.paths` for conflict detection

**Outputs:**
- Batch construction decisions (which tasks can safely run in parallel)
- Updated `run.json` with `parallel_batch` and `completed_in_batch` fields

**Key Behaviors:**
- Task-level parallelism only. Step-level parallelism is defined in the execution pipeline.
- Safe parallel conditions: no path overlap in `scope.paths`, no shared interface locks, no integration dependencies.
- Batch completion requires all tasks in `parallel_batch` to appear in `completed_in_batch`.

**Schemas:** None owned directly; reads `run-state.schema.json` and `lock-manifest.schema.json`.

---

## Memory & Evolution Skills

### memorizing

Memory lifecycle management -- candidate extraction, promotion pipeline, review, application logging, index maintenance, decay and harmful reuse detection.

**User-Invocable:** No

**Invoked By:** Orchestrator after retrospective (per-task extraction) and during Evolving (batch promotion)

**Inputs:**
- `.geas/missions/{mission_id}/tasks/{task_id}/retrospective.json` -- lessons from retrospective
- `.geas/state/memory-index.json` -- current memory index
- `.geas/memory/` -- existing memory entries

**Outputs:**
- `.geas/memory/` -- new or updated memory entries
- `.geas/state/memory-index.json` -- updated index

**Key Behaviors:**
- 9-state lifecycle: candidate → provisional → stable → canonical (+ under_review, decayed, superseded, archived, rejected)
- 6-stage promotion with explicit criteria at each gate
- Application logging tracks how memories are used and their impact
- Decay detection flags memories that haven't been applied or that contradict recent evidence

**Schemas:** `memory-candidate.schema.json`, `memory-entry.schema.json`, `memory-index.schema.json`, `memory-review.schema.json`, `memory-application-log.schema.json`

---

## Operational Skills

### conformance-checking

Meta-verification suite -- 18 scenarios that verify existing enforcement mechanisms (hooks, skill directives) are correctly wired and functioning.

**User-Invocable:** Yes (`/geas:conformance-checking`)

**Invoked By:** User or Orchestrator after significant changes to hooks or skills

**Inputs:**
- `plugin/hooks/hooks.json` -- hook configuration
- `plugin/hooks/scripts/` -- hook scripts
- `plugin/skills/` -- skill definitions

**Outputs:**
- Console report: pass/fail per scenario with details

**Key Behaviors:**
- Does not implement new behavior -- only checks that existing enforcement is intact.
- 18 scenarios covering: task state transitions, evidence gate enforcement, lock lifecycle, memory promotion gates, checkpoint integrity, and more.

---

### chaos-exercising

Failure scenario testing -- 5 chaos scenarios with inline setup, trigger, and verification scripts to validate Geas recovery mechanisms.

**User-Invocable:** Yes (`/geas:chaos-exercising`)

**Invoked By:** User

**Inputs:**
- A working `.geas/` directory with active session state

**Outputs:**
- Console report: pass/fail per scenario

**Key Behaviors:**
- 5 failure scenarios: context compaction, orphaned locks, corrupted checkpoint, stale evidence, interrupted subagent.
- Each scenario has setup → trigger → verify stages with inline bash scripts.

---

### policy-managing

Override management for `.geas/memory/_project/rules.md`. Lets the team temporarily disable or modify a rule with a reason, an expiry date, and an approver.

**User-Invocable:** Yes (`/geas:policy-managing`)

**Invoked By:** User or Orchestrator

**Inputs:**
- `.geas/memory/_project/rules.md` -- current rules
- `.geas/state/policy-overrides.json` -- existing overrides

**Outputs:**
- `.geas/state/policy-overrides.json` -- updated overrides with full audit trail

**Key Behaviors:**
- List active rules, apply temporary overrides, check expiry.
- Preserves full override history for audit.
- Overrides do not modify `rules.md` -- they are applied at runtime.

---

### reporting

Debt/gap dashboard and health signal calculation.

**User-Invocable:** Yes (`/geas:reporting`)

**Invoked By:** User or Orchestrator at phase transitions, session start, and Evolving phase entry

**Inputs:**
- `.geas/missions/{mission_id}/evolution/debt-register.json` -- debt items
- `.geas/missions/{mission_id}/evolution/gap-assessment-*.json` -- gap assessments
- `.geas/state/health-check.json` -- previous health check

**Outputs:**
- `.geas/state/health-check.json` -- updated health signals
- Console markdown summary

**Key Behaviors:**
- 8 health signals from protocol doc 12: gate pass rate, retry budget utilization, debt severity rollup, memory promotion rate, evidence completeness, lock contention, recovery frequency, rule freshness.
- Each signal has a threshold; breaching triggers a mandatory response.

**Schemas:** `plugin/skills/evidence-gate/schemas/decision-record.schema.json`
