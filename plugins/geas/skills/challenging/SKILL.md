---
name: challenging
description: Pressure-tests Mission Spec, Mission Plan, Task Direction, Task Contract, Task outputs, and Role Evidence for hidden assumptions, scope leaks, weak criteria, verification gaps, operational risks, and long-term cost. Use when a coordinator asks for independent challenge before criteria acceptance or Task result judgment. Do not use for implementation fixes, verification checks, ordinary review, Task Evidence, User Judgment, Mission Evidence, or direct artifact revision.
---

# Challenging

Challenge the target so the User and coordinator can see hidden risk before accepting criteria or Task results.

## Core Rules

- Read every `read_first` path before challenging.
- Challenge the artifact or Task result named by the handoff. Do not broaden the target silently.
- Use findings that can change User decision cost, criteria clarity, rework needs, or follow-up Tasks.
- For Task-scoped challenge, write Challenger Evidence directly to `.geas/missions/<mission-id>/tasks/<task-id>/challenger-evidence.md` when the write path is known.
- For criteria challenge before acceptance, return findings to the owning skill as a handoff result; do not write runtime Evidence unless the challenged artifact is already accepted and Task-scoped.
- Treat recommendation as agent-side input, not User Judgment.

## Workflow

1. Read the target artifacts, Role Evidence, User decisions, Memory, Debt Ledger, and Continuity Ledger relevant to the handoff.
2. Confirm whether the target is criteria work or Task result work.
3. Pressure-test assumptions, scope boundaries, acceptance criteria, verification gaps, user impact, operational risks, and continuity costs.
4. Keep only findings with a concrete basis and escalation route.
5. For Task result work, prepare Challenger Evidence with `references/challenger-evidence.md` and write it to `challenger-evidence.md`.
6. For criteria work, prepare challenge findings with `references/criteria-challenge.md` and return them to `specifying` or the caller.
7. Return User decisions needed, deeper checks needed, recommendation, and reflection candidates.

## Output

Return:

- challenged target
- findings and basis
- User decisions needed
- deeper checks needed
- recommendation as agent-side input
- reflection candidates for Task Memory, Memory, Debt Ledger, or Continuity Ledger
- Challenger Evidence path, or criteria challenge handoff result, or preserved payload with record failure reason

## Boundaries

- Do not revise the challenged artifact directly.
- Do not implement, verify, or perform ordinary review.
- Do not write Task Evidence, Mission Evidence, or User Judgment.
- Do not raise unfalsifiable doubt; each finding needs a basis and a route to reduce the risk.

`challenging` pressure-tests and reports risk. It does not own revisions or acceptance decisions.
