# INDEX

**Version**: v3

## 0. Reading Order

### To quickly understand the structure
1. `00_PROTOCOL_FOUNDATIONS.md`
2. `01_AGENT_TYPES_AND_AUTHORITY.md`
3. `02_MODES_MISSIONS_AND_RUNTIME.md`
4. `03_TASK_MODEL_AND_LIFECYCLE.md`
5. `05_GATE_VOTE_AND_FINAL_VERDICT.md`
6. `07_MEMORY_SYSTEM_OVERVIEW.md`
7. `08_EVOLVING_MEMORY_LIFECYCLE.md`
8. `10_SESSION_RECOVERY_AND_RESUMABILITY.md`
9. `14_EVOLUTION_DEBT_AND_GAP_LOOP.md`

### For implementation
1. `11_RUNTIME_ARTIFACTS_AND_SCHEMAS.md`
2. `12_ENFORCEMENT_CONFORMANCE_AND_METRICS.md`
3. `schemas/`
4. `examples/`

## 1. Document Map

- `00_PROTOCOL_FOUNDATIONS.md`
  - design principles, 4 Pillars, scope/non-scope, terminology, canonical ownership
- `01_AGENT_TYPES_AND_AUTHORITY.md`
  - type-only agent model, authority boundaries, specialist participation principles
- `02_MODES_MISSIONS_AND_RUNTIME.md`
  - mission-based 4-phase model (specifying/building/polishing/evolving), runtime phase
- `03_TASK_MODEL_AND_LIFECYCLE.md`
  - task classification, lifecycle, implementation contract, worker self-check, transition invariants
- `04_BASELINE_WORKTREE_SCHEDULER_AND_PARALLELISM.md`
  - base_commit, worktree, stale/revalidation, lock model, parallel processing
- `05_GATE_VOTE_AND_FINAL_VERDICT.md`
  - evidence gate, rubric scoring, vote round, closure packet, final verdict
- `06_SPECIALIST_EVIDENCE_MATRIX.md`
  - specialist type x artifact x closure/evolution inclusion matrix
- `07_MEMORY_SYSTEM_OVERVIEW.md`
  - memory architecture, behavior-change surfaces, ownership, promotion pipeline overview
- `08_EVOLVING_MEMORY_LIFECYCLE.md`
  - memory candidate -> provisional -> stable -> superseded lifecycle details
- `09_MEMORY_RETRIEVAL_AND_CONTEXT_ENGINE.md`
  - retrieval scoring, packet assembly, context budget, stale packet policy
- `10_SESSION_RECOVERY_AND_RESUMABILITY.md`
  - checkpoint, recovery packet (with field details), safe boundary, dirty state recovery, recovery to evolution feedback loop, evidence preservation principle
- `11_RUNTIME_ARTIFACTS_AND_SCHEMAS.md`
  - runtime artifact and memory artifact contract summary, specific drift examples, phase_targeting/review_after field details
- `12_ENFORCEMENT_CONFORMANCE_AND_METRICS.md`
  - hook/enforcement, conformance suite, metrics, health signal threshold definitions, low-quality incident/stub cap definitions
- `14_EVOLUTION_DEBT_AND_GAP_LOOP.md`
  - retrospective, rules.md update, role-specific lesson criteria, debt lifecycle (scheduled to resolved transition conditions), gap assessment forward-feeding, harmful reuse feedback loop
- `schemas/` -- 13 JSON Schemas (draft 2020-12) + `_defs.schema.json` shared definitions
- `examples/` -- 9 example files (corresponding to each schema)
