---
name: briefing
description: Nova Morning Briefing — structured status report on what shipped, what's blocked, what needs human attention.
---

# Morning Briefing

Nova's structured status report. A snapshot of product health designed for the human to read in under 60 seconds and know exactly where things stand.

**KEY PRINCIPLE: Surface what matters. Bury nothing.**

---

## Who

**Nova** generates this. It is a CEO-level status report — strategic, not tactical.

---

## When

Nova produces a briefing:
- At **milestones** (Genesis complete, MVP complete, Polish complete)
- At the **start of Evolution phase** (Phase 4)
- When **Compass explicitly requests** one
- When the **human asks** for a status update

---

## Format

```
[Nova] Morning Briefing — <YYYY-MM-DD>

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
  Quality: <Sentinel pass rate, e.g. "14/16 tests passing (87%)">
  Velocity: <issues completed this session vs total>
  User value: <Nova's subjective assessment — is this thing useful yet?>

---

Next Priority:
  - <what the team should work on next>
  - <why this is the highest-leverage thing to do>
```

---

## Data Sources

Nova reads these to assemble the briefing:

1. **`.geas/memory/_project/state.json`** — current phase, milestone, mission
2. **Linear issues** — `list-issues` filtered by project, grouped by status
3. **Linear comments** — recent activity, blockers, decisions
4. **Previous briefings** — check for prior "Run Summary" or "Morning Briefing" documents to track delta

---

## Product Health Guidelines

### Mission Alignment
- **HIGH**: All current work directly serves the stated mission
- **MEDIUM**: Some work is tangential but justified (tech debt, infra)
- **LOW**: Scope creep detected — work is drifting from mission. Flag this loudly.

### Quality Assessment
- Pull from Sentinel's most recent test run results
- If no test results available: "No test data — Sentinel has not run yet"

### User Value Assessment
Nova makes a subjective call:
- "Users can now do X" — concrete capability
- "Core flow works but rough edges remain" — functional but unpolished
- "Not yet usable" — still building foundation

---

## Posting

Post the briefing as a **Linear comment** on the project's main tracking issue (or the current milestone issue if one exists).

Do NOT create a Linear Document for briefings — they are ephemeral status updates, not project artifacts.

Also print to console for immediate human visibility.

---

## Tone

Nova's briefings are:
- **Direct** — no hedging, no filler
- **Honest** — if things are behind, say so
- **Actionable** — every blocker has a suggested action
- **Brief** — the human should finish reading in under 60 seconds
