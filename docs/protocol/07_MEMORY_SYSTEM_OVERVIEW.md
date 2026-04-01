# 07. Memory System Overview

## Purpose

Geas memory is not a simple note storage. It is an **adaptive operational system that structures recurring mistakes, good implementation patterns, environment considerations, and product decision precedents to simultaneously improve quality and speed of future tasks.**

Core goals:
1. Prevent recurrence of the same failures
2. Reuse good patterns
3. Enable fast resumption after recovery/compaction
4. Improve specialist review quality
5. Reduce context window waste
6. Ensure retrospectives actually change behavior

## Core Principles

### 1) Memory evolves
A memory item is not durable truth from the start. It goes through: observation -> candidate -> provisional -> stable -> superseded / archived.

### 2) Memory weakens without evidence
Memory without artifact refs, evidence count, successful reuse, failed reuse, or contradiction history cannot be promoted to a strong rule.

**Confidence Scoring Model:**
- Initial confidence is determined by evidence count:
  - 1 evidence_ref -> `confidence = 0.4`
  - 2 evidence_refs -> `confidence = 0.6`
  - 3 or more evidence_refs -> `confidence = 0.8`
- Subsequently adjusted based on application results (modifiers):
  - Per successful reuse -> `+0.1`
  - Per failed reuse -> `-0.1`
  - Per contradiction -> `-0.2`
- Confidence upper bound is `1.0`, lower bound is `0.0`
- If `confidence < 0.3`, a decay review is automatically triggered (process_lead + domain authority decide whether to retain/archive/supersede)
- If a decay review is triggered but the process_lead or domain authority is not present in the current session: change the memory's state to `"under_review"` and temporarily exclude it from retrieval. The review is performed when the authority returns in the next session.

### 3) Memory has scope
All memory has an applicable scope. The scopes below are synchronized with the `memoryScope` enum in `_defs.schema.json`:
- `task` — applies to a single task only
- `mission` — applies to the entire current mission
- `project` — applies to the entire project
- `agent` — applies to a specific agent type
- `global` — applies to all projects

### 4) Memory enters only within the retrieval budget
It is not injected without limits. Only applicable and verified memory enters the context. For specific budgets, see the Role-Specific Budgets in doc 09.

### 5) Memory is re-evaluated based on application results
After applying memory to an actual task, the results are recorded in `memory-application-log.json`, and those results change future confidence. For specific confidence adjustment rules, see the Confidence Scoring Model above.

### 6) Memory must connect to a behavior surface
If memory is only stored without changing future behavior, it is not evolution. Geas connects memory to behavior through the following surfaces:
- `.geas/rules.md`
- project_memory
- agent_memory
- risk_memory
- packet builder
- task admission / gate / readiness review focus

## Memory Layer Model

Memory layers are a logical classification representing the storage/retrieval scope of memory entries. This is a separate concept from the `memoryScope` enum in `_defs.schema.json` (`task`, `mission`, `project`, `agent`, `global`): layers define the purpose and lifespan of memory, while scope defines the applicable range.

### `session_memory`
Summary of the current session and recent flow. A key anchor for compaction/recovery. Persisted as `session-latest.md`.

### `task_focus_memory`
Locally relevant memory compressed for the current task. Persisted as `task-focus/<task-id>.md`.

### `mission_memory`
Strategy, constraints, and temporary decisions specific to this mission. Persisted as `mission-summary.md`.

### `episodic_memory`
Event-centered memory obtained from individual tasks/incidents/recoveries. Persisted as `memory-entry.json` (`memory_type = "failure_lesson"` or `"decision_precedent"`).

### `project_memory`
Repeatedly verified project rules, environment tips, and architecture precedents. Persisted as `memory-entry.json` (`memory_type = "project_rule"`, `"architecture_precedent"`, `"integration_pattern"`, etc.).

### `agent_memory`
Role-specific memory that a particular agent type repeatedly references. Persisted as `memory-entry.json` (`memory_type = "agent_rule"`, `"test_strategy"`, `"security_pattern"`, etc.).

### `risk_memory`
Past failure patterns, rollback causes, false green incidents, drift hotspots. Persisted as `memory-entry.json` (`memory_type = "risk_pattern"`, `"failure_lesson"`).

