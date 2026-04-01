---
name: scheduling
description: >
  Protocol for orchestrator to manage multiple tasks simultaneously.
  Defines batch construction, pipeline interleaving, checkpoint management, and recovery.
  Task-level parallelism only. Step-level parallelism is defined in initiative/sprint.
---

# Scheduling

This skill is a protocol document — the orchestrator reads it and executes directly. There is no separate scheduling agent.

The orchestrator assigns multiple tasks to run simultaneously. Each task progresses through its pipeline sequentially (as defined in initiative/sprint). The orchestrator interleaves agent spawns across tasks, spawning agents for different tasks in the same message when possible.

---

## Preconditions

- Worktree isolation must be available (git repo initialized). If unavailable, fall back to sequential execution (batch size 1).
- All batch tasks use `isolation: "worktree"` for implementation steps.

---

## 1. Batch Construction

When the orchestrator reaches a point where new tasks could start (Phase 2 entry, or after a task/batch resolves):

1. Read all task files in `.geas/tasks/`.
2. Filter: `status == "ready"` AND every ID in `depends_on` has a task file with `status == "passed"`.
3. If 0-1 eligible: this protocol does not apply. The orchestrator runs the single task through the normal pipeline.
4. If 2+ eligible: form a batch.
   - **Max batch size: 4.** If more eligible, take the first 4 by task ID order. Remainder waits for next batch.
   - Reason: worktree concurrency + context window limits.

---

## 2. Batch Start

For each task in the batch:
1. Read task file, set `"status": "implementing"`, write back.
2. Log `task_started` event for each task.

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

- Each task follows the per-task pipeline defined in initiative/sprint SKILL.md.
- **Independent progression:** When an agent returns for task A, the orchestrator spawns task A's next step immediately. It does NOT wait for other tasks to reach the same step.
- **Parallel spawning:** The orchestrator MAY spawn agents for different tasks in the same message (parallel tool calls). Example: `Agent(circuit, "implement STORY-003")` and `Agent(circuit, "implement STORY-009")` in one message.
- **Step groups:** Within a single task, the orchestrator also applies step group rules from initiative/sprint (e.g., spawning forge + sentinel simultaneously for the same task).
- **All mandatory steps apply:** Implementation contract, code review, testing, critic review, nova review, retrospective, and resolve are mandatory for every task in the batch. Do NOT skip any because of parallelism.

**Checkpoint during batch:** Before each agent spawn, update `last_updated` in run.json. `agent_in_flight` stays `null` during batches (multiple agents active). The authoritative progress record is the evidence files and task file statuses.

---

## 4. Per-Task Completion

When a task's pipeline finishes (keeper commits, retro done):

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
   - `.geas/evidence/{task-id}/keeper.json` exists AND `.geas/memory/retro/{task-id}.json` exists → task is complete. Set task file status to `"passed"`, add to `completed_in_batch`.
   - `keeper.json` exists but no retro → resume from retrospective step only.
   - Neither exists → re-execute the full pipeline for this task.
4. Update run.json with corrected `completed_in_batch`.
5. Continue with section 3 for any remaining tasks.
