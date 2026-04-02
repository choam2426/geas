---
name: scheduling
description: >
  Protocol for orchestrator to manage multiple tasks simultaneously.
  Defines batch construction, pipeline interleaving, checkpoint management, and recovery.
  Task-level parallelism only. Step-level parallelism is defined in the execution pipeline.
---

# Scheduling

This skill is a protocol document — the orchestrator reads it and executes directly. There is no separate scheduling agent.

The orchestrator assigns multiple tasks to run simultaneously. Each task progresses through its pipeline sequentially (as defined in the execution pipeline). The orchestrator interleaves agent spawns across tasks, spawning agents for different tasks in the same message when possible.

---

## Preconditions

- Worktree isolation must be available (git repo initialized). If unavailable, fall back to sequential execution (batch size 1).
- All batch tasks use `isolation: "worktree"` for implementation steps.

---

## 1. Batch Construction

When the orchestrator reaches a point where new tasks could start (Phase 2 entry, or after a task/batch resolves):

1. Read all task files in `.geas/tasks/`.
2. Filter: `status == "ready"` AND every ID in `depends_on` has a task file with `status == "passed"`.
3. **Staleness check per task**: For each candidate, compare `base_commit` with `tip(integration_branch)`.
   - If `base_commit == tip`: eligible
   - If `base_commit != tip`: run revalidation procedure
     - `clean_sync`: eligible (update base_commit first)
     - `review_sync`: eligible (flag for re-review after implementation)
     - `replan_required` or `blocking_conflict`: **exclude from batch**. Rewind or block as appropriate. Write revalidation-record.json.
4. **Lock conflict check**: For each pair of candidate tasks in the batch:
   - Compare their `scope.paths` — if any paths overlap, they have a path lock conflict. Remove the later task (by ID order) from the batch.
   - If either task touches API contracts that the other also touches, they have an interface lock conflict. Remove the later task.
   - If both tasks use the same shared resource, they have a resource lock conflict. Remove the later task.

After filtering, the batch contains only tasks that can safely run in parallel.

5. If 0-1 eligible: this protocol does not apply. The orchestrator runs the single task through the normal pipeline.
6. If 2+ eligible: form a batch.
   - **Max batch size: 4.** If more eligible, take the first 4 by task ID order. Remainder waits for next batch.
   - Reason: worktree concurrency + context window limits.

---

## 2. Batch Start

For each task in the batch:
1. Read task file, set `"status": "implementing"`, write back.
2. Acquire path/interface/resource locks for the task (same procedure as the execution pipeline Lock Acquisition). Write all locks to `.geas/state/locks.json`.
3. Log `task_started` event for each task.

Update `run.json` checkpoint:
```json
{
  "pipeline_step": "batch_active",
  "agent_in_flight": null,
  "pending_evidence": [],
  "retry_count": 0,
  "parallel_batch": ["STORY-003", "STORY-009"],
  "completed_in_batch": [],
  "remaining_steps": [],
  "last_updated": "<timestamp>"
}
```

Note: during batch execution, `remaining_steps` is empty at the batch level. Each task's pipeline progress is tracked by the orchestrator internally (in context) and by evidence file presence.

---

## 3. Pipeline Interleaving

The orchestrator manages each task's pipeline independently:

- Each task follows the per-task pipeline defined in `orchestrating/references/pipeline.md`.
- **Independent progression:** When an agent returns for task A, the orchestrator spawns task A's next step immediately. It does NOT wait for other tasks to reach the same step.
- **Parallel spawning:** The orchestrator MAY spawn agents for different tasks in the same message (parallel tool calls). Example: `Agent(backend-engineer, "implement STORY-003")` and `Agent(backend-engineer, "implement STORY-009")` in one message.
- **Step groups:** Within a single task, the orchestrator also applies step group rules from the execution pipeline (e.g., spawning architecture-authority + qa-engineer simultaneously for the same task).
- **All mandatory steps apply:** Implementation contract, code review, testing, critical_reviewer challenge, product_authority verdict, retrospective, and resolve are mandatory for every task in the batch. Do NOT skip any because of parallelism.

**Checkpoint during batch:** Before each agent spawn, update `last_updated` in run.json. `agent_in_flight` stays `null` during batches (multiple agents active). The authoritative progress record is the evidence files and task file statuses.

---

## 4. Per-Task Completion

When a task's pipeline finishes (repository_manager commits, retro done):

1. Read task file, set `"status": "passed"`, write back. **No exceptions.**
2. Add task ID to `completed_in_batch` in run.json, write back.
3. Add task ID to `completed_tasks` in run.json, write back.
4. Log `task_resolved` event.

If other tasks in the batch are still running, the orchestrator continues managing them.

---

## 5. Batch Complete

When `completed_in_batch` contains all IDs from `parallel_batch`:

1. Set checkpoint to `null` in run.json.
2. Return to section 1 — scan for next eligible batch.
3. If no eligible tasks remain: the execution phase is complete.

---

## 6. Recovery

When a session resumes and run.json has `parallel_batch` set (non-null):

1. Read `parallel_batch` and `completed_in_batch`.
2. Compute remaining: tasks in `parallel_batch` but not in `completed_in_batch`.
3. For each remaining task, check evidence:
   - `.geas/evidence/{task-id}/repository-manager.json` exists AND `.geas/tasks/{task-id}/retrospective.json` exists → task is complete. Set task file status to `"passed"`, add to `completed_in_batch`.
   - `repository-manager.json` exists but no retro → resume from retrospective step only.
   - Neither exists → re-execute the full pipeline for this task.
4. Update run.json with corrected `completed_in_batch`.
5. Continue with section 3 for any remaining tasks.

---

## Safe Parallel Conditions

All of the following must be satisfied for two tasks to run in parallel (per doc 04):

1. No path lock conflict (checked in batch construction)
2. No interface lock conflict (checked in batch construction)
3. No shared mutable resource contention (`.geas/state/run.json`, `.geas/rules.md`, project-wide config)
4. Both are independent tasks within the building phase
5. Both are non-speculative

### Unsafe Parallel Combinations (always rejected)

- Both tasks modify the same API contract
- Concurrent modification of auth / payment / migration / release paths
- Both change the same shared fixture or environment
- Both redefine the same docs+code contract

---

## Speculative Execution (conditions documented, dispatch deferred)

Speculative execution MAY be allowed when ALL of the following are true:
- Task has `risk_level = low`
- The predecessor task (dependency) is in `reviewed` or later state
- The predecessor's worker self-check `confidence` is 4 or above
- At most 1 speculative task is running concurrently

Speculative execution is PROHIBITED for:
- Tasks with `risk_level` of `normal`, `high`, or `critical`
- Tasks touching: public API, migration, auth/security, deploy/release, high-risk refactor

**Note:** Actual speculative dispatch is deferred to Phase 6. This section documents the conditions only. The scheduler currently treats all tasks as non-speculative.

---

## Pause / Park / Preemption

`paused` and `parked` are scheduler execution flags, not task states. The task's state (doc 03) does not change.

- **`paused`**: short suspension. On resume: baseline check only. If `base_commit` is 10+ commits behind `tip(integration_branch)`, run full revalidation.
- **`parked`**: longer hold. On resume: mandatory revalidation. Parking reason must be recorded in `run.json`.
- **Hotfix preemption**: hotfixes may preempt regular tasks. A preemption record must be left with: preempted `task_id`, preemption reason, task state at preemption time.

### Deadlock Handling

If two tasks hold mutually conflicting locks, the state transitions to `manual_repair_required`. No automatic resolution is attempted. The orchestration_authority or a human operator must intervene to release a lock or rewind a task.
