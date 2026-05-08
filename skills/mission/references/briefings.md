# Briefings

Use this reference to keep the User oriented without replacing their review or judgment.

Briefings are conversation output. They help the User see current state, Evidence basis, limits, risks, and available choices in a terminal, Codex, or Claude Code panel.

## Briefing Principles

- Write in the User's conversation language.
- Use compact Markdown headings and short bullets.
- Put the decision needed near the top when the User must choose.
- Separate facts, Evidence basis, agent recommendation, and User decision.
- Surface unverified scope and remaining risk plainly.
- Mention artifact paths when they lower review cost.
- Keep lines short enough to scan in a narrow terminal.
- Use numbered choices when the User must pick an action.
- Use `none` when a section has no item, instead of omitting the section.

## Boundaries

- Do not replace User review or User Judgment.
- Do not present agent verdicts as acceptance.
- Do not say the agent "completed" the work; say what Evidence is ready for User review.
- Do not use YAML or JSON for User-facing judgment briefings.
- Do not use wide tables; they wrap poorly in terminals.
- Do not hide criteria that are not satisfied or are satisfied only with limits behind a summary.

## Common Output Shape

Use this shape when a section below does not need a more specific template:

```text
**{Briefing Name}**
State: {current_state}
Decision needed: {decision_or_none}

**Basis**
- {artifact_or_evidence_ref} - {why_it_matters}

**Limits And Risks**
- Unverified scope: {items_or_none}
- Remaining risks: {items_or_none}

**Recommendation**
I recommend {next_step} because {basis}. This is agent-side context, not User Judgment.

**Choices**
1. {choice} - {effect}
2. {choice} - {effect}
```

## Current Status Briefing

Use after state inspection.

Include:

- Active Mission id and stage, or that no Mission is active.
- Current Task id and phase when relevant.
- Latest accepted baseline artifacts.
- Most recent Evidence or User Judgment.
- Detected drift.
- Next recommended procedure.

Use this shape:

```text
**Current Status**
Mission: {mission_id_or_none}
Stage: {stage_or_none}
Task: {task_id_or_none} / {phase_or_none}

**Basis**
- Baseline: {baseline_refs_or_none}
- Latest Evidence: {evidence_refs_or_none}
- Latest User Judgment: {judgment_ref_or_none}
- Memory used: {memory_refs_or_none}

**Drift**
- {drift_or_none}

**Next**
I recommend {next_procedure} because {basis}.
```

If drift exists, name the safest recovery basis before recommending a procedure.

## Baseline Review Briefing

Use during specifying before recording accepted baselines.

This is baseline acceptance, not Task or Mission result User Judgment.

Include:

- Mission goal.
- Scope in and out.
- Acceptance criteria.
- Task breakdown.
- Notable assumptions.
- Risks and optional Challenger recommendation.
- Explicit User choice: accept baseline, revise, challenge, split, or stop.

Use this shape:

```text
**Baseline Review**
Mission: {mission_goal}
Decision needed: accept this baseline, revise it, challenge it, split it, or stop.

**Scope**
- In: {scope_in}
- Out: {scope_out}

**Acceptance Criteria**
- {criterion}

**Task Plan**
- {task_id}: {task_summary}; depends on {dependencies_or_none}

**Assumptions And Risks**
- Assumptions: {items_or_none}
- Risks: {items_or_none}

**Recommendation**
I recommend {accept_or_revise_or_challenge} because {basis}.

**Choices**
1. accept baseline - record Mission Spec, Mission Design, and initial Task Contracts.
2. revise baseline - adjust scope, criteria, tasks, or constraints before recording.
3. challenge baseline - run an adversarial baseline pass before recording.
4. split Mission - separate independent acceptance boundaries.
5. stop - leave drafts unrecorded.
```

When recommending Challenger, name the specific ambiguity, risk, irreversibility, or delegation depth that justifies it.

