---
name: reviewing-phase
description: Invoked by the mission dispatcher when every mission-scope task in the current phase has reached a terminal state (passed, cancelled, or escalated); writes a phase-review entry with status passed and next_phase, then advances mission-state via mission-state update --phase.
user-invocable: false
---

# Reviewing Phase

## Overview

Closes a phase with an append-only phase-review entry, then advances `mission-state.phase`. The phase-review entry is the boundary marker between phases — it is the only way the CLI allows phase advancement. Phase-review is mission-level; per-task closures are separate and live in `closing-task`.

<HARD-GATE> Phase advance requires a matching phase-review with `status=passed` and `next_phase` equal to the target. The CLI rejects advancement otherwise. The skill never edits `mission-state.json` directly.

## When to Use

- `phase=specifying` completed: mission spec approved + design approved + ≥1 approved task contract. (This skill is normally invoked through `specifying-mission`'s final step, but can be invoked standalone by the dispatcher on resume.)
- `phase=building` completed: every mission-scope task is terminal (`passed`, `cancelled`, or `escalated`).
- `phase=polishing` completed: integration clean; retrospective tasks done.
- Do NOT invoke when any mission-scope task is still `drafted`, `ready`, `implementing`, `reviewing`, `deciding`, or `blocked` — non-terminal tasks block phase advance by CLI guard.
- Do NOT use inside `consolidating` — consolidation end is handled by `verdicting-mission`, not by a phase-review.

## Preconditions

- All mission-scope tasks are in terminal states (`passed` / `cancelled` / `escalated`).
- For full_depth mode specifying: required mission-level deliberation entry exists.
- CLI is the sole writer to `.geas/`.

## Process

1. **Verify invariants.** Read all `task-state.json` files under the mission. Confirm every task is terminal. If any task is non-terminal, halt and return to the dispatcher with the list of open tasks; do not proceed.
2. **Aggregate the phase summary.** Gather:
   - Task counts by terminal kind: `passed`, `cancelled`, `escalated`.
   - Evidence counts by kind across the phase.
   - `gap_signals` and `debt_candidates` surfaced in closures.
   - Phase duration (first task transition → last closure).
3. **Write the phase-review entry.** `geas phase-review append` is full-payload only (no inline flags), so stage the prose in .geas/tmp/ using the current client's file-write mechanism and pass `--file`. For the exact field list, run `geas schema template phase-reviews --op append`.
   ```bash
   # Step 1: stage the prose in .geas/tmp/ using the current client's file-write mechanism, e.g. .geas/tmp/phase-review.json (body matches the schema template)
   # Step 2: hand the file to the CLI
   geas phase-review append --mission <id> --file .geas/tmp/phase-review.json
   ```
   CLI injects `entry_id`, `created_at`; appends to `phase-reviews.reviews`.
4. **Advance the phase.** `geas mission-state update --mission <id> --phase <next>`. The CLI guards that the last `phase-reviews.reviews` entry has `next_phase` matching the target. For `--phase building`, the CLI also bulk-transitions approved drafted tasks to `ready` (per CLI.md §14.2).
5. **Return to the mission caller.** This skill does not format briefings itself. The mission caller will render the **Phase-transition** narrative template from `skills/mission/references/briefing-templates.md` (section 3) in Korean — naming the previous and next `phase`, the task counts in the just-closed phase, the next phase's main activity, and (where applicable) the user-confirmation gate. The user-facing vocabulary allowlist at the top of that templates file constrains the emitted briefing.

Phase-gate invariants (for the Process step 1 check):

- `specifying → building`: spec `user_approved=true`, mission-design written, every initial task has `approved_by` set.
- `building → polishing`: all mission-scope tasks in `passed`, `cancelled`, or `escalated`. Phase-review summarizes the build result.
- `polishing → consolidating`: integration-review evidence present; any last-mile tasks terminal.
- `consolidating → complete`: handled by `verdicting-mission`, not this skill.

## Red Flags

| Excuse | Reality |
|---|---|
| "All tasks except one are terminal — close the phase anyway" | Phase-review guard rejects. Non-terminal tasks must first move to `blocked` / `cancelled` / `escalated` with a rationale. |
| "Skip phase-review — just advance with `mission-state update --phase`" | CLI rejects advance without a matching review. Phase-review is the boundary artifact, not ceremony. |
| "Set `next_phase` to the phase after next to save a round" | Phases advance one step at a time. Skipping creates an inconsistent audit trail. |
| "The summary can be one word" | Phase-review is the consolidation input for next-phase planning. A vacuous summary defeats its purpose. |
| "Edit the last phase-review to fix a typo" | `phase-reviews.reviews` is append-only. Mistakes are corrected by appending a follow-up review (with rationale), not by overwrite. |

## Invokes

| CLI command | Purpose |
|---|---|
| `geas phase-review append --mission <id>` | Write the boundary entry; append-only. |
| `geas mission-state update --mission <id> --phase <next>` | Advance phase; CLI guards via the appended review + for `--phase building` bulk-transitions drafted tasks. |

## Outputs

- `.geas/missions/{mission_id}/phase-reviews.json` grows by one entry with `status=passed`, `next_phase` set.
- `.geas/missions/{mission_id}/mission-state.json` has `phase` advanced.
- Possibly: bulk task transitions `drafted → ready` when advancing to `building`.

## Failure Handling

- **Non-terminal tasks detected**: halt; return to dispatcher with the list. The dispatcher decides whether to close them (`blocked` / `cancelled` / `escalated`) before re-invoking.
- **CLI `guard_failed` on phase advance**: read hints. Typical causes: `next_phase` mismatch, or a drafted task without `approved_by` blocks the building transition.
- **Schema rejection on phase-review append**: `summary` empty, or `next_phase` not a valid enum. Fix and retry.
- **Bulk transition partial failure** (advance to `building`): inspect `bulk_transitions.failed` in the response; unblock each named task, then re-attempt the phase advance.
- **Attempted re-advance after failure**: phase-review is append-only. If the last entry has wrong `next_phase`, append a corrective review before retrying.

## Related Skills

- **Invoked by**: mission dispatcher when all mission-scope tasks are terminal. Also called at the end of `specifying-mission` as its closing step.
- **Invokes**: none.
- **Do NOT invoke**: `consolidating-mission` — consolidation is its own phase, entered via the `polishing → consolidating` phase-review this skill writes, then dispatched separately. `verdicting-mission` — mission verdict is the consolidating-phase exit, not a phase-review.

## Remember

- Phase-review is the boundary artifact; phase advance requires it.
- Append-only — fix mistakes by appending corrective reviews.
- Every mission-scope task must be terminal before this skill runs.
- For `--phase building`, CLI bulk-transitions approved drafts to `ready` automatically.
- This skill writes the entry and advances the phase; dispatcher owns the briefing.
