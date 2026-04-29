# Changelog

All notable changes to this project are documented in this file.

> **Note**: Tags were restructured in v0.5.1. Previous major versions (v1.x, v2.x) have been flattened to v0.x.y to reflect that the project is pre-1.0.

## [2.1.1] — 2026-04-29

**Dispatch policy relaxation.** The 2.1.0 formal `high-capability / balanced / fast` tier vocabulary documented tier→harness-model resolution as "out of scope" with no actual passing path, so every spawn fell through to "inherit the orchestrator's own model" — observed empirically as a single mission running 12/12 specialist spawns on the orchestrator's Opus instead of the intended balanced choice. This patch drops the formal tier system in favor of vendor-neutral orchestrator-judgment guidance keyed off slot family + task `risk_level`. No protocol-surface changes (schemas, lifecycle, dispatcher interface, agent frontmatter, CLI all unchanged); no new CLI subcommand or config artifact.

### Changed

- `scheduling-work/SKILL.md` Dispatch Model section rewritten. Formal `high-capability / balanced / fast` tier vocabulary and the "tier-to-model resolution is out of scope" fall-through removed. Defaults now expressed as intent ("the most capable model the harness exposes" for authority slots, "a balanced choice" for specialist slots). High/critical specialist promotion preserved as a "lift" toward the most-capable end. Per-task override preserved as contract prose. Vendor neutrality clause added: failing to pass an explicit per-spawn override is a dispatch bug, not documented behavior.
- `running-gate/SKILL.md` Dispatch Model section mirrors the new vocabulary; verify-fix re-dispatch inherits the orchestrator's choice.
- `convening-deliberation/SKILL.md` voter-dispatch instruction (Process step 2) mirrors the new vocabulary.

## [2.1.0] — 2026-04-29

**UX + CLI ergonomics release.** Errors framework + scalar default for the CLI, inline flags on every payload-taking write command, slot-aware dispatch tiers, risk-tiered retry budget, Korean narrative briefings, and a `specifying-mission` flow rework that aligns with protocol spawn boundaries.

### BREAKING

- **CLI default-mode error path is now scalar stderr.** `--format json` keeps the structured envelope, but the envelope shape changes too: the legacy `emit/err/ok/EXIT_CODES` exports are removed and every write command routes through the new errors framework.
- **`append_only_violation` error code folded into `guard`.** Guard hint payloads are now string-shaped (was an object).
- **`.geas/.tmp/` → `.geas/tmp/`.** `paths.tmpDir()` returns `.geas/tmp`. Hook `geas-write-block.js` rewritten with POSIX-normalized segment-walk so `.geas/tmp/<file>` is allowed and every other `.geas/` path (including the legacy `.geas/.tmp/`, prefix imitations like `.geas/tmpfoo`, and traversal escapes) is blocked. No migration path — start fresh.

### Added

**CLI**
- Output formatter, errors framework, and global `--format` flag — scalar default, JSON opt-in. Scalar formatters registered for `context`, `setup`, `state`, `event log`, and `schema` subcommands.
- **Inline flags on every payload-taking write command** so prose bodies don't have to round-trip through bash heredocs: `mission create`, `task draft`, `evidence append`, `self-check append`, `debt register`, `memory shared-set`, `memory agent-set`, `deliberation append`. Stdin and `--file` retained as fallbacks.
- `task base-snapshot set` — set/replace task base snapshot SHA out of band.
- `task deps remove` — strip dependencies (e.g. when a dep is cancelled) without rewriting the contract.
- **Risk-tiered retry budget** in `transition-guards.ts`: `RETRY_BUDGET_BY_RISK` (low=1, normal=2, high=2, critical=3), enforced on every `reviewing → implementing` rewind. Unknown risk falls back to `normal=2`. CLI guard hint surfaces risk_level + iterations and routes exhausted budgets to `blocked` or `escalated`.

**Skills**
- **Slot-aware Dispatch Model** in `scheduling-work/SKILL.md`: 3-tier vocabulary `high-capability / balanced / fast`. Authority slot defaults to high-capability; specialist slot defaults to balanced; high/critical specialist tasks promote to high-capability; per-task contract may override either. Tier→concrete-model resolution is left to the orchestrator. Cited from `running-gate` (verify-fix re-dispatch) and `convening-deliberation` (voter dispatch).
- **Reviewer selection rule** in `drafting-task/SKILL.md` step 7: default reviewer set = `risk-assessor + operator + communicator`. Challenger only when (a) `risk_level ≥ high`, (b) the task affects a protocol surface, or (c) the user explicitly requests it. Replaces the prior auto-attach challenger pattern.
- **Korean narrative briefings.** 4 user-facing briefings (current-status, task-completion, phase-transition, mission-verdict) rewritten as Korean narrative templates with a jargon allowlist. `mission/SKILL.md` emission steps + `closing-task` step 6 + `reviewing-phase` step 5 + `verdicting-mission` step 6 cite the templates by section.
- **Tmp file lifecycle** section in `mission/SKILL.md` documenting `.geas/tmp/` staging, sub-skill cleanup, dispatcher bulk cleanup at `verdicting-mission` + `phase-review`, and the hook allowlist scope. Cross-link sentences added to 5 task-side skills.
- **`specifying-mission` flow rework**: pre-scan reframe, unified review batching of mode+proceed, separate set-audit removed. Aligned with protocol spawn boundaries — design-authority spawned for mission-design and task-set authoring, decision-maker spawned for standard-mode review.
- **`drafting-task` spawn boundary**: dep preflight folded into the card render with options branched on the preflight outcome. New IN-8 preflight added.
- `mission/SKILL.md` dispatch table augmented with the `implementing → reviewing` transition row and reviewer/verifier dispatch rows.

**Tests**
- End-to-end lightweight mission walkthrough integration fixture (T5.2).
- 4 retry-budget unit tests in `g3-task.test.js` (one per risk_level). Suite at 245/245 pass.
- New `geas-write-block.test.js`: 8 tests (6 contract cases + 2 regressions) for `.geas/tmp/` allowlist semantics.
- Briefing-snapshot fixture asserting AC5 + structural-invariant for emission SKILL.md (T4).
- 3 grep fixtures asserting T3 SKILL.md migration.
- Binary fixture asserting legacy `emit/err/ok/EXIT_CODES` exports removed.

### Changed