## Baseline Challenge Briefing

Use during specifying after the User agrees to a Challenger pass before baseline recording.

This is conversation output for User review. It is not Challenger Evidence, not User Judgment, and not a runtime artifact. Accepted findings are incorporated into Mission Spec, Mission Design, or Task Contract drafts before recording.

Include:

- Baseline parts challenged.
- Challenge focus.
- Findings with basis.
- Draft changes recommended.
- User choices: incorporate, revise the finding, challenge deeper, or discard.

Use this shape:

```text
**Baseline Challenge**
Mission: {mission_goal}
Decision needed: decide which challenge findings should change the baseline draft.

**Challenged Baseline**
- Mission Spec draft: {summary_or_ref}
- Mission Design draft: {summary_or_ref}
- Task Contract drafts: {summary_or_refs}

**Challenge Focus**
- {focus_item}

**Findings**
- {finding}: Basis: {basis}. Suggested baseline change: {change}. Risk if ignored: {risk}

**Recommendation**
I recommend incorporating {finding_ids_or_none} because {basis}. This is agent-side context, not User Judgment.

**Choices**
1. incorporate - apply the selected findings to the baseline drafts.
2. revise finding - adjust the finding or proposed baseline change before applying it.
3. challenge deeper - run another focused pass before recording the baseline.
4. discard - leave the baseline draft unchanged for this finding.
```

When a finding is incorporated, the later baseline artifact should carry the resulting assumption, scope boundary, risk, acceptance criterion, Task split, or verification/review focus. Do not record the briefing itself as runtime Evidence.

## Task Judgment Briefing

Use when Task phase is `awaiting_user_judgment`.

This briefing is conversation output for User review. It is not Task Evidence, not User Judgment, and not a runtime artifact.

Build it from the latest Task Contract and current role Evidence. Keep it readable in a terminal or code assistant panel.

Include these sections:

- Task Contract reference.
- Deliverables.
- Evidence basis: Implementation, Verification, Review, and Challenger Evidence when present.
- Criteria status for every Task Contract acceptance criterion.
- Unverified scope and remaining risks the User would accept if they close the Task.
- Agent recommendation as context, not a decision.
- User choices: `accepted`, `accepted_with_limits`, `revise`, `deferred`, `stopped`.

Use this shape:

```text
**Task Judgment**
Task: {task_id}
Decision needed: {one_sentence}

**Evidence**
- Contract: {task_contract_ref}
- Implementation: {implementation_evidence_ref} - {one_sentence}
- Verification: {verification_evidence_ref} - verdict `{verdict}`; {key_limit_or_result}
- Review: {review_evidence_ref} - verdict `{verdict}`; {key_finding_or_result}
- Challenger: {challenger_evidence_ref_or_none}

**Criteria**
- {criterion}: {satisfied | satisfied_with_limits | not_satisfied}. Basis: {evidence_refs}. Limit/risk: {short_text_or_none}

**Limits And Risks**
- Unverified scope: {items_or_none}
- Remaining risks: {items_or_none}

**Recommendation**
I recommend `{decision_option}` because {basis}. This is agent-side context, not User Judgment.

**Choices**
1. `accepted` - accept the Task result without listed limits.
2. `accepted_with_limits` - accept the Task result and record the listed unverified scope or risks.
3. `revise` - request follow-up work, recheck, review, challenge, or Task Contract update.
4. `deferred` - decide later and preserve the current Task state.
5. `stopped` - stop without accepting this Task result.
```

Phrase accepted limits clearly:

```text
If you accept this result, you also accept this unverified scope: {unverified_scope}. The remaining risks are: {remaining_risks}.
```

When Verification, Review, or Challenger Evidence has `changes_requested` or `escalated`, make the revise or escalation path visible before listing acceptance options.

## Task Closure Briefing

Use after User Judgment and Task Evidence are recorded.

Include:

