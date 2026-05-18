# Verification Evidence

## Purpose

Verification Evidence records what was actually checked against the Task Contract, what the checks showed, what could not be checked, and what verdict the verifier gives as agent-side judgment input.

Verification Evidence is not User Judgment, Task acceptance, Review Evidence, or Task Evidence.

## Payload Shape

```markdown
---
name: <mission-name>
task_id: <task-id>
evidence_type: verification
task_contract_ref: <task-contract-ref>
implementation_evidence_ref: <implementation-evidence-ref>
verdict: <passed|changes_requested|escalated>
---

## Summary

<Brief summary of verification result and main limits.>

## Environment

- <tool, runtime, service, connector, version, or execution condition used>

## Target

- <path, artifact ref, feature, output, or changed scope actually checked>

## Checks Performed

- VC-001: <command, inspection, comparison, runtime check, or artifact check>
  - Target: <target ref>
  - Result: <passed|failed|partial|not_checked|blocked>
  - Output: <important output, observation, or artifact ref>

## Criteria Results

### TC-AC-001: <acceptance criterion>

- Result: <passed|failed|partial|not_checked|blocked>
- Checks: <VC ids or "None">
- Basis: <why this result follows from the check output, observation, or blocked condition>

## Outputs

- <user-inspectable command output, test result, comparison result, artifact ref, or log summary>

## Deviations

- <difference from Task Contract, expected result, or implementation claim, or "None">

## Unverified Scope

- <scope not checked and reason, or "None">

## Recheck Needed

- <item needing fix, rerun, environment support, or User/coordinator decision, or "None">
```

## Section Rules

`Summary` states the verification outcome, important failures, blocked checks, and material unverified scope.

`Environment` names the actual verification environment: tools, versions, services, runtime conditions, connectors, secrets availability, and relevant setup limits.

`Target` lists only what was actually inspected or executed against.

`Checks Performed` uses stable ids such as `VC-001`. Include commands, inspections, comparisons, runtime checks, connector-backed checks, or artifact checks that were attempted. Prefer active tool-backed checks when they are available, safe, and covered by the agreed environment. For blocked or not checked items, include the reason instead of pretending output exists.

`Criteria Results` maps Task Contract acceptance criteria to results. Each criterion result must include `Result`, `Checks`, and `Basis`.

`Outputs` includes user-inspectable evidence: command output summaries, test result summaries, screenshots or logs when available, artifact refs, or comparison observations.

`Deviations` records differences from the Task Contract, expected result, or Implementation Evidence claim.

`Unverified Scope` lists checks or target areas not verified and why. This section is required even when the value is `None`.

`Recheck Needed` lists fixes, reruns, environment support, or decisions needed before the Task result can be judged with lower risk.

## Criteria Result Values

Use only these criterion result values:

| Result | Use When |
| --- | --- |
| `passed` | The criterion was checked and the observed basis satisfies it in the checked scope. |
| `failed` | The checked output does not satisfy the criterion. |
| `partial` | Some required part passed, but another part failed, was incomplete, or was not covered. |
| `not_checked` | The criterion was not checked even though it may be checkable later. |
| `blocked` | The criterion could not be checked because a required input, environment, service, secret, connector, tool, or decision was unavailable. |

Do not use `passed` for a criterion when the only basis is an assumption, skipped check, missing tool, unavailable service, or implementation claim.

## Verdict Rules

Use `passed` only when required acceptance criteria passed within the checked scope, required checks ran successfully, and no material unverified scope remains for the Task Contract criteria.

Use `changes_requested` when one or more checked criteria failed or are partial, and the next useful route is implementation rework or a verification rerun after a concrete fix.

Use `escalated` when verification is blocked by missing environment support, missing secrets, insufficient or conflicting criteria, unavailable target outputs, or a required User/coordinator decision. Also use `escalated` when unverified scope prevents a meaningful pass/fail verdict.

The verdict is agent-side judgment input. It is not User Judgment or Task acceptance.

## Record Gate

Before asking `geas-cli` to record Verification Evidence, confirm:

- Every required `read_first` ref was read.
- The Task Contract ref, Implementation Evidence ref, and task id match the handoff.
- Each relevant acceptance criterion has a `Criteria Results` entry.
- Each criterion result uses only `passed`, `failed`, `partial`, `not_checked`, or `blocked`.
- Command outputs and observations are summarized honestly.
- Safe, agreed verification tools were used when they could check a claim more directly than passive reading.
- Blocked and not checked items appear in `Unverified Scope` or `Recheck Needed`.
- The verdict follows the verdict rules.
- No implementation fix, review finding, Task result decision, or User Judgment is included.

Record with the existing runtime write surface:

```text
task evidence record --kind verification
```

If the CLI adapter requires a file path or task id argument, pass the prepared payload through that adapter without changing the Evidence meaning.

## Stop Report Shape

When verification stops before Evidence can be recorded, return:

```markdown
## Verification Stopped

- Task: <task-id or unknown>
- Reason: <missing ref, unreadable target, insufficient contract basis, unsafe check, required User decision, or record failure>
- Inputs Read: <refs read before stopping>
- Target Outputs: <refs or "None">
- Checks Not Run: <checks and reasons>
- Preserved Payload: <payload ref, inline payload, or "None">
- Suggested Route: <return to coordinator, revise Task Contract, prepare environment, rerun implementation, or retry verification>
```
