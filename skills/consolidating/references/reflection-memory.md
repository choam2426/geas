# Reflection And Memory Reference

## Purpose

Use this reference to classify Mission closure candidates as gap, debt, follow-up, or memory, and to prepare Debt and Memory record payloads after User acceptance.

## Classification

| Candidate | Test | Closure handling |
| --- | --- | --- |
| Gap | Mission baseline expected it, but the accepted result did not fully satisfy or verify it. | Show in Mission result input and Mission Evidence. Route to `building` or `specifying` when the User chooses revision. |
| Debt | The User accepts a current-result cost or risk that will create future maintenance, verification, operation, or change cost. | Record in Debt Ledger after Mission result User Judgment accepts it. |
| Follow-up | The item is outside current Mission scope and can become new future work. | Show as follow-up candidate and summarize in Mission Evidence after acceptance. |
| Memory | The Mission produced repeatable operational guidance that should change future agent judgment or behavior. | Record in Common or Role Memory after Mission result User Judgment accepts it. |

## Candidate Shapes

### Gap Candidate

```markdown
- Title: <short gap name>
- Baseline refs: <Mission Spec, Mission Design, or Task Contract refs>
- Evidence refs: <Task Evidence or role Evidence refs>
- Unverified scope: <scope, or none>
- Remaining risks: <risks, or none>
- Route if not accepted: <building | specifying | defer | stop>
```

### Debt Candidate

```yaml
status: open
title: "<short debt title>"
summary: "<what is accepted and why it remains as cost>"
impact: "<future maintenance, verification, operation, or change cost>"
source_refs:
  - "<Task Evidence or role Evidence ref>"
accepted_in_ref: "<Mission result User Judgment ref>"
revisit_when:
  - "<condition or trigger>"
resolved_by_refs: []
```

For new debt records, do not include `debt_id`; the runtime writer assigns it. For an existing debt item, preserve the debt id and use the update path supported by the `geas-cli` adapter.

### Follow-Up Candidate

```markdown
- Title: <short follow-up name>
- Why outside this Mission: <scope basis>
- Source refs: <Task Evidence, role Evidence, or User Judgment refs>
- Suggested owner or next stage: <optional>
```

### Memory Candidate

```yaml
items:
  - guideline: "<repeatable future operating guidance>"
    applies_when:
      - "<condition where this guidance applies>"
    source_refs:
      - "<Evidence or Mission result User Judgment ref>"
```

Prepare separate payloads for common Memory and role Memory. Role Memory requires the target role before recording.

## Rules

- Classify in-scope unmet Mission work as a gap before considering debt or follow-up.
- Classify debt only when the User accepts the current result with known future cost or risk.
- Classify memory only when the lesson is repeatable beyond this Mission.
- Classify follow-up only when the item is outside the accepted Mission scope.
- Keep debt impact concrete; vague inconvenience is not enough for a debt record.
- Keep memory actionable; a historical note is not Memory.
- Source refs must point to the Evidence, Task Evidence, or User Judgment that exposed the candidate.
- Do not use the current Mission Evidence as a Memory source ref; Memory is recorded before Mission Evidence in this closure flow.
- Memory and Debt are recorded after Mission result User Judgment, not during Task execution.
- A Memory item is not a Debt item, and a Debt item is not a Memory item.

## Record Gates

Debt:

- Mission result User Judgment ref exists.
- User accepted the debt candidate.
- Payload has `status`, `title`, `summary`, `impact`, `source_refs`, `accepted_in_ref`, `revisit_when`, and `resolved_by_refs`.
- New debt payload omits `debt_id`.

Memory:

- Mission result User Judgment ref exists.
- User accepted the memory candidate.
- Target scope is `common` or `role`.
- Role Memory has a role name.
- Each item has `guideline`, `applies_when`, and `source_refs`.

## Stop Report

If Debt or Memory cannot be recorded, return:

- candidate type and title
- accepted User Judgment ref
- prepared payload
- record command purpose
- failure output
- whether Mission Evidence must wait
