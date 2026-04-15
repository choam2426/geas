# 04. Baseline, Workspace, Scheduler, and Parallelism

> **Normative document.**
> This document defines baseline validity, staleness handling, workspace lifecycle, lock semantics, scheduler goals, and the rules that make bounded parallelism safe.

## Purpose

Parallelism is valuable only when it does not destroy evidence integrity. This document exists to prevent:

- implementation against stale baselines
- hidden integration drift
- overlapping work that conflicts too late
- unsafe concurrent integration
- recovery ambiguity caused by unmanaged workspaces

## Baseline

A baseline is the last verified snapshot of the shared work state that a task was validated against (see `base_snapshot` in doc 03). Every admitted task MUST carry a `base_snapshot` representing the integration baseline last known to be valid for that task.

A baseline reference may be a document version, a dataset checkpoint, a version-control commit (e.g., Git), or any other reproducible state reference appropriate to the domain.

### Baseline rules

1. `base_snapshot` MUST reference a state that is at or before the current integration baseline when the task enters `ready`.
2. The task MUST NOT claim currentness against a baseline it has not actually checked.
3. Baseline state MUST be revalidated before integration if changes to the integration baseline make the task stale.

### Baseline freshness classes

| class | meaning |
|---|---|
| `fresh` | task baseline is current enough to proceed |
| `stale` | baseline changes may invalidate assumptions; revalidation required |
| `diverged` | direct conflict or incompatible baseline change detected |
| `unknown` | baseline could not be determined reliably |

`diverged` and `unknown` MUST block integration until resolved.

## Staleness Rules

### Before start

Before a task enters `implementing`, the system MUST ensure that the baseline remains valid. If not, the task MUST be revalidated or reworked against the new baseline.

### During implementation

Baseline changes alone do not force immediate halt. However:

- the task SHOULD surface that it is now potentially stale
- the scheduler SHOULD prefer fresher tasks when risk is equal
- the task MUST reconcile before integration

### Before integration

Before a task enters the integration lane:

- the current integration baseline MUST be compared with the task's `base_snapshot`
- revalidation MUST occur if the task is stale
- semantic drift MUST be considered, not just surface-level conflict

Semantic drift differs from surface conflict:

- **surface conflict**: the same area was directly modified, causing a physical collision
- **semantic drift**: different areas were modified, but an assumption or behavior changed in a way that invalidates the task's premise (e.g., an API response format changed while a task that calls that API was unaware)

## Revalidation Procedure

Revalidation determines whether a stale task can still be integrated safely. A conformant revalidation flow SHOULD:

1. fetch the current integration baseline
2. compare it to the task's `base_snapshot`
3. inspect changed surfaces for overlap or interface drift
4. decide the outcome:

| outcome | meaning |
|---|---|
| proceed unchanged | no meaningful overlap detected |
| light reconciliation | minor adjustments needed to align with baseline changes |
| major rework | significant overlap or interface change requires substantial revision |
| restore to `ready` | task assumptions are invalidated; replanning required |

The revalidation result SHOULD be recorded as an artifact.

## Workspace

A workspace is an isolated execution context for a task (see Glossary in doc 00). This may be a sandboxed environment, a dedicated working directory, a version-control worktree (e.g., Git), or any equivalent isolation mechanism appropriate to the domain.

### Workspace rules

- one primary workspace per active implementation task
- clear mapping from workspace to `task_id`
- isolation from other active work unless explicitly synchronized
- known cleanup semantics at task completion or cancellation

A workspace SHOULD be treated as disposable execution context, not the source of truth. The canonical state remains the validated baseline and runtime artifacts.

### Runtime state and workspaces

The runtime state directory (e.g., `.geas/`) is excluded from baseline tracking and therefore is NOT part of the workspace. When a workspace is created — for example, via an isolated working directory or version-control worktree — the runtime state directory is not replicated into it. An agent executing inside a workspace that attempts to access runtime state via a relative path will find nothing.

1. The Orchestrator MUST resolve the project root to an absolute path and pass it to every agent before spawning.
2. Agents running inside a workspace MUST use the absolute path to the main project's runtime state directory for all runtime state access.
3. Workspace agents MUST NOT write directly to shared state files (locks, run state, event ledger). They MAY only write to task-scoped paths such as `evidence/{task-id}/`.
4. When a workspace agent invokes a CLI tool that needs access to the project's runtime state, it MUST pass the project root via a `--cwd` option (or the tool's equivalent mechanism).

These rules ensure that workspace isolation does not break runtime state access, and that shared state remains consistent under concurrent execution.

### Workspace lifecycle

| phase | what happens |
|---|---|
| **prepare** | create workspace from valid baseline |
| **execute** | implement and locally inspect |
| **review-ready** | produce worker self-check and hand off for review |
| **reconcile** | refresh against current baseline if needed |
| **integrate** | enter serialized integration lane |
| **close or archive** | cleanup or preserve for recovery depending on state |

A damaged or externally modified workspace MUST be treated conservatively. See edge cases below.

## Lock Model

Locks prevent unsafe overlap between concurrent tasks. They are a coordination mechanism, not a total-control system.

| lock type | purpose | example |
|---|---|---|
| `path` | direct path or surface overlap | two tasks editing the same file, document section, or data table |
| `interface` | shared contract, schema, or abstraction overlap | two tasks altering the same API, event format, or shared interface |
| `resource` | shared mutable resource | local ports, fixtures, external sandboxes, scarce tool capacity |
| `integration` | global serialized lane for baseline-changing integration | only one task may integrate at a time |

