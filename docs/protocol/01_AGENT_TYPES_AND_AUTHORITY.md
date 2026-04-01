# 01. Agent Types and Authority

## Purpose

The protocol defines agents by **type**, not by unique name. A type specifies role, decision authority, prohibitions, and deliverable responsibilities.

## Core Authorities

### `orchestration_authority`
Responsibilities:
- mission interpretation
- mode/phase selection
- task decomposition and priority adjustment
- specialist assignment
- closure packet assembly
- recovery / context assembly / memory retrieval orchestration

Decision authority:
- task scheduling
- concurrency budget allocation
- stale/revalidation requests
- vote round invocation

Prohibitions:
- Must not directly issue a product final verdict
- Must not manipulate a closure packet while skipping specialist review

### `product_authority`
Responsibilities:
- Direction and priority judgment during discovery
- Final verdict (`pass | iterate | escalate`) at the end of delivery
- Product-perspective trade-off judgment when disagreements remain

Prohibitions:
- Must not act as primary worker by directly writing raw implementation
- Must not mark a task as passed when required evidence is missing

## Specialist Types

### `architecture_authority`
- Reviews system boundaries, contracts, dependencies, and long-term maintainability

### `frontend_engineer`
- Implements UI/browser interactions

### `backend_engineer`
- Implements APIs, services, persistence, and domain logic

### `ui_ux_designer`
- Reviews interaction models, visual intent, user flows, and copy intent

### `qa_engineer`
- Reviews acceptance criteria, demo paths, test readiness, and failure paths

### `security_engineer`
- Reviews auth, secret handling, permission boundaries, and abuse paths

### `devops_engineer`
- Reviews runtime/service/deploy/env/bootstrap concerns

### `technical_writer`
- Handles docs-first tasks, docs-impact reviews, migration notes, and operator guidance

### `critical_reviewer`
- Aggressively detects opposing viewpoints, weak assumptions, insufficient evidence, and ship risks
- Must be included in required_reviewer_types for any task where `risk_level` is `high` or `critical` (automatically added in Step 2)
- Pre-ship challenge: must raise at least one reason not to ship before the closure packet is finalized, and must provide evidence that the concern has been addressed

### `repository_manager`
- Supports integration hygiene, commit structure, release hygiene, and repo cleanliness

### `process_lead`
- Drives retrospective, memory promotion hygiene, and protocol drift improvement
- Leads retrospective collection at phase boundaries, identifies recurring patterns, and proposes candidates for promotion to rules.md
- Obtains endorsing authority approval for memory promotions and records promotion history in `memory-review.json`
- When protocol drift is detected, writes a deviation report and delivers it to orchestration_authority

## Decision Boundary

| decision | primary owner | note |
|---|---|---|
| mode selection | orchestration_authority | based on mission signals |
| task routing | orchestration_authority | derives the required specialist set |
| implementation approach | primary specialist + architecture_authority | requires contract review |
| evidence gate result | gate runner / verifier | objective verdict |
| readiness round result | reviewers set | deliberative |
| final closure | product_authority | task only |
| durable memory promotion | process_lead + endorsing authority | requires approver per type |

## Required Reviewer Routing Algorithm

A task's `required_reviewer_types[]` is determined by the following algorithm. Each step is cumulative (reviewers added in previous steps are retained).

### Step 1 -- Default reviewers based on task_kind

| task_kind | default required reviewer |
|---|---|
| `code` | `architecture_authority` |
| `docs` | `technical_writer` |
| `config` | `devops_engineer` |
| `design` | `ui_ux_designer` |
| `audit` | `security_engineer` |
| `release` | `devops_engineer`, `repository_manager` |

### Step 2 -- Additional reviewers based on risk_level

| risk_level | additional reviewer |
|---|---|
| `low` | (none) |
| `normal` | (none) |
| `high` | `critical_reviewer`, `security_engineer` |
| `critical` | `critical_reviewer`, `security_engineer`, `qa_engineer` |

### Step 3 -- Additional reviewers based on scope.paths surface signals

