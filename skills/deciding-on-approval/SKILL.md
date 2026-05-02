---
name: deciding-on-approval
description: Invoked by a spawned decision-maker at one of four moments — mission spec review (standard or full_depth), mid-mission scope-in task contract approval, phase-review verdict authoring, or mission-verdict authoring. Routes to the correct CLI surface per approval kind and produces the matching artifact (review evidence, contract approval, phase-review, or mission-verdict).
user-invocable: false
---

# Deciding on Approval

## Overview

You are the decision-maker. Your identity + judgment protocol live in your agent file; this skill captures the procedure that varies by approval moment. Four distinct trigger moments each route to a distinct CLI surface and a distinct artifact. Pick the branch, read the artifacts the protocol puts in your lane, produce the matching artifact, return.

<HARD-GATE> Only decision-maker issues mission verdicts. Mission spec is immutable after user approval — scope expansions become new tasks (mid-mission) or new missions, never spec rewrites. A passing gate at every task does NOT automatically mean `approved` at mission level. The CLI is the sole writer to `.geas/`.

## When to Use

- **Branch A — Mission spec review** (standard or full_depth mode): orchestrator has dispatched you after user proposes a spec draft, before user signs off.
- **Branch B — Mid-mission scope-in task approval**: during `building` or `polishing`, the orchestrator proposes a new in-scope task; the mission spec stays immutable; you are the approver.
- **Branch C — Phase-review verdict**: the orchestrator has handed you the phase's aggregated evidence and asked for the phase-review entry.
- **Branch D — Mission verdict**: all phase-reviews exist; `consolidating` is complete; orchestrator asks for the final verdict.
- Do NOT use to coordinate work — orchestrator's role.
- Do NOT use to issue structural review — design-authority's role.
- Do NOT use for adversarial challenge — challenger's role.

## Preconditions

- Your slot is `decision-maker` on the dispatched context.
- Artifacts your branch requires are present (see per-branch list below).
- CLI is the sole writer; you never edit `.geas/` directly.

## Process

1. **Identify the branch** from the orchestrator's spawn context. If unclear, stop and ask.
2. **Branch A — Mission spec review.**
   - Read the draft spec and (if present) `mission-design.md`.
   - Check: goal matches user request; `definition_of_done` is one-sentence observable; `acceptance_criteria` are observable + falsifiable; `scope.in` and `scope.out` are explicit; `constraints` are real; `risks` are honest.
   - Append a review-kind evidence entry at mission scope (the orchestrator specifies the mission-level evidence surface; commonly `geas evidence append --mission <id> --slot decision-maker` with `--task` omitted, or a dedicated `geas spec review` surface if registered).
   - Verdict: `approved` (user may sign off), `changes_requested` (name the fields that need fixing), or `blocked` (structural issue with the spec itself).
3. **Branch B — Mid-mission task contract approval.**
   - Read the proposed task contract: `mission_id` matches current mission; `goal` fits `mission-spec.scope.in`; `acceptance_criteria` are concrete; `dependencies` form no cycle; `risk_level` is honest.
   - If the task steps outside `mission-spec.scope.in`, refuse: "mission spec is immutable; note in verdict `carry_forward` or start a new mission". Do not approve.
   - On approval, set `approved_by: decision-maker` via:
     ```bash
     geas task approve --mission {mission_id} --task {task_id} --by decision-maker
     ```
     CLI enforces that this moves the contract into a state where `task transition --to ready` can fire.
4. **Branch C — Phase-review verdict.**
   - Read all task contracts, gate runs, closure evidence, and deliberations scoped to the phase.
   - Determine the phase outcome: all mission-scope tasks terminal? exit criteria met? outstanding structural or operator concerns?
   - Append the phase-review via CLI. `geas phase-review append` is full-payload only (no inline flags), so stage the prose in .geas/tmp/ using the current client's file-write mechanism and pass `--file`. For the exact field list, run `geas schema template phase-reviews --op append`.
     ```bash
     # Step 1: stage the prose in .geas/tmp/ using the current client's file-write mechanism, e.g. .geas/tmp/phase-review.json (body matches the schema template)
     # Step 2: hand the file to the CLI
     geas phase-review append --mission <id> --file .geas/tmp/phase-review.json
     ```
   - CLI validates phase enum, verdict enum, rationale non-empty; `changes_requested` at phase level typically rewinds to the prior sub-state.
