# Mission Spec

Use this reference to draft a Mission Spec payload that the User can review and accept as the Mission baseline.

## Purpose

Mission Spec captures what the User wants, why it matters, what is included, what is excluded, how success will be judged, and what risks or constraints govern the Mission.

The draft is not a runtime artifact. After User review, record the accepted payload with:

```text
geas mission spec record --from <path|->
```

## Payload Shape

```yaml
name: ""
goal: ""
background: ""
completion_criteria: []
included_scope: []
excluded_scope: []
acceptance_criteria: []
constraints: []
assumptions: []
risks: []
```

All keys are required. Use empty lists only when there is genuinely no content. Use field text to expose uncertainty rather than hiding it.

## Field Guidance

| Field | Write |
| --- | --- |
| `name` | A short label that identifies the Mission. |
| `goal` | The desired end state in User terms. |
| `background` | Why this Mission exists now and what problem it addresses. |
| `completion_criteria` | Mission-level conditions that make the Mission ready for User Judgment. |
| `included_scope` | Work surfaces and outcomes included in this Mission. |
| `excluded_scope` | Adjacent work deliberately kept outside this Mission. |
| `acceptance_criteria` | Observable criteria the User can use to judge the result. |
| `constraints` | Conditions that must hold while executing the Mission. |
| `assumptions` | Explicit assumptions used to interpret the User request. |
| `risks` | Things that could increase review cost, rework, safety risk, or long-term cost. |

## Acceptance Criteria Rules

Make criteria:

- Outcome-focused.
- Observable or testable.
- Independent enough to evaluate separately.
- Connected to User value or review cost.
- Specific about threshold, artifact, behavior, or evidence when possible.

Avoid criteria that only say the work is "done", "clean", "proper", "good", or "complete". Translate those words into observable results.

## Completion Criteria vs Acceptance Criteria

Completion criteria describe when the Mission is ready for Mission-level User Judgment.

Acceptance criteria describe what the User will judge about the result.

Example:

```yaml
completion_criteria:
  - "All planned Skill and Agent prompt files exist and pass structural validation."
  - "Task Evidence for each implementation Task has been accepted by the User."
acceptance_criteria:
  - "The mission skill can route specifying, building, optional challenge, and consolidation using prompt-level handoff."
  - "Every role Evidence type has a corresponding Skill procedure and Agent role prompt."
```

## Review Before Recording

Before recording, present the draft and ask the User to accept or revise it. Include:

- One sentence summary.
- Scope in/out.
- Acceptance criteria.
- Assumptions that affect implementation.
- Risks that may require Challenger.

Record only the accepted baseline.
