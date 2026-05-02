---
name: specifying-mission
description: Invoked by the mission dispatcher when phase=specifying and a mission spec has not yet been approved (or no mission exists); drives one-question-at-a-time requirement intake, produces an approved mission spec, an approved mission design, and the initial approved task set, then closes the specifying phase with a phase-review.
user-invocable: false
---

# Specifying Mission

## Overview

Drives the specifying phase end-to-end. Turns a natural-language request into an immutable mission spec, an approved mission design, and at least one approved task contract. Hands control back to the dispatcher after a specifying→building phase-review is appended.

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
- Codex adapter: every spawned `design-authority` or `decision-maker` prompt must be built by loading the concrete agent file per `../mission/references/codex-agent-dispatch.md`. If the file is unavailable, stop with `missing_agent_prompt` instead of spawning a generic agent.

## Process

0. **Pre-scan repo (skill memory only).** Before any user prompt, run a quick read-only sweep that captures facts to turn open intake questions into confirm-this prompts. Glob/Grep targets:

    - **Manifests / build**: `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `Makefile`
    - **Test runners**: `vitest.config*`, `jest.config*`, `pytest.ini`, `tests/`, `*_test.go`
    - **Lint / format**: `.eslintrc*`, `.prettierrc*`, `ruff.toml`, `.golangci*`
    - **Surface candidates**: grep keywords from the user's request to narrow probable `affected_surfaces`.

    Hold the result as a skill-local working note. Do NOT surface it as a separate user round — it feeds Step 2 reframing only.

1. **Size the request.** Decide: single mission or multi-mission? If multi, propose decomposition and run this skill against the first mission.

2. **Explore requirements, one question at a time.** Cover: scope boundary (in/out), target user, definition_of_done (one sentence), acceptance_criteria (≥3 observable/falsifiable), constraints, affected_surfaces, risks. Issue a structured single-choice prompt for every structured choice — keep it one-at-a-time, surface 2–4 options with labels, and append a free-text escape ("Other" or equivalent) so the user can answer outside the offered options. Use the Step 0 pre-scan note: when a fact already exists for an intake item (e.g., the test runner), reframe the open question as a confirm-this prompt ("vitest detected — confirm?") rather than asking blank. Skip unambiguous items. If user says "just build it", fill best-effort and note `intake-skipped` in the description.

3. **Spec self-check (skill-level).** Before assembling the unified review round, run a self-check across two axes. This is an LLM-level inspection that does NOT produce a `self_check` evidence file (which belongs to task lifecycle, not mission spec) — it stays in skill memory and feeds Step 4's display.

    - **AC ↔ DoD alignment**: is `definition_of_done` a single, externally-agreeable sentence? Are all `acceptance_criteria` (≥3) testable and observable? When every AC holds, does DoD automatically hold (no bypass path that satisfies every AC while sidestepping the DoD intent)?
    - **Scope ↔ Surface alignment**: do `scope_in` items map onto entries in `affected_surfaces`? Flag scope_in items with no surface match (abstract scope), and surfaces appearing without scope coverage (silent expansion).

    Generic noise (placeholders like "TBD" / "TODO", vague qualifiers like "appropriately" / "as needed") is absorbed into these axes — placeholders in AC fail the testable check, vague qualifiers fail the falsifiable check. Self-check is a recommendation surface, not a gate; findings appear in Step 4 and the user may choose proceed or revise.

4. **Unified review round.** Present a single round combining: spec preview (every section in `spec.json`), self-check findings from Step 3, and a mode recommendation with reasoning. Issue a structured-prompt round carrying two related questions in one batch (per the "up to four related questions" rule):

    1. **Mode** — `lightweight | standard | full_depth`, with a free-text escape. Recommend one based on scope width, AC testability, surface count, and self-check signal; state the reasoning in the prompt body.
    2. **Decision** — `proceed | revise`, with free-text escape for "which section, what change".

    On `revise`, return to Step 2 for the named section only, re-run Step 3 self-check, and re-display Step 4. On `proceed`, advance to Step 5 carrying the user's mode pick.

    Self-check is a recommendation, not a gate — even with non-OK findings, the user may proceed. Mode is a user pick, not the recommendation — the recommendation is reasoning material, never substituted for the answer.

5. **Create + approve the mission spec.** Run `geas mission create` with the user-selected mode from Step 4 (payload shape below). On user `proceed` in Step 4, run `geas mission approve`. Spec becomes immutable.

6. **Author the mission design.** specifying-mission spawns `design-authority` to author `mission-design.md` (the spawned agent runs `designing-solution` Branch A and calls `geas mission design-set` itself).

    Mode-dependent prereq before user approval (doc 02 § Operating Mode Requirements):
    - `lightweight`: user approves directly. Open ad-hoc deliberation via `convening-deliberation` only when disagreement surfaces.
    - `standard`: spawn `decision-maker` through the current client adapter; Claude uses registered Geas agent type `geas:authority:decision-maker`, while Codex reads `agents/authority/decision-maker.md` and spawns with that prompt plus context. The spawned agent runs `deciding-on-approval` and writes review-kind evidence before user sign-off.
    - `full_depth`: mission-level deliberation via `convening-deliberation` with decision-maker + challenger + ≥1 specialist (minimum 3 voters). Passing deliberation may substitute for the separate decision-maker review.

    Orchestrator collects design output, runs the prereq, then takes user approval — main-session does not write the design itself, and does not approve on the user's behalf (doc 01 § Orchestrator).

7. **Author the initial task contract set.** specifying-mission spawns `design-authority` a second time. The spawned agent plans decomposition from the approved mission-design and authors each task contract by invoking `drafting-task` (one task per call, in dependency order). main-session collects the drafted contracts when the spawned agent returns.

    Task contract authoring is design-authority's responsibility, not the orchestrator's (doc 01 § Design Authority, doc 03 § drafted state).

8. **Mode-dependent prereq for the initial task contract set.** Same rule as Step 6's design prereq (doc 02 § Operating Mode Requirements):
    - `lightweight`: none. Ad-hoc deliberation via `convening-deliberation` only on disagreement.
    - `standard`: spawn `decision-maker` (same mechanism as Step 6) to review the task set; the spawned agent runs `deciding-on-approval` and writes review-kind evidence before user approval.
    - `full_depth`: mission-level deliberation on the task set (decision-maker + challenger + ≥1 specialist, minimum 3 voters). Passing deliberation may substitute for the separate decision-maker review.

9. **Per-task user approval.** For each drafted task in dependency order, run the unified approval round defined by `drafting-task` Step 11+12: card rendered together with the dep-status preflight result. The first task's card carries a compact decomposition-table header so the user can audit the slicing before committing to individual contracts; subsequent tasks' cards omit the table.

    Prompt options branch on preflight outcome:
    - all deps OK → `approve | revise | cancel`
    - any dep `cancelled` / `escalated` / `void` → `repoint-deps | redraft-task | cancel-this-task`

    Free-text escape on every round; for set-level adjustments (redecompose the set, drop a task, reorder), the user may use escape on any task card. On `approve`, main-session issues `geas task approve --by user` (or `--by decision-maker` for mid-mission in-scope additions).

10. **Close the phase.** Append a specifying phase-review and return control. The dispatcher advances the phase.

`geas mission create` accepts inline flags (preferred for short payloads) or a full JSON payload via `--file`. For the exact field list, run `geas schema template mission-spec --op create`. The CLI injects `id`, `user_approved=false`, `created_at`, `updated_at`.

Inline form:

```bash
geas mission create \
    --name "approved name" \
    --mode standard \
    --description "approved description" \
    --definition-of-done "one sentence" \
    --scope-in "in-scope surface 1" --scope-in "in-scope surface 2" \
    --scope-out "out-of-scope surface 1" \
    --acceptance-criterion "criterion 1" --acceptance-criterion "criterion 2" --acceptance-criterion "criterion 3" \
    --constraint "constraint 1" \
    --affected-surface "surface 1" \
    --risk "risk 1"
