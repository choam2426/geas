---
name: reporting
description: Debt/gap dashboard and health signal calculation — produces health-check.json and a markdown summary.
user-invocable: true
---

# Reporting

Invokable anytime via `/geas:reporting`. The orchestrating skill calls this at phase transitions, session start, and evolving phase entry.

Produces a markdown summary to the conversation and writes `.geas/state/health-check.json`.

---

## Section 1: Debt Summary

Read `.geas/missions/{mission_id}/evolution/debt-register.json`.

Report the following counts:

**By severity** (use `rollup_by_severity`):
- critical, high, medium, low

**By kind** (use `rollup_by_kind`):
- code_quality, architecture, security, docs, ops, test_gap, product_gap

**By status** — count items in `items[]` by their `status` field:
- open, accepted, scheduled, resolved, dropped

If the file does not exist, report: "No debt register found — run after at least one phase completes."

---

## Section 2: Gap Summary

Read the latest `.geas/missions/{mission_id}/evolution/gap-assessment-*.json` file (most recent by timestamp).

Report:

- **Fully delivered**: count + list of `goal` values where `delivery_status = "fully_delivered"`
- **Partially delivered**: count + for each item: goal, delivered portion, remaining portion
- **Not delivered**: count + for each item: goal + rationale

Compute **gap closure ratio**:

```
ratio = fully_delivered / (fully_delivered + partially_delivered + not_delivered)
```

Report as a percentage (e.g., `75%`). If denominator is 0, report `N/A`.

If the file does not exist, report: "No gap assessment found — run after at least one phase completes."

---

## Section 3: Health Signals

Calculate all 8 signals from protocol doc 12. For each signal: read the source data, compute the value, compare against the threshold, and determine whether it is triggered.

| Signal | Threshold | Source | Calculation |
|--------|-----------|--------|-------------|
| `memory_bloat` | entries > 100 with 0 reuses in last 10 tasks | `.geas/state/memory-index.json` | Count index entries where `reuse_count = 0` |
| `review_gap` | > 20% miss rate in last 5 tasks | `.geas/ledger/events.jsonl` | Count tasks without specialist review evidence / total tasks (last 5) |
| `gate_quality_issue` | > 30% `iterate` rate in last 10 tasks | `.geas/ledger/events.jsonl` | Count `final_verdict = iterate` events / total final verdict events (last 10) |
| `contradiction_accumulation` | 2+ stable memories with `contradiction_count >= 3` | `.geas/state/memory-index.json` | Count index entries where `state = stable` and `contradiction_count >= 3` |
| `repeated_failure_class` | same failure class 3+ times | `.geas/ledger/events.jsonl` | Group gate failure events by `blocking_dimensions`; flag any group with count >= 3 |
| `debt_stagnation` | `accepted` >= 2x `resolved` per phase | `.geas/missions/{mission_id}/evolution/debt-register.json` | `accepted_count / resolved_count` (if resolved = 0 and accepted > 0, value = infinity → triggered) |
| `scope_control_weakness` | > 30% scope change after impl contract in last 5 tasks | `.geas/ledger/events.jsonl` | Count `revalidation_triggered` events after `implementation_contract_approved` per task (last 5); flag if > 30% of those tasks have at least one such event |
| `worker_low_confidence` | > 25% `confidence <= 2` in last 10 tasks | `.geas/missions/{mission_id}/tasks/*/worker-self-check.json` | Count self-check files with `confidence <= 2` / total self-check files (last 10 by `created_at`) |

### Mandatory Responses

When a signal is triggered, include the mandatory response in the output and take the described action:

1. **memory_bloat** — `orchestration_authority` batch-reviews memories with 0 reuses at the next retrospective. Items past their `review_after` date are transitioned to `decayed`.
2. **review_gap** — `orchestration_authority` activates blocking at the `pre_gate` hook for specialist review omissions starting from the next task.
3. **gate_quality_issue** — `orchestration_authority` creates a rule candidate for rubric criteria clarification. Adjusts evidence gate thresholds if needed.
4. **contradiction_accumulation** — immediately transition the affected memory entries to `under_review` and apply doc 08 decay rules.
5. **repeated_failure_class** — automatically register the failure pattern as a memory candidate and trigger the Retrospective to Rule Update process from doc 13.
6. **debt_stagnation** — `orchestration_authority` creates a debt resolution plan during phase review. Prioritize debt resolution tasks in the next phase scheduling.
7. **scope_control_weakness** — `orchestration_authority` strengthens the implementation contract approval process. Makes re-approval mandatory on scope changes.
8. **worker_low_confidence** — `orchestration_authority` reviews task granularity and improves L1/L2 memory quality in context packets.

### Missing source data

If a source file does not exist, mark the signal as `value: null, triggered: false` and note the missing source in the summary.

---

## Section 4: Output

Write `.geas/state/health-check.json`:

```json
{
  "timestamp": "<ISO 8601>",
  "signals": [
    {
      "name": "memory_bloat",
      "value": 15,
      "threshold": 100,
      "triggered": false
    },
    {
      "name": "debt_stagnation",
      "value": 2.5,
      "threshold": 2.0,
      "triggered": true,
      "mandatory_response": "orchestration_authority creates a debt resolution plan during phase review. Prioritize debt resolution tasks in the next phase scheduling."
    }
  ]
}
```

Include all 8 signals in the `signals` array. Only include `mandatory_response` on entries where `triggered: true`.

Then print a markdown summary to the conversation:

```
## Health Report — <ISO 8601 timestamp>

### Debt
- Critical: N  High: N  Medium: N  Low: N
- Open: N  Accepted: N  Scheduled: N  Resolved: N  Dropped: N

### Gaps
- Fully delivered: N  Partially: N  Not delivered: N  (Closure ratio: X%)

### Health Signals
| Signal | Value | Threshold | Status |
|--------|-------|-----------|--------|
| memory_bloat | 15 | 100 | OK |
| debt_stagnation | 2.5 | 2.0 | TRIGGERED |
...

### Required Actions
- debt_stagnation: orchestration_authority creates a debt resolution plan during phase review.
...
```

If no signals are triggered, print: "All health signals within thresholds."
