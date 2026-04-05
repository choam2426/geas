# INDEX

**Version**: v2  
**Status**: normative reading guide for the protocol set

## 0. Reading Order

### Fastest path to understand the protocol

1. `00_PROTOCOL_FOUNDATIONS.md`
2. `01_AGENT_TYPES_AND_AUTHORITY.md`
3. `02_MODES_MISSIONS_AND_RUNTIME.md`
4. `03_TASK_MODEL_AND_LIFECYCLE.md`
5. `05_GATE_VOTE_AND_FINAL_VERDICT.md`
6. `07_MEMORY_SYSTEM_OVERVIEW.md`
7. `10_SESSION_RECOVERY_AND_RESUMABILITY.md`
8. `12_ENFORCEMENT_CONFORMANCE_AND_METRICS.md`
9. `13_ASSURANCE_PROFILES_AND_STANDARDS_ALIGNMENT.md`
10. `14_EVOLUTION_DEBT_AND_GAP_LOOP.md`

### Implementation-oriented path

1. `04_BASELINE_WORKSPACE_SCHEDULER_AND_PARALLELISM.md`
2. `06_SPECIALIST_EVIDENCE_MATRIX.md`
3. `08_EVOLVING_MEMORY_LIFECYCLE.md`
4. `09_MEMORY_RETRIEVAL_AND_CONTEXT_ENGINE.md`
5. `11_RUNTIME_ARTIFACTS_AND_SCHEMAS.md`
6. `docs/protocol/schemas/`
7. `docs/protocol/examples/`

## 1. Document Map

- `00_PROTOCOL_FOUNDATIONS.md` — control objectives, invariants, conformance units, precedence rules, threat model
- `01_AGENT_TYPES_AND_AUTHORITY.md` — role taxonomy, separation of duties, reviewer routing, conflict rules
- `02_MODES_MISSIONS_AND_RUNTIME.md` — mission model, mission modes, four phases, runtime phases, phase gates
- `03_TASK_MODEL_AND_LIFECYCLE.md` — task metadata, contract quality, lifecycle states, state restoration, retry and iterate rules
- `04_BASELINE_WORKSPACE_SCHEDULER_AND_PARALLELISM.md` — baseline freshness, revalidation, workspace lifecycle, lock and scheduler model
- `05_GATE_VOTE_AND_FINAL_VERDICT.md` — gate semantics, rubric scoring, vote rounds, closure packets, final verdict
- `06_SPECIALIST_EVIDENCE_MATRIX.md` — minimum evidence obligations by specialist and inclusion rules
- `07_MEMORY_SYSTEM_OVERVIEW.md` — memory purpose, admissibility, confidence, behavior surfaces
- `08_EVOLVING_MEMORY_LIFECYCLE.md` — candidate-to-canonical lifecycle, decay, supersession, harmful reuse rollback
- `09_MEMORY_RETRIEVAL_AND_CONTEXT_ENGINE.md` — context packet assembly, provenance, stale packet rules, injection hygiene
- `10_SESSION_RECOVERY_AND_RESUMABILITY.md` — checkpointing, safe boundaries, recovery decisions, replay vs restore
- `11_RUNTIME_ARTIFACTS_AND_SCHEMAS.md` — artifact contract philosophy, canonical artifact families, validation failures
- `12_ENFORCEMENT_CONFORMANCE_AND_METRICS.md` — hooks, conformance scenarios, observability, health signals, mandatory responses
- `13_ASSURANCE_PROFILES_AND_STANDARDS_ALIGNMENT.md` — assurance profiles, external standards alignment, override posture
- `14_EVOLUTION_DEBT_AND_GAP_LOOP.md` — retrospectives, debt, gap assessment, mission carry-forward

## 2. Recommended Reading by Use Case

### I want to implement Geas

Read: `00`, `01`, `02`, `03`, `04`, `05`, `10`, `11`, `12`, `13`

### I want to harden Geas for production AI development

Read: `00`, `05`, `09`, `10`, `12`, `13`, `14`

### I want to understand the learning system

Read: `07`, `08`, `09`, `14`

### I want to audit a broken session

Read: `03`, `04`, `05`, `10`, `11`, `12`

## 3. Notes on Compatibility

The v2 protocol intentionally preserves the canonical artifact-first model while adding:

- stronger normative language
- assurance profiles
- clearer conformance and override expectations
- stronger context and recovery hygiene
- clearer distinction between schema-minimum fields and hardening recommendations
