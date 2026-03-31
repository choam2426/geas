# Schema Reference

Six JSON Schema (draft 2020-12) files define the data contracts between Geas components. Each schema is a machine-readable agreement that enforces what agents produce, consume, and hand off to one another. This document is the authoritative reference for all six schemas.

---

## Overview

| Schema | File | Produced by | Consumed by |
|---|---|---|---|
| Seed | `seed.schema.json` | intake skill | task-compiler |
| TaskContract | `task-contract.schema.json` | task-compiler | context-packet, implementation-contract, evidence-gate |
| ContextPacket | `context-packet.schema.json` | context-packet skill | worker agents |
| ImplementationContract | `implementation-contract.schema.json` | worker agent | Sentinel, Forge (approval) |
| EvidenceBundle | `evidence-bundle.schema.json` | worker/reviewer agents | evidence-gate |
| DecisionRecord | `decision-record.schema.json` | vote-round / debate skill | permanent decision log |

All schemas use `"additionalProperties": false` (where noted) to prevent undocumented fields from silently entering the pipeline.

---

## Schema Relationship Diagram

```
User conversation
      |
      v
  [ intake ] ──────────────── produces ──────> seed.json (Seed)
      |
      v
[ task-compiler ] ──────────── produces ──────> task-contract.json (TaskContract)
      |                                              |
      |──── feeds ──────> [ context-packet ] ──────> context-packet.json (ContextPacket)
      |                                              |
      |                                              v
      |                                         worker agent
      |                                              |
      |──── feeds ──────> [ implementation-contract ] <── worker proposes
      |                          |
      |                    Sentinel + Forge approve
      |                          |
      |                          v
      |                     worker implements
      |                          |
      |                          v
      |               evidence-bundle.json (EvidenceBundle)
      |                          |
      |──── feeds ──────> [ evidence-gate ] ──────> GateVerdict (pass / fail / escalate)
      |                                                    |
      |                                             if escalated
      |                                                    |
      |──── feeds ──────> [ vote-round / debate ] ──────> decision-record.json (DecisionRecord)
```

---

## Schema Details

### 1. Seed

**Location:** `plugin/skills/intake/schemas/seed.schema.json`

**Purpose:** Freezes the mission specification produced by the intake skill before execution begins.

The Seed is the contract between the human stakeholder and the agent team. No task compilation can begin until a valid Seed is on disk. It enforces that scope was consciously considered (at least one `scope_out` item required), acceptance criteria are concrete (minimum 3), and all sections were reviewed via `completeness_checklist`.

#### Required Fields

| Field | Type | Description |
|---|---|---|
| `version` | `string` (const `"1.0"`) | Schema version |
| `mission` | `string` | Refined, unambiguous mission statement |
| `acceptance_criteria` | `array<string>` | Measurable criteria defining done. Minimum 3 items. |
| `scope_in` | `array<string>` | Features explicitly included. Minimum 1 item. |
| `scope_out` | `array<string>` | Features explicitly excluded. Minimum 1 item. Proves scope was considered. |
| `completeness_checklist` | `object` | Binary checklist confirming each section was reviewed and approved by the user |
| `created_at` | `string` (date-time) | ISO 8601 timestamp when the seed was frozen |

#### Optional Fields

| Field | Type | Description |
|---|---|---|
| `target_user` | `string` | Primary user persona or audience |
| `constraints` | `array<string>` | Technical or business constraints (e.g., "Must use relational database") |
| `assumptions` | `array<string>` | Assumptions surfaced during intake that the user confirmed |
| `ambiguity_notes` | `array<string>` | Remaining ambiguities acknowledged but deferred, with rationale |
| `source` | `string` (enum) | Which mode created this seed. See enums below. |
| `readiness_override` | `boolean` | True if user explicitly skipped intake ("just build it") |

#### `completeness_checklist` Properties

