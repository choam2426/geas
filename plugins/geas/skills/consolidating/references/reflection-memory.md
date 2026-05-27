# Reflection And Ledger Reference

Use this reference when converting Task and Mission findings into Task Memory, Debt Ledger, Memory, or Continuity Ledger updates.

## Routing

| Signal | Destination | Rule |
| --- | --- | --- |
| Later Task needs context inside the same Mission | Task Memory | Use `task-memory.md`; User accepts intent, scope, criteria, and risk items. |
| User accepted cost or remaining burden | Debt Ledger | Use `.geas/debts.md`; cite User Judgment or Mission Evidence. |
| Reusable operating lesson | Memory | Use `.geas/memory/common.md` or role file. |
| Resume point, open question, next action, handoff note | Continuity Ledger | Use `.geas/continuity.md`. |

## Debt Ledger Item

```markdown
### DEBT-001: <title>

- Status: open | resolved | dropped
- Category: accepted_risk | unverified_scope | quality_debt | remaining_gap | follow_up_candidate
- Summary: <accepted cost>
- Impact: <future maintenance, verification, operation, or change cost>
- Source Refs: <Evidence, Task Evidence, Mission Evidence refs>
- Accepted In Ref: <User Judgment or Mission Evidence ref>
- Revisit When: <condition>
- Resolved By Refs: <refs or empty>
```

## Memory Item

```markdown
### MEM-001: <title>

- Status: active | superseded | dropped
- Guideline: <future operating rule>
- Applies When: <condition>
- Rationale: <why it reduces future cost>
- Source Refs: <Evidence, Mission Evidence, User Judgment refs>
```

## Continuity Item

```markdown
### CONT-001: <title>

- Status: open | closed
- Kind: current_state | accepted_decision | tradeoff | open_question | next_action | handoff_note
- Summary: <portable resume note>
- Details: <decision context>
- Next Action: <next action or "">
- Source Refs: <Mission Spec, Mission Plan, Task Contract, Evidence, User Judgment, Task Evidence, Mission Evidence refs>
- Closed By Refs: <refs or empty>
```

## Rules

- Do not promote every observation to long-term Memory.
- Debt needs User acceptance.
- Continuity notes should make restart cheaper, not duplicate every artifact.
- Ledger writes are separate from Mission Evidence and Task Evidence.
