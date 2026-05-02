# Skills Reference

Skills are the dispatcher's playbook. Each skill encodes one step of the Geas protocol as a prompt reused across missions. Skills never write `.geas/` directly — every write goes through the `geas` CLI. This reference describes the v3 skill surface: which skills exist, when each one runs, which CLI commands it invokes, and which artifacts it produces.

Authoritative sources: the shared catalog in `architecture/DESIGN.md §7.5`, the full CLI contract in `architecture/CLI.md`, and the actual skill bodies under `skills/{name}/SKILL.md`. This file is a consumer-side index — it does not repeat the CLI reference or re-derive protocol semantics.

---

## 1. Overview

The skill layer consists of 17 skills. Only two are user-invocable (`mission` and `navigating-geas`); the other 15 are dispatched by the `mission` main-session skill. Skills follow progressive disclosure: the frontmatter gives the trigger and CLI surface, the body holds execution procedure, and heavier patterns live under `references/`. The CLI is the sole writer to `.geas/`, so every "primary output" in this document is produced by the CLI command noted on the same row.

Execution kinds:
- `main_session` — runs in the main session with the user; the `mission` dispatcher is always main_session, and every mission-lifecycle + multi-party sub-skill runs in that same session.
- `spawned` — the dispatcher spawns a sub-agent for one of the six spawned skills (implementer, reviewer, verifier, voter, design-authority, decision-maker); the sub-agent runs the skill, writes via CLI, and returns.

---

## 2. Skill Index

| Skill | Group | Execution | User-invocable | One-line role |
|---|---|---|---|---|
| `mission` | A. Project utility | main_session | Yes (`/mission`) | Dispatcher and single user entry point — bootstrap, resume, phase-aware dispatch, briefings |
| `navigating-geas` | A. Project utility | main_session | Yes (`/navigating-geas`) | Skill catalog + CLI + workflow guide; produces explanation only |
| `specifying-mission` | B. Mission lifecycle | main_session | No | Drives specifying phase end-to-end: spec, design, initial task set, phase-review |
| `drafting-task` | B. Mission lifecycle | main_session | No | Authors one task contract (initial set or mid-mission scope-in) and moves it to ready on approval |
| `scheduling-work` | B. Mission lifecycle | main_session | No | Constructs a task-level parallel batch under surface-conflict rules and dispatches implementers |
| `running-gate` | B. Mission lifecycle | main_session | No | Runs Tier 0/1/2 gate, aggregates reviewer verdicts, and drives the bounded verify-fix loop on fail |
| `closing-task` | B. Mission lifecycle | main_session | No | Writes orchestrator closure evidence and transitions task-state from deciding to passed |
| `reviewing-phase` | B. Mission lifecycle | main_session | No | Appends a phase-review entry and advances mission-state phase |
| `consolidating-mission` | B. Mission lifecycle | main_session | No | Promotes debt / gap / memory candidates in consolidating phase |
| `verdicting-mission` | B. Mission lifecycle | main_session | No | Authors the mission-verdict entry; dispatcher transitions to complete after user confirmation |
| `convening-deliberation` | C. Multi-party | main_session (spawns voters) | No | Full-depth multi-party judgment; spawns voters and records one deliberation entry |
| `implementing-task` | D. Spawned agent | spawned | No | Spawned implementer owns the `implementing` state: writes implementation contract, implements, appends implementation evidence + self-check entry |
| `reviewing-task` | D. Spawned agent | spawned | No | Spawned reviewer (challenger / risk-assessor / operator / communicator) appends review-kind evidence |
| `verifying-task` | D. Spawned agent | spawned | No | Spawned verifier runs the contract's verification_plan and appends verifier evidence |
| `deliberating-on-proposal` | D. Spawned agent | spawned | No | Spawned voter returns one vote (agree / disagree / escalate) with rationale; no direct writes |
| `designing-solution` | D. Spawned agent | spawned | No | Spawned design-authority: mission-design, contract structural review, gap analysis |
| `deciding-on-approval` | D. Spawned agent | spawned | No | Spawned decision-maker: spec review, scope-in task approval, phase-review, mission-verdict |

---

## 3. Skills by group

### 3.1 Project utility (2)

#### `mission`

