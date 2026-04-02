# 09. Memory Retrieval and Context Engine

## Purpose

Even as the amount of memory grows, the system degrades if it overwhelms the context window. Therefore, retrieval and packet assembly constitute half of the memory system.

## Retrieval Inputs

Retrieval considers the following inputs:
- current phase / mission phase
- task kind / risk level
- scope.paths
- touched paths
- reviewer set
- known risks
- recent failures / incidents
- mission intent
- agent type
- applicable rules.md entries

## Retrieval Priority Bands

### L0 — pinned invariants
Minimum core rules that are always included:
- session phase
- mission phase
- focus task id
- task goal / acceptance
- current rewind status
- hard protocol invariants
- approved `rules.md` entries

### L1 — task-local packet
Baseline / scope / contract / recent review / recent memory directly relevant to the current task

### L2 — applicable memory
Stable/provisional memory matching the current task and role. Items with `memory_type` of `agent_rule` are prioritized on role match; items with `risk_pattern` are prioritized based on risk level

### L3 — drill-down
Detailed logs, past incidents, and superseded memory opened only when needed

## Memory Packet

`memory-packet.json` is a structured summary to be injected into a specific agent.

Minimum fields:
- `target_agent_type`
- `target_task_id`
- `pinned_items[]`
- `applicable_memory_ids[]`
- `caution_items[]`
- `suppressed_memory_ids[]`
- `assembly_reason`

## Retrieval Scoring Heuristic

The retrieval score for each memory entry is calculated using the following weights:

| Factor | Weight | Description |
|---|---|---|
| `scope_match` | `0.25` | Degree to which the memory's scope matches the current task scope (0.0-1.0) |
| `path_overlap` | `0.20` | Overlap ratio between the memory's related paths and the task's touched paths (0.0-1.0) |
| `role_match` | `0.15` | Whether the memory's target agent type matches the current agent type (0 or 1) |
| `freshness` | `0.15` | More recent based on `last_confirmed_at`. Calculation: `max(0.0, 1.0 - (days_since_last_confirmed / 180))`. 0.0 if 180+ days have passed |
| `confidence` | `0.10` | Use the memory's current confidence value as-is (0.0-1.0) |
| `reuse_success` | `0.10` | `successful_reuses / (successful_reuses + failed_reuses)` (0.0-1.0; 0.5 if no application history) |
| `contradiction_penalty` | `-0.15` | Subtract `min(contradiction_count * 0.05, 0.15)` |

**Formula:**
```
raw_score = (scope_match * 0.25) + (path_overlap * 0.20) + (role_match * 0.15)
          + (freshness * 0.15) + (confidence * 0.10) + (reuse_success * 0.10)
          - contradiction_penalty
score = clamp(raw_score, 0.0, 1.0)
```

If the task's risk_level is `high` or above, a `+0.10` bonus is applied to memories with `risk_pattern` type.

### Scope Match Calculation

Compare the memory's `scope` with the current task's context scope to produce a 0.0-1.0 score.

| Memory Scope \ Task Context | task | mission | project |
|---|---|---|---|
| `task` (same task) | 1.0 | 0.3 | 0.1 |
| `task` (different task) | 0.2 | 0.3 | 0.1 |
| `mission` | 0.7 | 1.0 | 0.5 |
| `project` | 0.5 | 0.7 | 1.0 |
| `agent` (same agent type) | 0.8 | 0.8 | 0.8 |
| `agent` (different agent type) | 0.1 | 0.1 | 0.1 |
| `global` | 0.4 | 0.4 | 0.6 |

### Path Overlap Calculation

Related paths for a memory are extracted from `evidence_refs[]`. If an evidence_ref points to a task, use that task's `scope.paths`. If an evidence_ref points to a file artifact, use that file path.

`path_overlap = |memory_paths intersection task_paths| / |task_paths|` (0.0 if task_paths is empty)

### Freshness Calculation

`last_confirmed_at` is not a direct field of memory-entry; it is derived from the `created_at` of the most recent `effect = "positive"` entry in `memory-application-log.json` for that memory_id. If there are no positive application logs, use the memory-entry's own `created_at`.

`freshness = max(0.0, 1.0 - (days_since_last_confirmed / 180))`

### Edge Cases