| Field | Type | Description |
|---|---|---|
| `mission` | `boolean` | Mission section reviewed |
| `acceptance_criteria` | `boolean` | Acceptance criteria reviewed |
| `scope_out` | `boolean` | Scope-out section reviewed |
| `target_user` | `boolean` | Target user reviewed |
| `constraints` | `boolean` | Constraints reviewed |

#### Enums and Constraints

- `source`: `"initiative"` | `"sprint"` — Tracks which mode created the seed. `"sprint"` indicates a minimal auto-generated seed (not a full Initiative intake). An Initiative run may overwrite a sprint-created seed.
- `acceptance_criteria`: minimum 3 items
- `scope_in`: minimum 1 item
- `scope_out`: minimum 1 item

#### Key Relationships

- Produced by the `intake` skill; written to `.geas/memory/_project/seed.json`
- Read by `task-compiler` as the source of truth for mission, constraints, and acceptance criteria
- `source` field added in v0.2.0 to distinguish sprint vs initiative origins

---

### 2. TaskContract

**Location:** `plugin/skills/task-compiler/schemas/task-contract.schema.json`

**Purpose:** A machine-readable contract defining what a worker must deliver, replacing ambiguous issue descriptions with verifiable agreements.

TaskContracts are the central unit of work in Geas. Every downstream artifact — ContextPackets, ImplementationContracts, EvidenceBundles — references a `task_id` from a TaskContract. The `rubric` field (required since v0.2.0) defines the quality dimensions that must be scored before a task can pass through the Evidence Gate's Tier 3 check.

#### Required Fields

| Field | Type | Description |
|---|---|---|
| `version` | `string` (const `"1.0"`) | Schema version |
| `id` | `string` | Unique task identifier (e.g., `"task-001"`) |
| `title` | `string` | Human-readable task title |
| `goal` | `string` | What this task must achieve, stated as a verifiable outcome |
| `assigned_worker` | `string` | Agent name assigned to implement (e.g., `"pixel"`, `"circuit"`) |
| `acceptance_criteria` | `array<string>` | Specific, verifiable criteria inherited from seed and story |
| `eval_commands` | `array<string>` | Shell commands to mechanically verify the task |
| `rubric` | `array<object>` | Quality rubric dimensions with scoring thresholds. All must pass for Tier 3 entry. |
| `status` | `string` (enum) | Current lifecycle state of the task |
| `created_at` | `string` (date-time) | ISO 8601 creation timestamp |

#### Optional Fields

| Field | Type | Description |
|---|---|---|
| `reviewer` | `string` | Agent name assigned to review (e.g., `"forge"`) |
| `prohibited_paths` | `array<string>` | File/directory paths the worker must not modify |
| `dependencies` | `array<string>` | Task IDs that must complete before this task can start |
| `scope_out` | `array<string>` | Feature-level exclusions this task will not implement. Complements `prohibited_paths` (which are file-level). |
| `retry_budget` | `integer` | Max fix-verify iterations before escalation. Default: `3`. Range: 1–5. |
| `escalation_policy` | `string` (enum) | What happens when retry budget is exhausted. Default: `"forge-review"`. |

#### `rubric` Item Structure

Each item in the `rubric` array has the following required fields:

| Field | Type | Description |
|---|---|---|
| `dimension` | `string` | Quality dimension name (e.g., `"core_interaction"`, `"code_quality"`) |
| `evaluator` | `string` (enum) | Agent responsible for scoring: `"sentinel"` \| `"forge"` \| `"nova"` |
| `threshold` | `integer` | Minimum score (1–5) required to pass. Scores below threshold block Tier 3 entry. |

#### Enums and Constraints

- `status`: `"pending"` | `"in_progress"` | `"in_review"` | `"testing"` | `"passed"` | `"failed"` | `"escalated"`
- `escalation_policy`: `"forge-review"` | `"nova-decision"` | `"pivot"`
- `rubric[].evaluator`: `"sentinel"` | `"forge"` | `"nova"`
- `rubric[].threshold`: integer, 1–5
- `retry_budget`: integer, 1–5, default 3

#### Key Relationships

