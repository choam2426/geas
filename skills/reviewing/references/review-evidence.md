# Review Evidence

## Purpose

Review Evidence records how the reviewer inspected changed outputs and role Evidence, what findings the User should see before Task result judgment, what review coverage is missing, what risks remain, and what next action the reviewer recommends.

Review Evidence is not User Judgment, Task acceptance, Verification Evidence, Challenger Evidence, or Task Evidence.

## Payload Shape

```markdown
---
name: <mission-name>
task_id: <task-id>
evidence_type: review
task_contract_ref: <task-contract-ref>
implementation_evidence_ref: <implementation-evidence-ref>
verification_evidence_ref: <verification-evidence-ref>
verdict: <passed|changes_requested|escalated>
---

## Summary

<Brief summary of review result, major findings, and remaining risks.>

## Target

- <changed output, artifact ref, file, feature, Implementation Evidence, or Verification Evidence reviewed>

## Review Focus Used

- <review focus item from Task Contract or handoff>

## Review Coverage

### Covered

- <scope actually reviewed>

### Not Covered

- <scope not reviewed and reason, or "None">

## Review Methods

- <method used: output inspection, diff review, Evidence consistency review, risk review, contract fit check, usability review, maintainability review, etc.>

## Findings

### RV-001: <short finding title>

- Finding: <specific issue or concern>
- Severity: <critical|major|minor|note>
- Category: <contract fit|correctness|evidence gap|maintainability|usability|risk|documentation|other>
- Affected refs: <paths, artifact refs, Evidence refs, or output refs>
- Basis: <review observation, Evidence gap, contract mismatch, or verification result>
- Recommendation: <next action for this finding>

## Remaining Risks

- <risk that remains after review, or "None">

## Overall Recommendation

<Recommended next action for the caller or User Judgment input.>
```

If there are no findings, write:

```markdown
## Findings

없음.
```

## Section Rules

`Summary` states the review outcome, blocking findings, material risks, and not-covered scope.

`Target` lists the outputs and Evidence actually reviewed. Include Implementation Evidence and Verification Evidence refs when they were part of the review.

`Review Focus Used` lists the Task Contract review focus and any handoff-specific focus actually used.

`Review Coverage` separates `Covered` and `Not Covered`. Do not imply that unreviewed scope was reviewed.

`Review Methods` records how review was performed, including reading order, comparison basis, review lenses used, and Evidence consistency checks.

`Findings` contains actionable items the User should see before Task result judgment. Each finding needs a stable id, severity, category, affected refs, basis, and recommendation.

`Remaining Risks` captures risks that remain after review but are not direct review findings, including risks that need challenge, verification, or User decision.

`Overall Recommendation` summarizes the next action. It is reviewer input, not User Judgment.

## Review Lenses

Choose lenses from the Task Contract, handoff focus, changed outputs, and role Evidence. Use only lenses that can be reviewed with the available targets and Evidence; put omitted or under-supported lenses in `Review Coverage` or `Remaining Risks`.

| Lens | Look For |
| --- | --- |
| `contract fit` | Scope, acceptance criteria, deliverables, excluded work, and review focus alignment. |
| `correctness` | Behavior, edge cases, data handling, regression risk, and mismatch with implementation or verification claims. |
| `security/privacy` | Authentication, authorization, input handling, secrets, sensitive data exposure, unsafe defaults, and abuse paths. |
| `reliability/operability` | Failure modes, recovery, observability, performance risk, resource use, rollout risk, and operational burden. |
| `UI/UX/accessibility` | User goal fit, system status visibility, consistency, error prevention/recovery, cognitive load, keyboard/screen reader concerns, and accessible alternatives. |
| `maintainability` | Complexity, readability, naming, cohesion, coupling, unnecessary generality, documentation, and future change cost. |
| `Evidence sufficiency` | Whether Implementation Evidence and Verification Evidence are specific, grounded, complete enough, and honest about unverified scope. |

When a lens exposes material risk but cannot be reviewed deeply inside this handoff, record it as `Remaining Risks` and recommend the next route.

## Finding Severity

Use these severity labels:

| Severity | Use When |
| --- | --- |
| `critical` | The Task result is likely unsafe, wrong, or outside contract unless fixed before judgment. |
| `major` | The User should normally request changes before accepting the Task result. |
| `minor` | The issue is real and actionable, but acceptance may still be reasonable with limits. |
| `note` | The item is useful context or a low-risk improvement, not a blocker. |

## Verdict Rules

Use `passed` only when the required review focus was covered, no blocking finding remains, Evidence is sufficient for User Judgment, and no material remaining risk requires User acceptance.

Use `changes_requested` when findings point to implementation rework, Evidence correction by the owning role, or verification rerun before Task result judgment.

Use `escalated` when review cannot responsibly recommend pass or rework because scope, criteria, Evidence, target outputs, authority, or risk requires coordinator or User decision. Also use `escalated` when challenge is needed before judgment.

The verdict is agent-side judgment input. It is not User Judgment or Task acceptance.

## Overall Recommendation Rules

Write the recommendation as a short next-action statement:

- `Proceed to Task result judgment input` when review passed and risks are disclosed.
- `Request implementation rework` when findings require output changes.
- `Request verification rerun` when findings depend on missing or weak verification.
- `Route to specifying` when the Task Contract must change.
- `Request challenge` when hidden-risk pressure testing is needed before User Judgment.
- `Stop pending User decision` when authority or acceptance risk needs User choice first.

## Record Gate

Before asking `geas-cli` to record Review Evidence, confirm:

- Every required `read_first` ref was read.
- The Task Contract ref, Implementation Evidence ref, Verification Evidence ref, and task id match the handoff.
- Review focus used is listed.
- Covered and not-covered scope are listed.
- Review lenses used or omitted are visible through `Review Methods`, `Review Coverage`, or `Remaining Risks`.
- Findings have affected refs and basis, or `Findings` is `None`.
- Remaining risks are listed even when the value is `None`.
- Verdict follows the verdict rules.
- Overall recommendation is reviewer input, not User Judgment.
- No implementation fix, verification rewrite, challenge finding, Task result decision, or User Judgment is included.

Record with the existing runtime write surface:

```text
task evidence record --kind review
```

If the CLI adapter requires a file path or task id argument, pass the prepared payload through that adapter without changing the Evidence meaning.

## Stop Report Shape

When review stops before Evidence can be recorded, return:

```markdown
## Review Stopped

- Task: <task-id or unknown>
- Reason: <missing ref, unreadable target, absent review focus, required User decision, or record failure>
- Inputs Read: <refs read before stopping>
- Target Outputs: <refs or "None">
- Review Not Performed: <scope and reasons>
- Preserved Payload: <payload ref, inline payload, or "None">
- Suggested Route: <return to coordinator, revise Task Contract, prepare missing Evidence, rerun verification, request challenge, or retry review>
```