- All 14 agent files drop `model:` frontmatter; agents now inherit the orchestrator model unless dispatch overrides.
- 7 spawned-agent + 4 dispatcher-side + 2 mission-level SKILL.md migrated to inline-flag CLI form. `consolidating-mission` stdin-pipe memory writes replaced with inline-flag form; `deliberating-on-proposal` phantom CLI subcommand refs corrected.
- 13 `<workspace>/.tmp/` references across 6 skills (`designing-solution`, `deciding-on-approval`, `verdicting-mission`, `reviewing-phase`, `consolidating-mission`, `implementing-task`) replaced with `.geas/tmp/`.
- Skill bodies made harness-agnostic: `AskUserQuestion` / `TodoWrite` / `EnterPlanMode` / `ExitPlanMode` / `PreToolUse` references in `specifying-mission`, `drafting-task`, `mission` SKILL.md replaced with abstract phrasing (`structured single-choice prompt`, `structured-prompt round`, `structured-prompt sequence`, `pre-tool-use write-block hook`).
- Platform-specific `opus` / `sonnet` model names in `scheduling-work` / `running-gate` / `convening-deliberation` Dispatch Model sections replaced with the tier vocabulary above.
- 3 `docs/` cross-links removed from skill bodies (`scheduling-work` L50, `running-gate` L101 + L116) so the runtime constraint "skills cannot access `docs/`" holds.
- Pre-defined plugin permissions removed from `plugin/plugin.json` — defer to user / local settings.
- `docs/{ko/,}architecture/CLI.md` synchronized with mission inline-flag + scalar-default error + envelope changes.
- `plugin/bin/geas` bundle regenerated; CLI version `0.13.0` → `0.14.0`; `plugin.json` + `marketplace.json` version `2.0.0` → `2.1.0`.

### Fixed

- Hook scripts and bundled `plugin/bin/geas` binary now have the executable bit set.
- Dashboard: unused Toast infrastructure removed.
- README Dashboard section updated for v2.0.0 console direction; per-sub-tab + Debt/Memory screenshots mirrored to the English README.

## [2.0.0] — 2026-04-23

**Major release — Protocol v3 clean rewrite + Skill layer redesign.**

This release replaces the entire implementation stack (CLI, skills, agents, hooks, dashboard) with protocol v3 semantics. The v1/v2 artifact model, CLI surface, and skill catalog are removed in full. Existing `.geas/` directories from v1.x are not supported; start fresh.

### BREAKING

- **Protocol v3 replaces v1/v2.** 4-phase mission lifecycle (`specifying` / `building` / `polishing` / `consolidating` → `complete`), 9-state task lifecycle (`drafted` / `ready` / `implementing` / `reviewing` / `deciding` / `passed` / `blocked` / `escalated` / `cancelled`), 3 operating modes (`lightweight` / `standard` / `full_depth`), slot-based agent model (4 authority + 5 specialist slots). 14 JSON Schemas replace the prior set.
- **CLI command surface replaced.** All v1.x commands removed: `lock`, `packet`, `recovery`, `health`, `evolution`, `decision`, `retrospective-draft`, `advance`, `harvest-memory`, `check-artifacts`, `closure-assemble`, `revalidate`, positional `task create` / `task add-acceptance` / `task add-surface` / `task set-risk` / `evidence submit` / `task record`, `mission create TITLE --done-when`, `phase write`. New v3 commands: `setup`, `context`, `schema`, `state`, `mission create|approve|state`, `mission-state update`, `phase-review append`, `mission-verdict append`, `task draft|approve|transition|deps|state`, `evidence append`, `self-check append`, `gate run`, `deliberation append`, `memory shared-set|agent-set`, `debt register|update-status|list`, `gap set`, `memory-update set`, `event log`.
- **Artifact paths replaced.** Per-mission at `.geas/missions/{mission_id}/`: `spec.json`, `mission-state.json`, `phase-reviews.json`, `mission-verdicts.json`, `deliberations.json`, `consolidation/gap.json`, `consolidation/memory-update.json`, `consolidation/candidates.json`, `tasks/{task_id}/{contract,task-state,self-check,implementation-contract}.json`, `tasks/{task_id}/deliberations.json`, `tasks/{task_id}/gate-results.json`, `tasks/{task_id}/evidence/{agent}.{slot}.json`. Project-level: `.geas/debts.json` (append-only ledger, replaces mission-scoped carry-forward), `.geas/events.jsonl` (best-effort telemetry, never rolls back primary writes), `.geas/memory/{shared.md,agents/{agent_type}.md}`. (No top-level `candidates.json` — consolidation candidates are mission-scoped.)
- **Removed v2 concepts**: `rules.md`, `policy-override`, `lock-manifest`, `recovery-packet`, `decision-record`, `health-check`, `evolving` phase, mission-scoped carry-forward debt, `pipeline_step`, `run-state`, `scheduler_state`, `recovery_class`, `design-brief`, `checkpoint_phase`, `rules-update`.
- **Skill catalog replaced (17 skills).** All 11 prior skills removed or rewritten. User-invocable surface narrowed to 2: `/mission` (dispatcher) and `/navigating-geas` (help). The other 15 are `user-invocable: false` sub-skills dispatched by `/mission`.
- **Agent directory reorganized.** `plugin/agents/authority/product-authority.md` renamed to `decision-maker.md` (v3 slot name, kebab-case canonical). Specialist roles in `plugin/agents/software/` and `plugin/agents/research/` re-slotted: `qa-engineer` → verifier, `security-engineer` → risk-assessor, `technical-writer` → communicator, `methodology-reviewer` → verifier, `research-integrity-reviewer` → risk-assessor, `research-engineer` → operator, `research-writer` → communicator.
- **Hook set trimmed.** `hooks.json` reduced to SessionStart + SubagentStart + PreToolUse. Deleted scripts: `calculate-cost.sh`, `checkpoint-pre-write.sh`, `checkpoint-post-write.sh`, `packet-stale-check.sh`, `protect-geas-state.sh`, `integration-lane-check.sh`, `restore-context.sh`.
- **Reference docs restructured.** `docs/{ko/,}reference/CLI.md` deleted (CLI is internal plumbing, not user-facing). `SKILLS.md`, `HOOKS.md`, `DASHBOARD.md` rewritten for v3.
- **Dashboard rebuilt.** Rust backend (`src/dashboard/src-tauri/`) models + commands + watcher replaced with v3 artifact readers. React frontend reads via a new `src/dashboard/src/lib/geasClient.ts` single wrapper. Deleted v2-only components: `RulesViewer`, `DebtPanel`, `DebtBadge`, `ProjectOverview`.
- **Task state rename.** `reviewed` → `reviewing`, `verified` → `deciding`. The old names captured the *completed* activity; the new names capture the *ongoing* state the task occupies, matching protocol doc 03 prose. Cascade hit schemas, CLI guards + commands, tests, skills, agent frontmatter, dashboard, reference docs.
- **Self-check model.** `self-check.json` is now an append-only `entries[]` envelope (one entry per implementer pass), not a write-once artifact. `geas self-check set` removed; new `geas self-check append` is the only writer. Each entry carries `entry_id` + `created_at` + optional `revision_ref`. Verify-fix re-entry appends another entry rather than rejecting the second call.
- **`impl-contract set` writable state narrowed.** Previously accepted `ready` OR `implementing`; now only `implementing`. The implementer is spawned into `implementing` and owns the plan artifact throughout that state — there is no pre-code concurrence gate. Header comment + docs + 6 tests updated.
- **Gate computes tier statuses itself.** `geas gate run` reads implementation-contract + self-check + evidence files directly and derives each tier's status. Callers no longer submit a tier payload; the command takes no stdin. Tier 1 verdict mapping: `approved→pass`, `changes_requested→fail`, `blocked→block`; worst-wins across multiple verifier files.
- **Event semantics clarified.** `events.jsonl` append is best-effort — if logging fails (disk full, transient permission error), the primary artifact write is not rolled back and the command still returns `ok`. CLI.md and HOOKS.md previously contradicted each other on this; both now match the implementation. HOOKS.md event-kind table expanded to cover all 21 emitted kinds.

