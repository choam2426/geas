---
name: briefing
description: product_authority Morning Briefing — structured status report on what shipped, what's blocked, what needs human attention.
---

# Morning Briefing

product_authority's structured status report. A snapshot of product health designed for the human to read in under 60 seconds and know exactly where things stand.

**KEY PRINCIPLE: Surface what matters. Bury nothing.**

---

## Who

**product_authority** generates this. It is a CEO-level status report — strategic, not tactical.

---

## When

product_authority produces a briefing:
- At **milestones** (Discovery complete, Build complete, Polish complete)
- At the **start of Evolution phase** (Phase 4)
- When **orchestration_authority explicitly requests** one
- When the **human asks** for a status update

---

## Format

```
[product_authority] Morning Briefing — <YYYY-MM-DD>

---

What Shipped:
  - <feature 1>: <one-line value delivered to users>
  - <feature 2>: <one-line value delivered to users>
  (If nothing shipped: "Nothing shipped since last briefing.")

---

What's Blocked:
  - <issue ID + title>: blocked by <reason> — suggested action: <what to do>
  - <issue ID + title>: blocked by <reason> — suggested action: <what to do>
  (If nothing blocked: "No blockers.")

---

Needs Human Attention:
  - <decision that requires human input, e.g. "Choose between OAuth providers">
  - <external dependency, e.g. "Stripe API key needed to proceed">
  - <scope question, e.g. "Feature X is larger than expected — cut or keep?">
  (If nothing needs attention: "No human input needed right now.")

---

Product Health:
  Mission alignment: HIGH | MEDIUM | LOW
  Quality: <qa_engineer pass rate, e.g. "14/16 tests passing (87%)">
  Velocity: <issues completed this session vs total>
  User value: <product_authority's subjective assessment — is this thing useful yet?>

---

Next Priority:
  - <what the team should work on next>
  - <why this is the highest-leverage thing to do>
```

---

## Data Sources

product_authority reads these to assemble the briefing:

1. **`.geas/state/run.json`** — current phase, milestone, mission
2. **`.geas/tasks/`** — TaskContracts grouped by status
3. **`.geas/evidence/`** — recent activity, blockers, decisions
4. **Previous briefings** — check for prior "Run Summary" or "Morning Briefing" documents to track delta

---

## Product Health Guidelines

### Mission Alignment
- **HIGH**: All current work directly serves the stated mission
- **MEDIUM**: Some work is tangential but justified (tech debt, infra)
- **LOW**: Scope creep detected — work is drifting from mission. Flag this loudly.

### Quality Assessment
- Pull from qa_engineer's most recent test run results
- If no test results available: "No test data — qa_engineer has not run yet"

### User Value Assessment
product_authority makes a subjective call:
- "Users can now do X" — concrete capability
- "Core flow works but rough edges remain" — functional but unpolished
- "Not yet usable" — still building foundation

---

## Posting

Print the briefing to console for immediate human visibility.

---

## Tone

product_authority's briefings are:
- **Direct** — no hedging, no filler
- **Honest** — if things are behind, say so
- **Actionable** — every blocker has a suggested action
- **Brief** — the human should finish reading in under 60 seconds
