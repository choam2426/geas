---
name: memorizing
description: Memory lifecycle management — candidate extraction, promotion pipeline, review, application logging, index maintenance, decay and harmful reuse detection.
---

# Memorizing

Manages the full memory lifecycle. Orchestrator invokes this skill after retrospective (per-task extraction) and during Evolving (batch promotion).

## When to Use

- **Per-task**: After retrospective completes, extract memory candidates from `memory_candidates[]`
- **Evolving phase**: Batch review and promotion of accumulated candidates
- **Wrap-Up**: Inline extraction and promotion for single-task executions
- **Session start**: Decay detection on existing entries

## Directory Structure

```
.geas/memory/
├── candidates/      # memory-candidate.json files (state = candidate)
│   └── {memory-id}.json
├── entries/         # promoted memory-entry.json files (provisional/stable/canonical)
│   └── {memory-id}.json
└── logs/            # memory-application-log.json files
    └── {task-id}-{memory-id}.json
```

Central index: `.geas/state/memory-index.json`

## 1. Candidate Extraction

Input: `.geas/missions/{mission_id}/tasks/{task-id}/retrospective.json` → `memory_candidates[]`

For each candidate string in `memory_candidates[]`:

1. Generate `memory_id`: `mem-{task-id}-{N}` (N = sequential within task)
2. Determine `memory_type` based on content:
   - Failure/bug pattern → `failure_lesson`
   - Architecture decision → `architecture_precedent` or `decision_precedent`
   - Security finding → `security_pattern`
   - Performance insight → `performance_tip`
   - Test approach → `test_strategy`
   - Integration issue → `integration_pattern`
   - UI/UX pattern → `ux_pattern`
   - Process improvement → `process_improvement`
   - Risk pattern → `risk_pattern`
   - Project convention → `project_rule`
   - Agent-specific learning → `agent_rule`
3. Determine `scope`:
   - Applies to this task only → `task`
   - Applies to the mission → `mission`
   - Applies to the whole project → `project`
   - Applies to a specific agent type → `agent`
   - Applies universally → `global`
4. Write `.geas/memory/candidates/{memory-id}.json` conforming to `schemas/memory-candidate.schema.json`:
   ```json
   {
     "meta": {
       "version": "1.0",
       "artifact_type": "memory_candidate",
       "artifact_id": "{memory-id}",
       "producer_type": "process_lead",
       "created_at": "<ISO 8601>"
     },
     "memory_id": "{memory-id}",
     "memory_type": "<determined type>",
     "state": "candidate",
     "title": "<short title from candidate string>",
     "summary": "<the candidate string from retrospective>",
     "scope": "<determined scope>",
     "evidence_refs": ["retro-{task-id}"],
     "signals": {
       "evidence_count": 1,
       "reuse_count": 0,
       "successful_reuses": 0,
       "failed_reuses": 0,
       "contradiction_count": 0,
       "confidence": 0.4
     },
     "candidate_reason": "Extracted from task {task-id} retrospective",
     "source_artifacts": [".geas/missions/{mission_id}/tasks/{task-id}/retrospective.json"]
   }
   ```
5. Add entry to `.geas/state/memory-index.json`

**Automatic extraction triggers** (check during retrospective review, per protocol/08):
- Same `failure_class` in failure-record.json repeats 2+ times → auto-extract failure_lesson, confidence 0.6
- Same reviewer concern `category` in specialist-review.json across 2+ tasks → auto-extract, confidence 0.6
- Same `recovery_class` recovery incident repeats 2+ times → auto-extract risk_pattern, confidence 0.4
- A specific demo/test recipe effectively used in 3+ tasks → auto-extract test_strategy, confidence 0.6
- Conflicts in integration-result.json occur 2+ times for the same path/domain → auto-extract integration_pattern, confidence 0.4
- `confidence <= 2` in worker-self-check.json repeats 2+ times for the same `task_kind` → auto-extract risk_pattern, confidence 0.4

## 2. Deduplication

Before creating a new candidate:

1. Read `.geas/state/memory-index.json`
2. Compare candidate title and summary against existing entries (all states)
3. **If semantically similar entry exists**:
   - Add this task's retrospective to the existing entry's `evidence_refs`
   - Increment `evidence_count` in signals
   - If confidence was 0.4, bump to 0.6 (2+ evidence refs)
   - Skip creating new candidate
4. **If no match**: proceed with new candidate creation

Similarity check: entries with the same `memory_type` and overlapping keywords in title/summary are considered similar.

## 3. Domain Review

For each new candidate, determine the domain authority reviewer:

| memory_type | reviewer_type |
|-------------|--------------|
| security_pattern | security_engineer |
| architecture_precedent | architecture_authority |
| test_strategy | qa_engineer |
| performance_tip | architecture_authority |
| integration_pattern | architecture_authority |
| ux_pattern | ui_ux_designer |
| process_improvement | process_lead |
| failure_lesson | process_lead |
| decision_precedent | product_authority |
| risk_pattern | process_lead |
| project_rule | orchestration_authority |
| agent_rule | orchestration_authority |

**Mission (batch)**: Domain authority reviews during Evolving phase. Spawn the reviewer agent:
```
Agent(agent: "{reviewer}", prompt: "Review memory candidate at .geas/memory/candidates/{memory-id}.json. Decide: promote_provisional (ready to try applying), keep (needs more evidence), or reject (not useful). Write review to .geas/memory/candidates/{memory-id}-review.json with fields: version, artifact_type (memory_review), artifact_id, producer_type, memory_id, decision (promote_provisional/keep/reject), rationale, created_at.")
```

