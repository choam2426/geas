# 08. Runtime Artifacts and Schemas

> Connects Geas artifacts, canonical paths, canonical schemas, and owner documents. Semantic meaning and judgment rules are owned by the respective documents; this document is only the map.

## Purpose

Protocol documents explain meaning, and schemas define structure. This document is the bridge between them.

When reading an artifact, follow this order.

1. Read the owner document for semantics and responsibility.
2. Use this document to find the canonical path and canonical schema.
3. Use the schema to confirm the exact fields and enums.

All schema paths live under `docs/schemas/`, so the tables below list only the schema filenames.

## Core Artifact Registry

### Project-level

| concept | canonical path | schema | owner |
|---|---|---|---|
| debts | `.geas/debts.json` | `debts.schema.json` | [doc 07](./07_DEBT_AND_GAP.md) |

### Mission-level

| concept | canonical path | schema | owner |
|---|---|---|---|
| mission spec | `.geas/missions/{mission_id}/spec.json` | `mission-spec.schema.json` | [doc 02](./02_MISSIONS_PHASES_AND_FINAL_VERDICT.md) |
| mission design | `.geas/missions/{mission_id}/mission-design.md` | markdown | [doc 02](./02_MISSIONS_PHASES_AND_FINAL_VERDICT.md) |
| mission-level deliberations | `.geas/missions/{mission_id}/deliberations.json` | `deliberation.schema.json` (append to the file's `entries` array) | [doc 02](./02_MISSIONS_PHASES_AND_FINAL_VERDICT.md) |
| phase reviews | `.geas/missions/{mission_id}/phase-reviews.json` | `phase-reviews.schema.json` | [doc 02](./02_MISSIONS_PHASES_AND_FINAL_VERDICT.md) |
| mission state | `.geas/missions/{mission_id}/mission-state.json` | `mission-state.schema.json` | [doc 05](./05_RUNTIME_STATE_AND_RECOVERY.md) |
| memory update | `.geas/missions/{mission_id}/consolidation/memory-update.json` | `memory-update.schema.json` | [doc 06](./06_MEMORY.md) |
| gap | `.geas/missions/{mission_id}/consolidation/gap.json` | `gap.schema.json` | [doc 07](./07_DEBT_AND_GAP.md) |
| mission verdicts | `.geas/missions/{mission_id}/mission-verdicts.json` | `mission-verdicts.schema.json` | [doc 02](./02_MISSIONS_PHASES_AND_FINAL_VERDICT.md) |

### Task-level

| concept | canonical path | schema | owner |
|---|---|---|---|
| task contract | `.geas/missions/{mission_id}/tasks/{task_id}/contract.json` | `task-contract.schema.json` | [doc 03](./03_TASK_LIFECYCLE_AND_EVIDENCE.md) |
| implementation contract | `.geas/missions/{mission_id}/tasks/{task_id}/implementation-contract.json` | `implementation-contract.schema.json` | [doc 03](./03_TASK_LIFECYCLE_AND_EVIDENCE.md) |
| implementer self-check | `.geas/missions/{mission_id}/tasks/{task_id}/self-check.json` | `self-check.schema.json` | [doc 03](./03_TASK_LIFECYCLE_AND_EVIDENCE.md) |
| task-level deliberations | `.geas/missions/{mission_id}/tasks/{task_id}/deliberations.json` | `deliberation.schema.json` (append to the file's `entries` array) | [doc 03](./03_TASK_LIFECYCLE_AND_EVIDENCE.md) |
| evidence | `.geas/missions/{mission_id}/tasks/{task_id}/evidence/{agent}.{slot}.json` | `evidence.schema.json` (append to the file's `entries` array; branch by each entry's `evidence_kind`) | [doc 03](./03_TASK_LIFECYCLE_AND_EVIDENCE.md) |
| gate results | `.geas/missions/{mission_id}/tasks/{task_id}/gate-results.json` | `gate-results.schema.json` | [doc 03](./03_TASK_LIFECYCLE_AND_EVIDENCE.md) |
| task state | `.geas/missions/{mission_id}/tasks/{task_id}/task-state.json` | `task-state.schema.json` | [doc 05](./05_RUNTIME_STATE_AND_RECOVERY.md) |

### Memory

| concept | canonical path | schema | owner |
|---|---|---|---|
| shared memory | `.geas/memory/shared.md` | markdown | [doc 06](./06_MEMORY.md) |
| agent memory | `.geas/memory/agents/{agent}.md` | markdown | [doc 06](./06_MEMORY.md) |

## Default drift rules

| conflict | what to trust first |
|---|---|
| prose document vs. schema | The schema for structure, the owner document for meaning |
| mission state or task state vs. artifact | The artifact |
| summary vs. canonical artifact | The canonical artifact |

When you are unsure where an artifact lives or which schema governs it, return to this document. When you need to know why the artifact exists or what it means, return to the owner document.