- Derived from a Seed by the `task-compiler` skill
- `id` is the foreign key referenced by ContextPacket, ImplementationContract, and EvidenceBundle (`task_id`)
- `acceptance_criteria` and `eval_commands` are copied into ContextPacket
- `prohibited_paths` is copied into ContextPacket
- `rubric` thresholds are evaluated against `rubric_scores` in EvidenceBundle
- `scope_out` added in v0.2.0 alongside the seed-level `scope_out`

---

### 3. ContextPacket

**Location:** `plugin/skills/context-packet/schemas/context-packet.schema.json`

**Purpose:** A role-specific briefing for a worker, replacing "read all comments" with a focused, compressed context window.

ContextPackets are generated by the `context-packet` skill immediately before a worker begins a task. They consolidate the relevant subset of the TaskContract — acceptance criteria, eval commands, prohibited paths — alongside design excerpts, tech approach notes, and pointers to prior evidence. A worker should be able to execute their task using only the ContextPacket plus their agent definition.

#### Required Fields

| Field | Type | Description |
|---|---|---|
| `version` | `string` (const `"1.0"`) | Schema version |
| `task_id` | `string` | Reference to the parent TaskContract |
| `target_worker` | `string` | Agent name this packet is written for |
| `issue_summary` | `string` | 1–3 sentence summary of what the task is about |
| `acceptance_criteria` | `array<string>` | Inherited from TaskContract |
| `created_at` | `string` (date-time) | ISO 8601 creation timestamp |

#### Optional Fields

| Field | Type | Description |
|---|---|---|
| `design_excerpt` | `string` | Relevant design decisions from Palette (if applicable) |
| `tech_approach` | `string` | Technical approach from Forge (if applicable) |
| `prohibited_paths` | `array<string>` | Inherited from TaskContract |
| `eval_commands` | `array<string>` | Inherited from TaskContract |
| `known_risks` | `array<string>` | Risks or edge cases the worker should be aware of |
| `prior_evidence` | `array<string>` | Paths to EvidenceBundle files from previous workers in the pipeline |

#### Enums and Constraints

No enums. `additionalProperties` is not restricted at the schema level for this document, but all fields are defined explicitly.

#### Key Relationships

- Produced by the `context-packet` skill, reading from the TaskContract
- `task_id` links back to the TaskContract
- `prior_evidence` contains paths to EvidenceBundle files, enabling workers to build on prior output
- Human comments from collaboration threads have the highest priority when populating this packet

---

### 4. ImplementationContract

**Location:** `plugin/skills/implementation-contract/schemas/implementation-contract.schema.json`

**Purpose:** A pre-implementation agreement between a worker and reviewers, capturing the worker's proposed approach, edge case handling, and demo steps before any code is written.

The ImplementationContract is a gate before implementation begins. The worker proposes concrete actions and the reviewers (Sentinel, Forge) approve. This prevents wasted implementation effort caused by misaligned assumptions. It is distinct from the TaskContract: the TaskContract says *what* must be done; the ImplementationContract says *how* the worker plans to do it.

#### Required Fields

| Field | Type | Description |
|---|---|---|
| `version` | `string` (const `"1.0"`) | Schema version |
| `task_id` | `string` | Reference to the parent TaskContract |
| `worker` | `string` | Agent who will implement (e.g., `"pixel"`, `"circuit"`) |
| `planned_actions` | `array<string>` | Concrete actions the worker will take. Minimum 1 item. |
| `edge_cases` | `array<string>` | Edge cases the worker plans to handle. Minimum 1 item. |
| `non_goals` | `array<string>` | What this implementation explicitly will not do. Prevents scope creep. Minimum 1 item. |
| `demo_steps` | `array<string>` | Step-by-step procedure to demonstrate and verify completion. Minimum 1 item. |
| `status` | `string` (enum) | Current approval state. Default: `"draft"`. |
| `created_at` | `string` (date-time) | ISO 8601 creation timestamp |

#### Optional Fields

