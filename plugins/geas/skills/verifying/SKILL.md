---
name: verifying
description: Performs Task Contract-scoped verification and writes Verification Evidence directly to the current Task directory. Use when a building handoff asks for checks against Task acceptance criteria, verification strategy, changed outputs, and Implementation Evidence. Do not use for implementation changes, Review Evidence, Challenger Evidence, Task Evidence, User Judgment, Mission criteria drafting, or Mission closure.
---

# Verifying

Run checks that establish what was verified, what failed, and what remains unverified against the Task Contract.

## Core Rules

- Read every `read_first` path before checking outputs.
- Map checks to Task Contract acceptance criteria and verification strategy.
- Separate failure from unverified scope.
- Use `passed`, `changes_requested`, or `escalated` only as an Evidence verdict, never as User Judgment.
- Write Verification Evidence directly to `.geas/missions/<mission-id>/tasks/<task-id>/verification-evidence.md` when the write path is known.
- If checks cannot run or Evidence cannot be written, return the prepared payload and stop reason.

## Workflow

1. Read Mission Spec, Mission Plan, Task Contract, Task Direction if referenced, Implementation Evidence, changed outputs, and handoff instructions.
2. Identify required checks from Task Contract acceptance criteria and verification strategy.
3. Run available tests, commands, inspections, comparisons, or manual output checks.
4. Record command output, failures, environment, and skipped checks.
5. Map results per `TC-AC-001:` style criterion.
6. Prepare Verification Evidence with `references/verification-evidence.md`.
7. Write the Evidence to `verification-evidence.md`, or return the payload with record failure reason.
8. Return the verdict, unverified scope, recheck needs, and reflection candidates.

## Output

Return:

- checks performed and outputs
- criteria results
- failures and unverified scope
- verdict as agent-side Evidence
- recheck needed
- reflection candidates for Task Memory, Memory, Debt Ledger, or Continuity Ledger
- Verification Evidence path or preserved payload with record failure reason

## Boundaries

- Do not modify implementation outputs except for generated verification artifacts explicitly allowed by the Task Contract.
- Do not write Review Evidence, Challenger Evidence, Task Evidence, or User Judgment.
- Do not mark a verdict as `passed` when required checks were skipped or key criteria remain unverified.

`verifying` records verification facts. It does not decide acceptance.
