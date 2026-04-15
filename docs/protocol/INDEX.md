# INDEX

**Version**: v1  
**Status**: normative reading guide for the protocol set

## 0. Reading Order

### Fastest path to understand the protocol

1. `00_PROTOCOL_FOUNDATIONS.md`
2. `01_AGENT_TYPES_AND_AUTHORITY.md`
3. `02_MODES_MISSIONS_AND_RUNTIME.md`
4. `03_TASK_MODEL_AND_LIFECYCLE.md`
5. `05_GATE_VOTE_AND_FINAL_VERDICT.md`
6. `07_MEMORY_SYSTEM_OVERVIEW.md`
7. `08_SESSION_RECOVERY_AND_RESUMABILITY.md`
8. `10_ENFORCEMENT_CONFORMANCE_AND_METRICS.md`
9. `11_EVOLUTION_DEBT_AND_GAP_LOOP.md`

### Implementation-oriented path

1. `04_BASELINE_WORKSPACE_SCHEDULER_AND_PARALLELISM.md`
2. `06_SPECIALIST_EVIDENCE_MATRIX.md`
3. `09_RUNTIME_ARTIFACTS_AND_SCHEMAS.md`
4. `docs/protocol/schemas/`
5. `docs/protocol/examples/`

## 1. Document Map

- `00_PROTOCOL_FOUNDATIONS.md` — control objectives, invariants, conformance units, precedence rules, threat model
- `01_AGENT_TYPES_AND_AUTHORITY.md` — role taxonomy, separation of duties, reviewer routing, conflict rules
- `02_MODES_MISSIONS_AND_RUNTIME.md` — mission model, mission modes, four phases, phase gates
- `03_TASK_MODEL_AND_LIFECYCLE.md` — task metadata, contract quality, lifecycle states, state restoration, retry and iterate rules
- `04_BASELINE_WORKSPACE_SCHEDULER_AND_PARALLELISM.md` — baseline freshness, revalidation, workspace lifecycle, lock and scheduler model
- `05_GATE_VOTE_AND_FINAL_VERDICT.md` — gate semantics, rubric scoring, vote rounds, closure packets, final verdict
- `06_SPECIALIST_EVIDENCE_MATRIX.md` — minimum evidence obligations by specialist and inclusion rules
- `07_MEMORY_SYSTEM_OVERVIEW.md` — memory purpose, 2-state lifecycle, entries, agent memory, rules.md, retrieval
- `08_SESSION_RECOVERY_AND_RESUMABILITY.md` — checkpointing, safe boundaries, recovery decisions, replay vs restore
- `09_RUNTIME_ARTIFACTS_AND_SCHEMAS.md` — artifact contract philosophy, canonical artifact families, directory structure, validation failures
- `10_ENFORCEMENT_CONFORMANCE_AND_METRICS.md` — hooks, conformance scenarios, transition guards, phase guards, observability, health signals
- `11_EVOLUTION_DEBT_AND_GAP_LOOP.md` — retrospectives, debt, gap assessment, mission carry-forward

## 2. Recommended Reading by Use Case

### I want to implement Geas

Read: `00`, `01`, `02`, `03`, `04`, `05`, `09`, `10`

### I want to harden Geas for production AI work

Read: `00`, `05`, `07`, `10`

### I want to understand the learning system

Read: `07`

### I want to audit a broken session

Read: `03`, `04`, `05`, `08`, `09`, `10`

## 3. Notes on Compatibility

The v3 protocol optimization simplifies by:

- consolidating per-task artifacts into `record.json` (single file, sections accumulated)
- introducing role-based evidence (`evidence/{agent}.json`)
- simplifying memory from 9-state to 2-state (draft/active)
- merged former memory docs 08+09 into doc 07 (08 is now Session Recovery, 09 is now Runtime Artifacts)
- adding mechanical transition guards (6 per-task + 3 phase)
- unifying conventions and rules into `rules.md`
- consolidating event logs into `state/events.jsonl`
