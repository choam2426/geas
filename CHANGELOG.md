# Changelog

## [1.0.0] - 2026-04-03

First stable release. Complete v3 protocol implementation with 14 protocol documents, 29 JSON schemas, 27 skills, 12 agent types, and 18 enforcement hooks.

### Protocol v3 Migration (Phase 1–6)

- **Phase 1 — Minimum Enforceable State**: 7-state task model (`drafted → ready → implementing → reviewed → integrated → verified → passed`), worker self-check, gate/verdict separation, closure packet assembly, conditional critical reviewer challenge
- **Phase 2 — Baseline, Staleness, Parallelism**: staleness detection with revalidation records, lock lifecycle and safe parallel conditions, skill renames (`compass → orchestrating`, `parallel-dispatch → scheduling`, `debate → decision`)
- **Phase 3 — Evolution Core**: structured retrospective (after Resolve/Ship only), rules update workflow with approval, `debt-register.json`, `gap-assessment.json`, phase-review wiring, evolution exit gate with 5 required artifacts
- **Phase 4 — Memory Core**: memorizing skill with 9-state lifecycle and 6-stage promotion, memory retrieval scoring in context-packet, application logging, memory-index initialization, promotion gate and superseded warning hooks
- **Phase 5 — Recovery and Context Engine**: recovery-packet schema, extended run-state, recovery decision table, `session-latest.md` and task-focus maintenance, two-phase checkpoint hooks, enhanced `restore-context.sh` with L0 anti-forgetting
- **Phase 6 — Refinement**: conformance-checking (18 scenarios), chaos-exercising (5 failure scenarios), policy-managing, reporting (debt/gap dashboard + 8 health signals), memory review cadence hook

### Architecture

- Unified initiative + sprint into single `orchestrating` skill with 4-phase execution flow (Specifying → Building → Polishing → Evolving)
- Per-mission spec files (`seed.json` → `mission-{n}.json`) with `mission_id` tracking
- Agent files renamed from character names to type names across all references
- Runtime accessibility rules — skills use local `schemas/` and inline fields, no `docs/` access at runtime
- Classification validation gate and pipeline fallback for task routing
- Continuation rule for uninterrupted pipeline execution

### Hooks

- Complete migration of all hook scripts from Python to Node.js (19 scripts)
- Windows compatibility via `cygpath` path resolution
- Node.js hook helper module (`lib/`)
- Two-phase checkpoint system (pre-write backup, post-write cleanup)
- L0 anti-forgetting in context restoration after compaction

### Documentation

- Full English protocol translation — 14 operational documents (`docs/protocol/`)
- 29 JSON schemas (draft 2020-12) covering all runtime artifacts (`docs/protocol/schemas/`)
- 15 example files for major schemas (`docs/protocol/examples/`)
- Rewritten READMEs with problem-first structure (English + Korean)
- Complete reference docs — AGENTS.md (12 types), SKILLS.md (27 skills), HOOKS.md (18 hooks)
- Architecture overview rewrite (`docs/architecture/DESIGN.md`)
- Korean documentation mirror (`docs/ko/`)

### Bug Fixes

- Schema alignment: `state → status`, `integration-result` fields, `open_risks` as objects
- Vote round policy heuristics and specifying→building checkpoint fix
- Pipeline enforcement: `critical_reviewer` mandatory for normal+ classifications
- Artifact path corrections across skills and hooks
- `scope.paths` replacing `prohibited_paths` in all references
- Stale mode/term references removed throughout codebase

## [0.2.0] - 2026-04-01

Initial public release with parallel-dispatch skill and batch checkpoint support.
