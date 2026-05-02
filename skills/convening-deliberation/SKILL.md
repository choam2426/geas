---
name: convening-deliberation
description: Invoked by the mission dispatcher when mission mode is full_depth and a multi-party judgment is required (conflicting reviewer verdicts, structural challenge from challenger, or phase rollback). Spawns voters, collects independent votes, aggregates the result per the CLI rule, and records the deliberation.
user-invocable: false
---

# Convening Deliberation

## Overview

Thin convening wrapper over `geas deliberation append`. Spawns the voter set for a task-level or mission-level judgment, dispatches each voter independently, and records one deliberation entry with the aggregated result. The skill never computes its own final judgment; the CLI's aggregation rule is the source of truth.

<HARD-GATE> Deliberation is permitted only when `mission-spec.mode == full_depth`. Lightweight and standard missions rely on the decision-maker's direct judgment. Voters never see each other's votes before voting. Inconclusive rounds are not recorded — convene again with a revised composition instead.

## When to Use

- Task-level: required reviewer verdicts conflict on incompatible grounds, or challenger raises a structural objection closure cannot adjudicate alone, or the rewind target is non-obvious.
- Mission-level: `full_depth` specifying-phase close requires documented agreement among ≥3 voters including challenger, or phase rollback is under consideration.
- Do NOT use for choices inside a worker's domain, minor refactors, or any judgment the contract routes to a single slot.
- Do NOT use in `lightweight` or `standard` missions — the CLI rejects with `guard_failed`.

## Preconditions

- `mission-spec.mode == full_depth`.
- Proposal text is stated plainly in one line.
- Voter roster is ≥2 slots; challenger is included whenever available.
- Supporting artifacts (contract, evidence, phase-review, prior deliberation) are identified for each voter.
- `level` is decided: `task` (writes under `tasks/{task_id}/deliberations.json`) or `mission` (writes under `missions/{id}/deliberations.json`).

## Process

1. **Assemble the roster.**
   - Pick ≥2 voter slots. Include challenger whenever the proposal has risk-level ≥ high implications or affects mission direction.
   - Resolve each slot to a concrete agent from the profile's agent map; the same concrete agent cannot hold implementer + reviewer on the same task.
2. **Brief each voter in parallel.**
   - Spawn the concrete agent for each slot. Hand them: the proposal text, pointers to supporting artifacts, and the instruction to invoke `deliberating-on-proposal` and return a vote (`agree` / `disagree` / `escalate`) + rationale.
   - Voters dispatch concurrently where practical. They do NOT receive each other's votes before voting.
   - Apply the same slot- and risk-driven dispatch pattern that `scheduling-work` describes: authority voters (`challenger`, `decision-maker`, `design-authority`) aim for the most capable model the harness exposes; specialist voters (`risk-assessor`, `operator`, `communicator`, `verifier`, `implementer`) aim for a balanced choice, lifted toward the most-capable end when the task or proposal has `risk_level` of `high` or `critical`. Mission-level deliberations inherit the proposal's effective risk; if unclear, treat them as high. A task contract's per-task rationale, when present, takes precedence. Canonical guidance: [scheduling-work/SKILL.md](../scheduling-work/SKILL.md) under "Dispatch Model".
3. **Collect votes and compute expected `result`** per the CLI aggregation rule:
   - any `escalate` → `escalate`
   - else majority `agree` → `agree`
   - else majority `disagree` → `disagree`
   - else (tie or fewer than two voters) → `inconclusive`
