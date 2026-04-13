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

## Inputs

- **Task files** — all tasks in `.geas/missions/{mission_id}/tasks/` with their status, dependencies, and scope surfaces
- **`.geas/state/run.json`** — current run state including checkpoint and batch tracking
- **Lock state** — current lock holdings for path, interface, and resource conflicts
- **Integration branch tip** — for staleness checking against `base_snapshot`

## Output

- **Batch assignment** — list of 2-4 tasks eligible for parallel execution
- **Lock acquisitions** — path/interface locks acquired per batch task via CLI
- **Updated checkpoint** — `run.json` updated with `parallel_batch` and `completed_in_batch`
- **Event log entries** — `task_started`, `task_resolved` events per batch task

---

## Preconditions

- Worktree isolation must be available (git repo initialized). If unavailable, fall back to sequential execution (batch size 1).
- All batch tasks use `isolation: "worktree"` for implementation steps.

---

## 1. Batch Construction

When the orchestrator reaches a point where new tasks could start (Phase 2 entry, or after a task/batch resolves):

1. Read all task files in `.geas/missions/{mission_id}/tasks/`.
2. Filter: `status == "ready"` AND every ID in `depends_on` has a task file with `status == "passed"`.
3. **Staleness check per task**: For each candidate, compare `base_snapshot` with `tip(integration_branch)`.
   - If `base_snapshot == tip`: eligible
   - If `base_snapshot != tip`: run revalidation procedure
     - `clean_sync`: eligible (update base_snapshot first)
     - `review_sync`: eligible (flag for re-review after implementation)
     - `replan_required` or `blocking_conflict`: **exclude from batch**. Rewind or block as appropriate. Log event via `geas event log --type revalidation`.
4. **Lock conflict check**: For each pair of candidate tasks in the batch:
   - Compare their `scope.surfaces` — if any paths overlap, they have a path lock conflict. Remove the later task (by ID order) from the batch.
   - If either task touches API contracts that the other also touches, they have an interface lock conflict. Remove the later task.
   - If both tasks use the same shared resource, they have a resource lock conflict. Remove the later task.

After filtering, the batch contains only tasks that can safely run in parallel.

5. **Risk-level concurrency filter**: For each remaining candidate:
   - Read `risk_level` from its task contract
   - If `risk_level` is `critical`: verify ALL four independence conditions from `building.md` Risk-Level Gating against every other task in the candidate batch. If any condition fails, remove the critical task from this batch (it runs solo next cycle).
   - If `risk_level` is `high`: keep in batch (challenger review is enforced at the gate step, not at scheduling)
   - If `risk_level` is `normal` or `low`, or absent: no additional filtering

6. If 0-1 eligible: this protocol does not apply. The orchestrator runs the single task through the normal pipeline.
7. If 2+ eligible: form a batch.
   - **Max batch size: 4.** If more eligible, take the first 4 by task ID order. Remainder waits for next batch.
   - Reason: worktree concurrency + context window limits.

---

## 2. Batch Start

For each task in the batch:
1. Transition task status via CLI: `Bash("geas task transition --mission {mission_id} --id {task-id} --to implementing")`
2. Acquire locks via CLI:
   ```bash
   Bash("geas lock acquire --task {task-id} --type path --targets '{comma_separated_paths}' --session {session-id}")
   ```
3. Log task_started event: `Bash("geas event log --type task_started --task {task-id}")`

Update checkpoint via CLI:
```bash
Bash("geas state checkpoint set --step batch_active --agent null --batch task-003,task-009")
```

Note: during batch execution, `remaining_steps` is empty at the batch level. Each task's pipeline progress is tracked by the orchestrator internally (in context) and by evidence file presence.

---

## 3. Pipeline Interleaving

The orchestrator manages each task's pipeline independently:

- Each task follows the per-task pipeline defined in `mission/references/pipeline.md`.
- **Independent progression:** When an agent returns for task A, the orchestrator spawns task A's next step immediately. It does NOT wait for other tasks to reach the same step.
- **Parallel spawning:** The orchestrator MAY spawn agents for different tasks in the same message (parallel tool calls). Example: `Agent(implementer, "implement task-003")` and `Agent(implementer, "implement task-009")` in one message.
- **Step groups:** Within a single task, the orchestrator also applies step group rules from the execution pipeline (e.g., spawning design-authority + quality-specialist simultaneously for the same task).
- **All mandatory steps apply:** Implementation contract, code review, testing, challenger challenge, product-authority verdict, retrospective, and resolve are mandatory for every task in the batch. Do NOT skip any because of parallelism.

**Checkpoint during batch:** Before each agent spawn, update `last_updated` in run.json. `agent_in_flight` stays `null` during batches (multiple agents active). The authoritative progress record is the evidence files and task file statuses.

---

## 4. Per-Task Completion

When a task's pipeline finishes (orchestrator commits, retro done):

1. Transition task: `Bash("geas task transition --mission {mission_id} --id {task-id} --to passed")` **No exceptions.**
2. Update run state: `Bash("geas state update --field completed_in_batch --value '<updated_json_array>'")`
3. Update run state: `Bash("geas state update --field completed_tasks --value '<updated_json_array>'")`
4. Log: `Bash("geas event log --type task_resolved --task {task-id}")`

If other tasks in the batch are still running, the orchestrator continues managing them.

---

## 5. Batch Complete

When `completed_in_batch` contains all IDs from `parallel_batch`:

1. Clear checkpoint: `Bash("geas state checkpoint clear")`
2. Return to section 1 — scan for next eligible batch.
3. If no eligible tasks remain: the execution phase is complete.

---

## 6. Recovery

When a session resumes and run.json has `parallel_batch` set (non-null):

1. Read `parallel_batch` and `completed_in_batch`.
2. Compute remaining: tasks in `parallel_batch` but not in `completed_in_batch`.
3. For each remaining task, check evidence:
   - record.json contains both `verdict` and `retrospective` sections → task is complete. Set task file status to `"passed"`, add to `completed_in_batch`.
   - record.json contains `verdict` section but no `retrospective` section → resume from retrospective step only.
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
6. Risk-level concurrency gate passed (critical tasks require explicit independence proof per `building.md` Risk-Level Gating)

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

- **`paused`**: short suspension. On resume: baseline check only. If `base_snapshot` is 10+ commits behind `tip(integration_branch)`, run full revalidation.
- **`parked`**: longer hold. On resume: mandatory revalidation. Parking reason must be recorded in `run.json`.
- **Hotfix preemption**: hotfixes may preempt regular tasks. A preemption record must be left with: preempted `task_id`, preemption reason, task state at preemption time.

### Deadlock Handling

If two tasks hold mutually conflicting locks, the state transitions to `manual_repair_required`. No automatic resolution is attempted. The orchestration-authority or a human operator must intervene to release a lock or rewind a task.
