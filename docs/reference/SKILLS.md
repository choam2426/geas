# Skills Reference

Skills are the orchestrator's playbook. Each skill encodes a specific step of the Geas protocol (doc 02–07) as a prompt that can be read in-session and re-used across missions. Skills do not write `.geas/` directly — every write goes through the `geas` CLI. This reference describes the Phase 1 surface (v3): what skills exist, when each one runs, which CLI commands it invokes, and what it produces.

For the authoritative CLI contract, see `architecture/CLI.md`. This file is a consumer view — it does not repeat the CLI reference.

---

## 1. Skill Index

All skills live under `plugin/skills/{name}/SKILL.md`. The orchestrator (`mission`) is the session entry point; the other skills are invoked from it at defined phase transitions. `help` is the only user-facing skill besides `mission`.

| Skill | One-liner | Phase / trigger | User-invocable |
|---|---|---|---|
| `mission` | Drives the mission through specifying → building → polishing → consolidating. | Session entry point. | Yes — `/geas:mission` |
| `intake` | Freezes a mission spec through section-by-section approval. | specifying phase (once per mission). | No |
| `task-compiler` | Turns a scope slice into a TaskContract with verifiable acceptance criteria. | specifying (initial set) and mid-mission (in-scope additions). | No |
| `implementation-contract` | Pre-implementation agreement — implementer proposes actions, reviewers approve. | Right after `ready`, before first evidence write. | No |
| `scheduling` | Batches ready tasks for parallel execution under surface-conflict rules. | building phase when ≥2 tasks are ready. | No |
| `evidence-gate` | Runs Tier 0 / Tier 1 / Tier 2 and records a `gate-results` run. | After all required reviewer and verifier evidence is written. | No |
| `verify-fix-loop` | Bounded fix → re-verify loop driven by the last gate verdict. | Gate verdict is `fail`. | No |
| `vote-round` | Convenes a deliberation and appends a single recorded vote entry. | full_depth missions only, when a task or mission needs collective judgment. | No |
| `memorizing` | Rewrites `memory/shared.md` and `memory/agents/{type}.md` from task learnings. | consolidating phase. | No |
| `setup` | Initializes `.geas/` at the project root. | First turn in a fresh project. | No (called by `mission`) |
| `help` | Conversational explainer for geas usage. | Any time the user asks. | Yes — `/geas:help` |

Removed in v3 (present in v2 docs, gone now): `policy-managing`, `reporting`. Rule overrides and health reporting are no longer skill-owned surfaces.

---

## 2. Per-skill Details

### 2.1 `mission`

**Purpose.** The orchestrator. Runs in the main session — never spawn as a sub-agent. Reads the protocol directly and drives each phase through its sub-skills.

**When it runs.** Session entry, user invokes `/geas:mission`.

**CLI it invokes.**
- `geas setup` (if `.geas/` is missing) — via the `setup` skill.
- `geas mission create`, `geas mission approve`, `geas mission state` — mission artifact ops.
- `geas mission-state update --phase <phase>` — phase transitions.
- `geas phase-review append`, `geas mission-verdict append` — phase gate and final verdict.
- `geas task draft`, `geas task approve`, `geas task transition` — per task.
- `geas gate run` — after reviewer evidence is complete.
- `geas deliberation append --level mission|task` — via `vote-round`.
- `geas debt register`, `geas debt update-status` — during polishing / consolidating.
- `geas consolidation scaffold`, `geas gap set`, `geas memory-update set` — consolidating phase.
- `geas context`, `geas status` — situational awareness.

**Primary outputs.** Everything the mission produces — spec, design, task contracts, evidence chains, gate runs, verdicts, debts, gap, memory-update — all written through the CLI commands above.

### 2.2 `intake`

**Purpose.** Turn a natural-language request into an approved mission spec, an approved mission design, and an approved initial task set.

**When it runs.** Specifying phase, driven by the orchestrator. Proceeds section by section, one question at a time.

**CLI it invokes.**
- `geas mission create` — writes `spec.json` (initial).
- `geas mission design-set` — writes `mission-design.md` when the mission needs one.
- `geas mission approve` — marks user-approved.
- `geas task draft` — one call per initial task.

