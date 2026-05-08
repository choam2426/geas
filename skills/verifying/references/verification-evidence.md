# Verification Evidence

Use this reference to write Verification Evidence.

## Payload Shape

```yaml
summary: ""
environment: ""
target: []
checks_performed: []
criteria_results:
  - criterion: ""
    result: passed
    basis: ""
outputs: []
deviations: []
unverified_scope: []
recheck_needed: []
verdict: passed
```

Allowed `criteria_results.result` values:

- `passed`
- `failed`
- `partial`
- `not_checked`
- `blocked`

Allowed `verdict` values:

- `passed`
- `changes_requested`
- `escalated`

## Verdict Rules

Use `passed` when:

- Required verification checks were performed.
- Required acceptance criteria have `passed` criteria results.
- Any `partial`, `not_checked`, or `blocked` result is outside the Task's required acceptance basis and is named as scope outside verification rather than success.
- No required check or required criterion has remaining unverified scope.

Use `changes_requested` when:

- A criterion failed.
- A check exposed a fixable issue.
- A required check could not run but can be rerun after changes.
- A required criterion has unverified scope that can be closed within the Task.
- Recheck is needed before User can reasonably accept.

Use `escalated` when:

- The Task Contract is insufficient to judge the result.
- The unverified scope is central and cannot be closed within the Task as written.
- A User or Mission-level tradeoff is needed.

## Evidence Writing

`summary` should state the overall result and biggest limit.

`environment` should include relevant OS, runtime, test runner, browser, data, or build context.

`target` should name actual files, artifacts, commands, UI surfaces, or behavior checked.

`checks_performed` should be concrete:

```text
Ran npm test -- --runInBand; inspected docs/skills.md references; searched for retired product prefixes.
```

`outputs` should include concise command results, log references, screenshots, or artifact paths. Do not paste massive logs; summarize and name where to find details.

`unverified_scope` should explain both what and why:

```text
Could not run browser interaction checks because no local dev server exists for this docs-only Task.
```

## Criteria Mapping

For each acceptance criterion:

- Copy or clearly reference the criterion.
- State result.
- Name the basis.
- Add unverified scope or recheck need when result is not fully passed.

## Quality Checklist

- Every performed check has a result.
- Every skipped check has a reason.
- Criteria results cover the Task Contract acceptance criteria.
- Verdict follows the rules above.
- User can see what was actually verified.
