---
name: scheduling-work
description: Invoked by the mission dispatcher when one or more approved tasks have dependencies satisfied and no active surface conflict; constructs a parallel batch under the baseline workspace rules, dispatches implementers for the batch, and returns the dispatched set plus deferred list to the dispatcher.
user-invocable: false
---

# Scheduling Work

## Overview

Constructs a task-level parallel batch and dispatches implementers for the selected tasks. Task-level parallelism only — step-level parallelism inside a task is governed by the contract, not by this skill. Scheduling is a planning aid; the CLI re-enforces every constraint on `task transition --to implementing`.

<HARD-GATE> `contract.surfaces` is the concurrency contract. Pairwise overlap = no concurrent execution. Critical-risk tasks run solo.

## When to Use

- Dispatcher signals `phase=building` (or `polishing`) with at least one `ready` task whose dependencies are all `passed`.
- Session resume where no `implementing` tasks are in flight.
- Do NOT use to re-dispatch tasks already in `implementing` — leave them with their implementer until they move to `reviewed`, `blocked`, or `escalated`.
- Do NOT use during `specifying` or `consolidating`.

## Preconditions

- All candidate tasks have `task-state.status == ready`.
- Every dependency of every candidate has `task-state.status == passed`.
- `.geas/memory/shared.md` readable; no direct edits.
- CLI is the sole writer to `.geas/`.

## Process

1. **Seed candidates.** Every task whose `task-state.status == ready`. Ignore terminal (`passed`, `cancelled`), waiting (`drafted`), and in-progress (`implementing`, `reviewed`, `verified`, `blocked`, `escalated`) states.
2. **Dependency gate.** Drop candidates with any dependency not in `passed`. Reason: `dependency_not_passed`.
3. **Baseline staleness check.** Compare each candidate's `contract.base_snapshot` against the current baseline reference (typically integration branch tip). Equal → proceeds. Different but the diff is outside the candidate's `surfaces` → proceeds. Different and overlapping → defer with `baseline_stale`. Rebase the baseline or re-draft the task before retry.
4. **Surface conflict prevention.** Compare each candidate's `surfaces` pairwise against (a) surfaces held by currently-`implementing` tasks in this mission, (b) surfaces of candidates already accepted into this batch. Any overlap → defer with `surface_conflict` (list the conflicting strings).
5. **Critical-risk solo rule.** If any candidate has `risk_level == critical`, it runs alone. Remove all other candidates from the batch; defer them to the next cycle.
6. **Batch size cap.** Max 4 tasks per batch. Tie-break by `task_id` ascending. Defer the rest.
7. **Dispatch.** For each task in the final batch: `geas task transition --task <id> --to implementing`. On success, spawn the primary implementer. The CLI guard re-checks dependencies and surface conflict; a guard failure here means the candidate filter missed a constraint — that is a scheduling bug, not a CLI bug.

## Red Flags

| Excuse | Reality |
|---|---|
| "Batch is small — skip the staleness check this cycle" | Baseline staleness burns retry budget silently. Check is non-optional. |
| "Two tasks share one surface but barely overlap — let them run together" | The CLI `ready→implementing` guard rejects them anyway. `surfaces` is an absolute allowlist. |
| "Critical task + one small task in the same batch won't distract anyone" | Critical runs solo by rule. Batch splitting is not negotiable. |
| "Session resumed — re-dispatch this still-implementing task to be safe" | Re-dispatch corrupts evidence chains. Leave it with its implementer or transition `* → blocked` if stuck. |
| "Let me add a 5th task — the cap is a rule of thumb, not a hard stop" | The cap reflects reviewer concurrency; ignoring it starves the gate. |

## Invokes

| CLI command | Purpose |
|---|---|
| `geas context` | Read mission structure and active task states (optional freshness check). |
| `geas task transition --mission <id> --task <id> --to implementing` | Per-task dispatch. Re-validates dependencies, surface conflict, and state gate. |

## Outputs

- For each dispatched task: `task-state.status == implementing`, `active_agent == <implementer>`.
- Deferral list (kept in the orchestrator's working context, not written to `.geas/`): task_id + reason per deferred candidate.
- No direct `.geas/` writes beyond the CLI's state update and events log.

## Failure Handling

- **Guard failure on `ready → implementing`**: re-audit the candidate filter. A surface conflict missed by the skill but caught by the CLI means another task is already `implementing` or the baseline check was skipped.
- **Stuck `implementing` task with no progress**: transition to `blocked` (unconditional acceptance); rationale belongs in the later closure evidence. Do not force-restart by mutating state.
- **All candidates deferred**: return to the dispatcher with the deferral list; do not dispatch a batch of zero.
- **Baseline mismatch detected after dispatch**: the task's evidence will expose it. Do not attempt to re-baseline mid-flight; move to `blocked` and investigate.

## Related Skills

- **Invoked by**: mission dispatcher when `phase=building` (or `polishing`) has ready tasks with satisfied dependencies.
- **Invokes**: none directly in main session; each dispatched implementer runs `implementing-task` in its own spawned context.
- **Do NOT invoke**: `drafting-task` — scheduling does not create tasks; if no candidates exist, return to dispatcher. `running-gate` — gates run after `reviewed`, not after dispatch.

## Remember

- Task-level parallelism only.
- `surfaces` is the concurrency contract, not advisory.
- Critical-risk runs solo; batch cap is 4.
- Never re-dispatch an already-`implementing` task.
- Return control to the dispatcher after each batch; do not loop through closures here.