**Primary outputs.** `missions/{mid}/spec.json`, optional `missions/{mid}/mission-design.md`, the first set of `tasks/{tid}/contract.json` in `drafted` state.

### 2.3 `task-compiler`

**Purpose.** Produce a single TaskContract from a slice of mission scope: routing (concrete implementer + required reviewer slots), surfaces, verification plan, dependencies, baseline snapshot.

**When it runs.** During specifying for the initial task set, and mid-mission when the decision-maker approves an in-scope addition. User approval is required for out-of-scope additions (the decision-maker can only authorize within scope).

**CLI it invokes.**
- `geas task draft` — writes `contract.json` and initializes `task-state.json` (drafted).

**Primary outputs.** `tasks/{tid}/contract.json` plus a scaffolded `tasks/{tid}/task-state.json` and evidence directory.

### 2.4 `implementation-contract`

**Purpose.** Catch scope / requirement mismatch before any code is written. Implementer drafts `planned_actions`, `edge_cases`, and `demo_steps`; the quality specialist and the design authority review them.

**When it runs.** Immediately after `task transition --to ready` succeeds, before the first evidence append. Amendments during implementation use the same skill.

**CLI it invokes.**
- `geas evidence append --slot implementer` with `evidence_kind: plan-proposal` — the implementer's proposed actions.
- `geas evidence append --slot reviewer` with `evidence_kind: review` — reviewer approvals.

**Primary outputs.** Review-approved `plan-proposal` evidence entries under `tasks/{tid}/evidence/`.

### 2.5 `scheduling`

**Purpose.** Build parallel batches of `ready` tasks while honoring surface conflicts, critical-risk solo rules, and the baseline snapshot.

**When it runs.** Building phase, when ≥2 tasks are in `ready`.

**CLI it invokes.**
- `geas task state`, `geas mission state` — read-only inspection.

Scheduling is a batch decision. The orchestrator then dispatches implementers, and those implementers write through their own CLI calls.

**Primary outputs.** The orchestrator's dispatch plan for the current batch. Nothing written to `.geas/`.

### 2.6 `evidence-gate`

**Purpose.** Objective gate over whether a task's evidence is sufficient to close. Emits one of `pass` / `fail` / `block` / `error`.

**When it runs.** After every `contract.routing.required_reviewers` slot has an evidence file with ≥1 entry, and every verifier (if any) has run.

**CLI it invokes.**
- `geas gate run` — records the run in `gate-results.runs`. The response carries a `suggested_next_transition` hint; the orchestrator decides whether to follow it.

**Primary outputs.** New entry in `tasks/{tid}/gate-results.json`.

### 2.7 `verify-fix-loop`

**Purpose.** Bounded fix → re-verify loop when the gate returns `fail`. Reads `verify_fix_iterations` from `task-state.json`, dispatches the implementer with concrete failure context, then re-runs `evidence-gate`. Budget exhaustion escalates.

**When it runs.** The last `gate run` returned `verdict: fail`. Does not run on `block`, `error`, or `pass`.

**CLI it invokes.**
- `geas task-state update` — iteration bookkeeping.
- `geas evidence append --slot implementer` with `evidence_kind: implementation` — new attempt.
- `geas gate run` — re-runs the gate each iteration.
- `geas task transition --to escalated` — on budget exhaustion.

**Primary outputs.** New implementation evidence entries, new `gate-results.runs` entries, possibly an `escalated` transition.

### 2.8 `vote-round`

**Purpose.** Thin convening wrapper over `geas deliberation append`. Spawns the voters, collects their agree / disagree / escalate votes with rationale, and appends a single deliberation entry.

**When it runs.** `mission.mode == full_depth` only — the CLI enforces this. Task-level triggers: conflicting reviewer verdicts, challenger objection, non-obvious rewind target. Mission-level triggers: per doc 02 (design forks, strategic decisions).

**CLI it invokes.**
- `geas deliberation append --level mission|task [--task <tid>]`.

**Primary outputs.** One new entry in `deliberations.entries`. Challenger is a required voter.

