---
name: designing-solution
description: Invoked by a spawned design-authority at one of three moments — authoring the mission design, reviewing a task or implementation contract on structural grounds, or assembling the gap analysis during consolidating. Routes to the correct CLI surface per consultation kind and produces the matching artifact (mission-design markdown, review-kind evidence, or gap.json).
user-invocable: false
---

# Designing Solution

## Overview

You are the design-authority. Your identity + judgment protocol live in your agent file; this skill captures the procedure that varies by consultation kind. Three distinct trigger moments each route to a distinct CLI surface and a distinct artifact. Pick the branch, produce the correct artifact, return.

<HARD-GATE> Mission spec is immutable after user approval; design authority cannot rewrite spec. CLI is the sole writer to `.geas/`. The same concrete agent cannot hold design-authority and implementer on the same task. Mission design's heading structure is validated by the CLI — deviating breaks the specifying-phase gate.

## When to Use

- **Branch A — Mission design authorship**: mission spec is `user_approved: true` and `mission-design.md` is absent; orchestrator has dispatched you to author it.
- **Branch B — Contract structural review**: orchestrator handed you a task contract (for scope/structural approval) or an implementation-contract (for structural concurrence pre-implementation).
- **Branch C — Gap analysis**: orchestrator has entered `consolidating` phase and requested the gap payload for the mission.
- Do NOT use to issue a mission verdict — that is decision-maker.
- Do NOT use to perform adversarial review — that is challenger.
- Do NOT use to sequence tasks or manage batches — that is the orchestrator.

## Preconditions

- Your slot is `design-authority` on the dispatched context.
- You are not also the implementer on the same task (branch B).
- For branch A: mission spec is approved (`user_approved: true`).
- For branch B: contract exists under the mission's tasks; you have access to `.geas/`.
- For branch C: mission is in `consolidating` phase; all building/polishing phase-reviews exist.

## Process

1. **Identify the branch.** The orchestrator's spawn context names the consultation kind. If unclear, stop and ask — do not infer.
2. **Branch A — Mission design authorship.**
   - Read the mission spec fully (goal, scope in/out, acceptance criteria, constraints, affected_surfaces, risks).
   - Read `shared.md` and `agents/design-authority.md` for prior patterns.
   - Draft `mission-design.md` with the required headings, in order:
     `## Strategy`, `## Architecture & Integration`, `## Task Breakdown Rationale`, `## Verification Plan`, `## Key Design Decisions`, `## Assumptions`, `## Unknowns`, `## Risks`, `## Failure Modes`, `## Migration / Rollout`.
   - For any section that does not apply, write `해당 없음 ({reason})` on one line — do not omit the heading.
   - Record via `geas mission design-set --mission <id> --file .geas/tmp/mission-design.md` (markdown via `--file <path>`; full-replace). Allowed only during specifying phase; requires the mission spec to be `user_approved`. The CLI does not enforce heading structure — the ten-section discipline above is yours to uphold.