4. **Handle inconclusive locally.** If the expected result is `inconclusive`, do NOT call the CLI. Revise the composition or the proposal, return to step 1.
5. **Record the entry via CLI.** `geas deliberation append` accepts inline flags (preferred for short rationales) or a full JSON payload via `--file`. For the exact field list, run `geas schema template deliberation --op append`.

   Inline form — `--vote` is repeatable and takes a `voter:vote:rationale` shorthand triple per voter:
   ```bash
   geas deliberation append --mission <id> --level task --task <id> \
       --proposal-summary "one-line summary of the question" \
       --vote "challenger:disagree:rationale text from challenger" \
       --vote "risk-assessor:agree:rationale text from risk-assessor" \
       --vote "decision-maker:agree:rationale text from decision-maker" \
       --result agree
   ```
   For mission-level deliberation drop `--task` and use `--level mission`. Use `--proposal-summary-from-file <path>` (stage the prose in .geas/tmp/ using the current client's file-write mechanism) when the summary runs long. The full-payload `--file <path>` form remains as a back-compat alias for callers who already author the full JSON; never use a bash heredoc — apostrophes / quotes inside any voter's rationale break shell parsing.

   CLI checks: mode gate, ≥2 voters, voter slots in enum, rationales non-empty, `result` matches aggregation. Mismatch → `guard_failed`.
6. **Feed the result back to the caller.**
   - `agree` → proposal becomes the path forward; caller (running-gate, reviewing-phase, specifying-mission) acts on it.
   - `disagree` → proposal is rejected; caller revises or escalates to a decision-maker call.
   - `escalate` → one or more voters want the decision to go up; caller writes a phase-review or mission-verdict entry or escalates to decision-maker.

## Red Flags

| Excuse | Reality |
|---|---|
| "Only one reviewer disagreed — skip deliberation, just override" | Incompatible reviewer verdicts are exactly what this skill exists for. Overriding corrupts the audit trail. |
| "Let voters see prior votes for efficiency" | Voters are independent by construction. Circulating votes destroys the independence guarantee that makes the result meaningful. |
| "Record the inconclusive round so we have something on file" | Inconclusive means the deliberation failed. Recording it falsifies the audit. Convene again with a revised composition. |
| "The mission is standard, not full_depth, but this decision is important" | Mode gate is enforced by CLI. Important decisions in standard mode go to decision-maker directly, not to a faked deliberation. |

## Invokes

| CLI command | Purpose |
|---|---|
| `geas deliberation append --mission <id> --level {task\|mission} [--task <id>]` | Record the concluded round; CLI validates mode, voters, aggregation. |

Sub-skills invoked: `deliberating-on-proposal` (spawned in parallel, one per voter slot).

## Outputs

- `.geas/missions/{mission_id}/tasks/{task_id}/deliberations.json` (task-level) or `.geas/missions/{mission_id}/deliberations.json` (mission-level) grows by one entry per concluded round.
- No other artifacts written by this skill.

## Failure Handling

- **Mode gate `guard_failed`**: mission is not `full_depth`; return to caller, route the judgment to decision-maker instead.
- **Aggregation mismatch `guard_failed`**: recomputed `result` differs from the declared one; recompute via the rule, resubmit.
- **Schema rejection** (rationale empty, voter outside enum, <2 voters): fix the payload, resubmit.
- **Voter unavailable**: pick an alternate slot from the profile map, document the substitution in the rationale, proceed.
- **Inconclusive**: do not record; return to step 1 with a revised roster or proposal.

## Related Skills

- **Invoked by**: mission dispatcher in `full_depth` missions when reviewer verdicts conflict (dispatched via `running-gate`), when challenger raises structural objection, or on phase rollback (via `reviewing-phase`) or specifying-phase close (via `specifying-mission`).
- **Invokes**: `deliberating-on-proposal` (spawned, one per voter).
- **Do NOT invoke**: `running-gate` — that runs after deliberation resolves the Tier 2 conflict. `deciding-on-approval` — decision-maker is a voter here, not an adjudicator.

## Remember

- The aggregation rule is owned by the CLI; the skill only reports votes honestly.
- Voters are independent; vote content never circulates mid-round.
- One entry per concluded round; revotes after a revised proposal are new entries, not amendments.
- `inconclusive` is a signal to convene again, not a verdict to record.
- Challenger's vote is captured even when agreeing — the rationale is the audit substrate.
