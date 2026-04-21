---
name: vote-round
description: Parallel deliberation convening — dispatches voters, collects agree/disagree/escalate votes with rationale, appends a single deliberation entry via the CLI. Challenger is mandatory. Permitted only in full_depth missions.
---

# Vote Round

Thin convening wrapper over `geas deliberation append`. Use this when multiple slots must weigh in on a judgment and the CLI's aggregation rule must record the collective answer.

**Mode gate**: deliberation is permitted only when `mission-spec.mode == full_depth`. Lightweight and standard missions rely on the decision-maker's direct judgment instead. The CLI enforces this — the skill simply cannot produce a recorded vote round in the wrong mode.

## When to Use

Task-level deliberation opens when:

- Required reviewer verdicts conflict on incompatible grounds (e.g. risk-assessor says `blocked`, operator says `approved` because they're reading different threat models).
- Challenger raises a structural objection that closure cannot adjudicate alone.
- Rewind target (which state to send the task back to) is non-obvious and needs collective judgment.

Mission-level deliberation opens when:

- `full_depth` mission's specifying-phase close requires a documented agreement among at least 3 voters including challenger.
- Phase rollback is being considered and the orchestrator wants the record to reflect the consulted voters.

Do NOT use vote rounds for:

- Individual implementation choices inside a worker's domain.
- Minor refactor decisions.
- Any judgment the task contract already routes to a single slot (that slot decides alone).

## Inputs

1. **Proposal** — what's being decided, stated plainly.
2. **Voter roster** — 2 or more slots, challenger always included when risk_level ≥ high or when the proposal affects mission direction.
3. **Supporting artifacts** — whatever evidence / contract / phase-review content voters need to read.
4. **Level** — `mission` (writes to `missions/{id}/deliberations.json`) or `task` (writes to `missions/{id}/tasks/{task_id}/deliberations.json`).

## Flow

### Step 1 — Brief voters

For each voter, spawn the concrete agent assigned to that slot with:

- The proposal text.
- Pointers to the supporting artifacts they should read.
- Instructions: return a vote (`agree` / `disagree` / `escalate`) and a rationale. Voters also note concerns even when agreeing — dissent is recorded, not penalized.

Voters are dispatched in parallel when practical. They do NOT see each other's votes before voting.

### Step 2 — Assemble the entry

Collect votes and compute the expected `result` using the CLI's aggregation rule:

- any `escalate` → `escalate`
- else majority `agree` → `agree`
- else majority `disagree` → `disagree`
- else (tie or fewer than two voters) → `inconclusive`

If the expected result is `inconclusive`, the deliberation failed to reach a judgment; convene a new round with a revised voter set rather than recording an empty outcome.

### Step 3 — Record via CLI

```bash
geas deliberation append --mission {mission_id} --level task --task {task_id} <<'EOF'
{
  "proposal_summary": "one-line summary of the question",
  "votes": [
    {"voter": "challenger", "vote": "disagree", "rationale": "…"},
    {"voter": "risk-assessor", "vote": "agree", "rationale": "…"},
    {"voter": "decision-maker", "vote": "agree", "rationale": "…"}
  ],
  "result": "agree"
}
EOF
```

CLI behavior:

- rejects the call if the mission mode is not `full_depth` (`guard_failed`).
- validates the entry against the deliberation schema (minimum 2 voters, voter slots from the protocol enum, rationales non-empty).
- cross-checks that `result` matches the aggregation rule given the votes. Mismatch → `guard_failed`.
- appends the entry to `deliberations.json`. Open deliberations are not recorded — entries land only when the outcome is final.

For mission-level deliberation, drop `--task` and use `--level mission`.

### Step 4 — Feed result back

- `agree` result → the proposal becomes the path forward. Orchestrator takes the corresponding action (e.g. moves gate Tier 2 judgment into the agreed direction, advances phase, approves amendment).
- `disagree` result → the proposal is rejected. Orchestrator either revises the proposal and convenes again, or routes to a decision-maker call for a non-deliberation judgment.
- `escalate` result → one or more voters explicitly want the decision to go up. Write a phase-review or mission-verdict entry as appropriate, or escalate to decision-maker.

## Rules

1. Challenger participates whenever available. Challenger's stance is captured even if their vote agrees — the concerns field is the part that matters for downstream memory.
2. Voters are independent. The skill never circulates vote content among voters before they have voted.
3. One deliberation entry per concluded round. Re-votes after a revised proposal are new entries, not amendments to prior ones.
4. `inconclusive` outcomes are not recorded. An inconclusive round means "we didn't actually deliberate"; fix the voter composition or the proposal, then try again.
5. Deliberation entries are append-only and immutable. Later context doesn't rewrite history — it shows up as a new entry.

## Boundaries

- The skill never computes its own final judgment — the CLI's aggregation rule is the source of truth for `result`.
- The skill never bypasses the mode gate. If the mission is not full_depth, vote rounds are not the right tool.
- Deliberation records are for collective judgment only. A single specialist's decision (even a structural one) belongs in their own evidence entry, not a deliberation.