The Geas dispatcher. Runs in the main session, never spawned. Bootstraps `.geas/` when absent, inspects state, and routes every invocation to the phase-appropriate sub-skill; reconciles each sub-skill's return with `.geas/` state before continuing or halting. The single user entry point for mission work.

- Trigger — user invokes `/mission` (start, resume, or "where are we?"); dispatcher also handles `.geas/` bootstrap defensively.
- Primary CLI — `geas setup`, `geas context`, `geas mission create|approve|state`, `geas mission-state update --phase`, `geas task draft|approve|transition`, `geas task deps add`, `geas gate run`, `geas phase-review append`, `geas mission-verdict append`, `geas debt register|update-status`, `geas gap set`, `geas memory-update set`, `geas memory shared-set|agent-set`, `geas deliberation append` (via `convening-deliberation`).
- Primary outputs — every artifact the mission produces, through the sub-skills it dispatches.

#### `navigating-geas`

Map of the framework. Explains the skill catalog, the CLI surface, and how the `mission` dispatcher orchestrates multi-agent work so the user can pick the right entry point. Produces explanation only; never writes to `.geas/`.

- Trigger — user asks what skills exist, what a skill does, how phases/slots/evidence fit together, or is orienting at project start.
- Primary CLI — `geas context` (read-only), `geas schema list|show` (read-only) for grounding.
- Primary outputs — markdown response in chat. No files written.

### 3.2 Mission lifecycle sub-skills (8)

#### `specifying-mission`

Invoked by the mission dispatcher when `phase=specifying` and the mission spec has not yet been user-approved (or no mission exists). Drives one-question-at-a-time requirement gathering, produces an approved mission spec, an approved mission design, and an approved initial task set, then closes the specifying phase with a phase-review. Mission spec is immutable after user approval.

- Trigger — `phase=specifying` and `spec.json` missing / `user_approved=false` / missing `mission-design.md` / no approved task yet.
- Primary CLI — `geas mission create`, `geas mission design-set`, `geas mission approve`, `geas task draft`, `geas task approve`, `geas phase-review append`.
- Primary outputs — `missions/{mid}/spec.json`, `missions/{mid}/mission-design.md`, the first approved `tasks/{tid}/contract.json` set, and the specifying-phase `phase-review` entry.

#### `drafting-task`

Invoked by the mission dispatcher when a task contract needs authoring — initial set during specifying, mid-mission scope-in within the approved spec, or replacement for a cancelled task. Produces a drafted contract routed to a concrete implementer with reviewer slots, surfaces, dependencies, and a baseline snapshot. Contracts are immutable on approval; amendments use cancel + draft-replacement.

- Trigger — specifying phase initial-set authoring (called by `specifying-mission`); building/polishing mid-mission scope-in task; `supersedes` replacement for a cancelled task.
- Primary CLI — `geas task draft`, `geas task approve`, `geas task deps add`.
- Primary outputs — `tasks/{tid}/contract.json` (drafted → approved), scaffolded `tasks/{tid}/task-state.json`, evidence directory.

#### `scheduling-work`

Invoked by the mission dispatcher when one or more approved tasks have all dependencies satisfied and no active surface conflict. Constructs a task-level parallel batch, honoring `contract.surfaces` pairwise-overlap rules and critical-risk solo constraints, and dispatches implementers for the selected set. Scheduling is planning; the CLI re-enforces every constraint on `task transition --to implementing`.

- Trigger — `phase=building` (or `polishing`) with ≥1 `ready` task whose dependencies are `passed`; session resume with no `implementing` tasks in flight.
- Primary CLI — `geas task transition --to implementing`, plus read-only `geas task state` and `geas mission state` for batch inspection.
- Primary outputs — the dispatch plan for the current batch; no new `.geas/` artifacts beyond the `implementing` transitions.

#### `running-gate`

Invoked by the mission dispatcher when all required reviewer slots and the verifier have appended evidence for a task. Runs the Tier 0/1/2 gate, aggregates reviewer verdicts, and on a `fail` verdict runs the bounded verify-fix loop (rewinding `reviewing → implementing` with `verify_fix_iterations` incremented) until `pass` or budget exhaustion. `fail` enters the loop; `block` / `error` / `pass` do not.

