---
name: reporting
description: Debt/gap dashboard and health signal calculation — produces health-check.json and a markdown summary.
user-invocable: true
---

# Reporting

Invokable anytime via `/geas:reporting`. The mission skill calls this at phase transitions, session start, and evolving phase entry.

Produces a markdown summary to the conversation and writes `.geas/state/health-check.json`.

---

## Inputs

- **Mission ID** — identifies which mission to report on
- **`.geas/missions/{mission_id}/evolution/debt-register.json`** — debt data
- **`.geas/missions/{mission_id}/evolution/gap-assessment-*.json`** — gap assessment data
- **`.geas/state/events.jsonl`** — event log for health signal computation
- **`.geas/rules.md`** and **`.geas/memory/agents/*.md`** — for memory_bloat signal
- **`.geas/missions/{mission_id}/tasks/*/record.json`** — for worker_low_confidence signal

## Output

- **`.geas/state/health-check.json`** — structured health check with all 8 signals (via `geas health generate`)
- **Markdown summary** — printed to conversation with debt, gaps, health signals, and required actions
- **`.geas/missions/{mission_id}/phase-reviews/{phase}-briefing.md`** — product authority briefing (at milestones)
- **`.geas/missions/{mission_id}/phase-reviews/session-{timestamp}.md`** — session end summary

---

## Section 1: Debt Summary

Read debt data via CLI:
```bash
Bash("geas debt list --mission {mission_id}")
```

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

Calculate all 8 signals from protocol doc 10. For each signal: read the source data, compute the value, compare against the threshold, and determine whether it is triggered.

| Signal | Threshold | Source | Calculation |
|--------|-----------|--------|-------------|
| `memory_bloat` | rules.md > 200 lines or agent notes > 50 lines each | `.geas/rules.md`, `.geas/memory/agents/*.md` | Count total lines in rules.md and each agent note file |
| `review_gap` | > 20% miss rate in last 5 tasks | `.geas/state/events.jsonl` | Count tasks without specialist review evidence / total tasks (last 5) |
| `gate_quality_issue` | > 30% `iterate` rate in last 10 tasks | `.geas/state/events.jsonl` | Count `final_verdict = iterate` events / total final verdict events (last 10) |
| `contradiction_accumulation` | 2+ conflicting rules in rules.md | `.geas/rules.md` | Scan rules.md for contradictory guidance |
| `repeated_failure_class` | same failure class 3+ times | `.geas/state/events.jsonl` | Group gate failure events by `blocking_dimensions`; flag any group with count >= 3 |
| `debt_stagnation` | `accepted` >= 2x `resolved` per phase | `.geas/missions/{mission_id}/evolution/debt-register.json` | `accepted_count / resolved_count` (if resolved = 0 and accepted > 0, value = infinity → triggered) |
| `scope_control_weakness` | > 30% scope change after impl contract in last 5 tasks | `.geas/state/events.jsonl` | Count `revalidation_triggered` events after `implementation_contract_approved` per task (last 5); flag if > 30% of those tasks have at least one such event |
| `worker_low_confidence` | > 25% `confidence <= 2` in last 10 tasks | `.geas/missions/{mission_id}/tasks/*/record.json` | Count record.json `self_check` sections with `confidence <= 2` / total (last 10 by `created_at`) |

### Mandatory Responses

When a signal is triggered, include the mandatory response in the output and take the described action:

1. **memory_bloat** — `orchestration_authority` reviews and trims `rules.md` and agent notes, removing stale or redundant entries.
2. **review_gap** — `orchestration_authority` activates blocking at the `pre_gate` hook for specialist review omissions starting from the next task.
3. **gate_quality_issue** — `orchestration_authority` creates a rule candidate for rubric criteria clarification. Adjusts evidence gate thresholds if needed.
4. **contradiction_accumulation** — `orchestration_authority` edits `rules.md` to resolve contradictions and remove the weaker rule.
5. **repeated_failure_class** — automatically add the failure pattern as a rule in `rules.md` and update relevant agent notes.
6. **debt_stagnation** — `orchestration_authority` creates a debt resolution plan during phase review. Prioritize debt resolution tasks in the next phase scheduling.
7. **scope_control_weakness** — `orchestration_authority` strengthens the implementation contract approval process. Makes re-approval mandatory on scope changes.
8. **worker_low_confidence** — `orchestration_authority` reviews task granularity and improves agent memory notes for relevant workers.

### Missing source data

If a source file does not exist, mark the signal as `value: null, triggered: false` and note the missing source in the summary.

---

## Section 4: Output

Generate and write health check via CLI (computes all 8 signals from current `.geas/` state):
```bash
Bash("geas health generate")
```

The CLI writes `.geas/state/health-check.json` with all 8 signals computed, each including `name`, `value`, `threshold`, `triggered`, `detail`, and `mandatory_response` (when triggered). The CLI enforces schema validation.

To read the current health check:
```bash
Bash("geas health read")
```

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

---

## Section 5: Product Authority Briefing

The reporting skill also generates product authority briefings at key milestones (phase transitions, mission completion). When invoked at a milestone:

1. Summarize completed tasks, their verdicts, and any open debt
2. List key decisions made since the last briefing
3. Highlight risks or signals that require product authority attention
4. Write the briefing (use Write tool for this markdown artifact at `.geas/missions/{mission_id}/phase-reviews/{phase}-briefing.md`)

---

## Section 6: Session End Summary

At session end, generate an audit-trail summary of decisions, tasks, and agent telemetry:

1. Read `.geas/state/events.jsonl` for all events in the current session
2. Summarize: tasks started/completed, gate results, decisions made, escalations
3. Include agent spawn counts and which agents were most active
4. Write the session summary (use Write tool for this markdown artifact at `.geas/missions/{mission_id}/phase-reviews/session-{timestamp}.md`)
