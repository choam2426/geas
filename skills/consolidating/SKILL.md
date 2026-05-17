---
name: consolidating
description: Synthesizes accepted Task Evidence against the Mission baseline, prepares Mission result User Judgment input, and records Mission closure artifacts after User Judgment. Use when a Mission is ready for consolidation, accepted Task Evidence must be compared to Mission Spec and Mission Design, or Debt, Memory, and Mission Evidence closure records need guarded coordination. Do not use for Task implementation, role Evidence, Task Evidence, baseline drafting, deciding User Judgment, or closing a Mission without User acceptance.
---

# Consolidating

## Job

Coordinate Mission closure from accepted Task Evidence through Mission result User Judgment, accepted Debt and Memory records, and Mission Evidence. Keep Mission result input, User Judgment, Debt, Memory, and Mission Evidence separate while preserving traceability back to Mission criteria and Task Evidence.

## Operating Stance

Act as an evidence-synthesizing closer.

- Read the accepted baseline and accepted Task Evidence before summarizing.
- Compare results to the Mission baseline instead of declaring completion from Task status.
- Surface gaps, unverified scope, remaining risks, debt, and follow-up candidates in decision-ready form.
- Classify reflection items conservatively: in-scope unmet work is a gap before it is anything else.
- Treat Mission acceptance as a User decision, not an agent verdict, CLI result, or Task state.
- Preserve Mission closure context so the Mission can be reopened from the final Evidence.

## Workflow

### Normal

1. Read the current Mission id, accepted Mission Spec, accepted Mission Design, accepted Task Evidence refs, Task result User Judgment refs, relevant role Evidence refs, current Debt Ledger refs, and current Memory refs when available.
2. Confirm the current Mission stage is `consolidating` before preparing Mission result records.
3. Confirm each Task Evidence ref is tied to a recorded Task result User Judgment with `accepted` or `accepted_with_limits`.
4. Compare accepted Task Evidence to Mission Spec acceptance criteria and Mission Design expectations.
5. Organize Mission criteria results, Mission Design deltas, gaps, accepted Task unverified scope, accepted Task remaining risks, and follow-up candidates.
6. Prepare Debt and Memory candidates with `references/reflection-memory.md`.
7. Prepare Mission result judgment input with `references/mission-acceptance-input.md`.
8. Brief the User in chunks when the input is long or decision-heavy, then present a final summary for Mission result decision.
9. After the User provides a Mission result decision, prepare the Mission result User Judgment payload with `references/mission-acceptance-input.md`, then ask the `geas-cli` adapter to record it.
10. If the recorded decision is `accepted` or `accepted_with_limits`, record User-accepted Debt candidates, then User-accepted Memory candidates, then prepare Mission Evidence with `references/mission-evidence.md`.
11. Ask the `geas-cli` adapter to record Mission Evidence after required Debt and Memory records are complete or explicitly absent.
12. Return the Mission Evidence ref, recorded Debt refs, recorded Memory refs, follow-up candidates, and closure summary.

### Revision

- If the User decision is `revise`, record the Mission result User Judgment, then choose the narrowest route from `Requested Actions`.
- For additional work inside existing accepted Task Contracts, route back to `building` with the relevant Task Evidence, role Evidence, gaps, and requested actions.
- For new Tasks, Task Contract changes, or Mission baseline changes, route to `specifying` with the accepted baseline refs, consolidation input, gaps, and requested actions.
- For `deferred` or `stopped`, record the Mission result User Judgment when possible, preserve the consolidation input and next decision point, and stop without Mission Evidence.
- Do not turn a gap into a follow-up, debt, or memory item to avoid revising the Mission path.

### Briefing

- For long or decision-heavy Mission result input, show 2-3 related items at a time.
- Good chunks are Mission summary and design deltas, criteria results and Evidence refs, gaps and accepted limits, reflection candidates, and final choices.
- Each chunk includes current synthesis, decision needed, choices or revision options, and next step.
- Treat chunk confirmation as provisional review input, not Mission result User Judgment.
- Present a final summary before preparing User Judgment, Debt, Memory, or Mission Evidence payloads.

### Record Failure

If `geas-cli` cannot record User Judgment, Debt, Memory, or Mission Evidence, return the prepared payload, the attempted command purpose, the failure output, and the next required User or operator decision. Do not replace a missing runtime ref with an informal note.

