---
name: verdicting-mission
description: Invoked by the mission dispatcher when consolidating-mission has finished writing debt, gap, memory-update, and memory markdowns; authors the mission-verdict entry (decision-maker slot) and returns to the dispatcher which emits the final briefing and transitions mission-state.phase to complete only after explicit user confirmation.
user-invocable: false
---

# Verdicting Mission

## Overview

Writes the final mission-level verdict — the decision-maker's assessment of whether the mission met its definition_of_done and acceptance_criteria, with any `carry_forward` notes for the next mission. This skill authors the verdict only; the dispatcher formats the user-facing briefing and, after user confirmation, transitions `mission-state.phase → complete`.

<HARD-GATE> Mission verdict is decision-maker-authored, not orchestrator-authored. A single verdict entry per mission (append-only log; subsequent entries correct prior ones but rarely occur). The `complete` transition happens only after explicit user confirmation via the dispatcher.

## When to Use

- Dispatcher signals consolidating-phase work is done: debt, gap, memory-update, and memory markdowns are all written.
- Do NOT run before consolidation completes — the verdict references consolidation outputs as part of its rationale.
- Do NOT run on missions in `cancelled` or terminated-by-failure paths — those take the escalation route, not a standard verdict.

## Preconditions

- `phase=consolidating`.
- `memory-update.json` present; memory markdowns replaced.
- `gap.json` present.
- All mission-scope tasks terminal; phase-reviews recorded for each completed phase.
- CLI is the sole writer to `.geas/`.

## Process

1. **Assemble the evidence set.** Read `spec.json` (definition_of_done, acceptance_criteria), all phase-reviews, `gap.json`, `memory-update.json`, and task-count aggregates. The verdict references this evidence.
2. **Grade each acceptance criterion.** For each criterion in `spec.acceptance_criteria`, mark ✓ or ✗ with a short rationale pointing to the gate run / closure / phase-review that established the result. Do not infer; cite.
3. **Formulate the overall verdict.** One of `approved | approved_with_carry_forward | not_approved`. "Carry forward" is used when DoD is met but specific gaps should be addressed by the next mission (referenced by `gap.json` entries).
4. **Draft `carry_forward` notes.** One or more pointers to future work. Each pointer either references an open debt (`debt_id`) or a `gap.json` entry. Vague or aspirational items are not recorded.
5. **Append the mission-verdict entry.** `geas mission-verdict append` is full-payload only (no inline flags), so stage the prose in .geas/tmp/ using the current client's file-write mechanism and pass `--file`. For the exact field list, run `geas schema template mission-verdicts --op append`.
   ```bash
   # Step 1: stage the prose in .geas/tmp/ using the current client's file-write mechanism, e.g. .geas/tmp/mission-verdict.json (body matches the schema template)
   # Step 2: hand the file to the CLI
   geas mission-verdict append --mission <id> --file .geas/tmp/mission-verdict.json
   ```
   CLI injects `entry_id`, `created_at`; appends to `mission-verdicts.verdicts`.
6. **Return to the mission caller.** This skill does not emit the briefing or transition the mission. The mission caller will render the **Mission-verdict** narrative template from `skills/mission/references/briefing-templates.md` (section 4) in Korean — naming the mission, the task counts, the definition-of-done outcome, the open debt and memory carried forward, and the user final-confirmation prompt — collect the user's approve, and only then run `geas mission-state update --mission <id> --phase complete`. The user-facing vocabulary allowlist at the top of that templates file constrains the emitted briefing.

## Red Flags

| Excuse | Reality |
|---|---|
| "Some acceptance criteria are partially met — call it approved" | Acceptance criteria are yes/no. Partial = fail; the honest path is `approved_with_carry_forward` with the gap cited. |
| "`carry_forward` without a debt or gap reference to keep it short" | Every `carry_forward` pointer must reference an existing artifact (debt or gap entry). Aspirational text is not recorded. |
| "Orchestrator writes the verdict — decision-maker is busy" | Mission verdict is decision-maker-authored. Orchestrator-authored verdicts corrupt the single-owner audit. |
| "Transition to `complete` after writing — skip the confirmation round" | The dispatcher owns the confirmation step. This skill never calls `mission-state update --phase complete`. |
| "Re-author a prior verdict to fix a typo" | Mission-verdicts is append-only. Append a corrective verdict that cites the prior one if correction is needed. |

## Invokes

| CLI command | Purpose |
|---|---|
| `geas mission-verdict append --mission <id>` | Write the mission verdict entry (append-only). |

Sub-skill invoked: none (the dispatcher invokes the optional `convening-deliberation` upstream if a decision-maker review conflicts).

## Outputs

- `.geas/missions/{mission_id}/mission-verdicts.json` grows by one entry.
- No direct phase transition from this skill — dispatcher handles `complete` after user confirmation.

## Failure Handling

- **Schema rejection on append**: `acceptance_criteria_results` empty, `verdict` enum invalid, or `carry_forward` not an array. Read hints, fix, retry.
- **Acceptance criterion cannot be graded from evidence**: do not infer. Either cite a gap.json entry explaining the missing evidence and mark `fail`, or invoke `convening-deliberation` (full_depth) to surface a consensus read.
- **Consolidation incomplete** (memory-update or gap missing): halt; return to dispatcher. Verdict cannot be authored until consolidation artifacts exist.
- **Missing `geas mission-verdict append` at runtime**: CLI.md documents this; it should be registered. If it is not, report upward as a CLI gap and halt.

## Related Skills

- **Invoked by**: mission dispatcher after `consolidating-mission` has finished writing debt/gap/memory artifacts.
- **Invokes**: none.
- **Do NOT invoke**: `consolidating-mission` — that must be complete before this skill runs. `reviewing-phase` — the mission-verdict is the consolidating-phase terminal artifact, not a phase-review. The dispatcher, not this skill, calls `geas mission-state update --phase complete`.

## Remember

- Decision-maker authors; orchestrator does not.
- Acceptance criteria are yes/no; cite evidence per criterion.
- Carry-forward must reference an existing debt or gap entry.
- Append-only log; corrections are new entries, not overwrites.
- `complete` transition is the dispatcher's job after user confirmation.