If files matching the following conditions are included in `scope.paths`, the corresponding reviewer is added.

| condition | additional reviewer |
|---|---|
| UI/frontend files (e.g., `*.tsx`, `*.vue`, `*.css`, `components/`, `pages/`) | `ui_ux_designer`, `frontend_engineer` |
| API/server files (e.g., `routes/`, `api/`, `controllers/`, `services/`) | `backend_engineer` |
| Infrastructure/deploy files (e.g., `Dockerfile`, `*.yaml` in infra/, CI config) | `devops_engineer` |
| Auth/permission files (e.g., `auth/`, `permissions/`, `*.policy`) | `security_engineer` |
| Test files (e.g., `*.test.*`, `*.spec.*`, `__tests__/`) | `qa_engineer` |

### Step 4 -- Adjustment based on gate_profile

| gate_profile | condition |
|---|---|
| `closure_ready` | `qa_engineer` must be added |
| `artifact_only` | code reviewers (architecture_authority, frontend/backend_engineer) may be excluded |

### Step 5 -- Deduplication and minimum guarantee

Remove duplicates from the final `required_reviewer_types[]`. If a type identical to primary_worker_type is included, that entry is retained (this does not mean a different instance of the same type is needed for self-review; it means the expertise of that type is required for the review).

### Step 6 -- Empty array prevention

If `required_reviewer_types[]` is empty after Steps 1-5, add `architecture_authority` as the default reviewer. Every task must have at least one reviewer.

## Specialist Conflict Resolution

When two or more specialists reach conflicting judgments (e.g., architecture_authority argues "refactoring required" while product_authority argues "ship immediately"), the following procedure applies.

1. **Conflict detection**: If specialist-review results for the same task split between `pass` and `block` (or mutually contradictory conditional passes), it is treated as a conflict.
2. **Vote round invocation**: orchestration_authority invokes `vote_round`. Participants are the conflicting parties plus the remaining required_reviewer_types for the task.
3. **Applying vote round results**:
   - If consensus is reached: follow the consensus outcome.
   - If a majority is reached: adopt the majority opinion, but record the minority opinion in a `decision-record`.
   - If consensus fails: product_authority makes the final decision based on product-perspective trade-offs, and records the rationale in a `decision-record`.
4. **Escalation**: If a structural conflict cannot be resolved even by product_authority judgment, the task transitions to `escalated` and is handed off to a human stakeholder.

## Single-Agent Session

In a session where only a single agent is available, that agent performs multiple type roles sequentially. Even in this case, the following rules are maintained:
- `orchestration_authority` and `product_authority` may be performed by the same agent, but an explicit role switch to product_authority must be recorded when issuing a final verdict.
- Specialist review artifacts corresponding to each entry in required_reviewer_types must be created separately per type.
- Since quorum shortfall in vote rounds during specialist conflict resolution is unavoidable, the process falls through to product_authority judgment after 2 consecutive quorum shortfalls.

### Single-Agent Specialist Conflict Safeguard

When a specialist conflict occurs in a single-agent session (where self-judgment bias exists because the same agent plays both sides), the following structural safeguards apply:

1. **Recording obligation**: The conflict must be recorded in `decision-record.json`. Both positions (which type role produced which judgment), the rationale for each, and the final chosen verdict must be documented.
2. **Escalation for high risk and above**: If the conflict occurs on a task with `risk_level = high` or `critical`, the verdict transitions to `escalated` and human stakeholder intervention is requested. A single agent's self-judgment cannot resolve conflicts at high risk or above.
3. **Self-judgment for low/normal risk**: If the conflict occurs on a task with `risk_level = low` or `normal`, the single agent may render a verdict. However, the conflict must be recorded in the retrospective's `what_was_surprising[]` to remain a candidate for future review.

## Type Naming Rules for Artifacts

Artifacts use type-neutral names.
Examples:
- `specialist-review.json`
- `closure-packet.json`
- `final-verdict.json`
- `memory-entry.json`
- `memory-review.json`

Unique-name-based filenames are not used in the canonical spec.
