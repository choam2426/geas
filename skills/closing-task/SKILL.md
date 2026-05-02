---
name: closing-task
description: Invoked by the mission dispatcher when the gate has returned verdict=pass on a task in the deciding state; writes the orchestrator closure evidence entry (verdict=approved) with retrospective fields, then transitions task-state from deciding to passed.
user-invocable: false
---

# Closing Task

## Overview

Writes the closure evidence that finalizes a task. Closure is an orchestrator-authored evidence entry (slot = orchestrator) with a closure-kind body; it records the retrospective (what went well, what broke, surprises, next-time guidance) and the orchestrator's approval verdict. The CLI's `deciding → passed` guard requires this entry with `verdict=approved`.

<HARD-GATE> Closure is orchestrator-authored, not implementer-authored. The closure evidence is the only way to leave `deciding`. Retrospective fields feed consolidation; omitting them is not a shortcut, it is data loss.

## When to Use

- Dispatcher signals a task in `task-state.status == deciding` with a passing gate run.
- Re-entry after escalation resolution (decision-maker approves the escalated task) — the same entry shape is used.
- Do NOT use on tasks still in `reviewing` — the gate must run first.
- Do NOT use on `blocked`, `escalated`, or `cancelled` terminal paths — those write closure via the decision-maker/orchestrator path with a different verdict.

## Preconditions

- `task-state.status == deciding`.
- `gate-results.runs` last entry has verdict `pass`.
- Task's evidence directory is present and complete.
- CLI is the sole writer to `.geas/`.

## Process

1. **Read the trail.** Load the contract, the self-check (read all entries to see iteration history; the latest entry is the implementer's final view), all reviewer entries, the verifier entry, and the latest gate run. Identify the acceptance criteria that the gate Tier 1 marked pass, the concerns reviewers raised, and the `gap_signals` / `debt_candidates` / `memory_suggestions` accumulated across the entries.
2. **Write the retrospective.** Draft closure fields:
   - `what_went_well` — concrete observations, not platitudes.
   - `what_broke` — failure modes encountered, even if recovered.
   - `what_was_surprising` — unexpected findings; if empty, say so explicitly (non-empty value is expected on most tasks).
   - `next_time_guidance` — actionable hint for future similar tasks.
3. **Promote signals.** Copy the aggregated `memory_suggestions`, `debt_candidates`, `gap_signals` into the closure entry (the orchestrator is the single collection point for consolidation).
4. **Append the closure evidence.** `geas evidence append --task <id> --agent orchestrator --slot orchestrator` with `evidence_kind=closure`, `verdict=approved`.
5. **Transition to `passed`.** `geas task transition --task <id> --to passed`. CLI guard checks that the last orchestrator closure entry has `verdict=approved`.
6. **Return to the mission caller.** Emit nothing else from this skill. The mission caller will render the **Task-completion** narrative template from `skills/mission/references/briefing-templates.md` (section 2) in Korean — naming the task, its result, key deliverable, memory and debt counts, and the next candidate — and pick up the next step. The user-facing vocabulary allowlist at the top of that templates file constrains the emitted briefing.

`geas evidence append` accepts inline flags (preferred for short prose) or a full JSON payload via `--file`. For the exact field list of a closure entry, run `geas schema template evidence --op append --kind closure`. The CLI injects `entry_id`, `created_at`; the agent/slot come from flags.

Inline form (closure-specific flags `--what-went-well`, `--what-broke`, `--what-was-surprising`, `--next-time-guidance` are repeatable; promote signals via repeatable `--memory-suggestion`, `--debt-candidate <json>`, `--gap-signal <json>`):

```bash
geas evidence append --mission <id> --task <id> \
    --agent orchestrator --slot orchestrator \
    --evidence-kind closure \
    --verdict approved \
    --summary "one-sentence task outcome" \
    --rationale "why approved; references gate run" \
    --scope-examined "what the closure covered" \
    --method-used gate-run-review --method-used evidence-trail-read \
    --what-went-well "concrete observation 1" --what-went-well "observation 2" \
    --what-broke "failure mode encountered, even if recovered" \
    --what-was-surprising "unexpected finding" \
    --next-time-guidance "actionable hint for future similar tasks" \
    --memory-suggestion "candidate memory entry" \
    --debt-candidate '{"title":"...","kind":"process","severity":"normal","summary":"..."}' \
    --gap-signal '{"kind":"learning_gain","summary":"..."}'
```

Use `--summary-from-file <path>`, `--rationale-from-file <path>`, `--scope-examined-from-file <path>` (stage the prose in .geas/tmp/ using the current client's file-write mechanism) for prose-heavy fields. The full-payload `--file <path>` form remains as a back-compat alias for callers who already author the full JSON; never use a bash heredoc — apostrophes / quotes / non-ASCII in retrospective prose break shell parsing.

## Red Flags

| Excuse | Reality |
|---|---|
| "Gate passed — skip the retrospective and just transition" | The `deciding → passed` guard rejects without a closure entry; retrospective fields are the primary consolidation input. |
| "Nothing broke — leave `what_broke` empty" | Empty retrospective fields are a consolidation failure. If nothing broke, state that explicitly; do not omit. |
| "Implementer writes closure" | Closure is orchestrator-authored. Implementer's evidence is implementation-kind, not closure-kind. |
| "Hand-transition to `passed` first, append closure later" | CLI guard rejects; even if bypassed, the audit trail would be inverted. Append first, transition second. |
| "Merge memory_suggestions from only one reviewer" | Consolidation needs the aggregated view. Copy from all reviewer + verifier entries, not one. |

## Invokes

| CLI command | Purpose |
|---|---|
| `geas evidence append --task <id> --agent orchestrator --slot orchestrator` | Write the closure evidence entry. |
| `geas task transition --task <id> --to passed` | Final transition; CLI guard checks the closure entry verdict. |

## Outputs

- `.geas/missions/{mission_id}/tasks/{task_id}/evidence/orchestrator.orchestrator.json` grows by one `closure` entry.
- `task-state.status` becomes `passed`.
- No phase-review writing here — that is `reviewing-phase`.

## Failure Handling

- **CLI `guard_failed` on transition**: the closure entry is missing, the wrong kind, or the wrong verdict. Re-read the evidence file; append again with corrected fields. Do not attempt state mutation.
- **Schema rejection on evidence append**: `evidence_kind=closure` has specific required fields (retrospective fields). Read hints; fill missing ones.
- **Conflicting signals** (gate says pass but the latest self-check entry surfaces a deviation): record the deviation in the retrospective; do not paper over it. If the conflict is severe, transition to `blocked` instead and escalate — closure with `verdict=approved` is for clean passes only.
- **Escalated task reaching closure**: verdict may be `escalated` or `cancelled` instead of `approved`. That path is not this skill's default; the dispatcher may route via decision-maker.

## Related Skills

- **Invoked by**: mission dispatcher after `running-gate` returns verdict=pass on a task.
- **Invokes**: none.
- **Do NOT invoke**: `running-gate` — that is the previous step. `reviewing-phase` — phase review aggregates after all mission-scope tasks are terminal, not per-task. `consolidating-mission` — consolidation aggregates at mission end.

## Remember

- Closure is orchestrator-authored, not implementer-authored.
- Retrospective fields are mandatory — they feed consolidation.
- `memory_suggestions`, `debt_candidates`, `gap_signals` copied into the closure entry are the single aggregation point.
- Append evidence first, transition second.
- Approved closure = clean pass. Escalated/cancelled paths use different verdicts.
