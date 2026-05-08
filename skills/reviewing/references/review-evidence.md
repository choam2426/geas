# Review Evidence

Use this reference to write Review Evidence.

## Payload Shape

```yaml
summary: ""
target: []
review_focus_used: []
scope_in: []
scope_out: []
review_methods: []
findings:
  - finding: ""
    severity: ""
    basis: ""
    recommendation: ""
remaining_risks: []
verdict: passed
overall_recommendation: ""
```

Allowed `verdict` values:

- `passed`
- `changes_requested`
- `escalated`

## Review Method

Review should answer:

- Does the result stay inside Task Contract scope?
- Do deliverables match acceptance criteria?
- Does Verification Evidence support the claims it makes?
- Are there missing checks that matter to User acceptance?
- Are terms, schemas, commands, paths, and responsibilities consistent with docs?
- Did implementation create maintainability or operational risks?
- Are there User-level tradeoffs that need explicit judgment?

## Findings

A finding needs:

- Specific issue.
- Severity or priority.
- Basis a User or future agent can inspect.
- Local recommendation.

Severity can be:

- `critical`: blocks User acceptance or creates high-risk wrong behavior.
- `major`: likely rework, regression, or misleading Evidence.
- `minor`: quality or clarity issue that may be presented for User Judgment with limits.
- `note`: useful context without requested change.

Use empty `findings: []` when no finding exists. Then use `remaining_risks` and `scope_out` to make review limits visible.

## Verdict Rules

Use `passed` when:

- Review focus was meaningfully covered.
- No finding requires change before User can reasonably judge.
- Remaining risks are low, explicit, and ready for User judgment.
- No required review focus has remaining unreviewed scope that the User would need to accept as a limit.

Use `changes_requested` when:

- A concrete issue should be fixed before User acceptance.
- Evidence is materially insufficient but fixable within the Task.
- Scope drift needs correction.
- Required review focus was not covered and can be reviewed within the Task.

Use `escalated` when:

- The issue exceeds the Task Contract.
- User or Mission-level tradeoff is required.
- Risk cannot be resolved by local changes.

## Lens Handling

Apply each lens as a focus layer, not as a new role.

Examples:

- `documentation`: terminology, structure, reader burden, stale references.
- `software`: code correctness, tests, regression, maintainability.
- `runtime`: artifact transitions, state consistency, resume behavior.
- `security`: permissions, secrets, input validation, data exposure.
- `compatibility`: CLI, schema, API, migration, backwards compatibility.
- `ux`: flows, affordances, error recovery, accessibility.

## Quality Checklist

- Review Evidence names what was actually reviewed.
- Findings include basis and recommendation.
- Scope out is explicit.
- Verdict does not replace User Judgment.
- Recommendation is phrased as input to `mission` and User.
