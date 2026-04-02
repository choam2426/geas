---
name: ledger-query
description: Structured search over .geas/ledger/events.jsonl — query by task, phase, agent, or failure. Cross-references TaskContracts, EvidenceBundles, and DecisionRecords. READ-ONLY, never modifies state.
---

# Ledger Query

Structured search over the event log with cross-references to contracts, evidence, and decisions.

**KEY PRINCIPLE: This skill is READ-ONLY. It never writes to any file.**

---

## When to Use

- Diagnosing a pipeline issue (why did task X fail?)
- Generating a status report
- Reviewing agent performance
- Understanding timeline of events
- Responding to user questions about project history

---

## Data Sources

All reads, no writes:

| Source | Path | Format |
|--------|------|--------|
| Event log | `.geas/ledger/events.jsonl` | JSONL (one JSON object per line) |
| Task contracts | `.geas/tasks/{id}.json` | JSON |
| Evidence bundles | `.geas/evidence/{task-id}/{worker}.json` | JSON |
| Decision records | `.geas/decisions/{id}.json` | JSON |
| Run state | `.geas/state/run.json` | JSON |
| Seed spec | `.geas/spec/seed.json` | JSON |

---

## Query Types

### 1. `timeline <task-id>`

Show all events for a specific task in chronological order.

**Process:**
1. Read `.geas/ledger/events.jsonl`
2. Filter lines where `task_id` matches
3. Sort by `timestamp` ascending
4. Cross-reference: read `.geas/tasks/<task-id>.json` for contract status
5. Cross-reference: list evidence files in `.geas/evidence/<task-id>/`

**Output format:**
```
## Timeline: <task-id> — <task-title>
Contract status: <status>  |  Worker: <assigned_worker>  |  Reviewer: <reviewer>

| # | Time | Event | Details |
|---|------|-------|---------|
| 1 | 10:00 | task_compiled | Title: [Frontend] Login form |
| 2 | 10:05 | worker_dispatched | Worker: frontend-engineer |
| 3 | 10:30 | evidence_collected | Worker: frontend-engineer |
| 4 | 10:31 | gate_result | Result: fail — TEST failed |
| 5 | 10:35 | worker_dispatched | Worker: frontend-engineer (fix-1) |
| 6 | 10:50 | gate_result | Result: pass |

Evidence files:
- ui-ux-designer.json ✓
- architecture-authority.json ✓
- frontend-engineer.json ✓
- qa-engineer.json ✓
```

---

### 2. `phase <phase-name>`

Show all events within a phase (specifying, building, polishing, evolving).

**Process:**
1. Read `.geas/ledger/events.jsonl`
2. Find `phase_complete` event boundaries to determine phase time ranges
3. Filter events within the specified phase's time range
4. If phase is currently active (no `phase_complete` event yet), include events from phase start until now

**Output format:**
```
## Phase: <phase-name>
Status: <active | complete>  |  Started: <timestamp>  |  Ended: <timestamp or "ongoing">

| # | Time | Event | Task | Details |
|---|------|-------|------|---------|
| 1 | ... | task_compiled | task-001 | ... |
| 2 | ... | worker_dispatched | task-001 | ... |

Summary:
- Tasks compiled: <count>
- Workers dispatched: <count>
- Gate passes: <count>
- Gate failures: <count>
- Decisions: <count>
```

---

### 3. `failures`

Show all gate failures, fix loops, escalations, and merge conflicts.

**Process:**
1. Read `.geas/ledger/events.jsonl`
2. Filter events where `event` is: `gate_result` with `result` containing "fail", `merge_conflict`, `readiness_gate_blocked`, or any event containing "escalat"
3. For each failure, cross-reference TaskContract for retry_budget and escalation_policy
4. Check if a subsequent pass exists (resolved vs unresolved)

**Output format:**
```
## Failures & Escalations

| # | Time | Task | Event | Resolution |
|---|------|------|-------|------------|
| 1 | 10:31 | task-001 | gate_result: fail (TEST) | Resolved: fix-1 passed |
| 2 | 11:15 | task-003 | gate_result: fail (semantic) | Escalated to architecture-authority-review |
| 3 | 12:00 | task-005 | merge_conflict | Resolved by architecture-authority |

Unresolved:
- task-007: gate failed, fix-2 in progress (retry 2/3)

Stats:
- Total failures: <count>
- Resolved: <count>
- Escalated: <count>
- Unresolved: <count>
```

---

### 4. `agent <agent-name>`

Show all dispatches and evidence for a specific agent.

**Process:**
1. Read `.geas/ledger/events.jsonl`
2. Filter events where `worker` matches the agent name
3. Also filter `conflict_resolved` events where `resolved_by` matches
4. List all evidence files produced by this agent across all tasks

**Output format:**
```
## Agent: <agent-name>
Role: <role from team roster>

| # | Time | Task | Action | Result |
|---|------|------|--------|--------|
| 1 | 10:05 | task-001 | dispatched | — |
| 2 | 10:30 | task-001 | evidence_collected | ui-ux-designer.json |
| 3 | 11:00 | task-003 | dispatched | — |
| 4 | 11:25 | task-003 | evidence_collected | ui-ux-designer.json |

Evidence files produced: <count>
Tasks worked on: <count>
Fix loops involved: <count>
```

---

### 5. `status`

Current run state summary with recent events.

**Process:**
1. Read `.geas/state/run.json` for current state
2. Read `.geas/spec/seed.json` for mission and completeness_checklist
3. Read last 10 events from `.geas/ledger/events.jsonl`
4. Count completed vs total tasks from `.geas/tasks/`
5. List any in-progress or failed tasks

**Output format:**
```
## Current Status

Mission: <mission from seed>
Phase: <current phase>
Completeness: <checklist summary>

Progress: <completed>/<total> tasks complete
Current task: <task-id> — <title> (<status>)

Recent Events (last 10):
| # | Time | Event | Details |
|---|------|-------|---------|
| 1 | ... | ... | ... |

Active Issues:
- <task-id>: <status> — <brief>
```

---

## Implementation Approach

This skill is pure instruction — orchestration_authority reads files with the Read tool and formats output as markdown. No external scripts needed.

**How orchestration_authority executes a ledger query:**
1. Read `.geas/ledger/events.jsonl` using the Read tool
2. Parse each line as a JSON object (JSONL format — one object per line)
3. Apply the filter logic for the requested query type
4. Cross-reference with other `.geas/` files as specified
5. Format the output as a markdown table
6. Present to the user or use internally for decision-making

---

## Rules

1. **NEVER modify any file** — this skill is strictly read-only
2. **Handle missing files gracefully** — if events.jsonl does not exist, say "No events recorded yet. Run a mission first."
3. **Handle malformed lines** — skip lines that cannot be parsed as JSON
4. **Limit output** — for queries returning more than 50 events, show the first 30 and summarize: "... and <N> more events. Refine your query with a task ID or phase name."
5. **Timestamps** — display in HH:MM format for readability
6. **Cross-reference failures** — when a referenced TaskContract or evidence file is missing, show "(not found)" instead of failing
