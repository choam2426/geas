# 07. Debt and Gap

> Defines Geas debts and the gap artifact. Debt and gap inputs emitted from tasks are owned by [03_TASK_LIFECYCLE_AND_EVIDENCE.md](./03_TASK_LIFECYCLE_AND_EVIDENCE.md); official accumulation and mission-level judgment are owned by this document.

## Purpose

Debt and gap can look similar, but they are not the same thing. This document defines how to record them separately and connect them to the final verdict.

| concept | question | example |
|---|---|---|
| debt | What are we knowingly leaving behind and accepting? | "The auth module refactor will not happen in this mission and is deferred to a future one." |
| gap | What did we fail to do, only partly do, or do differently from plan? | "Of the feature promised in the spec, only part Y of X was delivered." |

The two directions must not be blurred together. Under-delivery must not be disguised as debt, and accepted debt must not be rewritten as mere non-delivery.

## Debts

The canonical JSON artifact is `.geas/debts.json`, and its exact structure is governed by `debts.schema.json`. Debts are a **project-level ledger**. They do not belong to a single mission; they persist across the life of the project, and each entry points to its own origin mission and resolution mission.

The Orchestrator updates this ledger during the `consolidating` phase. It reviews the current mission's `debt_candidates` from task evidence, registers new debts, and updates the status of existing open debts that this mission resolved or discarded. The ledger can still be read outside `consolidating`; "what debt is currently open in the project?" should be answerable by this one file.

Each entry uses the following fields.

| field | meaning |
|---|---|
| `debt_id` | Stable identifier (`^debt-[0-9]{3}$`) |
| `severity` | `low` / `normal` / `high` / `critical` |
| `kind` | One of the schema enum values |
| `title`, `description` | Human-readable title and description |
| `status` | `open` / `resolved` / `dropped` |
| `introduced_by` | `{mission_id, task_id}` — the mission and task where this debt was first observed |
| `resolved_by` | `{mission_id, task_id}` — the mission and task that changed the status to `resolved` or `dropped`; `null` while the status is `open` |
| `resolution_rationale` | Narrative rationale for the status change, including the task, evidence, and context behind the resolution; `null` while the status is `open` |

### Criteria for raising debt

- Even if the current work closes now, the issue still needs to be handled in a later phase or a later mission.
- It can be clearly described as one of the allowed `kind` values. "Would be nice to improve" by itself is not debt.
- It creates real cost, not just a difference in taste.

### Status transition rules

- A new debt is appended to the ledger as `status: open` through `debt register`.
- If a mission decides an open debt has been resolved, it calls `debt update-status` with `status: resolved`; if the debt is no longer worth treating as debt, it calls `debt update-status` with `status: dropped`. In both cases it fills `resolved_by` and `resolution_rationale`.
- The ledger is a single file, so a debt's history is represented only by the entry's current status. If past status transitions need to be inspected, query `events.jsonl` by `debt_id`.

## Gap

The canonical JSON artifact is `.geas/missions/{mission_id}/consolidation/gap.json`, and its exact structure is governed by `gap.schema.json`. It is written by Design Authority during the `consolidating` phase as the output of scope-closure judgment.

Gap summarizes the difference between scope and delivery. The scope summary is not a restatement of the original mission spec; it describes the scope that was actually in force by the end of execution. If scope drift occurred during execution, that drift should be visible here.

| field | meaning |
|---|---|
| `scope_in_summary` | Summary of what was actually treated as in scope |
| `scope_out_summary` | Summary of what was actually left out of scope |
| `fully_delivered` | Items delivered as-is |
| `partially_delivered` | Items only partly delivered |
| `not_delivered` | Items not delivered. Intentional cuts are marked inline in the item text, for example `X (intentional cut: not enough time)` |
| `unexpected_additions` | Items added even though they were not part of the plan |

### Relationship between debt and gap

Gap is the record of what was observed after execution when scope is compared with delivery. Debt is the formal record of which of those issues the project has decided to carry forward as future work. The same phenomenon may appear in both places. Gap answers "what happened?"; debt answers "what will we carry forward?".

Debt kind `verification_gap` means a verification shortfall: something was in scope, but the verification procedure did not finish. Gap `partially_delivered` means only part of a scoped item was delivered, regardless of whether verification completed. If something was only partly delivered and that partial delivery was never fully verified, it belongs in both gap `partially_delivered` and debt `verification_gap`.

## Signals vs. official records

Task evidence may emit debt candidates and gap signals. That does not make them official debts or the official gap artifact.

- The agents writing each task's evidence raise signals.
- The `consolidating` phase decides whether to adopt them as official entries.
- The final verdict reads from the official debts and gap artifacts.

## Connection to the final verdict

The mission's final verdict reads debt and gap together.

- A mission may still be approved even with major debt left open, but the rationale for accepting it must be stated explicitly.
- If gap remains and the mission is still approved, it must be clear whether the outcome is an intentional cut or simple non-delivery.
- Follow-up work carried into the future is owned by debts. If an undelivered gap item is valuable enough to continue later, it should be promoted into a debt entry.

If debt and gap are left unresolved before the final verdict, the meaning of approval becomes blurry.
