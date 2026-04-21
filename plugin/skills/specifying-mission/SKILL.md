---
name: specifying-mission
description: Invoked by the mission dispatcher when phase=specifying and a mission spec has not yet been approved (or no mission exists); drives one-question-at-a-time requirement intake, produces an approved mission spec, an approved mission design, and the initial approved task set, then closes the specifying phase with a phase-review.
user-invocable: false
---

# Specifying Mission

## Overview

Drives the specifying phase end-to-end. Turns a natural-language request into an immutable mission spec, a mission-design artifact, and at least one approved task contract. Hands control back to the dispatcher after a specifying→building phase-review is appended.

<HARD-GATE> Mission spec is immutable after user approval. Every question must aim at something the user will sign off on as a fixed contract. Do not invent; if unknown, ask.

## When to Use

- `phase=specifying` and no `spec.json` exists for the active mission.
- `phase=specifying` and `spec.json` exists but `user_approved=false`.
- `phase=specifying` and spec is approved but `mission-design.md` is missing.
- `phase=specifying` and design exists but no approved task contract yet.
- Do NOT use to amend an already-approved spec — create a new mission or scope-in via `drafting-task`.
- Do NOT use for trivial single-file requests — the dispatcher bypasses the mission pipeline entirely.

## Preconditions

- `.geas/` exists (dispatcher guarantees this).
- Active `mission_id` is known, or no mission exists yet and the user is starting fresh.
- CLI is the sole writer to `.geas/`; no direct file edits at any step.
- If the request spans multiple independent subsystems, return to the dispatcher with a decomposition proposal instead of forcing one mission.

## Process

1. **Size the request.** Decide: single mission or multi-mission? If multi, propose decomposition and run this skill against the first mission.
2. **Select the mode (mandatory ask).** Explicitly ask the user to pick `lightweight | standard | full_depth`. Recommend one based on request signal (scope clarity, risk, cross-module impact) and state why in the question body. Use the `AskUserQuestion` tool with the three options (header: "Mode") so the choice is structured, not inferred from prose. Do not infer silently.
3. **Explore requirements, one question at a time.** Cover: scope boundary (in/out), target user, definition_of_done (one sentence), acceptance_criteria (≥3 observable/falsifiable), constraints, affected_surfaces, risks. Use `AskUserQuestion` for every structured choice — it enforces one-at-a-time, surfaces 2–4 options with labels, and appends "Other" automatically for free-text escape. Skip unambiguous items. If user says "just build it", fill best-effort and note `intake-skipped` in the description.
4. **Section-by-section approval.** Before the CLI call, confirm each section: name, description, scope in/out, DoD, acceptance_criteria, constraints, risks. `AskUserQuestion` accepts up to four questions in a single call, so batch related approvals (for example: name + description, or constraints + risks) instead of serial prose. Each question offers `approve | revise` with "Other" as the free-text escape for substantive edits.
5. **Create + approve the mission spec.** Run `geas mission create` (payload shape below). Show the summary. On user confirm, run `geas mission approve`. Spec becomes immutable.
6. **Author the mission design.** For `lightweight` the orchestrator may write `mission-design.md` directly via `geas mission design-set`. For `standard` ask decision-maker to review before user sign-off. For `full_depth` record a mission-level deliberation (via `convening-deliberation`) with challenger + decision-maker + ≥1 specialist before user approval.
7. **Draft the initial task set.** Plan the decomposition, then for each planned task delegate to `drafting-task` to author the contract. `drafting-task` writes the draft and returns control here BEFORE approving — approval happens in Step 9, after the user has audited the decomposition.
8. **Present the task-set overview.** Once every task in the initial set is drafted, render a decomposition table so the user audits the slicing itself before committing to individual contracts. Use `AskUserQuestion` (header: `Task set`) with options `approve-set | redecompose | drop-one`. "Other" covers targeted adjustments (split one, reorder, rename). Do not skip this step — set-level decomposition (which slices exist, which surfaces overlap, which dependencies form the order) is a separate audit from per-task contract fields, and collapsing the two hides scope errors behind card-level wording.

    ```
    | id | title | risk | surfaces (summary) | deps |
    |----|-------|------|---------------------|------|
    ```

9. **Per-task approval.** Walk each drafted task in dependency order. `drafting-task` Step 11 renders the full card and Step 12 runs the section-scoped approval via `AskUserQuestion`. Approve via `geas task approve --by user` per `drafting-task` Step 14 (or `--by decision-maker` for mid-mission in-scope additions).
10. **Close the phase.** Append a specifying phase-review and return control. The dispatcher advances the phase.

