# Building Briefings

Use these shapes for User-facing building-stage briefings. Write in the User's conversation language. These briefings are conversation output, not Evidence, not User Judgment, and not runtime artifacts.

## Task Judgment

Use when Task phase is `awaiting_user_judgment`.

```text
**Task Judgment**
Task: {task_id}
Decision needed: decide whether to accept, revise, defer, or stop this Task result.

**Evidence**
- Contract: {task_contract_ref}
- Implementation: {implementation_evidence_ref_or_none}
- Verification: {verification_evidence_ref_or_none}
- Review: {review_evidence_ref_or_none}
- Challenger: {challenger_evidence_ref_or_none}

**Criteria**
- {criterion}: {satisfied | satisfied_with_limits | not_satisfied}. Basis: {evidence_refs}. Limit/risk: {short_text_or_none}

**Limits And Risks**
- Unverified scope: {items_or_none}
- Remaining risks: {items_or_none}

**Choices**
1. accepted - accept the Task result without listed limits.
2. accepted_with_limits - accept the Task result and record listed unverified scope or risks.
3. revise - request follow-up work, recheck, review, challenge, or Task Contract update.
4. deferred - decide later and preserve the current Task state.
5. stopped - stop without accepting this Task result.
```

## Accepted Task Closure

Use after User Judgment and Task Evidence are recorded for `accepted` or `accepted_with_limits`.

```text
**Task Closure**
Task: {task_id}
User decision: {decision}

**Recorded**
- User Judgment: {user_judgment_ref}
- Task Evidence: {task_evidence_ref}

**Accepted Limits**
- Unverified scope: {accepted_unverified_scope_or_none}
- Remaining risks: {accepted_remaining_risks_or_none}

**Next**
- {next_task_or_mission_step}
```

## Unaccepted Task Closure

Use after User Judgment records `revise`, `deferred`, or `stopped`.

```text
**Task Closure**
Task: {task_id}
User decision: {decision}

**Recorded**
- User Judgment: {user_judgment_ref}
- Task Evidence: none

**Unaccepted Work**
- Requested actions: {requested_actions_or_none}
- Remaining unaccepted work: {items_or_none}

**Next**
- {next_task_or_mission_step}
```

## Git Checkpoint

Use after accepted Task closure when reporting repository continuity.

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