5. **Branch D — Mission verdict.**
   - Read everything in your lane: mission spec, mission design, every phase-review, every mission-level deliberation, each task's contract + evidence bundle + closure, `gap.json`, mission-scope debts, and `memory-update.json`.
   - Apply the judgment protocol: was the spec satisfied? was out-of-scope respected? was the design executed? are blocking specialist/challenger concerns resolved or explicitly accepted? what is handed forward?
   - Append the mission verdict via CLI. `geas mission-verdict append` is full-payload only (no inline flags), so stage the prose in .geas/tmp/ using the current client's file-write mechanism and pass `--file`. For the exact field list, run `geas schema template mission-verdicts --op append`.
     ```bash
     # Step 1: stage the prose in .geas/tmp/ using the current client's file-write mechanism, e.g. .geas/tmp/mission-verdict.json (body matches the schema template)
     # Step 2: hand the file to the CLI
     geas mission-verdict append --mission <id> --file .geas/tmp/mission-verdict.json
     ```
   - CLI validates verdict enum, rationale non-empty, `carry_forward` array. A passing gate on every task does not force `approved`; verdict reflects the whole mission.
6. **Return.** Orchestrator re-enters the briefing loop; for branch D, emits the Mission-verdict briefing before transitioning to `complete`.

## Red Flags

| Excuse | Reality |
|---|---|
| "All tasks passed the gate — verdict is obviously approved" | Mission-level judgment is not gate aggregation. Debts, gaps, carry_forward, and out-of-scope creep all feed the verdict. |
| "The spec can be tweaked after user approval — just once" | Spec is immutable. Tweaks are scope expansions; scope expansions go through new tasks (if in-scope) or new missions. |
| "Mid-mission task slightly outside scope is fine if small" | Scope discipline is binary. Slightly outside is outside. Either reject + carry_forward or escalate. |
| "Rationale can be one sentence — everyone can read the artifacts" | Rationale must cite the artifacts that informed the decision. Otherwise the audit cannot reconstruct your reasoning. |
| "Leave `carry_forward` empty for a clean close" | If real work is handed forward and `carry_forward` is empty, the next mission has no signal. Clean close on actually-closed missions only. |
| "Issue the verdict before consolidating completes — we're out of time" | `consolidating` phase-review must exist before the mission verdict. CLI rejects; rushing corrupts the record. |

## Invokes

| CLI command | Purpose |
|---|---|
| `geas evidence append --slot decision-maker --mission <id>` | Branch A: mission spec review evidence. |
| `geas task approve --mission <id> --task <id> --by decision-maker` | Branch B: mid-mission task contract approval. |
| `geas phase-review append --mission <id>` | Branch C: phase-review entry. |
| `geas mission-verdict append --mission <id>` | Branch D: mission verdict. |

Sub-skills you do NOT invoke: none.

## Outputs

- Branch A: mission-scope review-kind evidence entry.
- Branch B: task contract updated with `approved_by: decision-maker`.
- Branch C: one phase-review entry in `missions/{mission_id}/phase-reviews.json`.
- Branch D: one mission-verdict entry in `missions/{mission_id}/mission-verdict.json`.

## Failure Handling

- **Spec draft missing acceptance criteria or scope arrays (branch A)**: `changes_requested` with specific fields named.
- **Proposed task steps outside scope (branch B)**: refuse; recommend `carry_forward` (for later) or new mission (for material expansion).
- **Phase not actually terminal (branch C)**: CLI rejects `phase-review append`; return to orchestrator, let the missing sub-state finish.
- **Consolidating phase-review missing (branch D)**: CLI rejects `mission-verdict append`; return to orchestrator, run `consolidating-mission` first.
- **Blocking concern not addressed**: if a specialist/challenger concern is blocking and neither resolved nor explicitly accepted, verdict is `changes_requested` or `escalated`, never `approved`.
- **Branch unclear**: stop, return to orchestrator. Inferring the branch is the wrong move.

## Related Skills

- **Invoked by**: `specifying-mission` (branch A, B), `drafting-task` (branch B), `reviewing-phase` (branch C), `verdicting-mission` (branch D), and `convening-deliberation` may spawn you as a voter (different skill — `deliberating-on-proposal`).
- **Invokes**: none.
- **Do NOT invoke**: `designing-solution` (design-authority's role), `convening-deliberation` (if collective judgment is needed, orchestrator opens it), `verdicting-mission` (that is the orchestrator's main-session skill that spawns you; do not re-enter it).

## Remember

- Four branches, four CLI surfaces, four artifacts. Identify the branch first.
- Spec is immutable after approval; mid-mission scope-in tasks respect that.
- Mission verdict reflects the whole mission, not just gate aggregation.
- Rationale cites artifacts, not impressions.
- `carry_forward` is real work handed forward; empty only when empty.