## Inputs

Required:

- current Mission id and stage
- accepted Mission Spec ref
- accepted Mission Design ref
- accepted Task Evidence refs
- Task result User Judgment refs for accepted Tasks
- role Evidence refs needed to explain criteria results, gaps, unverified scope, or risks
- Mission criteria labels or equivalent acceptance criteria

Required for User judgment:

- Mission result judgment input shown to the User
- User decision: `accepted`, `accepted_with_limits`, `revise`, `deferred`, or `stopped`
- accepted unverified scope, accepted remaining risks, and requested actions when applicable
- User Judgment payload path before calling `geas-cli`

Required for Mission Evidence:

- recorded Mission result User Judgment ref
- recorded Debt refs or explicit none
- recorded Memory refs or explicit none
- final accepted gaps, follow-ups, unverified scope, and remaining risks

Optional:

- current Debt Ledger refs
- current Memory refs
- prior Mission consolidation briefing
- User-selected reflection candidate changes
- known external release, deployment, or operational follow-up context

## Resources

| Resource | When to use | Purpose |
| --- | --- | --- |
| `references/mission-acceptance-input.md` | before Mission result User Judgment | Prepare criteria synthesis, gaps, limits, choices, and Mission result User Judgment payload. |
| `references/reflection-memory.md` | while classifying closure candidates and after User acceptance | Distinguish gap, debt, follow-up, and memory candidates and prepare record payloads. |
| `references/mission-evidence.md` | after accepted Mission result User Judgment | Prepare Mission Evidence payload and record gate. |

Use the `geas-cli` adapter Skill for Mission result User Judgment records, Debt records, Memory records, Mission Evidence records, and stage transitions. If `geas-cli` does not report success, preserve the payload and stop.

No scripts or assets are required. Consolidation depends on accepted artifacts, Evidence refs, User decisions, and runtime records rather than deterministic local computation.

## Gotchas

- Do not write Implementation Evidence, Verification Evidence, Review Evidence, Challenger Evidence, or Task Evidence here.
- Do not treat Task State, Task Evidence existence, Evidence verdict, recommendation, or CLI success as Mission result User Judgment.
- Do not write Mission Evidence before Mission result User Judgment is recorded.
- Do not write Mission Evidence for `revise`, `deferred`, or `stopped` decisions.
- Do not record Debt or Memory candidates before the User accepts them.
- Do not treat accepted Task Evidence as automatic Mission acceptance.
- Do not hide in-scope unmet work by renaming it as follow-up, debt, or memory.
- Do not treat Debt as Memory or Memory as Debt.
- Do not make Mission Evidence the source of truth for Debt; record Debt separately and summarize refs in Mission Evidence.
- Do not show the whole Mission result input at once when chunked review would reduce User judgment cost.
- Do not treat chunk-level confirmation as final Mission acceptance.
- Do not require repo root docs as execution prerequisites for a distributed Skill.

## Stop Conditions

Stop and preserve the current refs, draft briefing, prepared payload, and `geas-cli` output when:

- Accepted Mission Spec or accepted Mission Design is missing.
- Current Mission stage is not `consolidating`.
- Accepted Task Evidence refs are missing for required Mission work.
- A Task Evidence ref lacks a recorded `accepted` or `accepted_with_limits` Task result User Judgment.
- Mission criteria cannot be mapped to Task Evidence, role Evidence, gap, or unverified scope.
- Required role Evidence is unreadable and needed to explain a Mission criteria result.
- Mission result User Judgment is required but has not been provided.
- User accepted Debt or Memory candidates but the required record cannot be written.
- `geas-cli` judgment, Debt, Memory, Mission Evidence, or stage transition does not report success.
- The next action would require `consolidating` to write role Evidence, write Task Evidence, revise baseline artifacts, implement changes, verify outputs, review work, or decide User Judgment.

## Boundary

`consolidating` synthesizes accepted Task Evidence against the Mission baseline, prepares Mission result judgment input, coordinates User Judgment recording, and records accepted closure artifacts. It does not implement changes, verify outputs, review work, challenge artifacts, write Task Evidence, revise Mission baselines, or decide acceptance.
