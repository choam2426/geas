# Intake Interview Reference

Use this reference before drafting Mission Spec when the User request is unclear or broad.

The goal is to make the next artifact reviewable without silently inventing User intent, scope, constraints, acceptance criteria, or exclusions.

## Intake Loop

1. Restate the likely Mission in one or two sentences.
2. List facts already provided by the User.
3. Identify decisions that affect Mission Spec.
4. Ask the smallest number of focused questions needed for Mission Spec review.
5. If a decision can wait without changing Mission Spec, mark its later owner: Mission Plan, Task Direction, Task Contract, building, or consolidating.
6. Draft Mission Spec only when the exit gate is met.

## Mission Spec Readiness

Confirm each item is answered, explicitly assumed, marked not applicable, or moved to a later owner without changing Mission Spec:

- Goal
- Background
- Included scope
- Excluded scope
- Acceptance criteria
- Constraints
- User-provided assumptions
- Known risks
- Existing workspace context that changes scope or criteria

## Project Context Scan

When an existing workspace matters, inspect only context that can affect the current artifact:

- repository instructions
- relevant docs
- current artifact refs under `.geas/`
- related source files or outputs
- Memory, Debt Ledger, Continuity Ledger

Do not scan unrelated project areas to make the intake look complete.

## Open Decision Shape

```markdown
### OD-001: <decision>

- Owner: Mission Spec | Mission Plan | Task Direction | Task Contract | building | consolidating
- Blocks current artifact: yes | no
- Options: <known options>
- User input needed: <question or none>
- Reason non-blocking: <why review can proceed if not blocking>
```

## Stop Briefing

Return this when intake cannot safely continue:

```markdown
## Intake Stopped

- Reason: <missing User decision, unreadable context, conflicting criteria, or unsafe assumption>
- Known facts: <facts>
- Blocking decisions: <decisions>
- Suggested next action: <question, inspect path, revise goal, or stop>
```
