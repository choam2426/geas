# Challenger Evidence

## Purpose

Challenger Evidence records hidden risks that remain visible only after pressuring the Task Contract, changed outputs, Implementation Evidence, Verification Evidence, and Review Evidence from a devil's-advocate and long-term operations perspective.

Challenger Evidence is not User Judgment, Task acceptance, Review Evidence, Verification Evidence, or Task Evidence.

## Payload Shape

```markdown
---
name: <mission-name>
task_id: <task-id>
evidence_type: challenger
task_contract_ref: <task-contract-ref>
implementation_evidence_ref: <implementation-evidence-ref>
verification_evidence_ref: <verification-evidence-ref>
review_evidence_ref: <review-evidence-ref>
verdict: <passed|changes_requested|escalated>
---

## Target

- <Task Contract, changed output, artifact ref, Implementation Evidence, Verification Evidence, or Review Evidence challenged>

## Challenge Focus

- <assumption, scope boundary, verification gap, operational risk, tradeoff, repeat risk, or caller focus>

## Challenge Methods

- <method used: assumption challenge, trace check, failure-mode scan, scope-boundary pressure test, verification-gap scan, operational-risk scan, tradeoff check, repeat-risk scan>

## Findings

### CH-001: <short risk title>

- Risk type: <assumption|misuse|scope boundary|verification gap|operational risk|tradeoff|repeat risk>
- Severity: <critical|major|minor|note>
- Concern: <specific risk or hidden failure mode>
- Basis: <evidence, target ref, missing evidence, contradiction, or reasoning basis>
- Escalation: <User decision, rework, deeper check, baseline revision, or other next action>

## User Decisions Needed

- <decision that must be carried to User, or "None">

## Deeper Checks Needed

- <verification, review, challenge, or investigation still needed, or "None">

## Overall Recommendation

<Recommended next action for the caller or Task result judgment input.>
```

If there are no findings, write:

```markdown
## Findings

None.
```

## Section Rules

`Target` lists every artifact, output, or Evidence ref actually challenged.

`Challenge Focus` states the risk focus used. Do not imply that unfocused risk areas were covered.

`Challenge Methods` records how pressure testing was performed.

`Findings` contains concrete risks that can affect Task result judgment, rework, deeper checks, or User decision cost. Each finding needs a stable id, risk type, severity, concern, basis, and escalation.

`User Decisions Needed` lists decisions that cannot be resolved by more implementation, verification, review, or challenge alone.

`Deeper Checks Needed` lists checks or investigations that should happen before lower-risk judgment.

`Overall Recommendation` summarizes the next action. It is challenger input, not User Judgment.

## Challenge Quality

Write findings as risk hypotheses:

- What can go wrong.
- Why it is plausible from the target, Evidence, or missing Evidence.
- Who or what would be affected.
- What decision, deeper check, rework, or baseline revision would reduce the risk.

Keep challenge blameless and system-focused. The target is the evidence chain, contract boundary, assumption, verification gap, or operating context, not the author.

## Risk Types

Use these short risk labels unless the caller provides a more specific focus:

| Risk type | Use When |
| --- | --- |
| `assumption` | The Task result depends on an unstated, weak, or untested assumption. |
| `misuse` | The result can be used incorrectly, abused, or pushed into an unsafe path. |
| `scope boundary` | The work may exceed, miss, or blur Task Contract scope. |
| `verification gap` | Evidence does not cover a claim, acceptance criterion, risk, or important path. |
| `operational risk` | Failure modes, rollout, observability, recovery, performance, cost, or support burden are unclear. |
| `tradeoff` | The Task accepted one cost or quality dimension without enough explicit judgment. |
| `repeat risk` | The same ambiguity, failure mode, or maintenance burden is likely to recur in later Tasks. |

## Verdict Rules

Use `passed` only when the required challenge focus was pressured, no material hidden risk remains, and no material User decision or deeper check is needed before Task result judgment.

Use `changes_requested` when findings point to implementation rework, Evidence correction by the owning role, verification rerun, review rerun, or clearer Task result briefing before judgment.

Use `escalated` when the risk requires User decision, Mission baseline review, Task Contract revision, challenge scope cannot be covered, or unresolved hidden risk prevents a meaningful pass or rework recommendation.

The verdict is agent-side judgment input. It is not User Judgment or Task acceptance.

## Overall Recommendation Rules

Write the recommendation as a short next-action statement:

- `Proceed to Task result judgment input` when challenge passed and limits are disclosed.
- `Request implementation rework` when findings require output changes.
- `Request verification rerun` when the risk depends on missing or weak verification.
- `Request review rerun` when ordinary review coverage is missing or contradicted.
- `Route to specifying` when the Task Contract or Mission baseline must change.
- `Carry User decision into judgment input` when User must explicitly accept, reject, or choose a tradeoff.
- `Stop pending deeper checks` when evidence is too weak for responsible judgment.

## Record Gate

Before asking `geas-cli` to record Challenger Evidence, confirm:

- Every required `read_first` ref was read.
- The Task Contract ref, Implementation Evidence ref, Verification Evidence ref, Review Evidence ref, and task id match the handoff.
- Challenge focus and methods are listed.
- Findings have risk type, concern, basis, and escalation, or `Findings` is `None`.
- User decisions needed and deeper checks needed are listed even when the value is `None`.
- Verdict follows the verdict rules.
- Overall recommendation is challenger input, not User Judgment.
- No implementation fix, verification rewrite, review rewrite, artifact revision, Task result decision, or User Judgment is included.

Record with the existing runtime write surface:

```text
task evidence record --kind challenger
```

If the CLI adapter requires a file path or task id argument, pass the prepared payload through that adapter without changing the Evidence meaning.

## Stop Report Shape

When Task-scoped challenge stops before Evidence can be recorded, return:

```markdown
## Challenge Stopped

- Task: <task-id or unknown>
- Reason: <missing ref, unreadable target, absent challenge focus, required User decision, or record failure>
- Inputs Read: <refs read before stopping>
- Target Outputs: <refs or "None">
- Challenge Not Performed: <focus or scope and reasons>
- Preserved Payload: <payload ref, inline payload, or "None">
- Suggested Route: <return to coordinator, prepare missing Evidence, revise Task Contract, request User decision, or retry challenge>
```