| Field | Type | Description |
|---|---|---|
| `state_transitions` | `array<string>` | State transitions the implementation will introduce (e.g., `"unauthenticated -> authenticated"`) |
| `approved_by` | `array<string>` | Agents who approved the contract (e.g., `["sentinel", "forge"]`) |
| `approval_notes` | `string` | Notes from reviewers during approval |

#### Enums and Constraints

- `status`: `"draft"` | `"in_review"` | `"approved"` | `"revision_requested"`
- `planned_actions`: minimum 1 item
- `edge_cases`: minimum 1 item
- `non_goals`: minimum 1 item
- `demo_steps`: minimum 1 item

#### Key Relationships

- `task_id` links to the parent TaskContract
- Must reach `status: "approved"` before the worker begins implementation
- `demo_steps` are reused by Sentinel during QA to verify completion
- `non_goals` complement the TaskContract's `scope_out` and `prohibited_paths` at the implementation strategy level
- Introduced as a new schema in v0.2.0

---

### 5. EvidenceBundle

**Location:** `plugin/skills/evidence-gate/schemas/evidence-bundle.schema.json`

**Purpose:** Structured output from a worker, providing all evidence reviewers and the Evidence Gate need to assess task completion.

EvidenceBundles are the primary output artifact of any agent performing work in the pipeline. Every agent role that produces work — implementer, reviewer, QA, security auditor — submits an EvidenceBundle. The Evidence Gate aggregates bundles and runs three verification tiers against them. The v0.2.0 additions (`self_check`, `rubric_scores`, `state_verification`) give the gate richer signal to work with.

#### Required Fields

| Field | Type | Description |
|---|---|---|
| `version` | `string` (const `"1.0"`) | Schema version |
| `task_id` | `string` | Reference to the parent TaskContract |
| `worker` | `string` | Agent name who produced this evidence |
| `type` | `string` (enum) | Category of evidence |
| `summary` | `string` | Brief summary of what was done and key decisions made |
| `created_at` | `string` (date-time) | ISO 8601 creation timestamp |

#### Optional Fields

| Field | Type | Description |
|---|---|---|
| `files_changed` | `array<string>` | List of file paths created or modified |
| `verify_results` | `object` | Results of mechanical verification (build, lint, test, typecheck) |
| `criteria_results` | `array<object>` | Per-criterion assessment against TaskContract acceptance criteria |
| `screenshots` | `array<string>` | Paths to screenshot files (for UI work) |
| `issues_found` | `array<object>` | Issues discovered during review, QA, or security audit |
| `tech_debt` | `array<object>` | Technical debt identified — not blocking, but should be tracked |
| `self_check` | `object` | Worker's honest self-assessment, guiding Sentinel on where to focus testing |
| `rubric_scores` | `array<object>` | Rubric dimension scores produced by evaluators |
| `state_verification` | `object` | Stateful QA results — API responses and DB state beyond UI surface testing |
| `notes` | `string` | Additional context or observations |

#### `verify_results` Properties

Each of the four check fields uses the same enum:

| Field | Values | Description |
|---|---|---|
| `build` | `"pass"` \| `"fail"` \| `"skip"` | Build check result |
| `lint` | `"pass"` \| `"fail"` \| `"skip"` | Lint check result |
| `test` | `"pass"` \| `"fail"` \| `"skip"` | Test suite result |
| `typecheck` | `"pass"` \| `"fail"` \| `"skip"` | Type check result |

#### `criteria_results` Item Structure

| Field | Type | Required | Description |
|---|---|---|---|
| `criterion` | `string` | yes | The acceptance criterion text |
| `met` | `boolean` | yes | Whether the criterion was met |
| `evidence` | `string` | no | Specific evidence supporting the verdict |

#### `issues_found` Item Structure

| Field | Type | Required | Description |
|---|---|---|---|
| `severity` | `string` (enum) | yes | `"critical"` \| `"major"` \| `"minor"` \| `"suggestion"` |
| `description` | `string` | yes | Description of the issue |
| `file` | `string` | no | File path where the issue was found |
| `line` | `integer` | no | Line number of the issue |

