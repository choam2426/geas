---
name: challenging
description: "Internal challenger procedure. Use only inside an active Mission or explicit mission handoff when importance, ambiguity, weak criteria, scope risk, verification gaps, or User-level tradeoffs justify an adversarial pass."
---

# Challenging

Use this skill for a conditional adversarial pass over baseline, Task result, or Evidence.

Challenging is not routine review. It pressures hidden assumptions, weak criteria, scope leaks, verification gaps, long-term cost, and User-level tradeoffs.

## Core Rules

- Use only when triggers justify the extra depth.
- Target specific assumptions, scope, verification, risk, or tradeoff.
- Produce Challenger Evidence for building-stage Task challenges.
- During specifying, return findings to `mission` for a Baseline Challenge Briefing and baseline draft revision.
- Do not record Challenger Evidence during specifying.
- Record absence of findings with focus and basis.
- Treat verdict as agent-side input only.

## Workflow

1. Read the target baseline, Task result, and Evidence that exist for the current stage.
2. Identify challenge focus.
3. Pressure the strongest hidden assumptions.
4. Look for scope expansion, verification gaps, fragile criteria, irreversible choices, and long-term cost.
5. Separate findings from preferences.
6. Choose verdict: `passed`, `changes_requested`, or `escalated`.
7. During specifying, return baseline challenge findings to `mission` for `briefings.md` Baseline Challenge Briefing. Do not write a runtime artifact.
8. During building, load `references/challenger-evidence.md` and record Challenger Evidence:

```text
geas task evidence record --task <task-id> --kind challenger --from <path|->
```

## References

- `references/challenger-evidence.md`: Prepare Challenger Evidence from challenge focus, findings, and basis.
- `../mission/references/briefings.md`: Present specifying-stage baseline challenge findings as a Baseline Challenge Briefing.