- **memory-index.json is empty**: the retrieval engine returns empty results and skips the L2 stage. The packet's `applicable_memory_ids[]` becomes an empty array. This is normal behavior (see doc 07 Empty Memory Index).
- **All memories have the same score**: prioritize entries with higher `confidence`. If confidence is also equal, prioritize entries with the most recent `last_confirmed_at`.
- **Budget is 0**: do not include L1/L2 memory; assemble the packet with only L0 (pinned invariants). Record all candidates in `suppressed_memory_ids[]` with `reason: "budget_zero"`.

## Role-Specific Budgets

### `orchestration_authority`
- pinned invariants: 8-12 bullets
- task-local packet: 1 compact summary
- memory entries: 5-8 max

### specialist
- task-local packet: strongly prioritized
- memory entries: 3-5 max
- caution items: 1-2

### `product_authority`
- Full implementation detail replaced by closure packet + high-signal memory only
- memory entries: 3 max

## Context Assembly Algorithm

1. Compose pinned invariants (L0 — includes anti-forgetting items, not counted against role budget)
2. Generate task-local packet from task contract / implementation contract / recent reviews
3. Calculate applicable subset of rules.md
4. Extract memory candidates via retrieval engine
5. Sort by score and select top-N within budget
6. In case of tied scores, prioritize entries with higher `confidence`
7. Record entries excluded due to budget overflow in `suppressed_memory_ids[]` with `reason: "budget_overflow"` for each
8. Mark cautionary incidents separately
9. Record packet version (format: `"{task_id}-{sequence_number}"`, sequence_number increments by 1 on each regeneration)
10. Record packet ref in `run.json`

### Packet Versioning

- `packet_version` format: `"{task_id}-{sequence_number}"`
  - `task_id`: the target task's ID
  - `sequence_number`: increments by 1 each time the packet is generated/regenerated for that task (initial value 1)
- Previous versions of the packet are not stored (only the latest packet is valid)

## Packet Staleness Rules

A packet is stale if any of the following occur:
- Task `base_commit` has changed
- Required reviewer set has changed
- A new integration result has appeared
- A gate fail or rewind has occurred
- Memory packet version has changed
- A rules update has been applied
- The focus task has changed
- One or more memories included in the packet has transitioned to `under_review` or `superseded` state

For staleness caused by `under_review` or `superseded` state transitions, add the affected memory to the regenerated packet's `suppressed_memory_ids[]` and record `reason: "state_changed_to_under_review"` or `reason: "state_changed_to_superseded"`.

Stale packets must be regenerated before the next step.

### Stale Packet Regeneration Rules

- Stale packets are **fully regenerated from scratch, not incrementally patched**.
- Regeneration is triggered **before** the `orchestration_authority` consumes the packet in the next step.
- Regeneration cost: one execution of the context assembly algorithm (see Context Assembly Algorithm above).
- The `packet_version` `sequence_number` increments by 1 on regeneration.
- **On regeneration failure**: if an error occurs during context assembly algorithm execution (e.g., memory-index load failure, run.json corruption), keep the previous packet in its `stale` marked state and block the next step of the task. The `orchestration_authority` resolves the error cause and retries regeneration.

## Summaries

### `session-latest.md`
The latest summary of the entire session. Anchor for compaction/resume.

### `task-focus/<task-id>.md`
Local summary for the current task. The default summary injected into specialist subagents.

### `mission-summary.md`
Summary of mission-level status, remaining issues, pending decisions, and outstanding risks.

## Anti-Forgetting Guarantee

The system must not lose at least the following 7 items. Each must be recoverable from `session-latest.md` or `run.json`:
1. current phase / mission phase — `phase`, `mission_phase` fields in `run.json`
2. focus task state — `focus_task_id` in `run.json` and the corresponding `task.json` `state`
3. current rewind reason — state `"none"` explicitly if there is no active rewind. `rewind` field in `run.json`
4. required next artifact — the artifact needed for the next transition from the current task state. Derived from `run.json` or `task.json`
5. open risks — `open_risks[]` in `run.json` or `known_risks[]` of the current task
6. most recent recovery outcome — state `"no_recovery"` explicitly if no recovery has occurred. Derived from `recovery-packet.json`
7. 1-3 most relevant rules + 1-3 most relevant stable memories — selected as top entries from retrieval scoring

### Relationship to Budget

The anti-forgetting items above belong to **L0 (pinned invariants)** and are **not counted against the role-specific budget**. That is, even if the role budget is "3-5 memory entries," anti-forgetting items are always injected separately. Budget applies only to L1/L2 memory.
