---
name: implementing
description: Performs Task Contract-scoped implementation work and writes Implementation Evidence directly to the current Task directory. Use when a building handoff asks for code, document, or artifact changes inside an accepted Task Contract. Do not use for Verification Evidence, Review Evidence, Challenger Evidence, Task Evidence, User Judgment, Mission criteria drafting, or Mission closure.
---

# Implementing

Perform only the implementation work described by the Task Contract and record what changed as Implementation Evidence.

## Core Rules

- Read every `read_first` path before changing outputs.
- Treat Mission Spec, Mission Plan, Task Direction, and Task Contract as execution criteria.
- Stay inside Task Contract scope. If a needed change exceeds scope, stop and report a contract delta instead of silently expanding work.
- Keep implementation changes separate from verification, review, challenge, Task Evidence, and User Judgment.
- Write Implementation Evidence directly to `.geas/missions/<mission-id>/tasks/<task-id>/implementation-evidence.md` when the write path is known.
- If the write target is unavailable, return the Evidence payload and record failure reason.

## Workflow

1. Read Mission Spec, Mission Plan, Task Contract, Task Direction if referenced, related Memory, Task Memory, and handoff instructions.
2. Confirm Task scope, deliverables, exclusions, acceptance criteria, execution guardrails, and change triggers.
3. Inspect the target files or artifacts before editing.
4. Make the smallest implementation changes that satisfy the Task Contract.
5. Run self checks that are available and appropriate for the implementation handoff.
6. Prepare Implementation Evidence with `references/implementation-evidence.md`.
7. Write the Evidence to `implementation-evidence.md` in the Task directory, or return the payload with a stop reason.
8. Return changed outputs, self checks, limits, contract deltas, and reflection candidates.

## Output

Return:

- changed outputs
- implementation decisions
- self checks and results
- limits and unverified implementation areas
- contract deltas
- reflection candidates for Task Memory, Memory, Debt Ledger, or Continuity Ledger
- Implementation Evidence path or preserved payload with record failure reason

## Boundaries

- Do not perform independent verification or review as a substitute for verifier or reviewer Evidence.
- Do not write Task Evidence or User Judgment.
- Do not edit outside the Task Contract unless the User has accepted a revised Task Contract.
- Do not cleanup unrelated code or docs.

`implementing` changes outputs and records implementation facts. It does not decide whether the Task is acceptable.
