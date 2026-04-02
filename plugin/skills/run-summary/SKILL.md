---
name: run-summary
description: Generate end-of-session summary — decisions, issues completed, agent stats, verify-fix loops. Output to console and .geas/ file.
---

# Run Summary

End-of-session summary for observability. Captures what happened, what shipped, and what is still open — so the human (and future sessions) have a clear record.

**KEY PRINCIPLE: The summary is an audit trail, not a narrative. Facts only.**

---

## When

Orchestrator invokes this:
- At the **end of every session** (natural completion or human interrupt)
- Before **session handoff** (if work continues in a new conversation)
- On explicit request from the human

---

## Data Sources

Read these in order to assemble the summary:

1. **`.geas/state/run.json`** — current phase, mission, milestone
2. **`.geas/ledger/costs.jsonl`** — agent spawn telemetry (agent name, task, phase, timestamp per spawn)
3. **`.geas/tasks/`** — TaskContracts, check statuses for completion and progress
4. **`.geas/decisions/`** — DecisionRecords for decisions made this session
5. **`.geas/ledger/events.jsonl`** — gate results, verify-fix loops, escalations

---

## Output Format

Print to **console** and write to **`.geas/summaries/`**.

```
Run Summary — <mission name or feature>
Date: <ISO date, e.g. 2026-03-21>
Phase: <specifying | building | polishing | evolving | complete>
Duration: <if available from timestamps, otherwise omit>

---

Decisions Made:
  - <decision 1> (by <agent or team>)
  - <decision 2> (by <agent or team>)
  (If none: "No major decisions this session.")

---

Issues Completed: <X> / <Y> total
  - <ID>: <title> -> Done
  - <ID>: <title> -> Done (after <N> verify-fix loops)
  (If none: "No issues completed this session.")

Issues In Progress:
  - <ID>: <title> — <status>, assigned to <agent>
  (If none: "No issues in progress.")

---

Verify-Fix Loops: <X> triggered
  - <ID>: <N> loop(s) — <brief reason, e.g. "frontend-engineer fixed CSS overlap">
  - <ID>: <N> loop(s) — <brief reason, e.g. "escalated to architecture-authority for arch review">
  (If none: "No verify-fix loops triggered.")

---

Agents Spawned: <total count>
  product-authority: <N> | architecture-authority: <N> | ui-ux-designer: <N> | frontend-engineer: <N> | backend-engineer: <N> | qa-engineer: <N> | devops-engineer: <N> | security-engineer: <N> | technical-writer: <N>
  (Only list agents that were actually spawned. Omit zeros.)

---

Open Work:
  - <ID>: <status>, awaiting <agent or action>
  - <ID>: <status>, blocked by <blocker>
  (If none: "All work complete.")
```

---

### Token Report (if `.geas/ledger/token-summary.json` exists)

Read token-summary.json and report:
- **Total agents spawned**: `agent_count`
- **Token usage**: input tokens, output tokens, cache creation tokens, cache read tokens
- **Per-agent breakdown**: group by agent name, show input/output tokens and spawn count

Present as a markdown table in the summary.

---

### Tech Debt Report (if `.geas/state/debt-register.json` exists)

Read debt-register.json and report:
- **Open**: count by severity (HIGH / MEDIUM / LOW)
- **New this session**: items where `created_at` falls within this session
- **Resolved this session**: items where `resolved_at` falls within this session

Present as a markdown summary.

---

## Writing the Summary File

Write the summary to `.geas/summaries/run-summary-<YYYY-MM-DD>.md`.

If multiple summaries exist for the same date (multiple sessions), append a sequence number: `run-summary-2026-03-21-2.md`.

---

## Console Output

Print the same summary to the console so the human sees it immediately.

Keep console output identical to the summary file content — no separate formatting.

---

## Edge Cases

- **Session interrupted mid-issue**: Mark the issue as "In Progress" in the summary. State what was in progress and which agent was working on it.
- **No issues created yet** (e.g. interrupted during Discovery): Summary should still capture decisions made, even if no issues were created.
- **Decision-only session**: No issues to report. Summarize the decision topic, positions taken, and outcome (if reached).
