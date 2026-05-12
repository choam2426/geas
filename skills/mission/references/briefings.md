# Briefings

Use this reference to keep the User oriented without replacing their review or judgment.

Briefings are conversation output. They help the User see current state, Evidence basis, limits, risks, and available choices in a terminal or conversation panel.

## Briefing Principles

- Write the full briefing in the User's conversation language, including headings, choice labels, recommendations, and status words, unless the User requests another language.
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

## Intake Sketch Briefing

Use during specifying after project pre-scan or whenever readiness gates are still open. This is not an artifact review and has no runtime recording choice.

Include:

- Current interpretation.
- Observed project or runtime facts.
- Candidate assumptions labeled as unconfirmed.
- Open readiness gates.
- One next gate-closing question.

Use this shape:

```text
**Intake Sketch**
Current interpretation: {one_sentence}

**Observed Facts**
- {repo_or_runtime_fact}

**Candidate Assumptions**
- {assumption}: unconfirmed

**Open Gates**
- {gate}: {what_is_missing_or_candidate_only}

**Next Question**
{one_gate_closing_question_with_options_or_free_response}
```

## Baseline Candidate Briefing

Use during specifying when readiness gates are filled and the User needs to decide whether this candidate should become the basis for a Mission Spec draft. This is still intake, not Mission Spec approval.

Include:

- Candidate Mission goal.
- Boundary.
- Evidence and review path.
- Decision ownership.
- Assumptions and risks.
- User choice to draft Mission Spec from the candidate or revise intake.

Use this shape:

```text
**Baseline Candidate**
Mission candidate: {one_sentence_goal}

**Boundary**
- In: {scope_in}
- Out: {scope_out}

**Evidence And Review Path**
- {verification_or_review_basis}

**Decision Ownership**
- Agent may decide: {delegated_decisions}
- Return to User: {user_owned_decisions}

**Assumptions And Risks**
- Assumptions: {items_or_none}
- Risks: {items_or_none}

**Question**
Should I draft the Mission Spec from this candidate, or revise the candidate first?
```

## Mission Spec Review Briefing

Use during specifying before recording Mission Spec.

This accepts or revises Mission Spec only. It is not Task or Mission result User Judgment, and it does not accept Mission Design or Task Contracts.

Include:

- Mission goal.
- Scope in and out.
- Acceptance criteria.
- Constraints, assumptions, and risks.
- Optional Challenger recommendation for the Spec draft.
- Explicit User choice: accept spec, revise spec, challenge spec, or stop.

Use this shape:

```text
**Mission Spec Review**
Mission: {mission_goal}
Decision needed: accept this Mission Spec, revise it, challenge it, or stop.

**Scope**
- In: {scope_in}
- Out: {scope_out}

**Acceptance Criteria**
- {criterion}

**Assumptions And Risks**
- Assumptions: {items_or_none}
- Risks: {items_or_none}

**Recommendation**
I recommend {accept_or_revise_or_challenge} because {basis}. This is agent-side context, not User Judgment.

**Choices**
1. accept spec - record this Mission Spec, then start Mission Design authoring.
2. revise spec - adjust goal, scope, criteria, constraints, assumptions, or risks before recording.
3. challenge spec - request a challenger role pass on this Mission Spec draft before recording.
4. stop - leave the Mission Spec draft unrecorded.
```

When recommending Challenger, name the specific ambiguity, risk, irreversibility, or delegation depth that justifies it.

## Mission Design Review Briefing

Use during specifying after Mission Spec acceptance and before recording Mission Design.

This accepts or revises Mission Design only. It does not accept Task Contracts and is not Task or Mission result User Judgment.

Include:

- Accepted Mission Spec reference or summary.
- Approach strategy.
- Alternatives considered.
- Key concepts.
- Task breakdown.
- Assumptions and risks created by the design.
- Explicit User choice: accept design, revise design, challenge design, return to spec, or stop.

Use this shape:

