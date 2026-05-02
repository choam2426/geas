# 05. Runtime State and Recovery

> Defines mission state, task state, the resume procedure, and safety rules in Geas. Mission phase semantics and task closure semantics are owned by [02_MISSIONS_PHASES_AND_FINAL_VERDICT.md](./02_MISSIONS_PHASES_AND_FINAL_VERDICT.md) and [03_TASK_LIFECYCLE_AND_EVIDENCE.md](./03_TASK_LIFECYCLE_AND_EVIDENCE.md).

## Purpose

Runtime state captures work in flight, and resume is the procedure for continuing interrupted execution. This document defines the minimum runtime rules needed to reconstruct how far execution got without rebuilding contracts or evidence from scratch.

Runtime state is split into two layers of indexes.

- **Mission state** — the runtime index for one mission. It lives in the mission directory.
- **Task state** — the runtime index for one task. It lives in the task directory.

Resume is not treated as a separate state category or a dedicated artifact type. It is a general procedure: read these two indexes together with the actual artifacts, determine where execution stopped, then continue from there. Keeping the layers separate makes it possible to run multiple missions in parallel while keeping task-level indexes next to task artifacts.

## Mission State

The canonical JSON artifact for mission state is `.geas/missions/{mission_id}/mission-state.json`. Its exact shape is governed by `mission-state.schema.json`.

Mission state is not the source of truth. It is a mission-level runtime index that helps readers navigate back to the contracts and evidence.

### Mission state fields

| field | meaning |
|---|---|
| `mission_id` | Identifier for this mission, used to check consistency with the path |
| `phase` | The mission's current phase |
| `active_tasks` | Task IDs currently in `implementing`, `reviewing`, or `deciding`: open work still in flight, not yet closed as `passed`, `cancelled`, or `escalated`, and not halted in `blocked` (`0` = idle, `1` = sequential, `N` = parallel batch) |
| `created_at`, `updated_at` | Creation and update timestamps |

Mission state does not carry the list of closed tasks, a recovery type, or implementation-specific scheduler signals. Closed status is derived from each task's `task-state.json`, and implementation signals are outside protocol scope.

If mission state disagrees with the contracts or evidence, the contracts and evidence always win.

## Task State

The canonical JSON artifact for task state is `.geas/missions/{mission_id}/tasks/{task_id}/task-state.json`. Its exact shape is governed by `task-state.schema.json`.

Task state is the task-level runtime state that records the lifecycle status, which agent is currently active, and how many verify-fix loops the task has gone through. The task contract fixes what the task is supposed to do; task state records how far execution has actually progressed.

### Task state fields

| field | meaning |
|---|---|
| `mission_id`, `task_id` | Identifiers used to check consistency with the path |
| `status` | The task's current lifecycle stage: the current state in the 9-state machine (`drafted` / `ready` / `implementing` / `reviewing` / `deciding` / `passed` / `blocked` / `escalated` / `cancelled`) |
| `active_agent` | The concrete type of the agent currently doing the work, or `null` if none. It uses the same namespace as the `agent` field in evidence files. If one agent serves multiple slots, the active slot is not encoded here; it is revealed by which `evidence/{agent}.{slot}.json` file receives appended entries |
| `verify_fix_iterations` | The number of verify-fix loops for this task. It increments every time the Orchestrator records closure evidence as `changes_requested` and rewinds the task |
| `created_at`, `updated_at` | Creation and update timestamps |

### Task state principles

- Update task state immediately before spawning an agent or when a lifecycle transition occurs.
- Atomicity of file writes is guaranteed by the CLI through atomic rename. Task state does not carry a separate write-status flag.
- Resume must not rely on task state alone; it must also check whether the expected artifacts actually exist.

## Resume procedure

Resume proceeds in the following order.

1. Read `mission-state.json` to determine the current phase and active tasks.
2. Read each active task's `task-state.json` to determine the expected agent and evidence.
3. Compare the real evidence files and contract state against what the indexes claim.
4. If they match, continue from the recorded point. If they diverge, trust the artifacts and realign the indexes as needed, following the drift rules in [08_RUNTIME_ARTIFACTS_AND_SCHEMAS.md](./08_RUNTIME_ARTIFACTS_AND_SCHEMAS.md).
5. If the system cannot resolve the mismatch automatically, or if even the artifacts themselves are no longer trustworthy, escalate the task.

Resume does not emit its own dedicated artifact. Any new observations and corrective actions should naturally show up in the next canonical artifacts, such as task evidence, closure, or phase review.

## Safety rules

- The mere presence of `mission-state.json` or `task-state.json` does not make the claimed state automatically valid.
- Partial artifacts must not be consumed as if they were complete; they must be treated as quarantine material.
- A dirty workspace must always be interpreted against the task contract, evidence, and task state.
- If a closure or final-verdict claim has no supporting artifact, execution must not continue as though it were valid.
- If the system cannot determine on solid grounds which artifact to trust, it must escalate rather than forcing a phase or task transition.
