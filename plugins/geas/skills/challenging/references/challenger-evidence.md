# Challenger Evidence

Use this reference for Task-scoped challenge after reading Task Contract, outputs, and available Role Evidence. Challenger Evidence pressure-tests hidden assumptions, scope boundaries, verification gaps, long-term costs, and User-decision traps.

Challenger Evidence is Role Evidence. It is not implementation, verification, review, Task Evidence, User Judgment, or acceptance.

## Runtime Path

Write to:

```text
.geas/missions/<mission-id>/tasks/<task-id>/challenger-evidence.md
```

`challenger-evidence.md` is the current Challenger Evidence for this Task scope. If replacing existing Evidence would discard context that has not been reflected in Task Evidence, Task Memory, or Continuity Ledger, stop and return the payload.

## Frontmatter

```yaml
---
verdict: passed | changes_requested | escalated
---
```

Use `passed` only when no material hidden risk blocks User judgment input. Use `changes_requested` when rework or deeper checks are needed. Use `escalated` when a User decision or criteria revision is needed before responsible judgment input.

## Payload Shape

```markdown
## Target

- <Task Contract, outputs, and Role Evidence challenged>

## Challenge Focus

- <hidden assumption, scope boundary, verification gap, long-term cost, user decision, or continuity focus>

## Challenge Methods

- <trace check, assumption challenge, failure-mode scan, criteria gap scan, continuity scan>

## Findings

### CH-001: <short title>

- Risk type: <scope, criteria, verification, operation, maintenance, data, user decision, continuity, other>
- Severity: <critical, high, medium, low>
- Concern: <risk or gap>
- Basis: <artifact refs and reasoning>
- Escalation: <rework, deeper check, Task Contract revision, Mission Plan revision, User decision, or accept risk>

If there are no findings, write `None.`

## User Decisions Needed

- <decision needed before acceptance, or `None.`>

## Deeper Checks Needed

- <verification, review, domain check, or external check needed, or `None.`>

## Overall Recommendation

<continue to User judgment, rework, rerun verification, rerun review, revise criteria, or ask User.>

## Reflection Candidates

- Task Memory: <candidate or `None.`>
- Memory: <candidate or `None.`>
- Debt Ledger: <candidate or `None.`>
- Continuity Ledger: <candidate or `None.`>
```

## Checklist

- Findings affect User judgment, rework, deeper checks, criteria revision, or continuity cost.
- Findings cite basis and affected refs.
- Challenge output is not treated as User Judgment.

## Write Failure

If direct writing fails, return the complete payload, intended path, reason, and needed next action.