```text
**Mission Design Review**
Mission: {mission_goal}
Decision needed: accept this Mission Design, revise it, challenge it, return to Mission Spec, or stop.

**Basis**
- Mission Spec: {mission_spec_ref_or_summary}
- Draft source: {work_designer_result_ref | role_omitted_reason}
- Coordinator edits: {formatting_only | none | user_delegated_mechanical_edits}

**Approach**
- Summary: {plan_summary}
- Selected: {approach_strategy}
- Alternatives: {alternatives_or_none}
- Work-designer: {role_required_result_ref | role_omitted_with_reason}

**Plan Outline**
- {focus}: {purpose}. User-visible result: {user_visible_result}

**Decision Points**
- {decision_points_or_none}

**Assumptions And Risks**
- Assumptions: {items_or_none}
- Risks: {items_or_none}
- Change triggers: {items_or_none}

**Recommendation**
I recommend {accept_or_revise_or_challenge_or_return} because {basis}. This is agent-side context, not User Judgment.

**Choices**
1. accept design - record this Mission Design, then draft initial Task Contracts.
2. revise design - adjust summary, approach, plan outline, decision points, concepts, assumptions, risks, or change triggers before recording.
3. challenge design - request a challenger role pass on this Mission Design draft before recording.
4. return to spec - revise the accepted Mission Spec before continuing.
5. stop - leave the Mission Design draft unrecorded.
```

## Task Contract Review Briefing

Use during specifying after Mission Design acceptance and before recording initial Task Contracts.

This accepts or revises initial Task Contracts only. Initial contracts may be reviewed in one packet, but this approval is separate from Mission Spec and Mission Design approval.

Include:

- Accepted Mission Design reference or summary.
- One Task Card per initial Task.
- Coverage of Mission acceptance criteria.
- Verification and review focus.
- Dependencies and risks.
- Explicit User choice: accept task contracts, revise task contracts, return to design, or stop.

Use this shape:

```text
**Task Contract Review**
Mission: {mission_goal}
Decision needed: accept these Task Contracts, revise them, return to Mission Design, or stop.

**Basis**
- Mission Design: {mission_design_ref_or_summary}
- Draft source: {work_designer_task_candidates_ref | specifying_role_omitted_reason}
- Coordinator edits: {formatting_only | none | user_delegated_mechanical_edits}

**Task Cards**
- {task_id}: Goal: {goal}. Scope: {scope_summary}. Acceptance: {criteria_summary}. Verification: {checks_summary}. Review focus: {focus_summary}. Risk level: {low_medium_or_high}. Depends on: {dependencies_or_none}

**Coverage And Risks**
- Mission criteria coverage: {coverage_summary}
- Risks: {items_or_none}

**Recommendation**
I recommend {accept_or_revise_or_return} because {basis}. This is agent-side context, not User Judgment.

**Choices**
1. accept task contracts - record these Task Contracts, then run baseline readiness review.
2. revise task contracts - adjust Task scope, deliverables, acceptance, verification, review focus, risk level, or dependencies before recording.
3. return to design - revise the accepted Mission Design before continuing.
4. stop - leave the Task Contract drafts unrecorded.
```

## Baseline Readiness Briefing

Use during specifying after accepted Mission Spec, accepted Mission Design, and accepted initial Task Contracts are recorded, before entering building.

This is a transition readiness check. It does not approve a new baseline and does not replace any prior artifact review.

Include:

- Recorded Mission Spec, Mission Design, and Task Contract paths.
- Readiness blocker status.
- Transfer context for building.
- Recommended first Task.
- Explicit User choice: start building, hand off to a fresh session, return to spec, return to design, or return to task contracts.

Use this shape:

```text
**Baseline Readiness**
Mission: {mission_id_or_goal}
Decision needed: start building here, hand off to a fresh session, or return to a baseline artifact.

**Recorded Baseline**
- Mission Spec: {mission_spec_ref}
- Mission Design: {mission_design_ref}
- Task Contracts: {task_contract_refs}

**Readiness**
- Blockers: {items_or_none}
- Transfer context: {known_constraints_current_task_and_acceptance_summary}

**Next Task**
- {task_id}: {task_summary}

**Recommendation**
I recommend {start_building_or_return} because {basis}. This is agent-side context, not User Judgment.

**Choices**
1. start building - transition to building with the first recorded Task Contract.
2. handoff session - keep recorded baselines and prepare Session Handoff so building can resume in a fresh session.
3. return to spec - revise Mission Spec before building.
4. return to design - revise Mission Design before building.
5. return to task contracts - revise initial Task Contracts before building.
```

## Baseline Challenge Briefing

Use during specifying after the User agrees to a Challenger pass before recording the current Spec, Design, or Task Contract draft.

This is conversation output for User review. It is not Challenger Evidence, not User Judgment, not a runtime artifact, and not revised artifact content. Accepted findings go back to the current artifact author for revision before that artifact is recorded.

Include:

- Current draft type and reference.
- Challenge focus.
- Findings with basis.
- Draft changes recommended.
- User choices: incorporate, revise the finding, challenge deeper, or discard.

Use this shape:

```text
**Baseline Challenge**
Mission: {mission_goal}
Decision needed: decide which challenge findings should return to the current artifact author.

**Challenged Draft**
- Type: {mission_spec | mission_design | task_contract}
- Draft: {summary_or_ref}

**Challenge Focus**
- {focus_item}

**Findings**
- {finding}: Basis: {basis}. Suggested draft change: {change}. Risk if ignored: {risk}

**Recommendation**
I recommend incorporating {finding_ids_or_none} because {basis}. This is agent-side context, not User Judgment.

**Choices**
1. incorporate - send the selected findings to the current artifact author for a revised draft.
2. revise finding - adjust the finding or proposed draft change before sending it to the author.
3. challenge deeper - request another focused challenger role pass before recording the current draft.
4. discard - leave the current draft unchanged for this finding.
```

When a finding is incorporated, the revised artifact from the current artifact author should carry the resulting assumption, scope boundary, risk, acceptance criterion, Task split, or verification/review focus. Do not record the briefing itself as runtime Evidence.

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

## Accepted Task Closure Briefing

Use after User Judgment and Task Evidence are recorded for `accepted` or `accepted_with_limits`.

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

## Unaccepted Task Closure Briefing

Use after User Judgment records `revise`, `deferred`, or `stopped`.

This briefing is conversation output. It does not claim Task Evidence was recorded.

Include:

- User decision.
- User Judgment path.
- Requested actions.
- Work that remains unaccepted.
- Evidence that remains useful as context.
- Safest resume point.

Use this shape:

```text
**Task Closure**
Task: {task_id}
User decision: `{decision}`

**Recorded**
- User Judgment: {user_judgment_ref}
- Task Evidence: none

**Unaccepted Work**
- Requested actions: {requested_actions_or_none}
- Remaining unaccepted work: {items_or_none}

**Useful Context**
- Evidence still useful: {evidence_refs_or_none}
- Safest resume point: {artifact_or_phase}

**Next**
- {next_task_or_mission_step}
```

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

## Session Handoff Briefing

Use after specifying records accepted baselines and the User chooses `handoff session` from Baseline Readiness.

This briefing is conversation output. It is not Evidence, not User Judgment, and not a runtime artifact.

Include:

- Mission id and current stage.
- Recorded Mission Spec and Mission Design paths.
- Initial Task Contract paths.
- First Task id and phase.
- Memory refs that should be read on resume.
- The next procedure to run.
- A short resume prompt for a fresh session.

Use this shape:

```text
**Session Handoff**
Mission: {mission_id}
Stage: {stage}
Decision: building will resume in a fresh session from the recorded baseline.

**Recorded Baseline**
- Mission Spec: {mission_spec_ref}
- Mission Design: {mission_design_ref}
- Task Contracts: {task_contract_refs}

**Resume Point**
- First Task: {task_id} / {task_phase}
- Next procedure: {next_procedure}
- Memory to read: {memory_refs_or_none}

**Why Handoff Helps**
- {context_risk_or_none}

**Fresh Session Prompt**
Resume Mission `{mission_id}` from the recorded Geas runtime state. Read the latest Mission Spec, Mission Design, first Task Contract, Task State if present, relevant Memory, and then continue with `{next_procedure}` using the available Geas entrypoint.

```

## Git Checkpoint Briefing

Use after an accepted Task closes and git checkpoint status is available.

This briefing reports repository continuity status. It is not Evidence and not User Judgment.

Include:

- Task id.
- Whether a commit was created, recommended, skipped, or blocked.
- Commit hash when created.
- Changed paths considered.
- Uncommitted or unrelated changes.
- User decision needed when staging is ambiguous.

Use this shape:

```text
**Git Checkpoint**
Task: {task_id}
State: {created | recommended | skipped | blocked}
Decision needed: {decision_or_none}

**Repository**
- Commit: {commit_hash_or_none}
- Task-owned changes: {paths_or_none}
- Unrelated changes: {paths_or_none}

**Next**
- {next_step}
```

## Decision Language

Use this distinction consistently:

- "Evidence indicates..." for agent-side basis.
- "I recommend..." for agent-side recommendation.
- "You can choose..." for available User Judgment options.
- "User Judgment records..." only after the User has decided.
- "Ready for User review" when Evidence is available but User has not decided.
- "Recorded" only after a CLI write succeeds.
