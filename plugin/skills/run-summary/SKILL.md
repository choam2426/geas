---
name: run-summary
description: Generate end-of-session summary — decisions, issues completed, agent stats, verify-fix loops. Post to Linear Document and console.
---

# Run Summary

End-of-session summary for observability. Captures what happened, what shipped, and what is still open — so the human (and future sessions) have a clear record.

**KEY PRINCIPLE: The summary is an audit trail, not a narrative. Facts only.**

---

## When

Compass invokes this:
- At the **end of every session** (natural completion or human interrupt)
- Before **session handoff** (if work continues in a new conversation)
- On explicit request from the human

---

## Data Sources

Read these in order to assemble the summary:

1. **`.geas/state/run.json`** — current phase, mode, mission, milestone
2. **`.geas/memory/_project/agent-log.jsonl`** — agent spawn history (who was spawned, when, for what issue)
3. **Linear issues** — `list-issues` filtered by project, check statuses and comments for decisions
4. **Linear comments** — scan for decision patterns: `[Nova]`, `[Forge]`, vote results, pivot notices

---

## Output Format

Post as both a **Linear Document** and **console output**.

```
Run Summary — <mission name or Sprint feature>
Date: <ISO date, e.g. 2026-03-21>
Mode: <initiative | sprint | debate>
Phase: <genesis | mvp | polish | evolve | complete>
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
  - <ID>: <N> loop(s) — <brief reason, e.g. "Pixel fixed CSS overlap">
  - <ID>: <N> loop(s) — <brief reason, e.g. "escalated to Forge for arch review">
  (If none: "No verify-fix loops triggered.")

---

Agents Spawned: <total count>
  Nova: <N> | Forge: <N> | Palette: <N> | Pixel: <N> | Circuit: <N> | Sentinel: <N> | Pipeline: <N> | Shield: <N> | Scroll: <N>
  (Only list agents that were actually spawned. Omit zeros.)

---

Open Work:
  - <ID>: <status>, awaiting <agent or action>
  - <ID>: <status>, blocked by <blocker>
  (If none: "All work complete.")
```

---

### Cost Report (if `.geas/ledger/costs.jsonl` exists)

Read costs.jsonl and aggregate:
- **Total agent spawns**: count of entries
- **Spawns by agent**: group by `agent` field, count each
- **Spawns by model**: group by `model` field (opus vs sonnet)
- **Spawns by phase**: group by `phase` field
- **Per-task breakdown**: group by `task_id`

Present as a markdown table in the summary.

---

## Creating the Linear Document

Post the summary as a Linear Document attached to the project:

```
create-document --title "Run Summary: <YYYY-MM-DD>" --content "<summary content>" --project-id <UUID>
```

Read the project ID from `.geas/memory/_project/linear-config.json`.

If multiple summaries exist for the same date (multiple sessions), append a sequence number: "Run Summary: 2026-03-21 #2".

---

## Agent Log Format

The agent log at `.geas/memory/_project/agent-log.jsonl` uses one JSON object per line:

```json
{"agent": "forge", "action": "spawn", "issue_id": "MY-42", "timestamp": "2026-03-21T10:30:00Z"}
{"agent": "pixel", "action": "complete", "issue_id": "MY-42", "timestamp": "2026-03-21T11:15:00Z"}
{"agent": "sentinel", "action": "verify-fail", "issue_id": "MY-42", "timestamp": "2026-03-21T11:20:00Z"}
```

If the log file does not exist, note "Agent log not available — counts estimated from Linear activity" and derive counts from Linear issue comments.

---

## Console Output

Print the same summary to the console so the human sees it immediately, without needing to open Linear.

Keep console output identical to the Linear Document content — no separate formatting.

---

## Edge Cases

- **Session interrupted mid-issue**: Mark the issue as "In Progress" in the summary. State what was in progress and which agent was working on it.
- **No issues created yet** (e.g. interrupted during Genesis): Summary should still capture decisions made, even if no issues were created.
- **Debate mode**: No issues to report. Summarize the debate topic, positions taken, and outcome (if reached).