- Trigger — `task-state.status == reviewing` with `self-check.json` valid, all `routing.required_reviewers` evidence files present, and verifier evidence present.
- Primary CLI — `geas gate run`, `geas task transition` (to `implementing` for rewind or `escalated` on budget exhaustion), `geas evidence append --slot implementer` during fix iterations.
- Primary outputs — new entries in `tasks/{tid}/gate-results.json`; rewound task-state transitions; additional implementation evidence entries on fix iterations.

#### `closing-task`

Invoked by the mission dispatcher when the gate has returned `verdict=pass` on a task in the `deciding` state. Writes the orchestrator-authored closure evidence (slot = orchestrator, `verdict=approved`) with retrospective fields (what went well, what broke, surprises, next-time guidance), then transitions task-state from `deciding → passed`. Closure is the only way to leave `deciding`; retrospective fields feed consolidation.

- Trigger — task in `task-state.status == deciding` with a passing gate run; also used on re-entry after escalation resolution.
- Primary CLI — `geas evidence append --kind closure`, `geas task transition --to passed`.
- Primary outputs — closure-kind orchestrator evidence entry under `tasks/{tid}/evidence/`; `task-state.status = passed`.

#### `reviewing-phase`

Invoked by the mission dispatcher when every mission-scope task in the current phase has reached a terminal state (`passed`, `cancelled`, or `escalated`). Appends a phase-review entry with `status=passed` and `next_phase`, then advances `mission-state.phase` via CLI — the only way the CLI permits phase advancement.

- Trigger — `specifying` / `building` / `polishing` completion with all mission-scope tasks terminal; full-depth specifying additionally requires a mission-level deliberation entry.
- Primary CLI — `geas phase-review append`, `geas mission-state update --phase`.
- Primary outputs — new entry in `missions/{mid}/phase-reviews.json`; `mission-state.phase` advanced.

#### `consolidating-mission`

Invoked by the mission dispatcher when `phase=consolidating` is entered. Scaffolds candidates from task evidence, promotes debt / memory / gap candidates, writes `memory-update.json` and `gap.json`, and replaces the memory markdowns (`shared.md` + per-agent `agents/{type}.md`). Memory markdown replace and `memory-update set` are paired by protocol.

- Trigger — `phase=consolidating` entry; session resume into an in-progress consolidation with partial artifacts.
- Primary CLI — `geas consolidation scaffold`, `geas debt register`, `geas gap set`, `geas memory-update set`, `geas memory shared-set`, `geas memory agent-set`.
- Primary outputs — `missions/{mid}/consolidation/candidates.json` (support file), `missions/{mid}/consolidation/gap.json`, `missions/{mid}/consolidation/memory-update.json`, appended entries in `debts.json`, rewritten `.geas/memory/shared.md` and `.geas/memory/agents/{type}.md`.

#### `verdicting-mission`

Invoked by the mission dispatcher when `consolidating-mission` has finished writing debt, gap, memory-update, and the memory markdowns. Spawns the decision-maker to author the mission-verdict entry. The `complete` transition is owned by the dispatcher and happens only after explicit user confirmation on the briefing.

- Trigger — `phase=consolidating` with consolidation artifacts all present; all mission-scope tasks terminal; per-phase phase-reviews recorded.
- Primary CLI — `geas mission-verdict append` (decision-maker authors via `deciding-on-approval`); `geas mission-state update --phase complete` after user confirmation.
- Primary outputs — new entry in `missions/{mid}/mission-verdict.json`; `mission-state.phase = complete` on confirmation.

### 3.3 Multi-party (1)

#### `convening-deliberation`

