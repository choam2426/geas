# Baseline Challenge

## Purpose

Baseline challenge pressure-tests Mission Spec, Mission Design, Pre-build Design Surface decisions, or Task Contract candidates before acceptance. It returns findings for User briefing and artifact revision. It is not runtime Evidence.

Use this reference when `challenging` is called from `specifying` or another baseline authoring flow.

## Output Shape

```markdown
## Baseline Challenge

- Target: <Mission Spec candidate, Mission Design candidate, Pre-build Design Surface decision, Task Contract candidate, or revision target>
- Challenge Focus: <assumption, scope boundary, acceptance criteria, verification method, design-surface decision, task slicing, risk, tradeoff, or User concern>
- Status: <findings|no_material_findings|stopped>

## Findings

### BC-001: <short finding title>

- Target artifact: <candidate ref or section>
- Risk type: <assumption|misuse|scope boundary|acceptance criteria|verification gap|task slicing|operational risk|tradeoff|repeat risk>
- Concern: <specific baseline risk>
- Basis: <candidate text, missing decision, contradiction, or reasoning basis>
- User decision needed: <decision or "None">
- Suggested revision owner: <specifying or artifact author>

## User Decisions Needed

- <decision to brief to the User, or "None">

## Suggested Revision Route

- <Mission Spec revision, Mission Design revision, Pre-build Design Surface decision, Task Contract revision, intake question, challenge retry, or "None">

## Limits

- <challenge scope not covered and reason, or "None">
```

If there are no findings, write:

```markdown
## Findings

None.
```

## Rules

- Challenge only baseline candidates, Pre-build Design Surface decisions, or accepted baseline revisions supplied in `read_first`.
- Return findings to the caller; do not record them as Challenger Evidence.
- Do not rewrite Mission Spec, Mission Design, Pre-build Design Surface outputs, or Task Contract candidates here.
- Keep findings tied to User acceptance cost, ambiguity, verification ability, design-surface decision quality, scope boundary, task slicing, or later execution risk.
- Frame findings as risk hypotheses with a plausible failure path and a decision or revision that would reduce the risk.
- Mark a finding as a User decision when it cannot be resolved by artifact wording alone.
- Preserve limits when the provided candidate is incomplete or the challenge focus cannot be fully covered.

## Stop Report Shape

When baseline challenge cannot proceed, return:

```markdown
## Baseline Challenge Stopped

- Target: <target or unknown>
- Reason: <missing candidate, unreadable ref, absent challenge focus, required User decision, or insufficient context>
- Inputs Read: <refs read before stopping>
- Challenge Not Performed: <focus or scope and reasons>
- Suggested Route: <return to specifying, ask intake question, provide baseline candidate, or retry challenge>
```
