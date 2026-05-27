# Verification Evidence

Use this reference after Task-scoped verification. Verification Evidence records checks, outputs, criteria mapping, unverified scope, recheck needs, and an agent-side verdict.

Verification Evidence is Role Evidence. It is not User Judgment, Task Evidence, Review Evidence, Challenger Evidence, or acceptance.

## Runtime Path

Write to:

```text
.geas/missions/<mission-id>/tasks/<task-id>/verification-evidence.md
```

`verification-evidence.md` is the current Verification Evidence for this Task scope. If replacing existing Evidence would discard context that has not been reflected in Task Evidence, Task Memory, or Continuity Ledger, stop and return the payload.

## Frontmatter

```yaml
---
verdict: passed | changes_requested | escalated
---
```

Use `passed` only when required checks passed and material criteria are covered. Use `changes_requested` when checked results fail criteria or correction is needed. Use `escalated` when missing criteria, target, environment, or evidence prevents responsible judgment input.

## Payload Shape

```markdown
## Summary

<Verification outcome, failures, blocked checks, and material unverified scope.>

## Environment

- <tool, version, service, fixture, dataset, operating condition>

## Target

- <artifact, file, feature, output, or changed scope actually checked>

## Checks Performed

- VC-001: <command, search, inspection, comparison, or run>
  - Result: <passed, failed, blocked>
  - Output refs: <logs, terminal output, screenshots, artifacts>

## Criteria Results

- TC-AC-001:
  - Result: <passed, failed, partial, not_checked, blocked>
  - Checks: <VC ids>
  - Evidence refs: <outputs>
  - Unverified scope: <scope or `None.`>
  - Remaining risks: <risks or `None.`>

## Outputs

- <output ref>: <why it matters>

## Deviations

- <deviation from Task Contract, accepted Task Direction, or expected result, or `None.`>

## Unverified Scope

- <scope not checked and reason>

## Recheck Needed

- <item requiring rerun or additional check, or `None.`>

## Reflection Candidates

- Task Memory: <candidate or `None.`>
- Memory: <candidate or `None.`>
- Debt Ledger: <candidate or `None.`>
- Continuity Ledger: <candidate or `None.`>
```

## Checklist

- Each Task Contract criterion is mapped or explicitly marked `not_checked`.
- Failed checks and unverified scope are separate.
- Commands and outputs are reproducible enough for User review.
- Verdict is not phrased as User Judgment.

## Write Failure

If direct writing fails, return the complete payload, intended path, reason, and needed next action.
