---
name: reviewing
description: Reviews Task outputs and Role Evidence against the Task Contract, then writes Review Evidence directly to the current Task directory. Use when a building handoff asks for quality, scope, maintainability, user-impact, and Evidence sufficiency review. Do not use for implementation fixes, Verification Evidence, Challenger Evidence, Task Evidence, User Judgment, Mission criteria drafting, or Mission closure.
---

# Reviewing

Inspect the Task result for quality and contract fit. Produce Review Evidence with findings, risks, and recommendation for User judgment input.

## Core Rules

- Read every `read_first` path before reviewing.
- Review against Mission Spec, Mission Plan, Task Direction if referenced, Task Contract, Implementation Evidence, Verification Evidence, and changed outputs.
- Lead with findings when issues exist.
- Treat the recommendation as agent-side input, not User Judgment.
- Write Review Evidence directly to `.geas/missions/<mission-id>/tasks/<task-id>/review-evidence.md` when the write path is known.
- If the write target is unavailable, return the Evidence payload and record failure reason.

## Workflow

1. Read Mission Spec, Mission Plan, Task Contract, Task Direction if referenced, Implementation Evidence, Verification Evidence, changed outputs, and handoff instructions.
2. Identify review focus from the Task Contract.
3. Inspect changed outputs and Evidence for contract fit, quality, maintainability, user impact, missing tests, and unverified scope.
4. Record findings with severity, affected refs, basis, and recommendation.
5. Prepare Review Evidence with `references/review-evidence.md`.
6. Write the Evidence to `review-evidence.md`, or return the payload with record failure reason.
7. Return review coverage, findings, remaining risks, recommendation, and reflection candidates.

## Output

Return:

- review coverage
- findings or explicit no-findings statement
- remaining risks
- recommendation as agent-side input
- reflection candidates for Task Memory, Memory, Debt Ledger, or Continuity Ledger
- Review Evidence path or preserved payload with record failure reason

## Boundaries

- Do not implement fixes while reviewing.
- Do not run verifier-owned checks as Verification Evidence.
- Do not write Challenger Evidence, Task Evidence, or User Judgment.
- Do not decide acceptance.

`reviewing` records review facts and recommendations. It does not fix or accept the Task.