**Lightweight (inline)**: If candidate has evidence_refs >= 2 or comes from a repeated pattern, auto-promote to provisional. Otherwise keep as candidate for future review.

## 4. Promotion Pipeline

### State transitions

| From | To | Conditions |
|------|----|-----------|
| candidate | provisional | 2+ evidence_refs OR 2+ similar incidents OR domain authority approval |
| provisional | stable | 3+ successful_reuses + 0 contradictions + domain authority review |
| stable | canonical | 5+ successful_reuses (3+ different tasks) + joint approval (process_lead + domain authority) |
| any active | under_review | failed_reuses >= 2 OR confidence < 0.3 OR manual request |
| under_review | reinstated/superseded/archived/rejected | Review decision |
| any | decayed | review_after passed + 0 reuses in period, OR contradiction_count >= 3, OR confidence < 0.3 |

### On promotion

1. If promoting from candidate: move file from `candidates/` to `entries/`, update state
2. If promoting within entries/: update state in-place
3. Set `review_after` to 30 days from now (provisional), 90 days (stable), 180 days (canonical)
4. Update `.geas/state/memory-index.json`
5. Log: `{"event": "memory_promoted", "memory_id": "...", "from_state": "...", "to_state": "...", "timestamp": "<actual>"}`

## 5. Application Logging

**Collected by orchestrator** after task completion (at retrospective time):

1. Read the memory-packet that was generated for this task's agents (if any)
2. For each `applicable_memory_id` in the packet:
   a. Read the task outcome (passed/failed/iterate) and gate result
   b. Determine `effect`:
      - Task passed and memory advice was relevant → `positive`
      - Task failed in an area the memory addressed → `negative`
      - Memory had no clear impact on outcome → `neutral`
      - Memory advice contradicted the actual correct approach → `negative` + set followup_action to `weaken`
   c. Determine `usage_surface` from context: `task_packet`, `review_context`, `gate_context`, etc.
   d. Write `.geas/memory/logs/{task-id}-{memory-id}.json` conforming to `schemas/memory-application-log.schema.json`:
      ```json
      {
        "meta": {
          "version": "1.0",
          "artifact_type": "memory_application_log",
          "artifact_id": "mal-{task-id}-{memory-id}",
          "producer_type": "orchestration_authority",
          "created_at": "<ISO 8601>"
        },
        "memory_id": "{memory-id}",
        "task_id": "{task-id}",
        "applied_by_type": "<agent type that received the packet>",
        "usage_surface": "task_packet",
        "effect": "positive | negative | neutral",
        "notes": "<brief explanation>",
        "followup_action": "none | strengthen | weaken | supersede | review_required"
      }
      ```
3. Update memory entry signals:
   - `positive` → `successful_reuses += 1`, `reuse_count += 1`, `confidence += 0.1` (cap at 1.0)
   - `negative` → `failed_reuses += 1`, `reuse_count += 1`, `confidence -= 0.1` (floor at 0.0)
   - `neutral` → `reuse_count += 1` (no confidence change)
   - If effect notes mention contradiction → `contradiction_count += 1`, `confidence -= 0.2`
4. Check harmful reuse threshold (see section 7)

## 6. Decay Detection

Run during Evolving phase or at session start:

1. Read `.geas/state/memory-index.json`
2. For each entry with state `provisional`, `stable`, or `canonical`:
   - If `review_after` has passed AND no application logs exist since `review_after` → transition to `decayed`
   - If `contradiction_count >= 3` → transition to `decayed`
   - If `confidence < 0.3` → transition to `decayed`
3. Update entry state and memory-index.json
4. Decayed entries remain in index (not deleted) — they can be reinstated if new evidence appears
5. Log: `{"event": "memory_decayed", "memory_id": "...", "reason": "...", "timestamp": "<actual>"}`

## 7. Harmful Reuse Rollback

When `failed_reuses >= 2` for any memory entry:

1. Transition to `under_review`
2. process_lead convenes review with the memory's domain authority
3. Review decision options:
   - **reinstate**: update guidance text, reset failed_reuses, resume from previous state
   - **supersede**: create new memory entry that replaces this one, set `superseded_by` on old entry
   - **archive**: preserve for historical reference, remove from active retrieval
   - **reject**: mark as permanently invalid
4. Write `memory-review.json` with the decision
5. **Reinstate circuit breaker**: if an entry has been through under_review 3+ times, mandatory archive — no more reinstating

## Confidence Reference

| Evidence refs | Initial confidence |
|---|---|
| 1 | 0.4 |
| 2 | 0.6 |
| 3+ | 0.8 |

Adjustments per application: positive +0.1, negative -0.1, contradiction -0.2. Clamped to [0.0, 1.0].

## Memory Type Reference

Valid types (from `_defs.schema.json`): `project_rule`, `agent_rule`, `decision_precedent`, `failure_lesson`, `security_pattern`, `performance_tip`, `test_strategy`, `integration_pattern`, `ux_pattern`, `architecture_precedent`, `process_improvement`, `risk_pattern`

## Memory State Reference

Valid states (from `_defs.schema.json`): `candidate`, `provisional`, `stable`, `canonical`, `under_review`, `decayed`, `superseded`, `archived`, `rejected`

## Conflict Resolution Priority

When multiple memories conflict (from doc 07): `rules.md` > `project_memory` > `agent_memory` > `risk_memory`
