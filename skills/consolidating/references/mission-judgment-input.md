# Mission Judgment Input

Use this reference to prepare Mission-level User Judgment input.

## Inputs

- Latest Mission Spec.
- Latest Mission Design.
- Accepted Task Evidence for required Tasks.
- Relevant role Evidence when Task Evidence alone is insufficient.
- Task and Mission User Judgments.
- Known follow-up or memory candidates.

## Output Packet

Return this packet to `mission`:

```yaml
mission_summary: ""
criteria_results:
  - criterion: ""
    result: satisfied
    evidence_refs: []
    unverified_scope: []
    remaining_risks: []
mission_design_deltas: []
gaps: []
debts: []
follow_ups: []
accepted_unverified_scope_candidates: []
accepted_remaining_risks_candidates: []
recommended_user_options: []
agent_recommendation: ""
```

This packet is judgment input, not Mission Evidence.

## Procedure

1. List Mission Spec acceptance criteria.
2. For each criterion, find supporting Task Evidence.
3. Mark result as `satisfied`, `satisfied_with_limits`, or `not_satisfied`.
4. Carry over unverified scope and remaining risks.
5. Compare actual Task sequence and outputs to Mission Design.
6. Classify differences as design deltas, gaps, debts, or follow-ups.
7. Prepare User options.

Use `not_satisfied` for any criterion that cannot be closed as satisfied or satisfied_with_limits. This includes failed, unverified, deferred, or additional-work-needed criteria. Put the reason in `unverified_scope`, `remaining_risks`, `gaps`, `debts`, or `follow_ups` as appropriate.

## Gap, Debt, Follow-Up

Use these distinctions:

- `gap`: Mission baseline promised it, and the result does not fully satisfy it.
- `debt`: User may accept the result now while knowingly carrying future cost.
- `follow_up`: Valuable work outside the current Mission's accepted scope.

Do not rename an in-scope gap as follow-up to make the Mission look complete. If User accepts a gap with known cost, represent it as accepted unverified scope, accepted remaining risk, or debt as appropriate.

## User Options

Always offer options that preserve User responsibility:

- `accepted`: Mission result satisfies the baseline enough to close.
- `accepted_with_limits`: Mission can close with listed unverified scope, risks, gaps, or debts accepted.
- `revise`: More Task work, Task Contract update, or Mission baseline revision is needed.
- `deferred`: User will decide later.
- `stopped`: User ends the Mission without accepting the result.

## Quality Checklist

- Every Mission acceptance criterion has a result.
- Evidence refs point to Task Evidence or role Evidence.
- Design deltas are visible.
- Gap, debt, and follow-up are not mixed.
- Agent recommendation is clearly separate from User options.
