# Task Closure

Use this reference after the User has reviewed the Task Judgment Briefing and made a Task-level decision.

## Inputs

- Current Mission id.
- Current Task id.
- Latest Task Contract.
- Implementation Evidence.
- Verification Evidence.
- Review Evidence.
- Challenger Evidence when present.
- User's Task result decision.

## User Judgment Payload

Record the User's decision with:

```text
geas judgment record --target task-result --task <task-id> --from <path|->
```

Payload:

```yaml
decision: accepted
accepted_unverified_scope: []
accepted_remaining_risks: []
requested_actions: []
```

Allowed decisions:

- `accepted`
- `accepted_with_limits`
- `revise`
- `deferred`
- `stopped`

`accepted_unverified_scope` and `accepted_remaining_risks` contain only limits the User knowingly accepts. `requested_actions` contains next actions for revise, deferred, or stopped decisions.

## Accepted or Accepted With Limits

After User Judgment records `accepted` or `accepted_with_limits`, prepare Task Evidence and record:

```text
geas task evidence record --task <task-id> --kind task --from <path|->
```

Payload:

```yaml
summary: ""
user_judgment_summary: ""
criteria_results:
  - criterion: ""
    result: satisfied
    evidence_refs: []
    unverified_scope: []
    remaining_risks: []
accepted_unverified_scope: []
accepted_remaining_risks: []
```

Task Evidence should:

- Summarize the Task result.
- Reference User Judgment.
- Map each Task Contract acceptance criterion to Evidence refs.
- Include accepted unverified scope and remaining risks.
- Distinguish accepted limits from verification success.

Allowed criteria result values:

- `satisfied`: The criterion is satisfied without accepted limits.
- `satisfied_with_limits`: The criterion is closed only because the User knowingly accepts listed unverified scope or remaining risks.
- `not_satisfied`: The criterion is not closed. This can include failure, unverified scope, deferred judgment, or needed rework.

Successful recording closes the Task phase.

After accepted Task Evidence is recorded, load `git-checkpoint.md` and use the accepted Task Closure briefing plus Git Checkpoint briefing in `briefings.md`.

## Revise

When User Judgment is `revise`, choose the next phase based on `requested_actions`.

Task Contract update is not a Task phase. When the User requests a Task Contract update, record the revised Task Contract while the Task remains in `awaiting_user_judgment`, then use the transition that matches the requested follow-up work.

| Requested Action | Transition |
| --- | --- |
| Task Contract needs update | `geas task contract record --task <task-id> --from <path|->`, then one of the follow-up transitions below |
| Implementation needs changes | `geas task transition --to implementing --task <task-id>` |
| More verification needed | `geas task transition --to verifying --task <task-id>` |
| More review needed | `geas task transition --to reviewing --task <task-id>` |
| Challenge needed | `geas task transition --to challenging --task <task-id>` |
| Mission baseline needs review | `geas mission transition --to specifying` |

Before transition, brief the User on what will be retried or revised and which Evidence remains valid.

## Deferred

When User Judgment is `deferred`, preserve the current Task phase and record requested actions. Brief the User on what external input or timing is needed to resume using the unaccepted Task Closure Briefing. Do not write Task Evidence.

## Stopped

When User Judgment is `stopped`, record the decision and requested actions. Brief the User on what work remains unaccepted and what artifacts should be considered historical context using the unaccepted Task Closure Briefing. Do not write Task Evidence.

## Closure Quality Checklist

- User Judgment is recorded before Task Evidence.
- Task Evidence references concrete Evidence artifacts.
- Criteria results cover all Task Contract acceptance criteria.
- Accepted unverified scope and remaining risks come from recorded User Judgment. The Task Judgment Briefing may propose candidates, but it is not an accepted source.
- Remaining risks are visible.
- The next Mission or Task pointer is clear.
