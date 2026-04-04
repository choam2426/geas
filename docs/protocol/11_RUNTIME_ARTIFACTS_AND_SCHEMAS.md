# 11. Runtime Artifacts and Schemas

## Purpose

This document summarizes the contracts for canonical runtime artifacts and memory artifacts. For detailed field definitions, see `schemas/`.

## Core Runtime Artifacts

### Specifying Artifacts

| Artifact | Schema | Storage path | Producer |
|----------|--------|-------------|----------|
| `mission-spec.json` | `mission-spec.schema.json` | `.geas/missions/{mission_id}/spec.json` | orchestration_authority |
| `design-brief.json` | `design-brief.schema.json` | `.geas/missions/{mission_id}/design-brief.json` | orchestration_authority |

### Pipeline Artifacts (per-task)

| Artifact | Schema | Storage path | Producer |
|----------|--------|-------------|----------|
| `task-contract.json` | `task-contract.schema.json` | `.geas/tasks/{task_id}.json` | task_compiler |
| `implementation-contract.json` | `implementation-contract.schema.json` | `.geas/contracts/{task_id}.json` | primary worker |
| `worker-self-check.json` | `worker-self-check.schema.json` | `.geas/tasks/{task_id}/worker-self-check.json` | primary worker |
| `specialist-review.json` | `specialist-review.schema.json` | `.geas/evidence/{task_id}/{agent-type}[-review].json` | specialist agents |
| `integration-result.json` | `integration-result.schema.json` | `.geas/tasks/{task_id}/integration-result.json` | orchestration_authority |
| `gate-result.json` | `gate-result.schema.json` | `.geas/tasks/{task_id}/gate-result.json` | orchestration_authority |
| `closure-packet.json` | `closure-packet.schema.json` | `.geas/tasks/{task_id}/closure-packet.json` | orchestration_authority |
| `challenge-review.json` | `challenge-review.schema.json` | `.geas/tasks/{task_id}/challenge-review.json` | critical_reviewer |
| `final-verdict.json` | `final-verdict.schema.json` | `.geas/tasks/{task_id}/final-verdict.json` | product_authority |
| `vote-round.json` | `vote-round.schema.json` | `.geas/decisions/{dec_id}.json` | orchestration_authority |
| `failure-record.json` | `failure-record.schema.json` | `.geas/tasks/{task_id}/failure-record-{seq}.json` | orchestration_authority |
| `retrospective.json` | `retrospective.schema.json` | `.geas/tasks/{task_id}/retrospective.json` | process_lead |

### Session & Orchestration Artifacts

| Artifact | Schema | Storage path | Producer |
|----------|--------|-------------|----------|
| `run-state.json` | `run-state.schema.json` | `.geas/state/run.json` | orchestration_authority |
| `lock-manifest.json` | `lock-manifest.schema.json` | `.geas/state/locks.json` | orchestration_authority |
| `health-check.json` | `health-check.schema.json` | `.geas/state/health-check.json` | orchestration_authority |
| `revalidation-record.json` | `revalidation-record.schema.json` | `.geas/tasks/{task_id}/revalidation-record.json` | orchestration_authority |
| `recovery-packet.json` | `recovery-packet.schema.json` | `.geas/recovery/recovery-{id}.json` | orchestration_authority |

### Evolution Artifacts

| Artifact | Schema | Storage path | Scope |
|----------|--------|-------------|-------|
| `rules-update.json` | `rules-update.schema.json` | `.geas/evolution/rules-update-{seq}.json` | per mission |
| `debt-register.json` | `debt-register.schema.json` | `.geas/evolution/debt-register.json` | per mission (entries accumulate) |
| `gap-assessment.json` | `gap-assessment.schema.json` | `.geas/evolution/gap-assessment-{transition}.json` | per phase transition |
| `phase-review.json` | `phase-review.schema.json` | `.geas/evolution/phase-review-{transition}.json` | per phase transition |
| `policy-override.json` | `policy-override.schema.json` | `.geas/state/policy-overrides.json` | per project |

### Memory Artifacts

| Artifact | Schema | Storage path | Producer |
|----------|--------|-------------|----------|
| `memory-candidate.json` | `memory-candidate.schema.json` | `.geas/memory/candidates/{memory_id}.json` | orchestration_authority |
| `memory-entry.json` | `memory-entry.schema.json` | `.geas/memory/entries/{memory_id}.json` | orchestration_authority |
| `memory-review.json` | `memory-review.schema.json` | `.geas/memory/candidates/{memory_id}-review.json` | domain authority |
| `memory-application-log.json` | `memory-application-log.schema.json` | `.geas/memory/logs/{task_id}-{memory_id}.json` | orchestration_authority |
| `memory-packet.json` | `memory-packet.schema.json` | `.geas/packets/{task_id}/memory-packet.json` | orchestration_authority |
| `memory-index.json` | `memory-index.schema.json` | `.geas/state/memory-index.json` | orchestration_authority |

### Human-Readable Summaries (no schema — markdown)

| File | Storage path | Scope |
|------|-------------|-------|
| `session-latest.md` | `.geas/state/session-latest.md` | per session (overwritten on compact) |
| `task-focus/{id}.md` | `.geas/state/task-focus/{task_id}.md` | per task |
| `mission-summary.md` | `.geas/summaries/mission-summary.md` | per mission |
| `run-summary-{ts}.md` | `.geas/summaries/run-summary-{timestamp}.md` | per session |

## Schema Inventory

29 JSON Schemas + 1 shared definitions file (`_defs.schema.json`) = 30 files total in `schemas/`.

## Artifact Purpose Highlights

### `worker-self-check.json`
A self-assessment artifact where the worker records known risks, untested paths, possible stubs, and confidence.

### `challenge-review.json`
Critical reviewer pre-ship challenge. Mandatory for high/critical risk tasks. The reviewer must raise at least 1 substantive concern (protocol doc 05: substantive challenge obligation).

### `vote-round.json`
Result of a structured vote round — either a `proposal_round` (agree/disagree) or a `readiness_round` (ship/iterate/escalate). Replaces the former separate readiness-round artifact.

### `design-brief.json`
Captures the HOW decisions between mission spec (WHAT/WHY) and task contracts (UNIT OF WORK). Always reviewed by architecture-authority. Full-depth briefs also go through a vote round. Must be user-approved before tasks are compiled.

### `failure-record.json`
Records a task failure and rewind. Failure is not a state — the task rewinds to the rewind target. Tracks retry_budget before/after.

### `health-check.json`
8 health signals from protocol doc 12, each with value, threshold, and triggered flag. Calculated at phase transitions, session start, and evolving phase entry.

### `policy-override.json`
Machine-readable registry for temporary rules.md overrides. Entries are never deleted — expired ones are marked `expired: true` for audit trail.

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
- `phase_targeting` — a field specifying which mission phase should resolve the debt. `"polishing"`: cosmetic/quality debt, `"evolving"`: architectural debt, `"future"`: debt outside current mission scope but still requiring tracking

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

When drift is detected, the canonical protocol schema definitions take precedence. Update the drifted artifact to match the schema.

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
2. If not backward-compatible, reject the artifact and require the producer to regenerate it conforming to the current schema.
