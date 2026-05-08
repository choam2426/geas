# Mission Closure

Use this reference after consolidating prepares Mission-level judgment input and the User makes a Mission-level decision.

## Inputs

- Current Mission id.
- Latest Mission Spec.
- Latest Mission Design.
- Accepted Task Evidence for all Mission-relevant Tasks.
- Role Evidence needed to understand gaps or risks.
- Consolidating output: Mission criteria comparison, design deltas, gaps, debts, follow-ups, memory candidates, unverified scope, remaining risk.
- User's Mission result decision.

## User Judgment

Record Mission result User Judgment with:

```text
geas judgment record --target mission-result --from <path|->
```

Payload:

```yaml
decision: accepted
accepted_unverified_scope: []
accepted_remaining_risks: []
requested_actions: []
```

If decision is `revise`, transition to the stage the User chooses:

- Additional Task work: `geas mission transition --to building --task <task-id>`
- Mission baseline revision: `geas mission transition --to specifying`

If decision is `deferred` or `stopped`, record User Judgment and brief the User on resume or stop conditions. Do not write Mission Evidence.

## Memory Recording

When Mission User Judgment is `accepted` or `accepted_with_limits`, record approved Memory updates before Mission Evidence.

Common Memory:

```text
geas memory record --scope common --from <path|->
```

Role Memory:

```text
geas memory record --scope role --role <role> --from <path|->
```

Memory payload items must be based on existing runtime artifacts: role Evidence, Task Evidence, User Judgment, or prior Mission Evidence. Current Mission-level synthesis may guide which Memory candidates to record, but it is not itself a `source_refs` target unless it already exists as a runtime artifact.

Payload:

```yaml
items:
  - guideline: ""
    applies_when: []
    source_refs: []
```

## Mission Evidence

Record Mission Evidence after accepted Mission User Judgment and approved Memory updates:

```text
geas mission evidence record --from <path|->
```

Payload:

```yaml
summary: ""
user_judgment_summary: ""
mission_criteria_results:
  - criterion: ""
    result: satisfied
    evidence_refs: []
    unverified_scope: []
    remaining_risks: []
mission_design_deltas: []
accepted_unverified_scope: []
accepted_remaining_risks: []
gaps: []
debts: []
follow_ups: []
reflection_summary: ""
memory_updates: []
```

Mission Evidence should be the first artifact to read when reopening the Mission later. It should summarize without hiding Task-level detail; use references for detail.

Allowed mission criteria result values:

- `satisfied`: The criterion is satisfied without accepted limits.
- `satisfied_with_limits`: The criterion is closed only because the User knowingly accepts listed unverified scope, remaining risks, gaps, or debts.
- `not_satisfied`: The criterion is not closed. This can include failure, unverified scope, deferred judgment, or additional Task work needed.

## Closure Quality Checklist

- Mission result User Judgment exists before Mission Evidence.
- Every Mission acceptance criterion has a result and Evidence refs.
- Gaps, debts, and follow-ups are separated.
- Accepted unverified scope and remaining risks match User Judgment.
- Memory updates reference existing runtime artifacts.
- Mission Evidence records what changed in Mission Design during execution.
- Final briefing tells the User where Mission Evidence is stored and what remains outside this Mission.