### Added

**CLI**
- `src/cli/src/lib/` primitives: `fs-atomic` (temp+rename), `paths` (v3 `.geas/` tree builders), `schema` (Ajv draft 2020-12 + `ajv-formats`), `envelope` (`{ok, data, error}` + automation events.jsonl auto-append), `transition-guards` (mission 5-state + task 9-state FSMs, evidence-aware guards).
- `lib/schemas-embedded.ts` auto-generated from `docs/schemas/*.schema.json`; hash-drift detection test.
- Env mocks: `GEAS_MOCK_MISSION_ID`, `GEAS_MOCK_TASK_ID` for deterministic tests.
- Evidence `(agent, slot)` uniqueness guard. Agent-slot independence enforced (implementer is exclusive; reviewer/verifier combinations allowed per protocol).
- Deliberation mode guard: append permitted only when `mission-spec.mode == full_depth`.
- Project-level debts.json with `mission_id` on every entry.
- events.jsonl with CLI-injected `entry_id` and `timestamp`; actor enum (slot ids + `user` + `cli:auto`).

**Tests**
- `src/cli/test/` integration suite: `schema-drift`, `g1-foundation`, `g2-mission`, `g3-task`, `g4-evidence`, `g5-memory`, `g6-debt-gap`, `g7-events`, `e2e-phase1` (4 scenarios: main path + blocked + verify-fix + full_depth deliberation), `legacy-sweep` (14 retired terms). 109 tests total.
- `test/helpers/setup.js` shared fixtures with `makeTempRoot`, `runCli`, `readArtifact`.

**Skills (17 total)**
- User-invocable: `mission` (dispatcher — bootstrap, state inspection, drift detection, phase-aware dispatch, briefing generation), `navigating-geas` (skill catalog + CLI + workflow guide).
- Mission lifecycle: `specifying-mission`, `drafting-task`, `scheduling-work`, `running-gate`, `closing-task`, `reviewing-phase`, `consolidating-mission`, `verdicting-mission`.
- Multi-party: `convening-deliberation` (spawns voters).
- Spawned agent procedures: `implementing-task`, `reviewing-task`, `verifying-task`, `deliberating-on-proposal`, `designing-solution`, `deciding-on-approval`.
- Every SKILL.md follows a 10-section template (Overview / When to Use / Preconditions / Process / Red Flags / Invokes / Outputs / Failure Handling / Related Skills / Remember), ≤200 lines body, ≥3 rationalization entries in Red Flags.
- Korean briefing templates for current-status / task-completion / phase-transition / mission-verdict in `plugin/skills/mission/references/briefing-templates.md`.

**Dashboard**
- `src/dashboard/src/lib/geasClient.ts` — single Tauri `invoke` wrapper for all artifact reads.
- Graceful degradation on missing/malformed artifacts.
- **"Console" direction reskin.** Terminal-inspired dark theme with phosphor-green accent, JetBrains Mono for IDs / paths / timestamps + Inter for prose. New design-token layer in `index.css @theme` (`--bg-0..2`, `--fg / muted / dim`, 5 accent families with translucent surface variants).
- **New shell.** Vertical flex — `TopBar` (logo + breadcrumb + phase pill) / `Sidebar` (project list, kept) / main / `StatusBar` (file-watcher status + real counts). `PathBadge` (click-to-copy `.geas/` path sticker) + `Pill` primitives used across the app.
- **Dashboard view = mission list** (active + past inline, resolved collapsed by default). `MissionHistory` absorbed; standalone `history` route removed.
- **MissionDetailShell with 5 sub-tabs**: `overview` / `spec` / `design` / `kanban` / `timeline`. `MissionSpecTab` renders the frozen `mission-spec.json` as structured key/value blocks with typed scalar cues; `MissionDesignTab` renders `mission-design.md` via `react-markdown` with a sticky decision-log sidebar sourced from phase-review verdicts; Kanban + Timeline embed inside the shell via an `embedded` prop.
- **TaskDetailModal expansion**: header `PathBadge`, acceptance-criteria list, implementation-contract full view, self-check (latest-of-N), gate tier drill-down, evidence timeline with per-entry detail, deliberations, deps-stack navigation (clicking a dependency pushes the current task, ESC pops).
- **Debt + Memory views restyled** with the new tokens, status-tab filter + severity chips (debt), shared / per-agent / changelog channels (memory).

**Implementing-task skill**
- New Process step 5 — "Clean up work byproducts before evidence." Scratch files, abandoned code paths, debug output, commented alternatives, unused imports, completed TODO markers must be removed before the implementation evidence + self-check land. `.geas/` runtime artifacts are explicitly exempt (they are the audit trail). Intentionally preserved byproducts must be recorded in `scope_examined` or `deviations_from_plan`. New Red Flag row enforces the same.

**CLI**
- `--file <path>` option added to every payload-taking command (`mission design-set`, `task draft`, `impl-contract set`, `evidence append`, `self-check append`, `deliberation append`, `phase-review append`, `mission-verdict append`, `gap set`, `memory-update set`, `memory shared-set`, `memory agent-set`, `debt register`, `event log`). Preferred over stdin because bash heredocs break on apostrophes / quotes / non-ASCII inside prose bodies. Stdin still accepted as a fallback.