#### `tech_debt` Item Structure

| Field | Type | Required | Description |
|---|---|---|---|
| `severity` | `string` (enum) | yes | `"HIGH"` \| `"MEDIUM"` \| `"LOW"` |
| `title` | `string` | yes | Short label for the debt item |
| `description` | `string` | no | Explanation of the debt |

#### `self_check` Structure (v0.2.0)

`self_check` is an optional object with `additionalProperties: false`. Required sub-fields within it: `known_risks`, `untested_paths`, `confidence`.

| Field | Type | Required | Description |
|---|---|---|---|
| `known_risks` | `array<string>` | yes | Risks the worker is aware of in their implementation |
| `untested_paths` | `array<string>` | yes | Code paths the worker did not test |
| `confidence` | `integer` (1–5) | yes | Worker's self-assessed confidence. Score ≤ 2 triggers stricter rubric thresholds at the Evidence Gate. |
| `possible_stubs` | `array<string>` | no | Implementations left as stubs or placeholders |
| `what_i_would_test_next` | `array<string>` | no | Suggested test areas for QA to prioritize |

#### `rubric_scores` Item Structure (v0.2.0)

| Field | Type | Required | Description |
|---|---|---|---|
| `dimension` | `string` | yes | Dimension name, matching a dimension in the TaskContract rubric |
| `score` | `integer` (1–5) | yes | Score awarded by the evaluator |
| `rationale` | `string` | no | Brief justification for the score |

The Evidence Gate compares each `score` against the corresponding `threshold` in the TaskContract `rubric`. Any dimension below its threshold blocks Tier 3 entry.

#### `state_verification` Structure (v0.2.0)

`state_verification` is an optional object with `additionalProperties: false`. It captures stateful QA results beyond what can be observed through the UI surface.

**`api_checks` item:**

| Field | Type | Required | Description |
|---|---|---|---|
| `endpoint` | `string` | yes | The API endpoint tested |
| `expected_status` | `integer` | yes | Expected HTTP status code |
| `actual_status` | `integer` | yes | Actual HTTP status code returned |
| `pass` | `boolean` | yes | Whether the check passed |
| `notes` | `string` | no | Additional notes about the response |

**`db_checks` item:**

| Field | Type | Required | Description |
|---|---|---|---|
| `description` | `string` | yes | What was being verified |
| `pass` | `boolean` | yes | Whether the check passed |
| `query` | `string` | no | The read-only query that was run |
| `expected` | `string` | no | Expected result |
| `actual` | `string` | no | Actual result |

#### `type` Enum Values

`"design"` | `"implementation"` | `"review"` | `"qa"` | `"security"` | `"performance"` | `"documentation"` | `"product-review"`

#### Key Relationships

- `task_id` links to the parent TaskContract
- `rubric_scores` are evaluated against `rubric` in the TaskContract
- `self_check.confidence` influences Evidence Gate scoring thresholds
- `state_verification` complements `verify_results` (mechanical) and `criteria_results` (semantic)
- Multiple EvidenceBundles may exist for one `task_id`, each from a different agent role

---

### 6. DecisionRecord

**Location:** `plugin/skills/evidence-gate/schemas/decision-record.schema.json`

**Purpose:** A durable record of architecture, product, or escalation decisions, replacing ephemeral debate comments with structured, traceable decisions.

DecisionRecords are written at the end of a vote-round or debate skill run. They capture what was decided, why, and who decided it. This creates a permanent audit trail for decisions that would otherwise exist only in conversation threads. A DecisionRecord may supersede a previous one if the team reverses course.

#### Required Fields

| Field | Type | Description |
|---|---|---|
| `version` | `string` (const `"1.0"`) | Schema version |
| `id` | `string` | Unique decision identifier (e.g., `"dec-001"`) |
| `title` | `string` | Short title describing the decision |
| `context` | `string` | Why this decision was needed — the problem or trigger |
| `decision` | `string` | The chosen option and what it means concretely |
| `reasoning` | `string` | Why this option was chosen over alternatives |
| `decided_by` | `string` | Agent who made the final call (e.g., `"nova"`, `"forge"`) |
| `created_at` | `string` (date-time) | ISO 8601 creation timestamp |