3. **Branch B — Contract structural review.**
   - Read the contract (task or implementation): `scope.surfaces`, `acceptance_criteria`, `verification_plan`, `dependencies`, `base_snapshot`, `routing`, `risk_level`.
   - Walk the judgment order: boundaries clean → interfaces stable → dependencies safe → complexity justified → stubs bounded (scope, exit condition, debt registered).
   - Choose a verdict: `approved` / `changes_requested` / `blocked`.
   - Append a review-kind evidence entry via CLI. For the exact field list, run `geas schema template evidence --op append --kind review`. `geas evidence append` accepts inline flags (preferred for short prose) or a full JSON payload via `--file`. Inline form:
     ```bash
     geas evidence append --mission <id> --task <id> \
         --agent <your_concrete_agent> --slot design-authority \
         --evidence-kind review \
         --summary "structural review of <contract|implementation-contract>" \
         --verdict approved \
         --concern "boundary issue in surface X — describe specifically" \
         --concern "interface drift between Y and Z — describe specifically" \
         --rationale "why, citing boundaries / interfaces / dependencies" \
         --scope-examined "contract fields + surfaces inspected" \
         --method-used "read contract" --method-used "traced surface overlaps"
     ```
     `--concern` is repeatable; each concern is a plain-text string (the schema rejects `{severity,text}` objects — severity lives in `verdict`). Use `--rationale-from-file <path>` (stage the prose in .geas/tmp/ using the current client's file-write mechanism) for long rationale.
     The full-payload `--file <path>` form remains as a back-compat alias for callers authoring the full JSON, never via bash heredoc (apostrophes / quotes corrupt shell parsing).
4. **Branch C — Gap analysis.**
   - Read every phase-review, closure evidence (gap_signals), and mission-design trajectory.
   - Identify gaps: design ≠ delivery, acceptance criteria partially met, stubs without exit condition, surfaces the mission touched that the design did not anticipate.
   - Classify each gap: should it resolve inside this mission's consolidating phase, land as a debt, or appear in the mission-verdict's `carry_forward`?
   - Write the gap payload via CLI. `geas gap set` is full-payload only (no inline flags), so stage the JSON body in .geas/tmp/ using the current client's file-write mechanism and pass `--file`. For the exact field list, run `geas schema template gap --op set`.
     ```bash
     # Step 1: stage the JSON body in .geas/tmp/ using the current client's file-write mechanism, e.g. .geas/tmp/gap.json (body matches the schema template)
     # Step 2: hand the file to the CLI
     geas gap set --mission <id> --file .geas/tmp/gap.json
     ```
   - `geas gap set` is full-replace; one payload per mission.
5. **Return.** Orchestrator re-enters briefing and invokes the next phase-appropriate skill.

## Red Flags

| Excuse | Reality |
|---|---|
| "Mission design can skip the Migration / Rollout heading — there's no rollout" | The heading is required. Write `해당 없음 ({reason})`; omitting the heading fails the gate. |
| "Approve the contract without reading surfaces — implementer will figure it out" | Structural review is specifically about surfaces, dependencies, interfaces. Approving blind makes downstream drift your fault. |
| "Style-nitpick the contract while skipping cycle check on dependencies" | Nitpicking while structural issues go unaddressed is the anti-pattern design authority is supposed to prevent. |
| "Gap analysis can skip items that reviewers already flagged" | Reviewer concerns are inputs to gap analysis, not replacements for it. Gap is the cross-cutting view. |
| "I'll also write the mission verdict since I'm closest to the artifacts" | Mission verdict is decision-maker's, not yours. Structural diagnosis is yours; acceptance judgment is not. |

## Invokes

| CLI command | Purpose |
|---|---|
| `geas mission design-set --mission <id>` | Write `mission-design.md` full-replace; guarded to specifying phase + approved spec (branch A). |
| `geas evidence append --slot design-authority --mission <id> --task <id>` | Append structural review evidence (branch B). |
| `geas gap set --mission <id>` | Write the mission's gap payload (branch C; full-replace). |

Sub-skills you do NOT invoke: none.

## Outputs

- Branch A: `missions/{mission_id}/mission-design.md` with required headings in order.
- Branch B: one review-kind evidence entry under `missions/{mission_id}/tasks/{task_id}/evidence/*.design-authority.json`.
- Branch C: `missions/{mission_id}/consolidation/gap.json` (full-replace).
- No other artifacts.

## Failure Handling

- **Heading order or presence fails (branch A)**: CLI rejects; re-insert the missing heading in the right position; resubmit.
- **Contract references surfaces that overlap with another in-flight task (branch B)**: verdict `blocked`; name the overlap in concerns.
- **Gap `severity` classification requires judgment call (branch C)**: prefer the narrower disposition (resolve > debt > carry_forward) unless evidence says otherwise; state the basis in `rationale`.
- **Mission spec immutable after approval**: if you think the spec is wrong, return `blocked` on the contract review with the structural objection; escalate to orchestrator + decision-maker. Do not attempt to edit the spec.
- **Branch unclear**: stop, return to orchestrator. Inferring the branch is the wrong move.

## Related Skills

- **Invoked by**: `specifying-mission` (branch A), `drafting-task` / `scheduling-work` / `running-gate` (branch B), `consolidating-mission` (branch C).
- **Invokes**: none.
- **Do NOT invoke**: `deciding-on-approval` (decision-maker's role), `reviewing-task` (that is the review slot skill; design-authority writes structural review via this skill's branch B), `convening-deliberation` (if structural objection needs collective judgment, orchestrator opens it).

## Remember

- Three branches, three CLI surfaces, three artifacts. Identify the branch first.
- Mission design headings are validated; use `해당 없음 ({reason})` for non-applicable sections.
- Structural review is about boundaries, interfaces, dependencies, complexity, stubs — in that order.
- Gap analysis is cross-cutting; reviewer concerns are inputs, not replacements.
- You do not issue mission verdicts or edit mission specs.