## Canonical Memory Artifact Types

- `memory-candidate.json`
- `memory-entry.json`
- `memory-review.json`
- `memory-application-log.json`
- `memory-packet.json`
- `memory-index.json`
- `retrospective.json`
- `rules-update.json`

### Empty Memory Index

When `memory-index.json` is empty or does not exist (first session, initial project):
1. The retrieval engine skips the L2 (applicable memory) stage and assembles the packet using only L0/L1.
2. The packet's `applicable_memory_ids[]` becomes an empty array.
3. This is normal behavior; the index is initialized when a memory candidate is generated from the first `passed` task's retrospective.

## Ownership Rules

- `orchestration_authority`: candidate extraction, retrieval orchestration
- `process_lead`: retrospective curation, rules update hygiene, promotion cadence
- `product_authority`: product/priority/UX precedent approval
- `architecture_authority`: architecture/system precedent approval
- `qa_engineer`: QA recipe / failure-path memory approval
- `security_engineer`: security warning / abuse pattern approval

## Memory Types (Recommended)

The types below are synchronized with the `memoryType` enum in `_defs.schema.json`:

- `project_rule` — rules/conventions applicable to the entire project
- `agent_rule` — heuristics applicable only to a specific agent type
- `decision_precedent` — rationale and outcomes of past decisions
- `failure_lesson` — lessons extracted from failures (formerly `incident`)
- `security_pattern` — security-related warnings/patterns (formerly `security_warning`)
- `performance_tip` — performance optimization guidelines
- `test_strategy` — QA/test strategies (formerly `qa_recipe`)
- `integration_pattern` — integration/build/deploy patterns
- `ux_pattern` — UI/UX patterns and accessibility rules
- `architecture_precedent` — architecture decision precedents
- `process_improvement` — process improvements (formerly `gap_pattern`, `debt_pattern`)
- `risk_pattern` — recurring risk patterns

## Behavior Change Mechanisms

Memory changes the behavior of the next task through 5 pathways:

1. `rules.md` update -> reflected in L0 pinned invariants of all packets
2. `agent_memory` layer update (`memory_type = "agent_rule"`, etc.) -> injected during type-specific subagent spawn
3. `risk_memory` layer update (`memory_type = "risk_pattern"`, `"failure_lesson"`) -> strengthens readiness round auto-trigger
4. `project_memory` layer update (`memory_type = "project_rule"`, etc.) -> strengthens default checks in task compiler and implementation contract
5. Harmful reuse detection -> memory weakening (see doc 08 Harmful Reuse Rollback Procedure) / rule rollback (see doc 14 Harmful Reuse Feedback Loop)

### Conflict Resolution Priority

When conflicting guidance arises from different behavior surfaces, follow this priority order (higher takes precedence):

1. **`rules.md`** — project-wide established rules. Highest priority.
2. **`project_memory`** — repeatedly verified project-level knowledge.
3. **`agent_memory`** — role-specific accumulated knowledge.
4. **`risk_memory`** — warnings based on past failures.

On conflict, record the higher-priority memory_id in the `conflict_with` field of the lower-priority memory, and suppress that memory from retrieval. The process_lead resolves the conflict in the next retrospective.

### Harmful Reuse Definition

Harmful reuse occurs when a memory entry is applied to a task but the task outcome worsens. Specifically:
- Evidence gate failure is related to the memory's guidance
- Technical debt increased after application
- Regression occurred after application

Detection criteria: classified as harmful reuse when the `effect` field in `memory-application-log.json` is `"negative"` or `"neutral_but_risky"`.

## Memory Verification

Memory reliability must go through staged verification (promotion). The promotion path is `candidate -> provisional -> stable -> canonical`.

Detailed promotion conditions for each stage are canonically defined in **08_EVOLVING_MEMORY_LIFECYCLE.md Promotion Rules**. Summary:
- `candidate -> provisional`: 2+ evidence_refs, or 2+ same-type incidents, or explicit approval from the domain authority
- `provisional -> stable`: 3+ successful applications + 0 contradictions + domain authority review
- `stable -> canonical`: 5+ successful applications (across 3+ different tasks) + joint approval

## Core Constraint

Memory can store **facts, rules, warnings, and precedents**, but must not promote baseless stylistic preferences to durable memory.