CLI payload shape (mission create):

```json
{
  "name": "<approved name>",
  "description": "<approved description>",
  "mode": "<lightweight|standard|full_depth>",
  "definition_of_done": "<one sentence>",
  "scope": { "in": ["..."], "out": ["..."] },
  "acceptance_criteria": ["...", "...", "..."],
  "constraints": ["..."],
  "affected_surfaces": ["..."],
  "risks": ["..."]
}
```

The CLI injects `id`, `user_approved=false`, `created_at`, `updated_at`.

## Red Flags

| Excuse | Reality |
|---|---|
| "The user is in a hurry — skip mode selection and default to standard" | Mode is a mandatory explicit ask; silent defaults produce missions governed by wrong gates. |
| "Acceptance criteria repeat the DoD — drop them" | Acceptance criteria are the falsifiable tests reviewers measure against; DoD alone gives nothing to grade. |
| "User sounded certain — skip section-by-section approval" | Section approval is the user's last chance to touch a soon-immutable contract. Skipping it bakes in misreads. |
| "Spec approved — retroactively edit it because scope slipped" | The spec is immutable after approval. Use `drafting-task` for in-scope additions or start a new mission. |
| "Just dump the whole intake as a prose block — it's faster" | Unstructured prose loses answers and invites the user to skim. `AskUserQuestion` forces a structured pick per question and keeps the audit trail clean. |
| "Draft the tasks, list them in a bullet, get one 'approve' for the whole set" | The task set has two audit layers: decomposition (set-level — which slices exist, surface overlap, dependency order) and contract (per-task — routing, criteria, verification). Collapsing them loses the surface/dependency check and locks contracts the user never saw. Overview table first, then per-task card via `drafting-task`. |

## Invokes

| CLI command | Purpose |
|---|---|
| `geas mission create` | Write the initial mission spec (scaffold + spec.json). |
| `geas mission approve --mission <id>` | Flip `user_approved` to true; lock the spec. |
| `geas mission design-set --mission <id>` | Write `mission-design.md` content (CLI.md §3 mission-level). |
| `geas task approve --mission <id> --task <id> --by user\|decision-maker` | Approve each drafted initial task. |
| `geas phase-review append --mission <id>` | Close the specifying phase with `status=passed`, `next_phase=building`. |

Sub-skills invoked: `drafting-task` (per initial task), `convening-deliberation` (full_depth design approval only).

## Outputs

- `.geas/missions/{mission_id}/spec.json` created, `user_approved=true`.
- `.geas/missions/{mission_id}/mission-design.md` written.
- `.geas/missions/{mission_id}/tasks/{task_id}/contract.json` for each initial task, `approved_by` set.
- `.geas/missions/{mission_id}/phase-reviews.json` has a new `specifying` entry with `status=passed`, `next_phase=building`.

## Failure Handling

- **Schema rejection** on `mission create`: read hints (`missing_required`, `invalid_enum`, `wrong_pattern`); fix payload and retry. Do not bypass.
- **Design approval stalls** in full_depth: escalate to deliberation (`convening-deliberation`); record the result before re-asking the user.
- **User declines a section**: revise that section only; re-present for approval. Never silent-skip.
- **Ambiguous mission boundary**: halt and return to dispatcher with a decomposition proposal; do not force-create a spec.
- **`geas mission design-set` guard rejection** (`guard_failed`): check that the mission spec is `user_approved` and the current phase is `specifying`; after building starts, the design is frozen and must not be edited from this skill.

## Related Skills

- **Invoked by**: mission dispatcher when `phase=specifying` and the spec/design/initial-task sequence is incomplete.
- **Invokes**: `drafting-task` (per initial task), `convening-deliberation` (design approval in `full_depth`).
- **Do NOT invoke**: `scheduling-work`, `running-gate`, `closing-task` — those belong to later phases. `reviewing-phase` writes the phase-review through this skill's closing step, not as a separate invocation.

## Remember

- Mode selection is an explicit ask, never inferred. Use `AskUserQuestion` for it.
- One question at a time for exploration; batch up to 4 questions in a single `AskUserQuestion` call when approvals are independent and related.
- Section-by-section approval before CLI writes; immutable after approve.
- At least one approved task contract must exist before the specifying phase-review.
- Task set has two audit layers — decomposition (overview table, set-level) then contract (per-task card via `drafting-task`). Never collapse them into one approval.
- Return control to the dispatcher after appending the phase-review — do not call `mission-state update --phase` from here.
