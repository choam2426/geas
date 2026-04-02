# 04. Baseline, Worktree, Scheduler, and Parallelism

## Baseline Rules

- `run.json` does not store the live HEAD.
- A task has a `base_commit`.
- The current baseline is read from Git via `tip(integration_branch)`.

## Staleness Rules

### Before start
If `task.base_commit != tip(integration_branch)`, revalidation is mandatory.

### Revalidation Procedure
Revalidation is performed in the following steps, in order:
1. Compute the diff between `base_commit` and `tip(integration_branch)`.
2. Check whether the diff overlaps with the task's `scope.paths`.
3. If there is no overlap, update `base_commit` to the current tip and continue the task.
4. If there is overlap, apply the pre-integration staleness classification (below) to classify the situation as one of `clean_sync | review_sync | replan_required | blocking_conflict`.
5. Record the result in the task metadata as `revalidation_result`.

### During implementation
Upstream movement alone does not trigger an immediate halt. Drift is recorded and reconciled at integration time.

### Before integration
Examine the difference between `base_commit` and the current tip, and classify as one of the following.

| classification | condition | required action |
|---|---|---|
| `clean_sync` | no changes between tip and base_commit overlap with the task's scope.paths | fast-forward merge or trivial rebase, then proceed with integration |
| `review_sync` | changes overlap with scope.paths but conflicts are auto-resolvable | merge, then specialist re-review required for the changed areas |
| `replan_required` | changes overlap with scope.paths and cannot be auto-resolved, but the task's purpose remains valid | rewind the task to `ready` and update the implementation contract |
| `blocking_conflict` | upstream changes invalidate the task's preconditions (API contract, schema, dependency) | transition the task to `blocked` or `escalated` |

## Worktree Rules

Each task has an independent worktree.
- `worktree.branch`
- `worktree.path`
- `fork_point = base_commit`

The worktree is the task-local source of truth until the task completes. No direct commits to the integration branch are made before integration.

## Lock Model

Lock state is stored in `.geas/state/locks.json`.

### Lock Lifecycle

| phase | rule |
|---|---|
| **Acquisition** | `path_lock`, `interface_lock`, and `resource_lock` are acquired before worktree creation. `integration_lock` is acquired before integration begins. |
| **Release** | When a task completes (passed/failed/cancelled), all locks for that task are released. At session end, the cleanup phase releases all remaining locks for that session. |
| **Orphan detection** | Orphan lock detection runs at session start and after recovery. Locks whose owning session no longer exists are classified as orphans and automatically released. |
| **Timeout** | Locks have no automatic timeout (they are session-scoped). |
| **Deadlock** | If two tasks hold mutually conflicting locks, the state transitions to `manual_repair_required`. No automatic resolution is attempted. |

### `path_lock`
Prevents change conflicts at the file path level.

### `interface_lock`
Prevents conflicts at the public contract/API/schema level.

### `resource_lock`
Prevents conflicts over ports, services, migration targets, fixtures, and similar resources.

### `integration_lock`
Serializes the integration lane to single-flight.

### Lock Acquisition Order

To prevent deadlocks, when a single task needs multiple locks, they are acquired in the following order:

1. `path_lock` (file/directory paths)
2. `interface_lock` (API/schema contracts)
3. `resource_lock` (shared resources)
4. `integration_lock` (integration branch)

Rules:
- A lower-order lock may only be requested while holding a higher-order lock.
- If a lower-order lock is held when a higher-order lock is needed, all locks are released and re-acquired in order.
- If lock acquisition fails (another task holds it), the task waits. If the wait cannot be resolved within the session, it is classified as `manual_repair_required`.

## Scheduler Goals

- Minimize high-risk drift
- Maximize safe parallelism
- Maintain serialized integration
- Allow hotfix preemption

## Safe Parallel Conditions

Parallel implementation is allowed when all of the following are satisfied.
- No path lock conflict
- No interface lock conflict
- No shared mutable resource contention (shared mutable resources are defined as: integration branch, `.geas/state/run.json`, `.geas/rules.md`, and project-wide shared configuration files. Task-local files within a worktree are excluded)
- Both are independent tasks within the `building` phase
- Both are non-speculative, or within the speculative budget (at most 1 speculative task may run concurrently)

## Unsafe Parallel Combinations

- Both sides modify the same API contract
- Concurrent modification of shared paths related to auth / payment / migration / release
- Both change the same shared fixture and env
- Both sides simultaneously redefine the same docs+code contract

