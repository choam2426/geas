# 11. Runtime Artifacts and Schemas

## Purpose

This document summarizes the contracts for canonical runtime artifacts and memory artifacts. For detailed field definitions, see `schemas/`.

## Core Runtime Artifacts

- `run.json`
- `task.json`
- `implementation-contract.json`
- `worker-self-check.json`
- `specialist-review.json`
- `integration-result.json`
- `gate-result.json`
- `readiness-round.json`
- `closure-packet.json`
- `final-verdict.json`
- `failure-record.json`
- `revalidation-record.json`
- `recovery-packet.json`
- `retrospective.json`
- `rules-update.json`
- `debt-register.json`
- `gap-assessment.json`
- `phase-review.json`

## Memory Artifacts

- `memory-candidate.json`
- `memory-entry.json`
- `memory-review.json`
- `memory-application-log.json`
- `memory-packet.json`
- `memory-index.json`

## Evolution Artifact Storage Paths

| Artifact | Storage path | Scope |
|---|---|---|
| `retrospective.json` | `.geas/tasks/{task_id}/retrospective.json` | per task |
| `rules-update.json` | `.geas/evolution/rules-update-{sequence}.json` | per mission |
| `debt-register.json` | `.geas/evolution/debt-register.json` | per mission (single file, entries accumulate) |
| `gap-assessment.json` | `.geas/evolution/gap-assessment-{phase_transition}.json` | per phase transition |
| `phase-review.json` | `.geas/evolution/phase-review-{phase_transition}.json` | per phase transition |
| `mission-summary.md` | `.geas/summaries/mission-summary.md` | per mission |
| `session-latest.md` | `.geas/summaries/session-latest.md` | per session (overwritten) |
| `task-focus/{id}.md` | `.geas/summaries/task-focus/{task_id}.md` | per task |

## Artifact Purpose Highlights

### `worker-self-check.json`
A self-assessment artifact where the worker records known risks, untested paths, possible stubs, and confidence.

### `retrospective.json`
Input for the per-task learning loop. Written by `process_lead`.

### `rules-update.json`
A record of approved rule changes applied to the durable behavior surface.

### `debt-register.json`
A mission/phase-level debt rollup artifact.

### `gap-assessment.json`
An artifact evaluating the difference between the original `scope_in` and the actual `scope_out`.

### `phase-review.json`
An artifact summarizing the state before and after a mission phase transition.

## Canonical Fields to Notice

### Common metadata across all artifacts
- `version`
- `artifact_type`
- `artifact_id`
- `producer_type`
- `created_at`
- `updated_at`

### Key fields for worker self-check
- `known_risks`
- `untested_paths`
- `possible_stubs`
- `what_to_test_next`
- `confidence`

### Key fields for debt register
- `items[]`
- `rollup_by_severity`
- `rollup_by_kind`
- `phase_targeting` — a field specifying which mission phase should resolve the debt. `"polish"`: cosmetic/quality debt, `"evolution"`: architectural debt, `"future"`: debt outside current mission scope but still requiring tracking

### Key fields for gap assessment
- `scope_in_summary`
- `scope_out_summary`
- `fully_delivered`
- `partially_delivered`
- `not_delivered`
- `intentional_cuts`
- `unexpected_additions`

### Key fields for memory entry
- `memory_type`
- `state`
- `scope`
- `summary`
- `evidence_refs`
- `confidence`
- `support_count`
- `successful_reuses`
- `failed_reuses`
- `contradiction_count`
- `review_after` — ISO 8601 date. After this date, the continued validity of the memory entry must be reassessed. Set by the reviewer at promotion time. Defaults: `provisional` memory is promotion date + 90 days, `stable` memory is promotion date + 180 days
- `supersedes`
- `superseded_by`

## Contract Philosophy

- Prose documents define semantics.
- Schemas enforce format and enums.
- Hooks enforce existence and invariants.

When these three layers encroach on each other's roles, drift occurs. When drift is detected, block the creation/consumption of the affected artifact and correct it. Specific examples of drift:

1. **schema-artifact drift**: a required field was added to the schema, but existing artifacts under `.geas/` lack that field
2. **hook-protocol drift**: a hook checks for the existence of a specific artifact, but a protocol change means that artifact is no longer produced
3. **doc-schema version drift**: the schema version referenced by a prose document does not match the actually deployed schema version

When drift is detected, the canonical split docs definitions take precedence (see doc 13 Migration Rule).

## Artifact Validation Failure Modes

### Required field missing

When a field defined as `required` in the schema is absent from the artifact:
1. The validator **rejects** the artifact.
2. Request regeneration from the producer agent, providing the list of missing fields.
3. If regeneration fails twice, escalate to `orchestration_authority`.

### artifact_type mismatch

When an artifact's `artifact_type` field does not match the filename or usage context:
1. The validator records a warning.
2. Block the next stage that consumes the artifact.
3. The producer agent corrects the artifact_type or creates a new artifact.

### Common metadata version incompatibility

When an artifact's `version` field is incompatible with the current schema version:
1. If within backward-compatible range (same `major` version), record a warning and proceed.
2. If not backward-compatible, reject the artifact and transform it following the migration procedure in doc 13.
