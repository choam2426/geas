# Criteria Challenge Reference

Use this reference when challenging Mission Spec, Mission Plan, Task Direction, or Task Contract candidates before User acceptance.

This output is a handoff result for the owning skill. It is not runtime Evidence unless a Task-scoped Challenger Evidence artifact is separately written.

## Output Shape

```markdown
## Target

- Type: <Mission Spec | Mission Plan | Task Direction | Task Contract>
- Refs read: <candidate refs or inline draft names>

## Findings

### CC-001: <short title>

- Risk type: <scope | criteria | assumption | verification | reviewability | user decision | continuity | operational>
- Severity: <low | medium | high>
- Concern: <specific risk>
- Basis: <artifact text, missing criterion, conflict, or unsupported assumption>
- Impact on User judgment: <why this changes decision cost>
- Recommended route: <revise artifact, ask User, add Task Direction, split Task, add verification, accept as risk, or no action>

## User Decisions Needed

- <decision needed before acceptance, or none>

## Deeper Checks Needed

- <additional inspection needed, or none>

## Recommendation

<accept candidate, revise before acceptance, ask User, or escalate to another role>
```

## Rules

- Challenge only the target supplied in the handoff.
- Do not rewrite the candidate.
- Do not invent User preferences to close a finding.
- Keep findings tied to a concrete criterion, missing input, artifact conflict, or User decision cost.
- If no material finding exists, say that and list the limits of the challenge.
