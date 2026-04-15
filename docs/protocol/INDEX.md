# INDEX

**Version**: v1  
**Status**: normative reading guide for the protocol set

## 0. Reading Order

The protocol follows a lifecycle flow. Sequential reading 00 → 10 is recommended.

1. `00_PROTOCOL_FOUNDATIONS.md`
2. `01_AGENTS_AND_EVIDENCE.md`
3. `02_MODES_MISSIONS_AND_RUNTIME.md`
4. `03_TASK_MODEL_AND_LIFECYCLE.md`
5. `04_BASELINE_WORKSPACE_SCHEDULER_AND_PARALLELISM.md`
6. `05_GATE_VOTE_AND_FINAL_VERDICT.md`
7. `06_SESSION_RECOVERY_AND_RESUMABILITY.md`
8. `07_MEMORY_AND_RETROSPECTIVE.md`
9. `08_DEBT_AND_GAP.md`
10. `09_RUNTIME_ARTIFACTS_AND_SCHEMAS.md`
11. `10_ENFORCEMENT_CONFORMANCE_AND_METRICS.md`

For implementation reference, see also:
- `docs/protocol/schemas/` — JSON Schema contracts
- `docs/protocol/examples/` — artifact examples

## 1. Document Map

- `00_PROTOCOL_FOUNDATIONS.md` — control objectives, invariants, conformance units, precedence rules, threat model
- `01_AGENTS_AND_EVIDENCE.md` — role taxonomy, authority, reviewer routing, specialist evidence obligations, conflict rules
- `02_MODES_MISSIONS_AND_RUNTIME.md` — mission model, mission modes, four phases, phase gates, runtime anchor
- `03_TASK_MODEL_AND_LIFECYCLE.md` — task metadata, contract quality, lifecycle states, state restoration, retry and iterate rules
- `04_BASELINE_WORKSPACE_SCHEDULER_AND_PARALLELISM.md` — baseline freshness, revalidation, workspace lifecycle, lock and scheduler model
- `05_GATE_VOTE_AND_FINAL_VERDICT.md` — gate semantics, rubric scoring, vote rounds, closure packets, final verdict
- `06_SESSION_RECOVERY_AND_RESUMABILITY.md` — checkpointing, safe boundaries, recovery decisions, replay vs restore
- `07_MEMORY_AND_RETROSPECTIVE.md` — memory storage, retrospective loop, rule and agent-memory flows, retrieval, privacy
- `08_DEBT_AND_GAP.md` — debt tracking, debt lifecycle, gap assessment, gap interpretation
- `09_RUNTIME_ARTIFACTS_AND_SCHEMAS.md` — artifact contract philosophy, canonical artifact families, directory structure, validation failures
- `10_ENFORCEMENT_CONFORMANCE_AND_METRICS.md` — hooks, conformance scenarios, transition guards, phase guards, observability, health signals

## 2. Recommended Reading by Use Case

### I want to implement Geas

Read: `00`, `01`, `02`, `03`, `04`, `05`, `09`, `10`

### I want to harden Geas for production AI work

Read: `00`, `05`, `07`, `10`

### I want to understand the learning system

Read: `07`, `08`

### I want to audit a broken session

Read: `03`, `04`, `05`, `06`, `09`, `10`

## 3. Structural Optimizations

The current protocol shape reflects a series of structural consolidations:

- per-task artifacts consolidated into `record.json` (single file, sections accumulated)
- role-based evidence (`evidence/{agent}.json`)
- memory simplified from a 9-state lifecycle to 2 states (draft / active)
- Session Recovery and Runtime Artifacts separated into dedicated documents
- Agents and Specialist Evidence unified into one document
- Memory and Retrospective unified into one document
- Debt and Gap isolated into a focused document
- mechanical transition guards (6 per-task + 3 phase) added
- conventions and rules unified into `rules.md`
- event logs consolidated into `state/events.jsonl`