**Docs**
- `docs/{ko/,}architecture/DESIGN.md §7.5` rewritten to enumerate the 17-skill catalog (user-invocable 2 / mission lifecycle 8 / multi-party 1 / spawned 6) with bilingual sync.
- `docs/{ko/,}reference/{SKILLS,HOOKS,DASHBOARD}.md` rewritten for v3 surfaces with EN/KO structural parity.
- Protocol v3 docs at `docs/{ko/,}protocol/00-08` and 14 schemas at `docs/schemas/` already synced prior; this release aligns the implementation.

### Changed

- **Evidence gate** — Tier 0/1/2 structure preserved, contents re-scoped to v3: Tier 0 = required artifact + required reviewer evidence presence, Tier 1 = `verification_plan` execution, Tier 2 = contract + reviewer-verdict judgment. Gate verdicts `pass|fail|block|error`; reviewer verdicts `approved|changes_requested|blocked` (separate layer).
- **Task routing** — `routing.required_reviewers` narrowed to 4 review-producing slots (`challenger`, `risk-assessor`, `operator`, `communicator`). Verifier is implicit; `primary_worker_type` is a concrete agent type (kebab-case).
- **Orchestration model** — single entry point `/mission`; no manual sub-skill invocation. Deterministic dispatch replaces auto-trigger routing.
- **Identifiers unified to kebab-case** — `decision-maker` (not `decision_maker` or `product-authority`) across frontmatter, enums, and event actor namespace.
- **Memory model** — `shared.md` (project-wide) + `agents/{agent_type}.md` (per concrete agent type). Writes via `geas memory shared-set` / `agent-set` with full-replace atomic semantics.
- **Self-check and closure** — now first-class evidence: `self-check.json` (one per task, write-once), closure as `evidence/orchestrator.orchestrator.json` entry with `evidence_kind=closure`, `verdict=approved`.
- **Task-state lifecycle** — status field moves from contract to runtime state (`task-state.json`). Contract remains immutable after approval.
- **Mission spec immutability** — after `geas mission approve`, the spec is frozen. No amendment path; scope changes require a new mission.
- `plugin/bin/geas` bundle regenerated. CLI version bumped through `0.9.0` → `0.10.0` → `0.11.0` → `0.12.0` → `0.13.0` as groups landed.
- `plugin.json` version → `2.0.0`.
- **`transition-guards.ts`** — `implementing → reviewing` guard drops reviewer-evidence check (moved to gate Tier 0 inside the `reviewing` state). `reviewing → deciding` reads the last gate run verdict directly.
- **Reviewer routing** — `required_reviewers` set at contract time. Verifier slot remains implicit (every task has one regardless).

### Removed

- CLI commands: `lock`, `packet`, `recovery`, `health`, `evolution`, `decision`, and all v1.4-era positional shortcuts (`task create TITLE`, `task add-acceptance`, `task add-surface`, `task set-risk`, `evidence submit`, `task record`, `mission create TITLE --done-when`, `phase write`).
- CLI lib files: `post-write-checks.ts`, `field-policy.ts`, `schema-template.ts`, `dry-run.ts`, `cwd.ts`, `output.ts`, `types.ts`, `check-field-policy.ts`.
- Schemas: `health-check.schema.json`, `lock-manifest.schema.json`, `policy-override.schema.json`, `recovery-packet.schema.json`, `run-state.schema.json`, `record.schema.json`, `vote-round.schema.json` (replaced by 14 v3 schemas).
- Skills: `evidence-gate`, `help`, `implementation-contract`, `intake`, `memorizing`, `policy-managing`, `reporting`, `scheduling`, `setup`, `task-compiler`, `verify-fix-loop`, `vote-round`.
- Agents: `plugin/agents/authority/product-authority.md` (renamed to `decision-maker.md`).
- Hooks: 7 legacy scripts listed above. `hooks.json` Stop and PostToolUse / PostCompact entries.
- Reference docs: `docs/reference/CLI.md`, `docs/ko/reference/CLI.md`.
- Prior DEBT-001 through DEBT-012 tracking comments — obsoleted by the clean rewrite; reopen as needed against the new artifact shapes.

### Fixed

