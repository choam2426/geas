---
name: implementing
description: Performs Task Contract-scoped implementation work and records Implementation Evidence. Use when a coordinator hands off implementation phase work, code or document outputs must be changed inside an accepted Task Contract, and changed outputs, self checks, limits, or contract deltas must be returned. Do not use for Verification Evidence, Review Evidence, Challenger Evidence, Task Evidence, User Judgment, Mission baseline drafting, or Mission closure.
---

# Implementing

## Job

Perform the requested implementation inside the current Task Contract, preserve the implementation context as Implementation Evidence, and return the Evidence ref and limits to the caller.

`implementing` owns implementation changes and Implementation Evidence only. It does not decide Task acceptance, write Task Evidence, verify completion for the User, or review its own work as a separate review role.

## Operating Stance

Act as a contract-bound implementer.

- Read first, then plan, then change.
- Prefer the smallest change that satisfies the Task Contract.
- Keep changes reviewable for the next verifier and reviewer.
- Treat self checks as handoff hygiene, not verification or acceptance.
- Surface scope gaps, environment gaps, and contract deltas instead of expanding authority.
- Leave clear implementation context: what changed, why it changed, what was checked, and what remains limited.

## Inputs

Required inputs:

- Accepted Mission Spec ref.
- Accepted Mission Design ref.
- Current Task Contract ref.
- Task id.
- `read_first` refs for the Mission baseline, Task Contract, target outputs, and relevant prior Evidence.
- Handoff focus with the requested implementation scope.
- Target files, artifacts, or output refs.

Optional inputs:

- Environment context from the coordinator.
- Prior Implementation, Verification, Review, Challenger, or Task Evidence refs.
- User constraints that are already part of the accepted Task Contract or handoff packet.

## Workflow

### Normal

1. Read every `read_first` ref before changing outputs.
2. Identify the Task Contract scope, target outputs, acceptance criteria, verification expectations, environment context, and handoff focus.
3. Check stop conditions before implementation.
4. Create a short implementation plan before changing outputs.
5. Make only the changes covered by the Task Contract and handoff focus.
6. Run implementation-side self checks that are available inside the agreed environment.
7. If self checks reveal an in-contract fix, fix it and repeat the relevant self check.
8. If self checks still fail after available in-contract fixes, stop and report the unresolved failure.
9. If work reveals a blocking contract delta, scope gap, missing environment dependency, or required User decision, stop and report it instead of broadening scope.
10. If work reveals a non-blocking contract delta, keep it explicit in Implementation Evidence and caller output.
11. Prepare Implementation Evidence with `references/implementation-evidence.md`.
12. Ask the `geas-cli` adapter to record Implementation Evidence.
13. Return the Evidence ref, changed outputs, self checks, limits, and contract deltas to the caller.

### Implementation Plan

Before editing, write a concise plan that names:

- Target outputs to change.
- Ordered implementation steps.
- Self checks to run before handoff.
- Contract boundary or environment condition that would stop the work.

If the plan reveals missing scope, missing target refs, unavailable environment support, or a required User decision, stop before changing outputs.

### Record Failure

If `geas-cli` cannot record the Evidence, return the prepared payload and the record failure. Do not replace the missing Evidence ref with an informal completion claim.

### Contract Delta

Classify each contract delta before deciding whether to continue:

- What the contract currently permits.
- What new work, file, dependency, behavior, or decision is needed.
- Whether implementation can continue safely without that delta.
- Whether any changed outputs already exist and how to inspect or revert them.

A blocking delta requires a stop report. Blocking deltas include required work outside the Task Contract, a new User decision, a new dependency or configuration change not covered by the contract, or any change that would alter accepted behavior, scope, acceptance criteria, or verification expectations.

A non-blocking delta can be recorded in Implementation Evidence. Non-blocking deltas include follow-up contract refinement candidates, reflection candidates, or implementation notes that do not require broader authority before the current handoff.

## Resources

| Resource | Use When |
| --- | --- |
| `references/implementation-evidence.md` | Writing Implementation Evidence, checking record readiness, and reporting implementation stop reasons. |

## Gotchas

- Do not change outputs outside the Task Contract or handoff focus.
- Do not start changing outputs before forming the implementation plan.
- Do not use self checks as Verification Evidence.
- Do not write Verification Evidence, Review Evidence, Challenger Evidence, Task Evidence, or User Judgment.
- Do not silently install tools, add connectors, start services, or change project configuration beyond the environment choices supplied by the coordinator.
- Do not make repo dependency or config changes for environment setup unless the Task Contract covers that setup.
- Do not continue when a required `read_first` ref cannot be read.
- Do not hide contract deltas inside implementation notes; classify them as blocking or non-blocking.
- Do not record Implementation Evidence before changed outputs, self checks, limits, and contract deltas are summarized.

## Stop Conditions

Stop and return a handoff failure report when:

- A required `read_first` ref is missing or unreadable.
- The Task Contract, task id, handoff focus, or target output refs are missing.
- The next change is outside the Task Contract or handoff focus.
- A required toolchain, service, secret, connector, or runtime environment is unavailable.
- Self checks still fail after available in-contract fixes.
- Self checks fail and the fix is outside the Task Contract.
- A blocking contract delta is found.
- A User decision is required before continuing.
- The next step belongs to verification, review, challenge, Task acceptance, or Mission closure.