## Speculative Execution

Allowed:
- Limited to tasks with `risk_level = low`.
- When the dependency task is in `reviewed` or later state, and that task's worker self-check confidence is 4 or above.
- For low-risk cases such as docs/update, tests-only, and adapter layers.
- At most 1 speculative task may run concurrently.

Prohibited:
- Tasks with `risk_level` of `normal`, `high`, or `critical`
- public API, migration, auth/security, deploy/release, high-risk refactor

Speculative tasks must be re-reviewed on a non-speculative baseline immediately before integration. If the predecessor task fails, speculative results are discarded.

## Pause / Park / Preemption

`paused` and `parked` are not separate task states but **scheduler execution flags**. The task's state (see doc 03) does not change; the scheduler suspends progress on the task.

- `paused`: short suspension; only an additional baseline check is needed on resume. However, if `base_commit` is 10 or more commits behind `tip(integration_branch)` (configurable, default 10), revalidation is performed before resume.
- `parked`: longer hold; revalidation is mandatory before resume. The parking reason must be recorded in `run.json`.
- Hotfixes may preempt regular tasks, but a preemption record must be left. The preemption record includes the preempted task_id, the preemption reason, and the task state at the time of preemption.

## Edge Cases

### 1. When all tasks are paused

When all active tasks are `paused` or `parked` and no tasks are executing, the scheduler enters **idle state**.

- **Behavior**: the scheduler waits for new task submission, external input (human stakeholder direction), or a resume signal for an existing task.
- **No automatic action**: the scheduler does not arbitrarily resume tasks or create new tasks while idle.
- **Recording**: `run.json`'s `scheduler_state` is updated to `idle`, and the time of idle entry is recorded.
- **Resume conditions**: the scheduler exits idle upon an explicit resume directive from orchestration_authority, new task submission, or external stakeholder input.

### 2. When two tasks request integration_lock simultaneously

`integration_lock` is single-flight, so two tasks cannot hold it at the same time.

- **Behavior**: the task that acquires the lock first proceeds with integration; the second task waits.
- **Timeout**: locks are session-scoped by default with no automatic timeout. A configurable timeout period may be specified, but the default lasts until session end.
- **While waiting**: the second task is recorded as waiting for `integration_lock` and cannot proceed to other steps (e.g., additional review). Integration must be serialized.
- **Deadlock scenario**: if two tasks hold mutually conflicting locks and reach a deadlock, the state transitions to `manual_repair_required`. No automatic resolution is attempted; orchestration_authority or a human operator must intervene to release a lock or rewind a task.
- **Recording**: the wait start time and the waiting task_id are recorded in `.geas/state/locks.json`.

### 3. When a worktree is damaged or deleted externally

This covers situations where a task's assigned worktree is damaged or disappears due to external factors (manual deletion, filesystem error, interference from another tool).

- **Detection**: a fingerprint mismatch occurs on the next worktree access. It is detected when the worktree path does not exist, or when it exists but does not match the expected branch/commit.
- **Recovery class**: classified as `dirty_state_recovery`.
- **Worktree deleted**: if `worktree.path` does not exist and the task is in `implementing`, either re-execute the implementation or transition to `manual_repair_required` (see doc 10 Worktree Recovery Rules).
- **Worktree damaged**: if the path exists but the fingerprint does not match, generate a diff and present it to orchestration_authority. orchestration_authority decides between commit-and-continue or rewind.
- **Artifact**: a `recovery-packet.json` is created and stored in `.geas/recovery/`. The `detected_problem` field records fingerprint mismatch details, and the `recommended_action` field records the decision.

### 4. Behavior in a single-task session

Even when the session has only one task, parallelism rules apply identically.

- **Rationale**: future-proofing. Additional tasks may be introduced mid-session, and maintaining rule consistency is important.
- **Lock acquisition**: even a single task acquires and releases `path_lock`, `interface_lock`, `integration_lock`, etc. normally. Since there is no contention, acquisition is immediate.
- **Scheduler overhead**: contention checks and queue management are effectively no-ops, so overhead is minimal. The scheduler only tracks state transitions for the single task.
- **Speculative execution**: speculative execution decisions are unnecessary in a single-task session (there is no predecessor task).
- **Safe parallel conditions**: the checks themselves are still performed, but since there is nothing to compare against, they always pass.
