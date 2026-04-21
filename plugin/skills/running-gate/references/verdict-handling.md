# Verdict Handling — Running Gate

Supporting detail for the gate verdict interpretation, self-check reuse, and verify-fix loop invariants.

## Verdict interpretation table

| verdict | Budget impact | Next action |
|---|---|---|
| `pass` | none | Dispatcher invokes `closing-task` → orchestrator writes closure evidence → `task transition --to verified` → `--to passed`. |
| `fail` | Consumes one `verify_fix_iterations` slot | Rewind via `task transition --to implementing`. Dispatch implementer with fix brief. Reviewers re-append review entries. Re-run gate. |
| `block` | No budget consumed | `task transition --to blocked`. Cannot re-gate until the block is resolved upstream. Return control to dispatcher. |
| `error` | No budget consumed | Resolve cause (tooling, plan ambiguity, snapshot drift) and re-run. After 3 consecutive `error` verdicts → `blocked`. |

## Self-check reuse across tiers

| Tier | Self-check field | Effect |
|---|---|---|
| Tier 0 | existence + schema | Precheck fails without a valid self-check. |
| Tier 1 | `reviewer_focus`, `known_risks` | Verification plan covers the paths the implementer flagged. |
| Tier 2 | `deviations_from_plan`, `gap_signals` | Reviewers weigh these when stating their verdict; feeds `debt_candidates` / `gap_signals` in review entries. |

Collecting self-check without consuming it in all three tiers is non-conformant.

## Verify-fix loop invariants

- The loop runs only on gate verdict `fail`.
- `verify_fix_iterations` is CLI-incremented automatically on each `reviewed → implementing` transition. Agents and skills never edit this field directly.
- Default budget = 3. `risk_level = critical` tightens the budget to 1.
- A fix without updated reviewer evidence is not a fix. Every iteration re-collects reviewer entries before the next gate run.
- Budget exhaustion path: `* → blocked` (unconditional) → `blocked → escalated`. Decision-maker then writes closure evidence with verdict `escalated` or `cancelled`. A follow-up task with a `supersedes` link may be drafted by the dispatcher + `drafting-task`.
- Gate runs are append-only: each re-run adds a new record to `gate-results.runs`; earlier runs are preserved for audit.

## Loop summary

```
gate run → verdict=fail
    ↓
diagnose: read failing gate run + reviewer/verifier evidence; build fix brief
    ↓
task transition --to implementing    (CLI: verify_fix_iterations += 1)
    ↓
implementer appends implementation-kind evidence (revision_ref to prior)
    ↓
reviewers re-inspect; append new review-kind evidence
    ↓
gate run again
    ↓
    pass  → dispatcher invokes closing-task
    fail  + budget remaining → loop
    fail  + budget exhausted → blocked → escalated → decision-maker closure
    block / error → handled per verdict table
```

## Deliberation escalation (Tier 2)

Tier 2 conflicts that cannot be resolved by the aggregation rule require a task-level deliberation via `convening-deliberation` before the gate run is recorded. The deliberation result becomes the input to Tier 2. Re-run the gate with the deliberation-informed verdict.

Deliberation is permitted only in `full_depth` missions (CLI enforces). In other modes, reviewer verdict conflict with no aggregation path forces `block` — escalate to decision-maker via orchestrator closure, not deliberation.