Invoked by the mission dispatcher when `mission.mode == full_depth` and a multi-party judgment is required. Thin convening wrapper over `geas deliberation append`: spawns voters, dispatches them independently (voters never see each other's votes before voting), collects their returns, and records one deliberation entry with the CLI-aggregated result. The CLI's aggregation rule is the source of truth; the skill never computes its own final judgment.

- Trigger — task-level: conflicting reviewer verdicts on incompatible grounds, a challenger structural objection closure cannot adjudicate alone, or a non-obvious rewind target. Mission-level: full-depth specifying close requires documented agreement among ≥3 voters including challenger, or phase rollback is under consideration.
- Primary CLI — `geas deliberation append --level mission|task`.
- Primary outputs — one new entry in `deliberations.entries` (under `tasks/{tid}/deliberations.json` or `missions/{mid}/deliberations.json`). Challenger is a required voter whenever available.

### 3.4 Spawned agent procedures (6)

#### `implementing-task`

Invoked by a spawned implementer after the dispatcher hands off an approved, dependency-satisfied task. The implementer owns the full `implementing` state: writes the implementation contract (the plan reviewers read later), performs the work, amends the contract if direction shifts materially, and closes out with one implementation-kind evidence entry plus a self-check entry. There is no pre-code reviewer concurrence round — per protocol doc 03, required reviewers submit evidence after the self-check is appended. Same concrete agent cannot hold implementer and reviewer/verifier on the same task.

- Trigger — `task-state.status == implementing` at spawn. Scheduler transitions `ready → implementing` on first dispatch; `running-gate` transitions `reviewing → implementing` on verify-fix rewinds. `base_snapshot` still matches the real workspace.
- Primary CLI — `geas impl-contract set`, `geas evidence append --slot implementer`, `geas self-check append`, `geas task transition --to reviewing` (orchestrator handles the transition after self-check lands).
- Primary outputs — `tasks/{tid}/implementation-contract.json`, implementation-kind evidence entry under `tasks/{tid}/evidence/`, and an entry appended to `tasks/{tid}/self-check.json`.

#### `reviewing-task`

Invoked by a spawned reviewer (challenger / risk-assessor / operator / communicator) after an implementer has appended implementation evidence plus a self-check entry. Reads the evidence in the reviewer's lane, forms a verdict, and appends one review-kind evidence entry. Stance (adversarial / failure-modes / operability / human-surfaces) lives in the agent file; the shared procedure lives here.

- Trigger — spawned as reviewer for a task in `reviewing`; reviewer is not the implementer on this task.
- Primary CLI — `geas evidence append --slot <reviewer slot>` with `evidence_kind: review`.
- Primary outputs — review-kind evidence entry with `verdict`, `concerns`, `scope_examined`, `methods_used`, `scope_excluded`.

#### `verifying-task`

Invoked by a spawned verifier alongside or after post-work reviewers (both sets must be present by gate run time). Runs the task contract's `verification_plan` independently of the implementer and records one verification-kind evidence entry mapping every acceptance criterion to a pass/fail result with concrete details. Missing or ambiguous verification produces a gate `error`.

- Trigger — `task-state.status == reviewing`; at least one implementation-kind evidence entry exists; `base_snapshot` still matches.
- Primary CLI — `geas evidence append --slot verifier` with `evidence_kind: verification`.
- Primary outputs — verifier evidence entry with `criteria_results` covering every acceptance criterion.

#### `deliberating-on-proposal`

Invoked by a spawned voter during a deliberation. The voter reads the proposal text and supporting artifacts, forms an independent judgment from the assigned slot, and returns one vote (`agree` / `disagree` / `escalate`) with non-empty rationale and dissent notes. Voters do not see each other's votes before returning theirs.

- Trigger — `convening-deliberation` dispatches the voter with proposal text, supporting artifact paths, and the voting slot identity.
- Primary CLI — none (no direct writes). The convening skill collects returns and calls `geas deliberation append`.
- Primary outputs — a vote object returned to the convening skill.

#### `designing-solution`

Invoked by a spawned design-authority at one of three moments — authoring the mission design, reviewing a task or implementation contract on structural grounds, or assembling the gap analysis during consolidating. Routes to the matching CLI surface per branch. Cannot hold design-authority and implementer on the same task.

- Trigger — branch A (mission design authorship, spec `user_approved: true` and no `mission-design.md`); branch B (task / implementation contract structural review); branch C (gap analysis in `consolidating`).
- Primary CLI — `geas mission design-set` (A), `geas evidence append --slot design-authority` with `evidence_kind: review` (B), `geas gap set` (C).
- Primary outputs — `missions/{mid}/mission-design.md`, review-kind design-authority evidence, or `missions/{mid}/consolidation/gap.json`.

#### `deciding-on-approval`

Invoked by a spawned decision-maker at one of four moments — mission spec review (standard or full_depth), mid-mission scope-in task contract approval, phase-review verdict authoring, or mission-verdict authoring. Routes to the matching CLI surface per branch.

- Trigger — branch A (mission spec review before user sign-off); branch B (building / polishing scope-in task approval); branch C (phase-review verdict authoring); branch D (mission verdict after consolidating completes).
- Primary CLI — `geas evidence append --slot decision-maker` (A, spec review entries), `geas task approve` (B), `geas phase-review append` (C), `geas mission-verdict append` (D).
- Primary outputs — review-kind decision-maker evidence, approved task contract, phase-review entry, or mission-verdict entry.

---

## 4. Skill → CLI Map

Fast lookup. For command details (flags, JSON shape, failure modes), see `architecture/CLI.md`.

| Skill | CLI commands (canonical) |
|---|---|
| `mission` | all mission / task / evidence / gate / phase-review / mission-verdict / debt / gap / memory / memory-update / context surfaces (via the sub-skill it dispatches) |
| `navigating-geas` | `context`, `schema list`, `schema show` (read-only) |
| `specifying-mission` | `mission create`, `mission design-set`, `mission approve`, `task draft`, `task approve`, `phase-review append` |
| `drafting-task` | `task draft`, `task approve`, `task deps add` |
| `scheduling-work` | `task transition --to implementing`, `task state`, `mission state` |
| `running-gate` | `gate run`, `task transition`, `evidence append --slot implementer` (fix iterations) |
| `closing-task` | `evidence append --kind closure`, `task transition --to passed` |
| `reviewing-phase` | `phase-review append`, `mission-state update --phase` |
| `consolidating-mission` | `consolidation scaffold`, `debt register`, `gap set`, `memory-update set`, `memory shared-set`, `memory agent-set` |
| `verdicting-mission` | `mission-verdict append`, `mission-state update --phase complete` |
| `convening-deliberation` | `deliberation append --level mission\|task` |
| `implementing-task` | `self-check append`, `evidence append --slot implementer`, `task transition` |
| `reviewing-task` | `evidence append --slot <reviewer slot>` |
| `verifying-task` | `evidence append --slot verifier` |
| `deliberating-on-proposal` | (none — returns a vote to the convener) |
| `designing-solution` | `mission design-set`, `evidence append --slot design-authority`, `gap set` |
| `deciding-on-approval` | `evidence append --slot decision-maker`, `task approve`, `phase-review append`, `mission-verdict append` |

---

## 5. User-invocable Commands and Read-only CLI

Two skills are user-invocable:

- `/mission` — the single entry point for mission work. Starts, continues, or resumes a mission; dispatches every other lifecycle skill.
- `/navigating-geas` — the framework map. Explains skills, CLI, and workflow. Safe to call any time; never writes.

Everything else in `skills/` is dispatched by `mission` and must not be invoked directly — sub-skills carry `user-invocable: false` in their frontmatter.

For inspecting `.geas/` state without going through a skill, a handful of CLI commands are read-only and safe to run manually:

| Command | What it shows |
|---|---|
| `geas context` | JSON summary of current `.geas/` state (active mission, phase, task counts). |
| `geas mission state --mission <mid>` | Mission spec + phase + task counts. |
| `geas task state --task <tid>` | Task contract summary + current lifecycle state + verify-fix iteration count. |
| `geas debt list` | Open / resolved debts across the project. |
| `geas schema list` | Embedded schema inventory. |
| `geas schema show <name>` | A single schema's JSON. |

All other writes to `.geas/` must flow through a skill-driven CLI call. Direct `Write` / `Edit` on files under `.geas/` is blocked by the `PreToolUse` hook (see `HOOKS.md`).

---

## 6. Cross-references

- `architecture/CLI.md` — full CLI contract, command surface, error codes.
- `architecture/DESIGN.md §7.5` — authoritative 17-skill catalog grouped by execution role.
- `protocol/01`–`protocol/08` — protocol layers the skills implement.
- `HOOKS.md` — hook surface and what runs automatically around skill invocations.
- `skills/{name}/SKILL.md` — per-skill body with the actual prompt text.
