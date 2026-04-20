# 04. Baseline, Workspace, and Parallelism

> Defines what baseline a Geas task starts from, how work is isolated in a workspace, and under what conditions multiple tasks may run in parallel.

## Purpose

This document covers three questions.

- What shared reference point does a task start from?
- How is in-progress work isolated?
- When may multiple tasks run together?

The goal is not raw speed. It is parallel execution without collisions, and runtime state that remains recoverable.

## Baseline

A baseline is the trusted shared reference point a task relied on when it started. The `base_snapshot` field in the [task contract](./03_TASK_LIFECYCLE_AND_EVIDENCE.md) pins that reference point.

### Baseline rules

- Before the Orchestrator moves a task from `ready` to `implementing`, it must verify that the baseline is still valid.
- If the baseline has changed, the Orchestrator decides whether to proceed as-is, relock against the new baseline, or send the task back for reconsideration.
- If the baseline delta conflicts with the task's `surfaces`, the task must not continue unchanged.

## Workspace

A workspace is the working surface where a task accumulates its actual changes. The protocol does not prescribe a specific mechanism, but the isolation must be strong enough to distinguish one task's changes from another's.

### Workspace principles

- Every active task must leave its work in a traceable workspace.
- Workspace state and mission/runtime state are not the same thing.
- A dirty workspace is not automatically invalid, but it must still be possible to explain which task produced which changes.
- During recovery, a workspace does not outrank the artifacts. The contract and evidence come first.

## Parallel execution principles

Parallel execution is not the default. It is allowed only when the conditions are right.

### Conditions for safe parallelism

- The baselines do not conflict.
- The `surfaces` do not materially overlap.
- Reviewers and evidence can be read separately for each task.
- One task does not depend on another task's output or judgment.

### When to avoid parallel execution

- When two tasks change the same interface or the same resource at the same time
- When integration order directly affects the quality of the outcome

## Coordination principles

- The Orchestrator should order tasks to avoid conflicts up front, rather than patching them together later.
- Even during parallel execution, task closure decisions and the mission's final verdict still follow the procedures defined in their owner documents.
- An implementation may expose executor state such as `active`, `idle`, or `paused`, but those signals do not by themselves guarantee that parallel execution is safe.
