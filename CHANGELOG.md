# Changelog

All notable changes to this project are documented in this file.

> **Note**: Tags were restructured in v0.5.1. Previous major versions (v1.x, v2.x) have been flattened to v0.x.y to reflect that the project is pre-1.0.

## [2.0.0] — 2026-04-20

**Major release — Protocol v3 clean rewrite + Skill layer redesign.**

This release replaces the entire implementation stack (CLI, skills, agents, hooks, dashboard) with protocol v3 semantics. The v1/v2 artifact model, CLI surface, and skill catalog are removed in full. Existing `.geas/` directories from v1.x are not supported; start fresh.

### BREAKING

- **Protocol v3 replaces v1/v2.** 4-phase mission lifecycle (`specifying` / `building` / `polishing` / `consolidating` → `complete`), 9-state task lifecycle (`drafted` / `ready` / `implementing` / `reviewed` / `verified` / `passed` / `blocked` / `escalated` / `cancelled`), 3 operating modes (`lightweight` / `standard` / `full_depth`), slot-based agent model (4 authority + 5 specialist slots). 14 JSON Schemas replace the prior set.
- **CLI command surface replaced.** All v1.x commands removed: `lock`, `packet`, `recovery`, `health`, `evolution`, `decision`, `retrospective-draft`, `advance`, `harvest-memory`, `check-artifacts`, `closure-assemble`, `revalidate`, positional `task create` / `task add-acceptance` / `task add-surface` / `task set-risk` / `evidence submit` / `task record`, `mission create TITLE --done-when`, `phase write`. New v3 commands: `setup`, `context`, `schema`, `state`, `mission create|approve|state`, `mission-state update`, `phase-review append`, `mission-verdict append`, `task draft|approve|transition|deps|state`, `evidence append`, `self-check set`, `gate run`, `deliberation append`, `memory shared-set|agent-set`, `debt register|update-status|list`, `gap set`, `memory-update set`, `event log`.
- **Artifact paths replaced.** Per-mission at `.geas/missions/{mission_id}/`: `spec.json`, `mission-state.json`, `phase-reviews.json`, `mission-verdicts.json`, `deliberations.json`, `consolidation/gap.json`, `consolidation/memory-update.json`, `consolidation/candidates.json`, `tasks/{task_id}/{contract,task-state,self-check,implementation-contract}.json`, `tasks/{task_id}/deliberations.json`, `tasks/{task_id}/gate-results.json`, `tasks/{task_id}/evidence/{agent}.{slot}.json`. Project-level: `.geas/debts.json` (append-only ledger, replaces mission-scoped carry-forward), `.geas/events.jsonl` (automation-only scope), `.geas/memory/{shared.md,agents/{agent_type}.md}`.
- **Removed v2 concepts**: `rules.md`, `policy-override`, `lock-manifest`, `recovery-packet`, `decision-record`, `health-check`, `evolving` phase, mission-scoped carry-forward debt, `pipeline_step`, `run-state`, `scheduler_state`, `recovery_class`, `design-brief`, `checkpoint_phase`, `rules-update`.
- **Skill catalog replaced (17 skills).** All 11 prior skills removed or rewritten. User-invocable surface narrowed to 2: `/mission` (dispatcher) and `/navigating-geas` (help). The other 15 are `user-invocable: false` sub-skills dispatched by `/mission`.
- **Agent directory reorganized.** `plugin/agents/authority/product-authority.md` renamed to `decision-maker.md` (v3 slot name, kebab-case canonical). Specialist roles in `plugin/agents/software/` and `plugin/agents/research/` re-slotted: `qa-engineer` → verifier, `security-engineer` → risk-assessor, `technical-writer` → communicator, `methodology-reviewer` → verifier, `research-integrity-reviewer` → risk-assessor, `research-engineer` → operator, `research-writer` → communicator.
- **Hook set trimmed.** `hooks.json` reduced to SessionStart + SubagentStart + PreToolUse. Deleted scripts: `calculate-cost.sh`, `checkpoint-pre-write.sh`, `checkpoint-post-write.sh`, `packet-stale-check.sh`, `protect-geas-state.sh`, `integration-lane-check.sh`, `restore-context.sh`.
- **Reference docs restructured.** `docs/{ko/,}reference/CLI.md` deleted (CLI is internal plumbing, not user-facing). `SKILLS.md`, `HOOKS.md`, `DASHBOARD.md` rewritten for v3.
- **Dashboard rebuilt.** Rust backend (`src/dashboard/src-tauri/`) models + commands + watcher replaced with v3 artifact readers. React frontend reads via a new `src/dashboard/src/lib/geasClient.ts` single wrapper. Deleted v2-only components: `RulesViewer`, `DebtPanel`, `DebtBadge`, `ProjectOverview`.

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
- New views: Evidence gate status, Phase review history, Gap signals summary, Consolidation packet view (in `MissionDetailView`).
- Graceful degradation on missing/malformed artifacts.

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
- `plugin/bin/geas` bundle regenerated. CLI version bumped through `0.9.0` → `0.10.0` → `0.11.0` → `0.12.0` as groups landed.
- `plugin.json` version → `2.0.0`.

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

### Known Issues / follow-ups

- **CLI convenience gaps still open** (2 of the original 6): `geas status` (CLI.md §14.6) and `geas validate` (CLI.md §3). Dispatcher can compose status from `geas context` + `geas mission state` + `geas task state`; individual writes are already schema-validated, so `validate` is a debug/CI convenience. Neither blocks current skill flows.
- **Rust compile for dashboard** not validated locally (no `cargo` in migration environment); user to run `cargo check` / `cargo build` on their machine.
- **Dashboard Rust-side tests** removed with the v3 rewrite; replacement suite deferred.
- **Skill lint automation** not yet in CI; checklist verified manually during this release.
- **Skill pressure-test harness** (obra-style adversarial eval) not yet implemented.
- **Local `main` ahead of `origin/main`**; release push is a separate operation.

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
