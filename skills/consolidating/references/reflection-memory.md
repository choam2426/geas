# Reflection Memory

Use this reference to prepare reflection summary and Memory candidates.

## Reflection Inputs

Use:

- Implementation Evidence `reflection_candidates`.
- Verification Evidence recheck patterns and unverified scope.
- Review Evidence findings and remaining risks.
- Challenger Evidence repeat risks.
- Task Evidence accepted limits.
- Mission judgment input gaps, debts, follow-ups.
- User Judgment requested actions.

Mission-level synthesis can help select Memory candidates, but Memory `source_refs` must point to already existing runtime artifacts. For the current Mission, prefer role Evidence, Task Evidence, and User Judgment. Do not use current Mission Evidence as a source because Memory is recorded before Mission Evidence.

## Reflection Categories

| Category | Meaning |
| --- | --- |
| `memory` | Reusable operating guidance for future Missions or roles. |
| `debt` | Future cost knowingly accepted inside this Mission result. |
| `gap` | Difference between Mission baseline and result. |
| `follow_up` | New work outside the current Mission closure. |

## Memory Candidate Shape

Prepare candidates for `mission` to record after Mission User Judgment:

```yaml
scope: common
role: ""
guideline: ""
applies_when: []
source_refs: []
reason: ""
```

`scope` is `common` or `role`. For role memory, set `role` to one of:

- `orchestrator`
- `work-designer`
- `implementer`
- `verifier`
- `reviewer`
- `challenger`

## Promotion Criteria

Promote a reflection candidate to Memory only when it:

- Comes from Evidence or User Judgment.
- Is repeatable beyond this Mission.
- Would change future judgment or behavior.
- Is specific enough to apply.
- Has source references to already existing runtime artifacts.

Keep one-off observations in Mission Evidence reflection summary, not Memory.

## Common Examples

```yaml
scope: common
role: ""
guideline: "When a Task changes CLI command names, include docs/cli.md consistency checks in verification."
applies_when:
  - "Task touches CLI surface or Skill instructions that mention CLI commands."
source_refs:
  - "tasks/task-002/review-evidence-001.yaml"
reason: "Review found command drift that verification did not catch."
```

```yaml
scope: role
role: reviewer
guideline: "For docs-only Tasks, review terminology against docs/definition.md before assessing clarity."
applies_when:
  - "Reviewer has documentation lens."
source_refs:
  - "tasks/task-001/task-evidence.yaml"
reason: "User review cost increased when terms were used loosely."
```

## Return to Mission

Return:

- Reflection summary.
- Memory candidates.
- Debt notes.
- Gap notes.
- Follow-up candidates.
- Existing runtime artifact source refs for each Memory candidate.

`mission` asks the User to accept Mission result and then records approved Memory updates before Mission Evidence.
