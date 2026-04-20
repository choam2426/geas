---
name: evidence-gate
description: Evidence Gate — Tier 0 (precheck) + Tier 1 (objective verification per verification_plan) + Tier 2 (reviewer verdict aggregation). Produces a gate-results run with verdict pass/fail/block/error.
---

# Evidence Gate

Objective check of whether a task's evidence is sufficient to close. The gate answers "may this task move toward `passed`?" with one of four verdicts:

- `pass` — closure decision can proceed.
- `fail` — rework is needed; not a blocker.
- `block` — a structural prerequisite is missing; cannot close in current shape.
- `error` — the gate itself could not run cleanly; re-run after resolving the cause.

Gate verdicts are distinct from reviewer verdicts (`approved` / `changes_requested` / `blocked`). Reviewers state their finding inside review evidence; the gate combines those plus objective checks into a single outcome.

## When to Run

Orchestrator invokes this skill after every required reviewer has written review evidence and any verifier has written verification evidence. Gate is re-runnable — each run appends a new record to `gate-results.json`.

## Inputs

1. **Task contract** — `.geas/missions/{mission_id}/tasks/{task_id}/contract.json`.
2. **Self-check** — `.geas/missions/{mission_id}/tasks/{task_id}/self-check.json`.
3. **Reviewer evidence** — every `*.{slot}.json` under `evidence/` for slots named in `routing.required_reviewers`.
4. **Verifier evidence** — `*.verifier.json` file if any, or equivalent verification record.
5. **Prior gate runs** — `gate-results.json` (if present) to inform iteration count.

## Tiers

Gate runs Tier 0 → Tier 1 → Tier 2 in order. A non-pass status in any tier short-circuits the remaining tiers and becomes the overall verdict.

### Tier 0 — Precheck

Confirms that the gate has the inputs it needs before any heavier work:

1. `self-check.json` exists and validates against its schema.
2. For every slot in `routing.required_reviewers`: at least one evidence file `*.{slot}.json` exists AND has a review-kind entry with a valid verdict (approved / changes_requested / blocked).
3. Task state is `reviewed`. Tier 0 running on tasks still in `implementing` is an `error`.
4. `base_snapshot` still corresponds to the real workspace baseline.

**Failure modes**:

- Missing required artifact (self-check or reviewer evidence) → `block`.
- Task-state ineligibility → `error`.
- Base snapshot mismatch → `block`.

### Tier 1 — Objective verification

Executes the procedure the contract's `verification_plan` describes. The plan may be automated (scripts, test runs) or a fixed manual procedure; either way, the same inputs produce the same result regardless of who runs it.

Produces a `verifier` evidence entry (kind `verification`) whose `criteria_results` list maps each acceptance criterion to pass/fail with concrete details. If `verification_plan` is not executable as written (ambiguous, references missing tooling), the tier status is `error` and the plan itself needs revision.

**Failure modes**:

- One or more acceptance criteria fail objectively → `fail`.
- Verification procedure cannot be run as written → `error`.
- Procedure discovers a structural block (e.g. runtime refuses to start due to missing config owned outside this task) → `block`.

### Tier 2 — Reviewer verdict aggregation

Reads the verdict field from every required reviewer's latest review entry and combines per protocol 03 §168:

- any `blocked` reviewer verdict → tier status `block`.
- else any `changes_requested` → tier status `fail`.
- else all `approved` → tier status `pass`.

If two reviewers disagree on incompatible grounds and the orchestrator judges the conflict cannot be resolved by aggregation, open a task-level deliberation BEFORE recording the gate run. Use the `vote-round` skill (thin wrapper over `geas deliberation append`). The deliberation result then informs Tier 2.

Challenger evidence (slot `challenger`) counts as a reviewer verdict for this tier when challenger was required (risk_level ≥ high).

## Recording the gate run

Assemble tier statuses and call the CLI:

```bash
geas gate run --mission {mission_id} --task {task_id} <<'EOF'
{
  "tier_results": {
    "tier_0": {"status": "pass", "details": "self-check + reviewer evidence present"},
    "tier_1": {"status": "pass", "details": "verification_plan ran clean; 4/4 criteria met"},
    "tier_2": {"status": "pass", "details": "challenger approved, risk-assessor approved"}
  }
}
EOF
```

The CLI:

- assigns `gate_run_id` (`gate-1`, `gate-2`, ...).
- derives overall verdict from tier statuses (any non-pass short-circuits; otherwise pass).
- appends the new run to `gate-results.json`.
- returns `suggested_next_transition` in the envelope (CLI.md §14.5) but does NOT auto-transition. Orchestrator calls `geas task transition` separately.

## Verdict interpretation

| verdict | Budget impact | Next action |
|---|---|---|
| `pass` | none | Orchestrator writes closure evidence, then `task transition --to verified` (then `--to passed` once closure is approved). |
| `fail` | Consumes one `verify_fix_iterations` slot | Orchestrator moves the task back to `implementing` via `task transition --to implementing` and spawns the implementer with the failing criteria. Use `verify-fix-loop` skill. |
| `block` | No budget consumed | Orchestrator moves task to `blocked` and records the blocking cause. Task cannot re-gate until the block is resolved upstream. |
| `error` | No budget consumed | Orchestrator resolves the cause (missing tooling, contract ambiguity, snapshot drift) and re-runs the gate. If the same error repeats three times, move the task to `blocked`. |

## Self-check reuse

The implementer's `self-check.json` contributes to gate judgment at three points:

| Tier | self-check field | Effect |
|---|---|---|
| Tier 0 | (existence + schema) | Precheck fails without a valid self-check. |
| Tier 1 | `reviewer_focus`, `known_risks` | Verification plan covers the paths the implementer flagged. |
| Tier 2 | `deviations_from_plan`, `gap_signals` | Reviewers weigh these when stating their verdict; feeds `debt_candidates` / `gap_signals` in their review entries. |

Collecting self-check without consuming it is non-conformant.

## Boundaries

- The gate never modifies the task contract.
- The gate never writes new reviewer evidence — it only reads what reviewers already produced.
- Orchestrator, not the gate, decides rewind target on fail/block. Suggested transition in the response is a hint, not an instruction.
- Gate runs are append-only: each re-run appends to `runs`, earlier runs are preserved for audit.
