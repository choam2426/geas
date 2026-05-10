# Specifying Briefings

Use these shapes for User-facing specifying briefings. Write in the User's conversation language. These briefings are conversation output, not Evidence, not User Judgment, and not runtime artifacts.

## Intake Sketch

Use after project pre-scan or whenever readiness gates are still open. This is not an artifact review and has no runtime recording choice.

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

## Baseline Candidate

Use when readiness gates are filled and the User needs to decide whether this candidate should become the basis for a Mission Spec draft. This is still intake, not Mission Spec approval.

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

## Mission Spec Review

Use before recording Mission Spec.

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
1. accept spec - record this Mission Spec, then draft Mission Design.
2. revise spec - adjust goal, scope, criteria, constraints, assumptions, or risks before recording.
3. challenge spec - request a challenger role pass on this Mission Spec draft before recording.
4. stop - leave the Mission Spec draft unrecorded.
```

## Mission Design Review

Use after Mission Spec acceptance and before recording Mission Design.

```text
**Mission Design Review**
Mission: {mission_goal}
Decision needed: accept this Mission Design, revise it, challenge it, return to Mission Spec, or stop.

**Basis**
- Mission Spec: {mission_spec_ref_or_summary}

**Approach**
- Selected: {approach_strategy}
- Alternatives: {alternatives_or_none}
- Work-designer: {role_required_result_ref | role_omitted_with_reason}

**Task Breakdown**
- {task_id}: {task_summary}; depends on {dependencies_or_none}

**Assumptions And Risks**
- Assumptions: {items_or_none}
- Risks: {items_or_none}

**Choices**
1. accept design - record this Mission Design, then draft initial Task Contracts.
2. revise design - adjust approach, task structure, dependencies, concepts, assumptions, or risks before recording.
3. challenge design - request a challenger role pass on this Mission Design draft before recording.
4. return to spec - revise the accepted Mission Spec before continuing.
5. stop - leave the Mission Design draft unrecorded.
```

## Task Contract Review

Use after Mission Design acceptance and before recording initial Task Contracts. Initial Task Contracts may be reviewed in one packet, but this approval is separate from Mission Spec and Mission Design approval.

```text
**Task Contract Review**
Mission: {mission_goal}
Decision needed: accept these Task Contracts, revise them, return to Mission Design, or stop.

**Basis**
- Mission Design: {mission_design_ref_or_summary}

**Task Cards**
- {task_id}: Goal: {goal}. Scope: {scope_summary}. Acceptance: {criteria_summary}. Verification: {checks_summary}. Review focus: {focus_summary}. Depends on: {dependencies_or_none}

**Coverage And Risks**
- Mission criteria coverage: {coverage_summary}
- Risks: {items_or_none}

**Choices**
1. accept task contracts - record these Task Contracts, then run baseline readiness review.
2. revise task contracts - adjust Task scope, deliverables, acceptance, verification, review focus, or dependencies before recording.
3. return to design - revise the accepted Mission Design before continuing.
4. stop - leave the Task Contract drafts unrecorded.
```

## Baseline Readiness

Use after accepted Mission Spec, accepted Mission Design, and accepted initial Task Contracts are recorded, before entering building.

```text
**Baseline Readiness**
Mission: {mission_id_or_goal}
Decision needed: start building, return to a baseline artifact, or stop.

**Recorded Baseline**
- Mission Spec: {mission_spec_ref}
- Mission Design: {mission_design_ref}
- Task Contracts: {task_contract_refs}

**Readiness**
- Blockers: {items_or_none}
- Transfer context: {known_constraints_current_task_and_acceptance_summary}

**Next Task**
- {task_id}: {task_summary}

**Choices**
1. start building - transition to building with the first recorded Task Contract.
2. return to spec - revise Mission Spec before building.
3. return to design - revise Mission Design before building.
4. return to task contracts - revise initial Task Contracts before building.
5. stop - keep recorded baselines and do not enter building.
```

## Baseline Challenge

Use after a Challenger pass on the current Spec, Design, or Task Contract draft.

```text
**Baseline Challenge**
Mission: {mission_goal}
Decision needed: decide which challenge findings should change the current draft.

**Challenge Focus**
- {focus_item}

**Findings**
- {finding}: Basis: {basis}. Suggested draft change: {change}. Risk if ignored: {risk}

**Choices**
1. incorporate - apply the selected findings to the current draft.
2. revise finding - adjust the finding or proposed draft change before applying it.
3. challenge deeper - request another focused challenger role pass before recording the current draft.
4. discard - leave the current draft unchanged for this finding.
```

## Session Handoff

Use when a fresh session would lower building risk after baseline recording.

```text
**Session Handoff**
Mission: {mission_id}
Stage: {stage}
Decision needed: continue here or resume building in a fresh session.

**Recorded Baseline**
- Mission Spec: {mission_spec_ref}
- Mission Design: {mission_design_ref}
- Task Contracts: {task_contract_refs}

**Resume Point**
- First Task: {task_id} / {task_phase}
- Next procedure: {next_procedure}
- Memory to read: {memory_refs_or_none}

**Resume Prompt**
Resume this Geas Mission from the recorded runtime state. Read the latest Mission Spec, Mission Design, current Task Contract, Task State, relevant Memory, and continue with {next_procedure}.
```
