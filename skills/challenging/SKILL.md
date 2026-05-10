---
name: challenging
description: "Challenger role procedure. Use only inside a challenger role context or explicit challenger role handoff when importance, ambiguity, weak criteria, scope risk, verification gaps, or User-level tradeoffs justify an adversarial pass."
---

# Challenging

Use this skill only when the current execution context is the `challenger` role for a conditional adversarial pass over baseline, Task result, or Evidence.

Challenging is not routine review. It pressures hidden assumptions, weak criteria, scope leaks, verification gaps, long-term cost, and User-level tradeoffs.

## Core Rules

- Read every `read_first` path from the handoff before challenging. If a required path cannot be read, return handoff failure to the calling context instead of producing findings or Challenger Evidence.
- If the current context is the mission, specifying, building, or any other calling context, do not run this workflow locally. Prepare or request a `challenger` role handoff and wait for that role result.
- Use only when triggers justify the extra depth.
- Target specific assumptions, scope, verification, risk, or tradeoff.
- Produce Challenger Evidence for building-stage Task challenges.
- Challenger findings are produced from the `challenger` role context.
- During specifying, return findings to the calling context for Baseline Challenge briefing and baseline draft revision.
- Do not record Challenger Evidence during specifying.
- If building-stage Evidence recording is unavailable, prepare the Challenger Evidence payload and return it to the calling context with recording marked unavailable.
- Record absence of findings with focus and basis.
- Treat verdict as agent-side input only.

## Workflow

1. Read all `read_first` paths, including the target baseline, Task result, and Evidence that exist for the current stage.
2. Identify challenge focus.
3. Pressure the strongest hidden assumptions.
4. Look for scope expansion, verification gaps, fragile criteria, irreversible choices, and long-term cost.
5. Separate findings from preferences.
6. Choose verdict: `passed`, `changes_requested`, or `escalated`.
7. During specifying, load `references/baseline-challenge.md` and return baseline challenge findings to the calling context. Do not write a runtime artifact.
8. During building, load `references/challenger-evidence.md` and record Challenger Evidence:

```text
geas task evidence record --task <task-id> --kind challenger --from <path|->
```

## References

- `references/challenger-evidence.md`: Prepare Challenger Evidence from challenge focus, findings, and basis.
- `references/baseline-challenge.md`: Return specifying-stage baseline challenge findings for User briefing and draft revision.