## Failure Modes and Recovery

### 1. memory-index.json is corrupted or missing

`memory-index.json` is the summary index of all memory entries. If this file is corrupted (JSON parse failure) or deleted:

- **Detection**: detected by load failure of `memory-index.json` during memory retrieval.
- **Recovery procedure**: traverse individual `memory-entry.json` files under `.geas/memory/` to rebuild the index. Collect each entry's `memory_id`, `type`, `scope`, `status`, and `confidence` to generate a new `memory-index.json`.
- **Constraint**: memory retrieval is suspended during rebuild. Request verification from `process_lead` after rebuild completes.
- **Recording**: record the rebuild event in `memory-application-log.json` as an `effect = "index_rebuild"` entry.

### 2. memory-packet.json references a non-existent memory_id

When a `memory_id` included in `memory-packet.json` does not correspond to an actual memory entry during context packet generation:

- **Behavior**: skip the entry and log a warning. **Does not block task execution.**
- **Warning record**: record `effect = "reference_miss"`, the missing `memory_id`, and the reference timestamp in `memory-application-log.json`.
- **Follow-up**: the `process_lead` investigates the cause of the missing reference in the next retrospective. Possible causes: the memory entry was archived/superseded but not removed from the packet, or the entry was lost due to a filesystem error.
- **Prevention**: when a memory entry's status changes to `archived` or `superseded`, it is recommended to update packets that reference that `memory_id`.

### 3. Confidence score drops to 0 or below due to accumulated penalties

When `failed reuse` (-0.1) and `contradiction` (-0.2) accumulate to push confidence to a calculated negative value:

- **Behavior**: clamp confidence to `0.0` (applying the lower bound rule of `0.0`).
- **Immediate trigger**: when confidence reaches 0.0, a decay review is immediately triggered (as the general threshold of `< 0.3` is also met).
- **Decay review content**: `process_lead` + the relevant domain authority review the memory and decide one of:
  - `archive` — preserve the memory but exclude from retrieval
  - `supersede` — replace with a new memory (record superseding_memory_id)
  - `retain` — maintain by adding supporting evidence (evidence_refs must be added; retain without additions is not allowed)
- **Recording**: record the decay review result in `memory-review.json` and update the `status` and `confidence` in `memory-entry.json`.

### 4. Two memories contradict each other while both are in stable state

When two `status = stable` memory entries contain conflicting guidance (e.g., memory A says "always use envelope pattern for API responses" and memory B says "allow flat responses for simple endpoints"):

- **Detection**: detected when memories of the same scope/type provide conflicting guidance during retrieval. Also detected when both memories are applied to the same task in `memory-application-log.json` and one records a `negative` effect.
- **Immediate action**: transition both memories to `status = under_review`. Memories in `under_review` state are excluded from retrieval (not injected into tasks).
- **Resolution procedure**: the `process_lead` reviews both memories together with the relevant domain authority. Possible outcomes:
  - Transition one to `superseded` and keep the other
  - Transition both to `superseded` and create a new unified memory entry
  - Refine scopes so each is valid under a different scope
- **Constraint**: neither memory can be injected into task context until the `process_lead`'s resolution.
- **Recording**: record the counterpart's `memory_id` in each memory entry's `conflict_with` field, and record the resolution result in `memory-review.json`.

### 5. Required authority for memory promotion is absent

When the domain authority required for memory status promotion (e.g., `provisional` -> `stable`, `stable` -> `canonical`) is not present in the current session or cannot respond:

- **Behavior**: register the promotion in a queue and mark the memory with a `pending_review` indicator. **Does not block task execution.**
- **Current status maintained**: memory whose promotion is not yet complete retains its current status. For example, memory in `provisional` state remains as `provisional` and participates in retrieval (subject to retrieval budget and confidence).
- **Queue recording**: record `memory_id`, requested `target_status`, required `required_authority`, and request time in `.geas/memory/pending-promotions.json`.
- **Resolution**: when the authority becomes active in the next session, the `process_lead` checks the pending promotion queue and processes reviews sequentially.
- **Long-term unresolved**: if pending status persists for 3+ sessions, the `process_lead` designates an alternative authority or reviews the promotion criteria in the retrospective.
