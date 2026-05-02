# Dashboard (v3 Specification)

**Status.** Forward-looking specification. This document is written before Phase 3 implementation so that the upcoming rewrite of `src/dashboard/` has a concrete target. Soft-frozen during Phase 3 — minor refinements from implementation feedback are allowed, but structural changes should come back through a design round.

This spec defines *what* the dashboard shows, *what data it reads*, *how it degrades on missing inputs*, and *what it does not do*. It does not prescribe the exact framework or widget library; those are decided in the Phase 3 survey step.

---

## 1. Purpose

The dashboard is a read-only observer for a Geas project. Its reader is the developer or operator who wants a bird's-eye view of the state the CLI has persisted, without opening JSON files by hand.

It is *not*:

- An editor. No field on screen writes back to `.geas/`.
- A CLI wrapper. No button invokes `geas` commands.
- A multi-user surface. No authentication, no permissions, no remote access.
- A replacement for `geas context` / `geas state get`. Those give single-shot JSON; the dashboard gives an interactive, aggregated view.

The dashboard's value is in correlating artifacts (task state + evidence + gate runs + debts + events) and presenting them in views that answer questions the raw JSON does not answer directly.

---

## 2. Data Sources

The dashboard reads exclusively from the `.geas/` artifact tree produced by the CLI. It does not call `geas`, does not invoke hooks, and does not write anywhere.

### 2.1 Project-level files

| Path | Schema | Use |
|---|---|---|
| `.geas/debts.json` | `debts.schema.json` | Debt register view. |
| `.geas/events.jsonl` | (events contract — `architecture/CLI.md` §14.7) | Events timeline. |
| `.geas/memory/shared.md` | (free markdown) | Memory panel. |
| `.geas/memory/agents/{agent}.md` | (free markdown) | Memory panel. |

### 2.2 Per-mission files

Mission id pattern: `mission-YYYYMMDD-xxxxxxxx`. Each directory `.geas/missions/{mission_id}/` can contain:

| Path | Schema | Use |
|---|---|---|
| `spec.json` | `mission-spec.schema.json` | Mission overview. |
| `mission-design.md` | (free markdown) | Mission overview (optional). |
| `mission-state.json` | `mission-state.schema.json` | Mission overview, phase badge. |
| `phase-reviews.json` | `phase-reviews.schema.json` | Phase review history view. |
| `mission-verdicts.json` | `mission-verdicts.schema.json` | Mission overview (final verdict). |
| `deliberations.json` | `deliberation.schema.json` | Evidence/gate detail context. |
| `consolidation/gap.json` | `gap.schema.json` | Gap signals view. |
| `consolidation/memory-update.json` | `memory-update.schema.json` | Memory panel (changelog). |
| `consolidation/candidates.json` | (support artifact, not schema-validated) | Consolidation packet view. |

### 2.3 Per-task files

Under `.geas/missions/{mission_id}/tasks/{task_id}/`:

| Path | Schema | Use |
|---|---|---|
| `contract.json` | `task-contract.schema.json` | Task table, evidence gate status. |
| `task-state.json` | `task-state.schema.json` | Task table. |
| `implementation-contract.json` | `implementation-contract.schema.json` | Task detail. |
| `self-check.json` | `self-check.schema.json` | Evidence gate status. |
| `evidence/{agent}.{slot}.json` | `evidence.schema.json` | Evidence gate status, closure view. |
| `gate-results.json` | `gate-results.schema.json` | Evidence gate status. |
| `deliberations.json` | `deliberation.schema.json` | Evidence gate detail. |

### 2.4 Refresh semantics

The dashboard re-reads artifacts on demand. Minimum viable contract:

- Manual refresh on each view (explicit user action).
- Optional filesystem watcher on `.geas/` that debounces change events and invalidates cached artifacts.

Polling is acceptable as a fallback where the watcher is unavailable; poll interval must be configurable and default to ≥2 s to avoid thrashing.

---

## 3. Views

The dashboard organizes nine views. Each view is specified as: *what it shows*, *what it reads*, *how it aggregates*, and *how it degrades on missing or malformed inputs*.

### 3.1 Mission overview