- **`geas task draft` scaffold gap** — task-level `deliberations.json` wrapper was not created at draft time; now scaffolded identically to the mission-level wrapper (CLI.md §14.1 compliance).
- **Guard tightening** — transition guards moved from file-presence stubs to real verdict-aware checks: `selfCheckExists` schema-validates; `reviewEvidenceExists` checks `evidence_kind=review` per required slot; `verificationEvidenceExists` requires gate-results last run `verdict=pass` and `tier_results.tier_2.status=pass`; `closureApproved` requires orchestrator closure evidence with `verdict=approved`.
- **`geas mission design-set`** (CLI.md §14.2) — registered. Writes `missions/{id}/mission-design.md` via atomic full-replace; guarded to specifying phase + approved spec.
- **`geas consolidation scaffold`** (CLI.md §14.4) — registered. Walks all task evidence under a mission and writes `consolidation/candidates.json` with `debt_candidates`, `memory_suggestions`, `gap_signals` arrays; each item is stamped with `source_task_id` + `source_evidence_entry_id`. Convenience cache, not schema-validated. Guarded to polishing or consolidating phase.
- **`geas impl-contract set`** (CLI.md §3 + §71) — registered. Writes `tasks/{id}/implementation-contract.json` with schema validation + envelope injection. Guarded to `ready` or `implementing` task state (pre-implementation agreement). Full-replace semantics.
- **`geas schema template <type> --op <op> [--kind <k>]`** (CLI.md §12) — registered. Returns 3-part response (`you_must_fill` + `cli_will_inject` + `notes`) with op-aware envelope filtering; `--kind` selects the allOf branch for `evidence` (review / verification / closure). New `lib/envelope-fields.ts` maps `(schema, op)` pairs to envelope field lists.
- **`mission-state.active_tasks` recomputed on every task transition** — was previously only written at `task draft` time; now derived from current task-state files at each `geas task transition` so dashboard reads stay consistent with what the CLI enforces.
- **Dashboard file-watcher on Windows** — `std::fs::canonicalize` returns paths in the `\\?\` extended-length form, and `notify` silently drops events for some Windows configurations when watching prefixed paths. Strip the prefix before calling `watcher.watch()`; registry still stores the prefixed path for display.
- **Dashboard refresh cascade** — `ProjectRefreshContext` now exposes `bumpProject(path)`. The Sidebar refresh button calls it for every project, forcing every subscribed view (sub-tabs included) to re-fetch its own data. Previously manual refresh only reloaded the project list.
- **Dashboard shell robustness** — a refresh failure after a successful initial fetch no longer blanks the mission detail view; stale detail is kept on screen until the next refresh replaces it.
- **Dashboard overview tab refresh** — unified initial-mount and refresh-tick loaders into a single `load()` callback, closing a gap where the refresh tick forgot to re-fetch debts.
- **session-init hook** — read `phase` rather than the v2-era `mission_phase` key from `mission-state.json` (was silently producing empty status lines).
- **CLI.md surface drift** — removed stale documentation for `geas status` / `geas resume` / `geas validate` (never registered in `main.ts`); corrected operation taxonomy (`self-check` is `append`, `mission-design` is `set`); dropped the dedicated `§14.6 Status` section and renumbered down.
- **Consolidating-mission skill** — removed the stale `unknown command` fallback in Failure Handling (command has been registered for some time). Reference docs (`SKILLS.md`, `DESIGN.md`, EN + KO) now list `consolidation scaffold` as primary CLI with the mission-scoped `candidates.json` as a primary output.
- **Top-level `.geas/candidates.json` removed.** `geas setup` used to bootstrap an empty scratch file that no consumer read — actual consolidation candidates live per-mission at `missions/{id}/consolidation/candidates.json`. The `candidatesPath` helper + its tree-comment entry are gone; `g1-foundation` asserts the absence. `e2e-phase1` now drives `geas consolidation scaffold` explicitly and asserts the mission-scoped output exists, closing a test-coverage gap where the path the dashboard actually reads was never exercised end-to-end.

### Known Issues / follow-ups

- **`geas status` / `geas validate`** — retired from CLI.md rather than implemented. Status composes from `geas context` + `geas state get`; single-payload validation sits on `geas schema validate --type <t>`. No dispatcher or skill depends on the retired names.
- **Dashboard Rust-side tests** removed with the v3 rewrite; replacement suite deferred.
- **Skill lint automation** not yet in CI; checklist verified manually during this release.
- **Skill pressure-test harness** (obra-style adversarial eval) not yet implemented.
- **Docs parity test** not in CI — `legacy-sweep` covers `src/cli`, `plugin/skills`, `plugin/agents`, `plugin/hooks` but not `docs/reference` / `docs/architecture`. Stale `docs/architecture/CLI.md` text drifted undetected until caught by external review this release.
- **TaskDetailModal not file-watcher subscribed** — if the modal is open when `.geas/` changes, the rendered view is the snapshot at open time. Close + reopen to refresh. Minor; documented here as a known gap.

## [1.4.0] — 2026-04-15

### Added
- **Field policy registry** (`src/cli/src/lib/field-policy.ts`) — single source of truth for field classification across all 15 embedded schema types. Six classifications: `system`, `derived`, `defaulted`, `input`, `append_only`, `guarded`. Helper functions: `getEnvelopeEntry`, `getEnvelopeFields`, `getCliFlagFields`, `getStrippableFields`. Replaces ad-hoc `ENVELOPE_REGISTRY` / `ENVELOPE_FIELDS` / `CLI_FLAG_FIELDS` constants.
- **Build-time field-policy sync check** — `check-field-policy.ts` runs during `npm run build` and fails on schema/policy drift.
- **`geas task create TITLE --goal GOAL --kind KIND`** — positional task creation. Auto-generates `task-NNN` ID, writes contract with sensible defaults. Stdin JSON path preserved as fallback.
- **`geas task add-acceptance TASK_ID CRITERION`** — append acceptance criterion to existing contract.
- **`geas task add-surface TASK_ID PATH`** — append surface path to scope.
- **`geas task set-risk TASK_ID LEVEL`** — set risk_level with enum pre-validation (`low|normal|high|critical`).
- **`geas evidence submit <task> <role> [summary]`** — positional evidence creation. Required positional args enforced by Commander.
- **`geas task record self-check TASK SUMMARY --confidence N`** — write self_check section without raw JSON.
- **`geas task record gate TASK VERDICT`** — write gate_result section with verdict enum validation.
- **`geas mission create TITLE --done-when DESC`** — positional mission creation that scaffolds directory and writes `spec.json` in one step.
- **`geas phase write PHASE STATUS --summary STR`** — positional phase review writes.
- **Actionable validation diagnostics** — `validationError()` enriches Ajv errors with per-keyword `suggested_fix` (enum, required, additionalProperties, type, minLength) and `next_command` (`geas schema template <name>`).
- **`FIELD_ALIASES` + `normalizeAliases()`** in `input.ts` — alias map for `medium→normal`, `doc/docs→documentation`, `qa→qa-engineer`, `dev/sw→software-engineer`, etc. Exported for future caller integration.
- **Internal schema hiding** — `INTERNAL_SCHEMAS` Set filters `health-check` and `recovery-packet` from `geas schema list` and rejects them from `geas schema template`. Internal CLI code retains access via `SCHEMAS` map.

### Changed
- **Protocol docs reframed profile-first** — English (`docs/protocol/`) and Korean (`docs/ko/protocol/`) docs rewritten so domain (software/research/etc.) is a profile parameter rather than a hardcoded assumption. Single-domain examples replaced with 3-domain sets.
- **Schema slot-first routing** — `task-contract`, `record`, `recovery-packet`, `mission-spec` now use slot-based agent taxonomy. `_defs.schema.json` `agentType` replaced with slot-based vocabulary.
- **Evidence/record schemas neutralized** — software-specific vocabulary stripped to support multi-domain use.
- **Schemas slimmed** — envelope fields stripped from all artifact schemas (CLI auto-injects via field-policy). 5 unused schemas deleted; remaining 11 had timestamps/decorative fields removed.
- **Visual documentation overhaul** — diagrams added, CLI reference and Dashboard guide written, `DESIGN.md` rewritten.
- **`set-risk` enum aligned to schema** — `VALID_RISK_LEVELS` corrected from `medium` to `normal`.
- **`evidence submit` signature tightened** — `[task] [role]` (optional) → `<task> <role>` (required) so Commander enforces missing-arg errors.
- `plugin/bin/geas` bundle regenerated.
- `plugin.json` version bumped to 1.4.0.

### Fixed
- **Broken main build restored** — schemas-embedded.ts imported 5 schema files (`debt-register`, `lock-manifest`, `policy-override`, `run-state`, `vote-round`) that had been deleted in commit `3d9760f`. Files restored to fix `npm run build` on main.

### Known Issues (tracked as debt for next mission)
- `enrichTimestamp` injects `created_at`/`updated_at` into record.json root, conflicting with `additionalProperties: false` on subsequent writes (DEBT-004).
- `normalizeAliases` exported but not yet wired into command handlers (DEBT-006).
- Positional `task create` skips `injectEnvelope` unlike stdin path (DEBT-007).
- `--set` flag merged after schema validation, can bypass enum/range checks (DEBT-008).
- No unit tests for field-policy helpers (DEBT-001).
- CLI reference docs for new positional commands not yet written (DEBT-012).

## [1.3.1] — 2026-04-13

### Security
- **Command injection fix in `revalidate`** — `base_snapshot` validated as hex commit hash (`/^[0-9a-f]{4,40}$/i`), `execSync` replaced with `execFileSync` to prevent shell interpretation of untrusted input.

## [1.3.0] — 2026-04-13

### Added
- **`geas task check-artifacts`** — verify pipeline step artifacts exist with schema validation.
- **`geas task closure-assemble`** — assemble closure packets from evidence with 6 forbidden pass condition pre-checks.
- **`geas task revalidate`** — automate baseline staleness checks with freshness classification and semantic drift adjacency analysis.
- **`geas task retrospective-draft`** — auto-draft retrospectives from evidence and record sections.
- **`geas task advance`** — primary chain state transitions with guard pre-check, replacing multi-step manual `task transition` calls.
- **`geas task harvest-memory`** — batch-extracts `memory_suggestions` from task evidence files, deduplicates per-agent, and writes agent notes via shared `appendAgentNote` helper.
- **`geas task resolve`** — atomic task resolution bundle (transition + event log + lock release) with forward-only writes and idempotent behavior.
- **Dot-path `--set` for nested fields** — `--set a.b.c=value` creates nested objects; `--set a.b[0].c=value` supports mixed dot-bracket paths. Max depth 10, prototype pollution blocked at all segments.
- **`deepMergeSetOverrides` utility** — exported from `input.ts`, replaces `Object.assign` in `evidence add` and `task record add` callers to preserve sibling fields during nested `--set` overlay.
- **Schema template pipe workflow** — `geas schema template` output pipes directly to write commands. New flags: `--strip-envelope` (default: true), `--section <name>` for record sub-schemas, `--pretty` for human-readable output. New subcommand: `geas schema sections`.
- **`--dry-run` validation mode** — all 10 stdin-based write commands accept `--dry-run` to validate payloads without writing files. Structured JSON output with exit code 0 (valid) / 1 (invalid).
- **`--update-checkpoint` flag** on `geas event log` for step_complete events.
- **Contract amendment mechanism** — pipeline.md documents 5 material change conditions, DA re-approval flow, and amendment recording via `implementation_contract.amendments[]` array.
- **Semantic drift analysis** in pipeline.md staleness checks — adjacency-based content impact classification.
- **Workspace health check** before implementation in pipeline.md.
- **task_kind skip rules table** — systematic pipeline step skip logic for all 7 task_kind enums.
- **Risk-level concurrency gating** in building.md and scheduling — critical tasks require 4 Doc 04 independence conditions.
- **Cancellation record enrichment** — Doc 03's 4 required items in pipeline.md cancel path.
- **Self-check consumption paths table** in evidence-gate documenting all 6 Doc 05 routing paths.
- **Forbidden pass conditions** — pre-resolve check now enforces all 6 conditions from Protocol Doc 05.
- 19 new tests for dot-path nesting (14), deep merge (4), dry-run (5); total 68 tests.

### Changed
- Pipeline.md workspace operations abstracted to domain-neutral language. Git-specific commands moved to blockquote implementation notes.
- Rubric dimension names aligned to protocol: `feature_completeness` → `output_completeness`, `code_quality` → `output_quality` across all skill files.
- Evidence gate `artifact_only` profile: Tier 1 conditionally runs when `eval_commands` exist (previously unconditionally skipped).
- Gate sequence corrected: `reviewed → integrated` and `integrated → verified` are now separate transitions.
- Pipeline self-check data routed to reviewer context packets, QA plans, closure open_risks, and debt tracking.
- `appendAgentNote` extracted as shared helper from `memory.ts` for reuse by `harvest-memory`.
- Implementation-contract SKILL.md: added Amendment Flow section with 4-step process and Rule 6; field labels clarified (required vs recommended).
- `plugin/bin/geas` bundle regenerated.

### Fixed
- **Tester verdict enum** — corrected from `pass|iterate|escalate` to `pass|fail|block|error` in evidence-gate.
- **Pipeline.md cosmetic fixes** — worktree terminology, lock order justification, iterate verdict fields, challenger substantive challenge, baseline unknown classification, reviewer optional fields.
- **remaining_steps cleanup** — removed `post_integration_verification` from pipeline remaining_steps and task_kind skip table.

## [1.2.0] — 2026-04-11

### Changed
- CLI write commands now accept JSON only via stdin. `--data` and `--file` options are removed from `mission write-spec`/`write-brief`, `task create`/`record add`, `evidence add`, `decision write`, `phase write`, `recovery write`, and `evolution gap-assessment`/`rules-update`. Preserved as non-JSON value flags: `event log --data`, `context write --data`, `packet create --file`/`--content`.
- `readInputData()` is now 0-arg and reads stdin exclusively. It refuses to block on a real TTY (`isTTY === true`), emits NO_STDIN errors with heredoc/pipe/redirection examples, normalizes Windows `fs.readFileSync(0)` EAGAIN/EOF/UV_EOF, strips UTF-8 BOM, and returns line-hinted JSON parse errors.
- `evidence add` and `task record add` retain the `--set` fallback: empty stdin is accepted when `--set` flags are present.
- Plugin skills and agent docs (13 files, 20 sites) updated to use stdin heredoc/here-string examples.
- `plugin/bin/geas` bundle regenerated.

### Added
- 11 new `input.test.ts` cases covering TTY trichotomy, 0-byte stdin, invalid-JSON line hint (primary + fallback), Windows EAGAIN/EOF/UV_EOF, and BOM handling.

## [1.1.0] — 2026-04-11

### Added
- `geas schema list` — lists all available schema types (15 types)
- `geas schema template <type> [--role <role>]` — generates fill-in JSON templates from schema definitions; `--role` selects evidence role variants (implementer, reviewer, tester, authority)
- Validation error hints — `hints` field in VALIDATION_ERROR responses provides correct field names, allowed enum values, and required/optional status
- Envelope auto-injection — `version`, `artifact_type`, `producer_type`, `artifact_id` are automatically injected by the CLI; agents no longer need to provide these fields
- 18 regression tests for schema templates, envelope injection, and validation hints

### Changed
- Skills: inline schema templates removed from skill text, replaced with `geas schema template` CLI calls
- `task create` enforces `status: "drafted"` regardless of input value

## [1.0.1] — 2026-04-10

README rewrite, project structure cleanup, versioning fix.

### Changed
- README (en + ko) rewritten: icon hero, highlight cards, restructured sections, accurate pipeline/hook counts
- Evidence Gate tier descriptions corrected (Tier 0 Precheck / Tier 1 Mechanical / Tier 2 Contract+Rubric)
- Vote Round and Gap Assessment added to README feature list
- Korean README: natural tone, English section titles and technical terms
- CLAUDE.md simplified: removed migration history, merged redundant rules, removed derivable skill lists
- Project description updated across plugin.json and marketplace.json
- `dashboard/` moved to `src/dashboard/` for consistent source layout
- `marketplace.json` version fields removed (breaks `/plugin update` auto-detection)

### Fixed
- Pipeline step count: 14 → 15 across all docs (CLAUDE.md, DESIGN.md, orchestration.md, help SKILL.md)
- Hook count: 9 → 10 across all docs

## [1.0.0] — 2026-04-10

First stable release. Dashboard, progressive skill loading, domain flexibility, and full test-driven polish.

### Added
- **Tauri desktop dashboard** — real-time kanban board, timeline, memory browser, debt panel, toast notifications (Windows / Linux / macOS)
- Trivial task bypass — `/geas:mission` skips the full pipeline for obvious small fixes
- Session handoff suggestion at specifying→building boundary (5+ tasks)
- Progressive skill loading — SKILL.md reduced to 53-line router, orchestration rules loaded on demand
- Orchestrator reads its own memory note at startup
- `geas mission create` auto-generates mission ID when `--id` is omitted
- `geas evidence add --phase` flag for phase-level evidence (polishing, evolving)
- `rules.md` template with sub-agent rules: evidence by role, scope enforcement, review standards, knowledge sharing
- Schema field references in skills for 6 artifact types to prevent field name guessing
- Agent Review Protocols sections (7 agents) — single source for review checklists

### Fixed
- `enrichTimestamp` Windows path regex bug
- `geas task record add` now shallow-merges instead of replacing sections
- `format: "date-time"` Ajv warning removed
- `created_at` removed from required in all schemas (CLI auto-injects)
- Architecture transition table aligned with actual guard conditions
- `rules-update` producer_type conditional on status
- Design review clarified as not a task
- 66 snake_case agent type references converted to kebab-case
- Intake/design-brief field name mismatches with schemas

### Changed
- `domain_profile` is now a hint, not a hard constraint — mixed-domain missions supported
- Phase-level evidence stored in `polishing/evidence/` and `evolution/evidence/`
- Mission directory: removed `contracts/`, `packets/` (v3 remnants); added `polishing/`
- Agent-specific review checklists moved from skill prompts to agent.md
- Protocol 09: `producer_type` semantics clarified
- README rewritten with dashboard screenshots, feature list, help command

## [0.8.1] — 2026-04-10

Test session analysis fixes — schema friction, CLI usability, skill guidance.

### Fixed
- `format: "date-time"` removed from `_defs.schema.json` — suppresses Ajv `unknown format ignored` warning on every CLI validation
- `geas task record add` now shallow-merges into existing sections instead of replacing — partial updates (e.g., changing just `status`) no longer require resending all fields
- Redundant user confirmation at specifying→building transition removed
- Mission-spec field reference added to intake skill (`scope` is nested object, not flat `scope_in`/`scope_out`)
- Gap-assessment must be written before phase review — explicit ordering note in building.md
- `rules-update` `producer_type`: conditional on status — omit when `status: "none"`, required (domain authority) otherwise
- `producer_type` semantics clarified in protocol 09 (en + ko): the agent whose judgment produced the content
- Phase-level evidence stored in phase-specific directories (`polishing/evidence/`, `evolution/evidence/`) instead of creating pseudo-task directories (`tasks/polishing/`, `tasks/evolving/`)

### Changed
- `geas evidence add`: added `--phase` flag for mission-level evidence (mutually exclusive with `--task`)
- `geas mission create`: removed `contracts/`, `packets/`, `evidence/` subdirectories (v3 remnants); added `polishing/`
- `rules.md` template: sub-agent focused rules (evidence by role, scope enforcement, review standards)
- Orchestrator reads its own memory note (`.geas/memory/agents/orchestration-authority.md`) at startup
- Mission SKILL.md refactored to 53-line router with progressive loading — orchestration rules moved to `references/orchestration.md`, loaded only when full pipeline is needed
- Session handoff suggestion at specifying→building boundary (5+ tasks)
- Trivial task bypass — skip full pipeline for obvious small fixes
- Agent-specific review checklists moved from skill prompts to agent.md `Review Protocols` sections (7 agents, 5 skill files slimmed)
- Design review clarified as NOT a task — no contract or evidence, result lives in design-brief
- Knowledge sharing rule added to rules.md template — agents must update rules.md for cross-agent knowledge
- Design-brief field reference expanded: `depth` (not mode), `constraints` (array), `reviewer_type` (const)

## [0.8.0] — 2026-04-10

Schema alignment, Windows compatibility, flexible agent selection, and CLI improvements.

### Fixed
- `enrichTimestamp` Windows path regex bug — regex required leading `/`, failing on Windows paths like `A:/...`. Replaced with `includes`/`endsWith` pattern. Same fix applied to `checkScopeAndFrozenSpec` and `checkTaskPassedEvidence`.
- Intake skill field name mismatches with mission-spec schema: `risks` → `risk_notes`, `scope.surfaces` → `affected_surfaces`
- Intake skill `producer_type` example used snake_case (`orchestration_authority`) instead of kebab-case
- 66 snake_case agent type references across 17 skill/agent files converted to kebab-case per Agent Name Rule
- Design-brief field name mismatches: added schema field reference to specifying.md (`rejected_reason`, `description`, `design_review` structure)
- Added schema field references for recovery-packet, record (gate_result, closure, challenge_review), evidence, rules-update to prevent agent field name guessing

### Changed
- `created_at` removed from `required` in all 12 schemas — CLI auto-injects, agents no longer need to include it
- `domain_profile` is now a hint, not a hard constraint — orchestrator freely selects the best agent per task from the full agent pool. Mixed-domain missions (research + development) can use agents from any domain.
- `profiles.json`: `slot_mapping` renamed to `defaults` (semantic clarity)
- Slot resolution in pipeline/specifying/polishing: mandatory profile lookup replaced with best-fit agent selection
- Protocol 02 metadata table now maps conceptual field names to schema field names (en + ko)
- Intake skill: `created_at` no longer manually included — CLI auto-injects

### Added
- Optional `updated_at` field added to 13 schemas that have `created_at` (CLI auto-injects on file updates)
- `geas mission create` auto-generates mission ID when `--id` is omitted — orchestrators no longer need to generate IDs manually

## [0.7.0] — 2026-04-10

CLI restructure, pipeline enforcement, and process reliability improvements.

### Breaking
- CLI source moved from `plugin/cli/` to `src/cli/` (development only)
- CLI is now a pre-built single-file bundle at `plugin/bin/geas`
- `--cwd` flag no longer required for worktree agents (auto-detection via git)

### Changed
- CLI uses esbuild single-file bundle with embedded JSON schemas (no runtime fs reads)
- `resolveGeasDir` uses `git rev-parse --git-common-dir` to always find main repo `.geas/`, even in worktrees
- Setup Phase 0 simplified: no more `npm install && npm run build` — CLI is pre-bundled
- All worktree Agent() prompts simplified: `geas` replaces `node {project_root}/plugin/cli/index.js --cwd {project_root}`
- Pipeline `remaining_steps` now includes `integration` step
- `integrated` state transition moved to worktree merge point (after gate pass)
- Building→Polishing transition now clears checkpoint and current_task_id
- Evolving phase: `phase: complete` must be set last (triggers CLI auto-cleanup)
- Setup: `.geas/` gitignore is now user's choice (not forced)

### Added
- `plugin/bin/geas` — single-file CLI bundle, auto-registered in PATH by Claude Code
- `drafted → ready` transition explicitly added to pipeline Start Task
- Integration step in pipeline: merge + worktree cleanup after gate pass
- Mission SKILL.md Gotchas section (4 items: TaskCreate confusion, lightweight mode, orchestrate-only, commit≠skip)
- Lightweight mode clarification in specifying.md
- CLI `state update --field phase --value complete` auto-clears mission_id, mission, completed_tasks
- Help skill mandatory display rule

### Fixed
- Help skill output not displayed to user (just said "displayed")
- CLI commands failing after `cd plugin/cli` changed session CWD
- Stale CLI builds causing "unknown command" errors

### Removed
- `plugin/cli/` directory (replaced by `src/cli/` + `plugin/bin/geas`)
- Setup Phase 0 CLI build step (no longer needed)
- Worktree `--cwd` requirement in all skill files

## [0.6.0] — 2026-04-09

Skill-schema alignment, process UX improvements, naming unification, and skill optimization.

### Security
- CLI path traversal defense: validateIdentifier() + assertContainedIn() on 7 commands
- Replace silent sanitization with rejection in memory, packet, decision commands
- .geas/ write-block hook (PreToolUse) prevents direct Write/Edit to runtime state

### Changed
- Agent type naming unified to hyphens across schemas, agents, profiles, CLI, examples
- Agent Name Rule in CLAUDE.md updated (hyphen-only convention)
- Intake skill now asks for mode (lightweight/standard/full_depth) explicitly
- Setup skill uses CLI-only writes (state init, memory init-rules)
- Evolving phase has checkpoint management for all agent spawns
- All 13 skills have Input/Output sections

### Added
- /geas:help skill with usage guide, commands, and workflow explanation
- task-contract schema: dependencies array field
- mission-spec schema: existing_project source enum
- task-compiler/references/examples.md with annotated examples
- CLI commands: state init, memory init-rules
- VALID_PHASES enum validation in evolution.ts

### Fixed
- Skill-schema mismatches: scope.surfaces, concrete agent types, field names
- Specifying phase had exactly one task-list approval (no double approval)

### Documentation
- SKILLS.md and HOOKS.md updated with help skill and write-block hook
- Protocol example files updated to use hyphenated agent names

## [0.5.1] — 2026-03-30

Previously v2.0.1.

- Legacy cleanup: CLI bug fixes, dead code removal, stale reference fixes
- Protocol version bumped to v1
- Tag restructuring from v1.x/v2.x to v0.x.y

## [0.5.1] — 2026-03-30

Previously v2.0.1.

- Enhanced evolving phase: detailed mission complete briefing with task results, scope delivery, metrics
- Schema fixes: design-brief depth, run-state mission_id, debt-register sync
- Schema sync: 10 skill-local schemas aligned to protocol canonical
- Specifying enhancements: detailed task list approval output, 3-tier design brief depth
- Intake enhancements: domain_profile, mode, done_when, risk_notes, affected_surfaces
- Replaced legacy SW terminology: arch_review → design_review, code_review → specialist_review

## [0.5.0] — 2026-03-28

Previously v2.0.0. Domain-agnostic restructure.

- Agent split: authority/ (3) + software/ (5) + research/ (6)
- Slot-based agent routing via domain profiles
- Enhanced agent personas: anti-patterns, priority checklists, self-checks
- Skills consolidated to flat structure (12 core skills)
- Reference docs (AGENTS.md, SKILLS.md, HOOKS.md) synced EN + KO
- CLAUDE.md updated for domain-agnostic wording

## [0.4.0] — 2026-03-22

Previously v1.2.0.

- Agent absorption: repository-manager and process-lead absorbed into orchestrator
- Agent count reduced from 12 to 10 (later expanded to 14 with research agents)
- Pipeline updated for orchestrator-direct git operations
- Korean mirror synced for agent absorption

## [0.3.1] — 2026-03-20

Previously v1.1.1.

- Hook migration to mission-scoped paths (verify-pipeline, verify-task-status, restore-context, protect-geas-state)

## [0.3.0] — 2026-03-19

Previously v1.1.0.

- Directory migration: all artifacts moved to `.geas/missions/{mission_id}/`
- Skills, hooks, and reference docs migrated to new path structure
- Vote-round schema path migration

## [0.2.1] — 2026-03-17

Previously v1.0.1.

- Removed stale seed.json references across docs and skills
- Clarified mission vs mission_id in run.json

## [0.2.0] — 2026-03-15

Previously v1.0.0.

- Replaced seed.json with per-mission spec files (`.geas/missions/{mission_id}/spec.json`)
- Renamed seed.schema.json to mission-spec.schema.json
- Enhanced README for clarity and governance description
- Added mission briefing step to evolving phase

## [0.1.0] — 2026-03-10

Initial structured release.

- Core protocol: 12 documents (00-11)
- 16 JSON Schemas (draft 2020-12)
- Parallel dispatch skill
- Vote round as parallel voting skill
- Run-state schema for session checkpoint
- Basic mission lifecycle: specifying → building → polishing → evolving
