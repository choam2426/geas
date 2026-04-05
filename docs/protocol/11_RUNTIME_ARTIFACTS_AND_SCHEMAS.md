# 11. Runtime Artifacts and Schemas

> **Normative document.**
> This document summarizes the canonical runtime artifact families, their contract philosophy, versioning expectations, and validation failure handling.

## Purpose

Artifacts are how Geas converts ephemeral model behavior into auditable, evidence-based process. This document defines the artifact layer so that:

- state transitions remain evidence-based
- validators know what to enforce
- reviewers know what to expect
- drift between docs, schemas, and hooks becomes visible

## Artifact Contract Philosophy

Geas uses three complementary layers to govern artifacts. Each layer has a distinct responsibility, and no single layer should do the job of the others.

| layer | responsibility |
|---|---|
| prose documents | define semantics and invariants in human-readable form |
| schemas | define structure and machine-validatable constraints |
| hooks / validators | enforce existence, ordering, and selected invariants at runtime |

## Core Runtime Artifacts

Geas produces artifacts at every phase of execution. The following tables group artifacts by the phase or subsystem that produces them.

### Specifying artifacts

Artifacts produced during the Specifying phase, when the mission is being defined and broken down into tasks.

| artifact | description |
|---|---|
| mission spec | defines the mission scope, goals, and constraints |
| design brief | describes the structural approach and key decisions |
| decision record | captures a structured decision and its rationale |
| initial task compilation outputs | task contracts generated from the mission spec and design brief |
| phase review | Specifying phase exit assessment |

### Per-task pipeline artifacts

Artifacts produced during the per-task execution pipeline as a task moves through its lifecycle states.

| artifact | description |
|---|---|
| task contract | defines what the task must accomplish, its classification, and acceptance criteria |
| implementation contract | pre-implementation agreement between worker and reviewers on approach |
| worker self-check | the worker's own assessment that implementation meets the contract |
| specialist review | review by a specialist agent (Quality Specialist, Risk Specialist, etc.) |
| integration result | outcome of integrating the task's changes into the baseline |
| gate result | evidence gate verdict with tier-level pass/fail details |
| vote-round result | structured deliberation outcome when triggered |
| challenge review | Challenger assessment for high/critical risk tasks |
| closure packet | assembled evidence bundle for final verdict |
| final verdict | Decision Maker's pass/iterate/escalate decision |
| failure record | captures what went wrong when a step fails (created as needed) |

### Session and orchestration artifacts

Artifacts that coordinate runtime execution across tasks and sessions.

| artifact | description |
|---|---|
| `run.json` | mission-level runtime state including phase, active tasks, and configuration |
| session summary | high-level record of what happened in a session |
| task-focus summary | per-task progress snapshot for recovery and context |
| recovery packet | assessment of interrupted state for the next session |
| health check | periodic health signal collection |
| lock / lane state | workspace lock ownership and parallel lane assignments |

### Evolution artifacts

Artifacts produced during the Evolving phase, when the team reflects on performance and updates its processes.

| artifact | description |
|---|---|
| retrospective | structured reflection on what worked, what failed, and what to change |
| rules update | proposed or applied changes to project rules |
| debt register | tracked technical or process debt items |
| gap assessment | identified gaps between protocol requirements and actual practice |
| mission summary | final record of the completed mission |
| memory application log | record of which memories were applied and their effect |

### Memory artifacts

Artifacts that capture and manage learned experience across sessions.

| artifact | description |
|---|---|
| memory entry | a single memory candidate or promoted memory |
| memory review | periodic review of memory health and relevance |
| memory index | registry of all active memories with metadata |
| memory packet | context-packet supplement containing relevant memories |
| supersession or decay notes | record of why a memory was replaced or retired |

## Canonical Metadata

Every canonical artifact SHOULD expose shared metadata so that validators, recovery engines, and reviewers can identify and trust it. The exact field names are schema-governed; the semantics are protocol-governed.

| field | description |
|---|---|
| `artifact_type` | identifies which kind of artifact this is |
| `version` | schema or artifact version for compatibility checking |
| creation timestamp | when the artifact was produced |
| producing role or subsystem | which agent or subsystem created the artifact |
| relevant ids | `mission_id`, `task_id`, `memory_id`, or other linking identifiers |
| source or lineage references | pointers to parent artifacts or triggering events, where applicable |

## File Naming and Path Discipline