**Shows.** For the selected mission: id, mode, phase, user-approval state, final verdict (if any), scope summary (from `mission-spec.scope`), counts of tasks by status, and the mission-design body if present.

**Reads.** `spec.json`, `mission-state.json`, `mission-design.md`, `mission-verdicts.json`, and summaries from `tasks/*/task-state.json`.

**Aggregates.** Task counts are grouped by the 9-state lifecycle (`drafted`, `ready`, `implementing`, `reviewing`, `deciding`, `passed`, `blocked`, `escalated`, `cancelled`).

**Edge cases.**
- `mission-state.json` missing → mission is rendered with phase `unknown` and a warning badge.
- `mission-design.md` missing → the design section is hidden (not an error).
- `mission-verdicts.json` missing or empty → final verdict area reads "not yet issued".

### 3.2 Task table

**Shows.** For the selected mission: one row per task with columns id, title (from `contract.goal`), current state, risk level, active agent, verify-fix iteration count, required reviewers summary, next expected transition.

**Reads.** All `tasks/*/contract.json` and `tasks/*/task-state.json` for the mission.

**Aggregates.** Sorted by state group (in-flight first, then terminal) then by id. Filterable by state, risk level, implementer.

**Edge cases.**
- A task directory missing `contract.json` → row shows id + "contract missing" and is flagged.
- A task directory missing `task-state.json` → state column reads `?` with a warning.
- A task in an unknown state (schema-invalid) → state rendered verbatim with a warning badge; row remains visible.

### 3.3 Evidence gate status

**Shows.** For a selected task: required reviewer slots and which ones have at least one evidence entry; last gate run verdict (`pass` / `fail` / `block` / `error`) and reason; most-recent `self-check.json` summary; links to each evidence file.

**Reads.** `contract.json` (routing), `self-check.json`, `evidence/{agent}.{slot}.json` for every slot, `gate-results.json`.

**Aggregates.** For each required reviewer slot, presence ∈ {present, absent}. Highlights the first missing slot blocking transition.

**Edge cases.**
- No gate run yet → the verdict area reads "gate not yet run".
- Evidence file absent for a required reviewer → that slot is highlighted as missing (not an error — this is the common pre-gate state).
- Schema-invalid evidence file → file is listed but flagged; verdict area reads "evidence malformed; see file".

### 3.4 Phase review history

**Shows.** For the selected mission: each appended phase review entry with from/to phases, status (passed / changes-requested / blocked), reviewer, verdict summary, timestamp.

**Reads.** `phase-reviews.json`.

**Aggregates.** Reverse-chronological (latest first). Filterable by phase or status.

**Edge cases.**
- File missing → empty state "no phase reviews recorded".
- Schema-invalid entry → skipped with a "1 malformed entry skipped" note.

### 3.5 Debt register

**Shows.** Project-wide debt entries with columns id, title, severity, status, owner, source mission, opened date, resolved date (if any).

**Reads.** `.geas/debts.json`.

**Aggregates.** Default filter: status = open. Groupable by severity or source mission.

**Edge cases.**
- File missing → empty state "no debts registered yet".
- Entry with unknown status → rendered with status verbatim and a warning.

### 3.6 Gap signals summary

**Shows.** For the selected mission: contents of `consolidation/gap.json` — each gap category (design, process, tooling, etc.) with entries.

**Reads.** `missions/{mid}/consolidation/gap.json`.

**Aggregates.** Groups by category; counts per category; links cross-referenced evidence.

**Edge cases.**
- File missing (pre-consolidation) → empty state with the text "mission has not entered consolidating phase yet".
- Empty `gap.json` (consolidation ran, no gaps) → explicit "no gaps surfaced" state.

### 3.7 Memory panel

**Shows.** Current `.geas/memory/shared.md` and `.geas/memory/agents/{agent}.md` bodies, plus the most recent mission's `consolidation/memory-update.json` changelog.

**Reads.** `.geas/memory/shared.md`, all `.geas/memory/agents/*.md`, the latest `missions/{mid}/consolidation/memory-update.json`.

**Aggregates.** Tabs by agent type; changelog shown as a diff-style list (added / modified / removed with `reason` and `evidence_refs` per entry).