```

Use `--description-from-file <path>` and `--definition-of-done-from-file <path>` (stage the prose in .geas/tmp/ using the current client's file-write mechanism) for prose-heavy free-body fields.
The full-payload `--file <path>` form remains as a back-compat alias for callers who already author the full JSON. See `mission/SKILL.md` § Tmp file lifecycle for staging location and cleanup.

## Red Flags

| Excuse | Reality |
|---|---|
| "Recommendation looks unambiguous — pick mode without waiting for the user" | The recommendation is reasoning material; the user must make the actual pick in Step 4. Filling it in silently bypasses the explicit ask and produces missions governed by the wrong gates. |
| "Acceptance criteria repeat the DoD — drop them" | AC are the falsifiable tests reviewers measure against; DoD alone gives nothing to grade. |
| "Pre-scan found the test runner — write it into the spec without asking" | Pre-scan facts feed Step 2 reframing as confirm-this prompts. Only user-confirmed answers reach the spec. |
| "Self-check found issues — block the unified review (or persist findings as evidence)" | Spec self-check is a recommendation surface, not a gate. Findings appear in Step 4; the user decides proceed or revise. Mission-level self-check is skill-internal — no `self_check` evidence file (those belong to task lifecycle). |
| "Orchestrator writes mission-design or drafts task contracts directly" | Both are design-authority's responsibility in every mode. Spawn design-authority through the current client adapter; main-session does not author these artifacts. |
| "Spec approved — retroactively edit because scope slipped" | The spec is immutable after approval. Use `drafting-task` for in-scope additions or start a new mission. |
| "Just dump the whole intake as a prose block — it's faster" | Unstructured prose loses answers and invites the user to skim. A structured single-choice prompt forces a structured pick per question and keeps the audit trail clean. |
| "Skip the decomposition-table header on the first task card" | The header is the user's chance to audit slicing, surface overlap, and dependency order at set level before locking individual contracts. Without it, set-level errors hide behind card-level wording. |

## Invokes

| Tool / target | Purpose |
|---|---|
| `geas mission create` | Write the initial mission spec. |
| `geas mission approve --mission <id>` | Flip `user_approved` to true; lock the spec. |
| `geas task approve --mission <id> --task <id> --by user\|decision-maker` | Approve each drafted initial task. |
| `geas phase-review append --mission <id>` | Close the specifying phase with `status=passed`, `next_phase=building`. |
| Client adapter dispatch (`design-authority`) | Spawn design-authority for mission-design (Step 6) and initial task contract set (Step 7). Claude uses registered Geas agent type `geas:authority:design-authority`; Codex follows `../mission/references/codex-agent-dispatch.md`, reads `agents/authority/design-authority.md`, and spawns with that prompt plus context. Two spawns per specifying phase. The spawned agent calls `geas mission design-set` and invokes `drafting-task` itself. |
| Client adapter dispatch (`decision-maker`) | Spawn decision-maker for standard-mode review of mission-design (Step 6) and task set (Step 8). Claude uses registered Geas agent type `geas:authority:decision-maker`; Codex follows `../mission/references/codex-agent-dispatch.md`, reads `agents/authority/decision-maker.md`, and spawns with that prompt plus context. The spawned agent runs `deciding-on-approval` and writes review-kind evidence. |

Sub-skills invoked from main-session: `convening-deliberation` — full_depth design and task-set deliberations (Steps 6, 8), and ad-hoc deliberation in any mode when disagreement surfaces.

## Outputs

- `.geas/missions/{mission_id}/spec.json` created, `user_approved=true`.
- `.geas/missions/{mission_id}/mission-design.md` written.
- `.geas/missions/{mission_id}/tasks/{task_id}/contract.json` for each initial task, `approved_by` set.
- `.geas/missions/{mission_id}/phase-reviews.json` has a new `specifying` entry with `status=passed`, `next_phase=building`.

## Failure Handling

- **Schema rejection** on `mission create`: read CLI hints (`missing_required` / `invalid_enum` / `wrong_pattern`); fix payload and retry. Do not bypass.
- **User chooses `revise` in Step 4**: return to Step 2 for the named section only, re-run Step 3 self-check, re-display Step 4. Never silent-skip.
- **Self-check finds issues but user accepts**: self-check is a recommendation. Record the user's pick and advance. Findings stay in skill memory only.
- **`design-authority` spawn fails (timeout / empty / error)**: re-spawn once with the same prompt. On second failure, surface the spawn output to the user with options: retry, decompose differently, or cancel the mission.
- **`decision-maker` spawn fails (standard-mode review)**: re-spawn once. On second failure, surface to the user with options: retry, escalate to a `convening-deliberation` (full_depth-equivalent), or proceed without the review (record the chosen path explicitly).
- **Mode prereq stalls in `full_depth`**: deliberation has not closed; do not advance to user approval. Re-attempt `convening-deliberation`.
- **Ambiguous mission boundary at Step 1**: halt and return to dispatcher with a decomposition proposal; do not force-create a spec spanning multiple subsystems.

## Related Skills

- **Invoked by**: mission dispatcher when `phase=specifying` and the spec/design/initial-task sequence is incomplete.
- **Invokes from main-session**: `convening-deliberation` (mode prereq + ad-hoc on disagreement), current client adapter dispatch for `design-authority` (Steps 6, 7).
- **Do NOT invoke directly from main-session**: `designing-solution` (spawned-only; called from inside the design-authority spawn), `drafting-task` (called from inside the design-authority spawn at Step 7), `deciding-on-approval` (spawned-only; called from inside the decision-maker spawn for standard-mode review). Phase-later skills (`scheduling-work`, `running-gate`, `closing-task`, `reviewing-phase`) belong to building/later phases.

## Remember

- Pre-scan first; reframe blank intake questions as confirm-this prompts.
- One question at a time during intake.
- Spec self-check is a recommendation surface, not a gate.
- Mode is the user's pick in Step 4; the recommendation accompanies, never substitutes.
- Spec is immutable after approve.
- Mission-design and initial task contract set are design-authority's responsibility (spawned through the current client adapter). Standard-mode review of both is decision-maker's responsibility (also spawned). Main-session does not write the design, draft contracts, or perform mode-prereq reviews directly — all three are spawn-based.
- Mode-dependent prereq applies to both mission-design (Step 6) and task set (Step 8) under the same rule.
- The decomposition-table header on the first task card is the set-level audit; do not omit.
- Per-task approval is one unified round per task: card + dep preflight + options branched on preflight outcome.
- Return control to dispatcher after appending the phase-review — do not call `mission-state update --phase` from here.
