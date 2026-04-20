---
name: scheduling
description: Construct parallel task batches under the v3 baseline workspace rules. Selects ready tasks, detects surface conflicts, enforces critical-risk solo execution, and only then dispatches implementers.
---

# Scheduling

Protocol document for the orchestrator. There is no separate scheduling agent. The orchestrator reads this skill and applies it directly before dispatching any implementer.

Task-level parallelism only. Step-level parallelism inside a single task is governed by protocol 03 and 04, not by this skill.

## Inputs

- All contracts under `.geas/missions/{mission_id}/tasks/*/contract.json`.
- All task states under `.geas/missions/{mission_id}/tasks/*/task-state.json`.
- Current mission mode and phase from `.geas/missions/{mission_id}/spec.json` + `mission-state.json`.
- The project's baseline reference the contracts recorded in `base_snapshot` (typically the integration branch tip — the implementation of "is this snapshot stale" lives outside this skill).

## Output

- An ordered batch of task ids that may transition to `implementing` now. The orchestrator dispatches them using `geas task transition --to implementing` in sequence (each guard-checked).
- A list of tasks deferred to the next batch, each with a deferral reason (dependency not `passed`, surface conflict, critical-risk solo rule, baseline stale).

## Batch Construction

Follow the steps in order. Each step narrows the candidate set.

### 1. Seed candidates

Every task whose `task-state.status == ready`. Ignore terminal states (`passed`, `cancelled`), waiting states (`drafted`), and in-progress states (`implementing`, `reviewed`, `verified`).

### 2. Dependency gate

For each candidate, every id in `contract.dependencies` must have `task-state.status == passed`. Drop candidates with unmet dependencies. The CLI also enforces this on `task transition --to implementing` — this step is the orchestrator-level early rejection so no wasted dispatch occurs.

### 3. Baseline staleness check

For each candidate, compare `contract.base_snapshot` against the current baseline reference. The contract format permits any string, but the convention is a git commit sha.

- If equal: candidate proceeds.
- If different but the diff is in surfaces unrelated to the candidate's `surfaces`: candidate proceeds; the stale baseline is harmless for this task.
- If different and the diff overlaps the candidate's surfaces: candidate is deferred with reason `baseline_stale`. The orchestrator rebases the baseline or re-drafts the task before trying again.

Staleness is a pre-dispatch check, not a post-hoc one. Running an implementer against a stale baseline wastes the retry budget.

### 4. Surface conflict prevention

Maintain the invariant: at most one active task (state == `implementing`) per surface.

Compare each candidate's `surfaces` against:
- surfaces held by currently `implementing` tasks in the same mission,
- surfaces held by any other candidate already accepted into the current batch.

Any overlap drops the candidate with reason `surface_conflict` (include the conflicting surface strings). The CLI's `ready -> implementing` guard enforces this again at dispatch time — treat the skill's check as a planning aid.

Rule of thumb: the allowlist in `contract.surfaces` is the contract. If two tasks overlap on even one surface string, they do not run concurrently.

### 5. Critical-risk solo rule

Any candidate with `risk_level == critical` runs alone. If you add a `critical` task to the batch, remove all other candidates and defer them to the next cycle.

Rationale: critical tasks land irreversible change (migrations, authority boundaries). Orchestrator attention and reviewer capacity should not be split.

### 6. Batch size cap

Limit the final batch to at most 4 tasks. If more candidates survive, pick by `task_id` ascending (deterministic ordering) and defer the rest. The cap reflects orchestrator attention + reviewer concurrency, not a hard CLI constraint.

## Dispatch

For each task in the final batch:

```bash
geas task transition --mission {mission_id} --task {task_id} --to implementing
```

The CLI guard re-checks:
- task-state currently `ready` (or `blocked` if you are unblocking),
- every dependency in `passed`,
- no surface conflict with existing `implementing` tasks.

A guard failure here means your candidate filter missed a constraint. Treat it as a scheduling bug, not a CLI bug.

Once the transition succeeds, spawn the implementer agent for that task. The implementer writes evidence under the task's evidence directory and signals completion through its own evidence file (G4 defines the closure path).

## Recovery

When a session resumes and implementing tasks exist, do not re-dispatch. The task is still in the implementer's hands until either:
- its implementer produces implementation evidence plus self-check, and the orchestrator transitions it to `reviewed`;
- a block or escalation lands it in `blocked` / `escalated`.

If a task is stuck in `implementing` without progress (no recent evidence, no self-check), the orchestrator may transition it to `blocked` and investigate. The transition guard accepts `* -> blocked` unconditionally; the rationale belongs in the later closure evidence.

## Lightweight / Standard / Full-depth

Operating mode adjusts reviewer counts and gate strictness inside `evidence-gate`, not here. This skill produces the same kind of batch regardless of mode. One gotcha: lightweight missions typically draft fewer tasks, so most batches will be size 1. That is not a bug.

## Non-goals

- No speculative scheduling in v3. A task does not enter `implementing` before its dependencies pass. If you want early preparation, draft a separate low-risk task with an empty dependency list.
- No global path lock manifest. The `surfaces` allowlist on each contract is the only concurrency contract; the skill enforces it by pairwise comparison.
- No hotfix preemption machinery. A hotfix is just a new task; the orchestrator may cancel in-flight tasks explicitly via `task transition --to cancelled` and then draft and approve the hotfix task.