#### Optional Fields

| Field | Type | Description |
|---|---|---|
| `options` | `array<object>` | Options that were considered before the decision |
| `trade_offs` | `string` | What the team is giving up or accepting as risk |
| `participants` | `array<string>` | Agents involved in the discussion |
| `related_task_id` | `string` | TaskContract ID this decision relates to (if any) |
| `supersedes` | `string` | ID of a previous DecisionRecord this one replaces |

#### `options` Item Structure

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | yes | Short label for the option |
| `description` | `string` | yes | Description of the option |
| `pros` | `array<string>` | no | Arguments in favor |
| `cons` | `array<string>` | no | Arguments against |

#### Enums and Constraints

No enums. `additionalProperties` is not restricted at the schema level for this document.

#### Key Relationships

- `related_task_id` optionally links to a TaskContract, typically when a decision is triggered by an escalation from the Evidence Gate
- `supersedes` enables tracing the history of reversed decisions
- Written to `.geas/memory/_project/decisions/` as permanent project history
- Produced by the `vote-round` and `debate` skills

---

## New Fields Added in v0.2.0

The following fields were added to the schema set in v0.2.0. They implement rubric-based quality scoring, worker self-honesty, stateful QA verification, and multi-mode seed tracking.

### `rubric` in TaskContract (required)

**Schema:** TaskContract
**Type:** `array<object>`
**Status:** Required

Added as a required field in v0.2.0. Each TaskContract must now define one or more quality dimensions with an assigned evaluator agent and a minimum passing threshold. The Evidence Gate uses these thresholds to gate Tier 3 approval. Tasks compiled before this field was required must be regenerated.

### `self_check` in EvidenceBundle (optional object)

**Schema:** EvidenceBundle
**Type:** `object`
**Status:** Optional, but strongly recommended for implementation bundles

Captures the worker's honest self-assessment before submitting evidence. The `confidence` sub-field (required within `self_check`) directly affects Evidence Gate behavior: a score of 2 or below signals to Sentinel to apply stricter rubric thresholds. `untested_paths` and `what_i_would_test_next` guide Sentinel's QA focus without requiring Sentinel to discover these areas independently.

### `rubric_scores` in EvidenceBundle (optional array)

**Schema:** EvidenceBundle
**Type:** `array<object>`
**Status:** Optional; required for Tier 3 gate passage

Evaluators (Sentinel for QA dimensions, Forge for code quality dimensions) populate this array after scoring the work. The Evidence Gate aggregates all `rubric_scores` and compares each `score` against the corresponding `threshold` in the TaskContract `rubric`. A missing score for a required dimension is treated as a gate failure.

### `state_verification` in EvidenceBundle (optional object)

**Schema:** EvidenceBundle
**Type:** `object`
**Status:** Optional; required for tasks with API or database acceptance criteria

Provides a structured record of stateful QA that cannot be captured by `verify_results` (which runs shell commands) or `criteria_results` (which relies on agent observation). `api_checks` records live HTTP responses; `db_checks` records read-only database queries and their results. Both give the Evidence Gate auditable, machine-readable evidence of system state.

### `scope_out` in TaskContract (optional array)

**Schema:** TaskContract
**Type:** `array<string>`
**Status:** Optional

Mirrors the seed-level `scope_out` at the task level. While `prohibited_paths` restricts file-level access, `scope_out` expresses feature-level exclusions for this specific task. This prevents scope creep within a task without requiring the worker to re-read the full seed.

### `source` in Seed (optional string enum)

**Schema:** Seed
**Type:** `string` enum: `"initiative"` | `"sprint"`
**Status:** Optional

Tracks which execution mode created the seed. A `"sprint"` seed is auto-generated and minimal; it may be overwritten by a full `"initiative"` run. This enables the system to detect when a project started via sprint needs a proper intake pass.