**Edge cases.**
- Memory directory missing → empty state "no memory written yet".
- `memory-update.json` missing → changelog tab hidden; markdown tabs still render.

### 3.8 Events timeline

**Shows.** A chronological list of events with kind, actor, mission / task ids (when present), and a summary of the payload.

**Reads.** `.geas/events.jsonl`.

**Aggregates.** Default view: latest 100 entries. Filterable by kind, actor, mission, task. Entries with unknown `kind` are rendered verbatim without a predefined summary.

**Edge cases.**
- File missing → empty state "no events recorded".
- Malformed JSONL line → skipped silently; a footer reports the skipped-line count.
- `actor` with the `cli:auto` value is rendered as a distinct badge (per `architecture/CLI.md` §14.7); unrecognized actors are rendered verbatim.

### 3.9 Consolidation packet view

**Shows.** For a mission in or past `consolidating` phase: the `candidates.json` output of `geas consolidation scaffold` (debt candidates, memory suggestions, gap signals collected across the mission's evidence), alongside the official `debts.json` entries, `gap.json`, and `memory-update.json` that the orchestrator promoted from those candidates.

**Reads.** `consolidation/candidates.json`, `consolidation/gap.json`, `consolidation/memory-update.json`, `debts.json`.

**Aggregates.** Side-by-side: each candidate marked "promoted", "dropped", or "still pending" based on whether the orchestrator recorded a corresponding official entry.

**Edge cases.**
- `candidates.json` missing → view text reads "scaffold has not been run for this mission".
- No promotions yet → every candidate shows as "still pending" with no error.

---

## 4. UX Principles

1. **Graceful degradation.** A missing or malformed artifact is never fatal. The affected view or field is replaced with an explicit empty state or a warning badge; the rest of the dashboard keeps working.
2. **Read-only.** No on-screen action writes to `.geas/`. Copy-to-clipboard, open-in-editor, and similar external actions are acceptable; mutation is not.
3. **Schema-aware, not schema-rigid.** Parsers should read defensively (unknown fields preserved, enum values rendered verbatim when unrecognized). The schemas are the source of truth for validation, but the dashboard is a viewer — it never rejects a file.
4. **Fast startup.** First paint should not block on reading the whole artifact tree. Views lazy-load; the index page reads only a minimal summary.
5. **Offline, single-project by default.** A single project is the common case. If multi-project switching is added, each project is read from a local path the user selects.
6. **Explain, don't punish.** When something is missing, explain what the user would do next through the CLI rather than showing a generic error. Example: "Gate has not been run. Required reviewers still missing: risk-assessor." rather than "404 gate-results.json".

---

## 5. Non-goals

- No writes to `.geas/` of any kind.
- No invocation of `geas` CLI commands from the UI.
- No authentication / multi-user support / remote access.
- No analytics, usage collection, or background reporting.
- No task or evidence editing.
- No replacement for the CLI's own `context` and `state get` endpoints for scripting — the dashboard is for humans.
- No scheduled reports or emailed summaries.

---

## 6. Tech stack constraints

The Phase 3 survey step determines the concrete stack. The spec imposes the following constraints on whatever the survey picks:

1. Reads the `.geas/` tree from the local filesystem. No server component beyond what the UI runtime needs locally.
2. Handles both forward-slash and backslash paths produced on Windows vs POSIX without requiring user configuration.
3. Parses malformed JSON defensively. Crash on first parse error is not acceptable — the rest of the tree must still render.
4. Keeps the bundle reasonably small; the target is "single local viewer", not a platform.
5. Target UI is web-based (browser or local desktop shell) unless the Phase 3 survey finds a strong reason for a TUI. This is a preference, not a hard constraint.

Concrete implementation choices (framework, bundler, styling, widget library, filesystem-watch strategy) are settled in the Phase 3 design round and captured in a separate spec at that time.

---

## 7. Cross-references

- `architecture/CLI.md` — command surface that produces the artifacts the dashboard reads.
- `architecture/DESIGN.md` — artifact tree owners, events.jsonl scope.
- `protocol/08` — canonical artifact inventory and schema bindings.
- `SKILLS.md` / `HOOKS.md` — the other Phase 1 / Phase 2 surfaces that produce the state the dashboard renders.