### 2.9 `memorizing`

**Purpose.** Rewrite `memory/shared.md` and `memory/agents/{type}.md` from the mission's collected `memory_suggestions` and closure retrospectives. Full-replace semantics (not patch) — the skill composes the new file, the CLI atomically replaces it.

**When it runs.** Consolidating phase.

**CLI it invokes.**
- `geas memory shared-set` — full replace of `memory/shared.md`.
- `geas memory agent-set --agent <type>` — full replace of `memory/agents/{type}.md`.
- `geas memory-update set` — writes the semantic changelog (markdown and changelog are paired per doc 07).

**Primary outputs.** Rewritten memory markdown files and `missions/{mid}/consolidation/memory-update.json`.

### 2.10 `setup`

**Purpose.** Bootstrap the `.geas/` tree per doc 08. Idempotent; safe to re-run.

**When it runs.** First turn in a fresh project. The orchestrator may invoke it defensively when `.geas/` is missing.

**CLI it invokes.**
- `geas setup` (only).

**Primary outputs.** `.geas/` skeleton (empty `missions/`, `memory/`, `events.jsonl` header, etc.).

### 2.11 `help`

**Purpose.** Conversational explainer. Reads `.geas/` state if present and answers usage / concept questions in markdown.

**When it runs.** User invokes `/geas:help`.

**CLI it invokes.** None for writes. May call `geas context` or `geas status` to ground its answer.

**Primary outputs.** Markdown response in chat only. No files written.

---

## 3. Skill → CLI Map

Fast lookup. For command details (flags, JSON shape, failure modes), see `architecture/CLI.md`.

| Skill | CLI commands (canonical) |
|---|---|
| `mission` | all mission-level + task-level + memory + debt + gap + memory-update + event + status + context |
| `intake` | `mission create`, `mission design-set`, `mission approve`, `task draft` |
| `task-compiler` | `task draft` |
| `implementation-contract` | `evidence append` (plan-proposal, review) |
| `scheduling` | `task state`, `mission state` (read-only) |
| `evidence-gate` | `gate run` |
| `verify-fix-loop` | `task-state update`, `evidence append`, `gate run`, `task transition --to escalated` |
| `vote-round` | `deliberation append --level mission|task` |
| `memorizing` | `memory shared-set`, `memory agent-set`, `memory-update set` |
| `setup` | `setup` |
| `help` | `context`, `status` (read-only) |

---

## 4. Troubleshooting — Read-only CLI for Users

Most of the CLI is internal plumbing, invoked by skills. A handful of commands are safe for users to run manually when they want to inspect state without going through a skill.

| Command | What it shows |
|---|---|
| `geas context` | JSON summary of current `.geas/` state (active mission, phase, task counts). |
| `geas status` | Active mission phase, active tasks with state and agent, pending queues. Read-only. |
| `geas mission state --mission <mid>` | Mission spec + phase + task counts. |
| `geas task state --task <tid>` | Task contract summary + current lifecycle state + iterations. |
| `geas debt list` | Open / resolved debts across the project. |
| `geas schema list` | Embedded schema inventory. |
| `geas schema show <name>` | A single schema's JSON. |
| `geas validate` | Re-validate the entire `.geas/` tree against schemas. |

The only user-level writes supported outside a skill-driven flow are the memory rewrites:

- `geas memory shared-set` — overwrite `.geas/memory/shared.md` with markdown from stdin.
- `geas memory agent-set --agent <type>` — overwrite `.geas/memory/agents/{type}.md`.

Everything else in `.geas/` must go through a skill-driven flow. Direct `Write` / `Edit` on files under `.geas/` is blocked by the `PreToolUse` hook (see `HOOKS.md`).

---

## 5. Cross-references

- `architecture/CLI.md` — the full CLI contract, command surface, and error codes.
- `architecture/DESIGN.md` — how skills relate to the protocol layers.
- `protocol/02` through `protocol/07` — the authoritative specifications the skills implement.
- `HOOKS.md` — hook surface and what runs automatically around skill invocations.
- `plugin/skills/{name}/SKILL.md` — per-skill body with the actual prompt text.
