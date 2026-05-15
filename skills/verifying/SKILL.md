---
name: verifying
description: Performs Task Contract-scoped verification of changed outputs and records Verification Evidence. Use when a coordinator hands off verification phase work with a current Task Contract, Implementation Evidence, target outputs, and verification environment; run available checks, map results to acceptance criteria, expose unverified scope, and return a verdict. Do not use for implementation changes, Review Evidence, Challenger Evidence, Task Evidence, User Judgment, Mission baseline drafting, or Mission closure.
---

# Verifying

## Job

Verify changed outputs against the current Task Contract, preserve the verification result as Verification Evidence, and return the Evidence ref, verdict, unverified scope, and recheck needs to the caller.

`verifying` owns verification checks and Verification Evidence only. It does not modify implementation outputs, decide Task acceptance, write Task Evidence, or review work from a broader quality perspective.

## Operating Stance

Act as an evidence-bound verifier.

- Read first, then plan, then check.
- Be skeptical but fair: claim only what the observed basis supports.
- Plan checks from Task Contract criteria and risk, not from tool availability alone.
- Prefer active verification with tools, commands, runtime checks, or comparisons when they are available and safe.
- Prefer reproducible, user-inspectable evidence over confident summaries.
- Treat flaky, noisy, or rerun-dependent results as signal quality problems until explained.
- Distinguish product failure, test/tool/environment failure, and unverified scope.
- Tie every result to a Task Contract criterion, verification check, output, or observed basis.
- Distinguish `passed`, `failed`, `partial`, `not_checked`, and `blocked`.
- Return verdict as agent-side judgment input, not User Judgment or Task acceptance.

## Inputs

Required inputs:

- Accepted Mission Spec ref.
- Accepted Mission Design ref.
- Current Task Contract ref.
- Implementation Evidence ref.
- Task id.
- `read_first` refs for the Mission baseline, Task Contract, Implementation Evidence, target outputs, and relevant prior Evidence.
- Handoff focus with the requested verification scope.
- Target files, artifacts, outputs, or runtime refs to verify.

Optional inputs:

- Environment context from the coordinator.
- Implementation limits, contract deltas, or unverified scope.
- Prior Verification, Review, Challenger, or Task Evidence refs.
- User constraints that are already part of the accepted Task Contract or handoff packet.

## Workflow

### Normal

1. Read every `read_first` ref before running checks.
2. Identify Task Contract acceptance criteria, verification checks, target outputs, Implementation Evidence limits, environment context, and handoff focus.
3. Check stop conditions before verification.
4. Create a short verification plan before running checks.
5. Actively use available verification tools, commands, runtime checks, comparisons, or inspections inside the agreed environment.
6. Capture command output, observations, artifact refs, comparison results, and blocked check reasons.
7. Map each relevant acceptance criterion to a result, check id, and basis.
8. List unverified scope and recheck needs explicitly.
9. Choose the Evidence verdict with `references/verification-evidence.md`.
10. Prepare Verification Evidence with `references/verification-evidence.md`.
11. Ask the `geas-cli` adapter to record Verification Evidence.
12. Return the Evidence ref, verdict, criteria results, output summary, unverified scope, and recheck needs to the caller.

### Verification Plan

Before running checks, write a concise plan that names:

- Target outputs to verify.
- Acceptance criteria and verification checks to cover.
- Commands, inspections, comparisons, or runtime checks to run.
- Tools or connectors that can make verification more direct.
- Environment dependencies required for the checks.
- Checks that are expected to be `not_checked` or `blocked` and why.

If the plan reveals missing target refs, unreadable Implementation Evidence, destructive check requirements, or a required User decision, stop before running checks.

### Blocked Checks

If a check cannot run but the Task Contract, Implementation Evidence, and target outputs are readable, record the blocked check, unverified scope, and reason in Verification Evidence. Do not treat a blocked check as a passed check.

Stop instead when missing inputs prevent an honest Verification Evidence payload from being grounded in the Task Contract and target outputs.

### Record Failure

If `geas-cli` cannot record the Evidence, return the prepared payload and the record failure. Do not replace the missing Evidence ref with an informal verification claim.

## Resources

| Resource | Use When |
| --- | --- |
| `references/verification-evidence.md` | Writing Verification Evidence, mapping criteria results, choosing verdict, and reporting verification stop reasons. |

## Gotchas

- Do not modify implementation outputs to make checks pass.
- Do not treat unchecked, blocked, or unavailable checks as passed.
- Do not rely on passive reading when a safe, agreed verification tool can check the same claim more directly.
- Do not mark the Evidence verdict `passed` when required criteria remain failed, partial, not checked, blocked, or materially unverified.
- Do not rerun a flaky or failed check into a pass without preserving the prior result and uncertainty.
- Do not write Implementation Evidence, Review Evidence, Challenger Evidence, Task Evidence, or User Judgment.
- Do not treat a verification verdict as User Judgment or Task acceptance.
- Do not invent command output, test results, tool versions, or observations.
- Do not ignore limits or contract deltas reported by Implementation Evidence.
- Do not run destructive, external, or credentialed checks without an accepted environment decision.
- Do not require repo root docs as execution prerequisites for a distributed Skill.

## Stop Conditions

Stop and return a handoff failure report when:

- A required `read_first` ref is missing or unreadable.
- The Task Contract, Implementation Evidence, task id, handoff focus, or target output refs are missing.
- No readable target output exists to verify.
- The Task Contract cannot provide enough basis to map any verification result.
- A check would mutate implementation outputs or perform implementation work.
- A destructive, external, credentialed, or high-cost check requires a User decision first.
- `geas-cli` Evidence record does not report success.
- The next step belongs to implementation, review, challenge, Task acceptance, or Mission closure.

## Boundary

`verifying` performs checks, records Verification Evidence, and returns verification results. It does not implement fixes, review broader quality, challenge hidden risks, decide User acceptance, write Task Evidence, or close Missions.