- User decision.
- User Judgment path.
- Task Evidence path.
- Accepted unverified scope and remaining risks.
- Criteria marked `satisfied`, `satisfied_with_limits`, or `not_satisfied`.
- Next Task or Mission transition.

Use this shape:

```text
**Task Closure**
Task: {task_id}
User decision: `{decision}`

**Recorded**
- User Judgment: {user_judgment_ref}
- Task Evidence: {task_evidence_ref}

**Accepted Limits**
- Unverified scope: {accepted_unverified_scope_or_none}
- Remaining risks: {accepted_remaining_risks_or_none}

**Criteria Summary**
- {criterion}: {result}; basis {evidence_refs}

**Next**
- {next_task_or_mission_step}
```

If the User chose `revise`, `deferred`, or `stopped`, brief what remains unaccepted and which artifact is the safest resume point.

## Mission Judgment Briefing

Use after consolidating prepares Mission-level judgment context.

This is conversation output for Mission-level User review. It is not Mission Evidence, not User Judgment, and not a runtime artifact.

Include:

- Mission Spec acceptance criteria.
- Accepted Task Evidence summary.
- Mission Design deltas.
- Gap, debt, follow-up candidates.
- Accepted or proposed unverified scope and remaining risks.
- Memory candidates.
- User choices: `accepted`, `accepted_with_limits`, `revise`, `deferred`, `stopped`.

Use this shape:

```text
**Mission Judgment**
Mission: {mission_id}
Decision needed: decide whether the Mission result can close.

**Evidence**
- Mission Spec: {mission_spec_ref}
- Mission Design: {mission_design_ref}
- Task Evidence: {task_evidence_refs}
- Role Evidence used: {role_evidence_refs_or_none}

**Mission Criteria**
- {criterion}: {satisfied | satisfied_with_limits | not_satisfied}. Basis: {evidence_refs}. Limit/risk: {short_text_or_none}

**Gaps, Debt, Follow-ups**
- Gaps: {items_or_none}
- Debt: {items_or_none}
- Follow-ups: {items_or_none}

**Limits And Risks**
- Unverified scope: {items_or_none}
- Remaining risks: {items_or_none}

**Memory Candidates**
- {candidate_or_none}

**Recommendation**
I recommend `{decision_option}` because {basis}. This is agent-side context, not User Judgment.

**Choices**
1. `accepted` - close the Mission without listed limits.
2. `accepted_with_limits` - close and record accepted limits, risks, gaps, or debt.
3. `revise` - request more Task work, Task Contract update, or Mission baseline revision.
4. `deferred` - decide later and preserve the current Mission state.
5. `stopped` - stop without accepting the Mission result.
```

Do not rename an in-scope gap as a follow-up to make the Mission look ready to close.

## Mission Closure Briefing

Use after Mission Evidence is recorded.

Include:

- Mission Evidence path.
- User decision summary.
- Accepted unverified scope and remaining risks.
- Memory updates recorded.
- Follow-ups left outside the Mission.

Use this shape:

```text
**Mission Closure**
Mission: {mission_id}
User decision: `{decision}`

**Recorded**
- Mission Evidence: {mission_evidence_ref}
- Memory updates: {memory_refs_or_none}

**Accepted Limits**
- Unverified scope: {accepted_unverified_scope_or_none}
- Remaining risks: {accepted_remaining_risks_or_none}

**Left Outside This Mission**
- Gaps: {gaps_or_none}
- Debt: {debt_or_none}
- Follow-ups: {followups_or_none}

**Next**
- {next_recommended_mission_or_none}
```

## Decision Language

Use this distinction consistently:

- "Evidence indicates..." for agent-side basis.
- "I recommend..." for agent-side recommendation.
- "You can choose..." for available User Judgment options.
- "User Judgment records..." only after the User has decided.
- "Ready for User review" when Evidence is available but User has not decided.
- "Recorded" only after a CLI write succeeds.