### Lock lifecycle

| phase | rules |
|---|---|
| acquire | acquisition MUST be visible in runtime state |
| hold | lock is active; other tasks with conflicting scope are blocked |
| renew or downgrade | if scope narrows, the lock MAY be downgraded |
| release | MUST happen on task completion, cancellation, or explicit park |

Abandoned locks SHOULD expire conservatively or require recovery cleanup. The integration lock MUST NOT be shared by competing tasks.

### Lock acquisition order

To avoid deadlock, the recommended acquisition order is:

1. `resource`
2. `interface`
3. `path`
4. `integration`

A project MAY adopt a different order, but it MUST document and enforce it consistently.

## Scheduler

The scheduler decides which ready tasks to execute and in what order. It SHOULD optimize for the following goals, listed by priority:

| priority | goal |
|---|---|
| 1 | integrity of evidence and baseline correctness |
| 2 | avoidance of overlapping unsafe work |
| 3 | completion of unblockers before dependents |
| 4 | risk-aware throughput |
| 5 | fairness across ready tasks |
| 6 | minimized rework from preventable drift |

### Concurrency budget

A project SHOULD define a concurrency budget per risk level:

| risk_level | recommended concurrency |
|---|---|
| `critical` | one at a time unless explicitly proven independent |
| `high` | bounded parallelism with strong lock checks |
| `normal` | parallel when scopes are independent |
| `low` | parallel by default if no lock conflict exists |

To consider critical tasks "proven independent," all of the following must hold:

- their `scope.surfaces` do not overlap
- no lock conflict exists between them
- neither task's output is an input to the other
- Design Authority has confirmed their independence

The scheduler MUST NOT maximize concurrency at the cost of impossible review or impossible recovery.

### Scheduler State

The scheduler exposes its current state via `run.json.scheduler_state`, with enum values `active`, `idle`, `paused`:

- `active` — scheduler is selecting and dispatching ready tasks.
- `idle` — scheduler has no ready tasks to dispatch; waiting for external input.
- `paused` — scheduler is explicitly held (e.g., during integration-lane-only periods or manual intervention).

State changes do not alter task contracts; they only gate whether new dispatches happen.

## Safe Parallel Conditions

Tasks MAY run in parallel when all of the following are true:

- no lock conflict exists
- no shared integration lane ownership exists
- their acceptance criteria are independently reviewable
- the required reviewer set can still inspect them meaningfully
- recovery of one task will not corrupt the other

## Unsafe Parallel Combinations

Parallel execution SHOULD be blocked when any of the following are true:

- overlapping `path`
- overlapping `interface`
- shared migration or shared delivery artifact without serialization
- coupled risk-sensitive changes across surfaces
- one task's output is another's required baseline
- two tasks both require the integration lane soon and are likely to conflict

## Speculative Execution

A task MAY begin speculative implementation before a sibling task completes only when:

- assumptions are recorded explicitly
- the task can be cleanly restored to a prior state if assumptions fail
- interface risk is low or strongly bounded
- the selected mission mode allows speculation

Speculative execution MUST NOT be used to hide unresolved design disagreement.

## Pause, Park, and Preemption

| action | meaning | lock behavior |
|---|---|---|
| **pause** | temporarily unscheduled; keeps workspace and artifacts | locks held |
| **park** | intentionally removed from active scheduling | most locks released |
| **preempt** | Orchestrator interrupts the task for a higher-priority concern | checkpoint recorded for conservative resume |

The Orchestrator MAY preempt a task when:

- a higher-priority blocker appears
- recovery work becomes urgent
- a freshness or integrity condition makes continued execution unwise

A preemption checkpoint MUST include:

- current task state and progress step
- summary of workspace changes
- last completed artifact
- remaining work items
- known risks or blocking concerns

## Integration Lane

Integration changes the shared baseline and therefore MUST be serialized unless the local implementation has a proven equivalent integrity mechanism.

| rule | description |
|---|---|
| exclusive ownership | only one active lane owner at a time |
| visibility | lane ownership MUST be visible in runtime state |
| reconciliation | a task MUST reconcile with the latest baseline before integration |
| recording | integration result MUST be recorded whether it succeeded or failed |

## Edge Cases

### All tasks are paused

- `scheduler_state` MAY become `idle`
- the current blocking reason SHOULD be recorded
- a future resume MUST still perform freshness checks

### Simultaneous integration requests

- the scheduler MUST choose one deterministically
- the losing task remains `reviewed` until it acquires the lane
- the losing task MAY need revalidation if the winner changes shared surfaces

### Damaged or deleted workspace

- the task MUST NOT continue as if nothing happened
- recover from checkpoint if possible
- otherwise rebuild the workspace from a safe baseline and replay from the last safe boundary
- record the incident for evolution review if the loss was non-trivial

### Single-task session

The lock system may be mostly quiet, but baseline and integration rules still apply.

## Audit Events

A conformant runtime SHOULD be able to reconstruct:

- when each task acquired and released locks
- which task owned the integration lane
- when a task became stale
- when revalidation happened and what it decided
- why a task was paused, parked, or preempted

## Key Statement

Parallelism in Geas is always subordinate to integration integrity. Safe speed is permitted; untraceable speed is not.
