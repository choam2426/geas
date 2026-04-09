# 09. Runtime Artifacts and Schemas

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

Each task produces three artifact groups under `tasks/{tid}/`:

| artifact | file | description |
|---|---|---|
| task contract | `contract.json` | defines what the task must accomplish, its classification, and acceptance criteria |
| context packets | `packets/{agent}.md` | role-specific briefings delivered to agents before work begins |
| execution record | `record.json` | single file accumulating all pipeline step outputs (see below) |
| evidence files | `evidence/{agent}.json` | role-based agent deliverables (implementer, reviewer, tester, authority) |

#### record.json sections

The execution record accumulates sections as the pipeline progresses. Each section is added via CLI (`geas task record add --section {name}`). Duplicate adds overwrite.

| section | added at step | key fields |
|---|---|---|
| `implementation_contract` | implementation contract approval | planned_actions, edge_cases, status |
| `self_check` | worker self-assessment | confidence (1-5), known_risks, summary |
| `gate_result` | evidence gate | verdict (pass/fail/block/error), tier_results, rubric_scores |
| `challenge_review` | challenger review (high/critical) | concerns, blocking |
| `verdict` | final verdict | verdict (pass/iterate/escalate), rationale |
| `closure` | closure assembly | change_summary, reviews, open_risks |
| `retrospective` | task retrospective | what_went_well, what_broke, memory_candidates |

#### evidence roles

Evidence files use role-based required fields:

| role | required fields | typical agents |
|---|---|---|
| implementer | summary, files_changed | software-engineer, platform-engineer |
| reviewer | summary, verdict, concerns | design-authority, security-engineer, challenger |
| tester | summary, verdict, criteria_results | qa-engineer |
| authority | summary, verdict, rationale | product-authority |

### Session and orchestration artifacts

Artifacts that coordinate runtime execution across tasks and sessions.

| artifact | file | description |
|---|---|---|
| `run.json` | `state/run.json` | mission-level runtime state including phase, active tasks, and checkpoint |
| `events.jsonl` | `state/events.jsonl` | append-only event log for all pipeline events (single source) |
| recovery packet | `recovery/` | assessment of interrupted state for the next session |
| health check | (stdout) | periodic health signal collection |
| lock / lane state | `state/locks.json` | workspace lock ownership and parallel lane assignments |

### Evolution artifacts

Artifacts produced during the Evolving phase, when the team reflects on performance and updates its processes.

| artifact | file | description |
|---|---|---|
| retrospective | `record.json` retrospective section | structured reflection on what worked, what failed, and what to change |
| rules update | `evolution/rules-update.json` | proposed or applied changes to project rules |
| debt register | `evolution/debt-register.json` | tracked technical or process debt items |
| gap assessment | `evolution/gap-assessment.json` | identified gaps between protocol requirements and actual practice |

### Memory artifacts

Two-file memory system: `rules.md` for project knowledge, agent markdown files for role-specific notes.

| artifact | file | description |
|---|---|---|
| rules | `.geas/rules.md` | project conventions + learned rules + role-specific rules (unified) |
| agent memory | `memory/agents/{agent}.md` | per-agent markdown notes, injected into agent context |

## Canonical Metadata

Every canonical artifact SHOULD expose shared metadata so that validators, recovery engines, and reviewers can identify and trust it. The exact field names are schema-governed; the semantics are protocol-governed.

| field | description |
|---|---|
| `artifact_type` | identifies which kind of artifact this is |
| `version` | schema or artifact version for compatibility checking |
| creation timestamp | when the artifact was produced |
| producing role or subsystem | the agent whose judgment or expertise produced the artifact's content — not necessarily the agent that physically wrote the file (the orchestrator often writes on behalf of others) |
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

## Directory Structure

The canonical `.geas/` runtime directory layout:

```
.geas/
  state/
    run.json                          # mission runtime state
    events.jsonl                      # append-only event log
  rules.md                            # conventions + rules + role-specific rules
  recovery/                           # session recovery packets
  memory/
    agents/{agent}.md                 # per-agent memory notes
  missions/{mid}/
    spec.json                         # mission spec
    design-brief.json                 # design brief
    decisions/                        # vote round results
    phase-reviews/                    # phase transition reviews
    evolution/                        # gap-assessment, debt-register, rules-update
    tasks/{tid}/
      contract.json                   # task contract (definition)
      packets/{agent}.md              # context packets (agent briefings)
      record.json                     # execution record (pipeline outputs)
      evidence/{agent}.json           # agent evidence files
```

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

## Overwrite Policy

Sections in `record.json` and evidence files may be overwritten by subsequent writes. This is by design — the pipeline is iterative (verify-fix-loop, revalidation). Semantic correctness after overwrites is enforced by transition guards at state change boundaries, not by file immutability. Guard checks re-read current state on every transition attempt.

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
