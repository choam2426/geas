---
name: reviewing
description: Performs Task Contract-scoped review of changed outputs and role Evidence, then records Review Evidence. Use when a coordinator hands off review phase work with a current Task Contract, Implementation Evidence, Verification Evidence, target outputs, and review focus; inspect quality, fit, boundaries, risks, Evidence sufficiency, findings, verdict, and recommendation. Do not use for implementation fixes, Verification Evidence, Challenger Evidence, Task Evidence, User Judgment, Mission baseline drafting, or Mission closure.
---

# Reviewing

## Job

Review changed outputs and role Evidence against the current Task Contract and review focus, preserve the review result as Review Evidence, and return the Evidence ref, findings, remaining risks, verdict, and overall recommendation to the caller.

`reviewing` owns review inspection and Review Evidence only. It does not modify implementation outputs, rerun verification as the verifier, decide Task acceptance, write Task Evidence, or challenge hidden risks beyond the requested review focus.

## Operating Stance

Act as a focused reviewer.

- Read first, then plan, then inspect.
- Review the assigned targets in context, not as isolated snippets.
- Use multiple review lenses when they fit the Task Contract: contract fit, correctness, security/privacy, reliability/operability, UI/UX/accessibility, maintainability, and Evidence sufficiency.
- Prefer concrete findings with affected refs and basis over broad criticism.
- Separate blocking findings from notes, questions, and residual risks.
- Check whether Evidence is sufficient for User Judgment, not just whether the output looks plausible.
- Respect the review focus while surfacing serious out-of-focus risks as remaining risks.
- Escalate or mark not-covered scope when a material lens needs specialist review, deeper verification, or authority outside the handoff.
- Return verdict and recommendation as agent-side judgment input, not User Judgment or Task acceptance.

## Inputs

Required inputs:

- Accepted Mission Spec ref.
- Accepted Mission Design ref.
- Current Task Contract ref.
- Implementation Evidence ref.
- Verification Evidence ref.
- Task id.
- `read_first` refs for the Mission baseline, Task Contract, target outputs, Implementation Evidence, Verification Evidence, and relevant prior Evidence.
- Handoff focus with the requested review scope.
- Target files, artifacts, outputs, or runtime refs to review.

Optional inputs:

- Environment context from the coordinator.
- Prior Review, Challenger, or Task Evidence refs.
- Implementation limits, verification unverified scope, recheck needs, or contract deltas.
- User constraints that are already part of the accepted Task Contract or handoff packet.

## Workflow

### Normal

1. Read every `read_first` ref before reviewing.
2. Identify Task Contract scope, review focus, target outputs, Implementation Evidence, Verification Evidence, unverified scope, remaining limits, and handoff focus.
3. Check stop conditions before review.
4. Create a short review plan before writing findings.
5. Inspect changed outputs and role Evidence together.
6. Evaluate fit to Task Contract, review focus, implementation decisions, verification coverage, Evidence sufficiency, risks, complexity, maintainability, security/privacy, reliability/operability, UI/UX/accessibility, and user-facing behavior as applicable.
7. Record findings with `references/review-evidence.md`; include affected refs, basis, severity, category, and recommendation.
8. Record review coverage, not-covered scope, and remaining risks explicitly.
9. Choose the Evidence verdict and overall recommendation with `references/review-evidence.md`.
10. Prepare Review Evidence with `references/review-evidence.md`.
11. Ask the `geas-cli` adapter to record Review Evidence.
12. Return the Evidence ref, findings, remaining risks, verdict, overall recommendation, and not-covered scope to the caller.

### Review Plan

Before writing findings, create a concise plan that names:

- Target outputs and Evidence refs to inspect.
- Review focus items from the Task Contract and handoff.
- Review lenses to apply and omitted lenses with reasons.
- Review methods to use.
- Known risk areas from implementation and verification limits.
- Scope that will not be reviewed and why.

If the plan reveals missing target refs, missing Evidence refs, unreadable outputs, absent review focus, or a required User decision, stop before writing findings.

### Findings

Write a finding only when the User or caller can act on it. Each finding needs a specific affected ref and basis.

Use `Remaining Risks` for concerns that are real but not actionable as a review finding inside the current focus, or that need challenge, verification, or User Judgment rather than implementation rework.

### Record Failure

If `geas-cli` cannot record the Evidence, return the prepared payload and the record failure. Do not replace the missing Evidence ref with an informal review claim.

## Resources

| Resource | Use When |
| --- | --- |
| `references/review-evidence.md` | Writing Review Evidence, shaping findings, choosing verdict and recommendation, and reporting review stop reasons. |

## Gotchas

- Do not modify implementation outputs or apply fixes.
- Do not write Implementation Evidence, Verification Evidence, Challenger Evidence, Task Evidence, or User Judgment.
- Do not treat Review Evidence verdict or recommendation as User Judgment or Task acceptance.
- Do not rewrite Verification Evidence when coverage is weak; report the weakness as a finding, remaining risk, or recommendation.
- Do not mark the Evidence verdict `passed` when required review focus remains unreviewed, blocking findings exist, or material risks are unresolved.
- Do not file vague findings without affected refs and basis.
- Do not over-expand review beyond the Task Contract; surface serious out-of-focus risks as remaining risks or escalation recommendations.
- Do not claim security, accessibility, reliability, or UX coverage when the lens was only skimmed or the needed evidence is missing.
- Do not require repo root docs as execution prerequisites for a distributed Skill.

## Stop Conditions

Stop and return a handoff failure report when:

- A required `read_first` ref is missing or unreadable.
- The Task Contract, Implementation Evidence, Verification Evidence, task id, handoff focus, or target output refs are missing.
- No readable target output exists to review.
- Review focus is absent or cannot be inferred from the Task Contract and handoff.
- The next action would require implementation changes or verification reruns before a grounded review can be written.
- A required User or coordinator decision is needed before review can continue.
- `geas-cli` Evidence record does not report success.
- The next step belongs to implementation, verification, challenge, Task acceptance, or Mission closure.

## Boundary

`reviewing` inspects outputs and Evidence, records Review Evidence, and returns review findings and recommendation. It does not implement fixes, run the verifier role, challenge beyond the requested review focus, decide User acceptance, write Task Evidence, or close Missions.