Consistent naming and path structure make artifacts discoverable and reduce the chance of misidentification.

| rule | description |
|---|---|
| stable, type-oriented filenames | canonical artifact filenames SHOULD be predictable and reflect the artifact type |
| clear ownership paths | path layout SHOULD make it obvious which mission or task an artifact belongs to |
| flexible summaries, predictable JSON | summaries MAY use flexible naming, but canonical JSON artifacts SHOULD remain predictable |
| metadata over filename | a filename alone MUST NOT be the only source of meaning; internal metadata must agree |

## Schema Inventory

The canonical JSON schemas under `docs/protocol/schemas/` remain the source of structural truth for machine validation. This document does not replace them; it explains how to use them correctly.

## Artifact Immutability and Replacement

Once an artifact represents a completed step, it should be treated as immutable. If correction is needed, the recommended approach is to create a new version or replacement record rather than mutating the original.

| policy | description |
|---|---|
| treat completed artifacts as immutable | once an artifact records a finished step, do not modify it in place |
| create replacement records for corrections | if a correction is needed, produce a new version that references the original |
| preserve reconstruction metadata if mutating | if local policy allows in-place mutation, retain enough metadata to reconstruct the prior state |

History rewriting weakens traceability.

## Recommended Hardening Patterns

The following are RECOMMENDED even if not yet present in every canonical schema. Projects SHOULD implement these through schema extension or companion metadata, not hidden ad hoc fields.

| pattern | description |
|---|---|
| artifact lineage or parent references | link to the artifact(s) that triggered or preceded this one |
| explicit producer role | record which agent type or subsystem created the artifact |
| checksum or content hash | integrity verification for critical artifacts |
| link to relevant evidence | pointer to command output, test results, or evidence bundle |
| staleness or freshness marker | for derived packets, indicate when the source data was last confirmed current |
| redaction marker | when sensitive content was removed, indicate that redaction occurred |

## Redaction and Sensitive Content

Artifacts SHOULD avoid unnecessary retention of:

- raw secrets
- credentials
- high-risk exploit details beyond operational need
- private personal information not required for the task

When redaction occurs, the artifact SHOULD indicate that redaction happened so later readers do not confuse omission with absence.

## Drift Types

Drift occurs when the layers that govern artifacts fall out of alignment. The following table describes the canonical drift types and their symptoms.

| drift type | description | example |
|---|---|---|
| schema-artifact drift | produced artifacts do not match the schema that governs them | a schema requires a field that produced artifacts do not contain |
| hook-protocol drift | hooks enforce rules that the protocol no longer requires, or miss rules it now does | a hook blocks on an artifact that the protocol no longer requires |
| doc-schema drift | prose documents claim fields or enums that the canonical schema does not support | a protocol document references a `task_kind` value that no schema defines |
| runtime-summary drift | summaries claim states or verdicts that canonical artifacts do not support | a session summary says a task passed but no final verdict artifact exists |

## Drift Handling

When drift is detected:

1. stop trusting the drifted surface as canonical
2. identify which layer is actually authoritative for the question at hand
3. correct the weaker or outdated layer
4. document migration if existing artifacts are affected

The safest default authority for each concern:

| concern | authoritative layer |
|---|---|
| semantics | prose documents |
| structure | schemas |
| executed evidence | runtime artifacts |

## Artifact Validation Failure Modes

When an artifact fails validation, the response depends on the type of failure. The following table summarizes each failure mode and the expected response.

| failure mode | response |
|---|---|
| **required field missing** | reject or quarantine the artifact; request regeneration or correction; block dependent transitions until corrected |
| **`artifact_type` mismatch** | record the mismatch; block downstream consumption if ambiguity matters; correct or replace the artifact |
| **version incompatibility** | allow only if the difference is explicitly backward compatible; otherwise reject or require migration |
| **parseable but semantically impossible** | block downstream progress; treat as semantic invalidity even if JSON parses (e.g., final verdict says `pass` but task is not `verified`, or gate result says `pass` but required checks are absent) |

## Compatibility Guidance

A project that adds local artifact extensions SHOULD:

- version its local schemas
- document extension ownership
- avoid colliding with canonical semantics
- avoid weakening mandatory invariants
- provide migration notes where needed

## Key Statement

Artifacts are the enforceable memory of the workflow. If they are weak, inconsistent, or ambiguous, the rest of the protocol becomes guesswork.
