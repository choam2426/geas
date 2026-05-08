---
name: specifying
description: "Internal specifying procedure. Use only inside an active Mission or explicit mission handoff to elicit the User's goal, reduce ambiguity, draft baselines, and record accepted Mission Spec, Mission Design, and Task Contracts."
---

# Specifying

Use this skill to turn a User's unclear or high-level goal into a reviewable Geas Mission baseline.

Specifying is an interactive elicitation procedure. It prepares working drafts, asks only the questions that materially affect the Mission baseline, confirms the User's decisions, and records agreed Mission Spec, Mission Design, and initial Task Contract artifacts through the Geas CLI.

## Core Rules

- Treat the User's goal as the source of truth; turn assumptions into explicit draft assumptions or questions.
- Ask one focused question at a time during elicitation unless a small batch of related choices lowers User burden.
- Prefer confirm-this prompts when repo facts or existing artifacts already suggest a likely answer.
- Keep drafts outside runtime until the User has reviewed the baseline.
- Record agreed baselines with the CLI; never hand-edit `.geas/` runtime artifacts.
- Keep User review and User Judgment separate from agent-side confidence or recommendations.

## Workflow

1. Prepare context.
   - Read `docs/definition.md`, `docs/runtime.md`, `docs/cli.md`, and the relevant operating docs when working in the Geas repo.
   - Inspect the project and existing `.geas/` state enough to convert blank questions into confirm-this prompts.
   - Load `references/interview.md` and `references/ambiguity-patterns.md`.

2. Elicit the Mission.
   - Identify goal, background, success criteria, included scope, excluded scope, constraints, assumptions, risks, decision owners, and expected review burden.
   - Use `references/interview.md` for the interaction loop.
   - Use `references/ambiguity-patterns.md` whenever a request has multiple plausible interpretations.

3. Draft the Mission Spec.
   - Load `references/mission-spec.md`.
   - Draft all required Mission Spec fields.
   - Present the draft for User review and revise until the User accepts it as the baseline.

4. Draft the Mission Design.
   - Load `references/mission-design.md`.
   - Use or hand off to the `work-designer` role when Task structure, dependency order, alternatives, or risk tradeoffs need an independent design pass.
   - Present the design for User review and revise until accepted.

5. Draft initial Task Contracts.
   - Load `references/task-contract.md`.
   - Create one Task Contract per User-judgment-worthy work unit.
   - Ensure each Task has acceptance criteria, verification checks, review focus, and risks.

6. Run baseline review.
   - Load `references/baseline-review.md`.
   - Check Mission Spec, Mission Design, and Task Contracts for clarity, coverage, traceability, testability, and review cost.
   - Recommend Challenger involvement when baseline ambiguity, risk, irreversibility, or delegation depth justifies it. Proceed with challenge only when the User accepts the added depth.

7. Record accepted baselines.
   - Use `geas init` if runtime storage is absent.
   - Use `geas mission create` when starting a new Mission.
   - Use `geas mission spec record --from <path|->`.
   - Use `geas mission design record --from <path|->`.
   - Use `geas task contract record --task <task-id> --from <path|->` for each initial Task Contract.
   - Use `geas mission transition --to building --task <task-id>` only after the first Task Contract is recorded and the User is ready to start building.

## Outputs

- User-reviewed Mission Spec payload.
- User-reviewed Mission Design payload.
- User-reviewed initial Task Contract payloads.
- Optional Challenger recommendation and outcome.
- CLI result summaries with created runtime artifact paths.

## References

- `references/interview.md`: Elicit goals, constraints, success criteria, and decision ownership.
- `references/ambiguity-patterns.md`: Detect and handle common ambiguity patterns.
- `references/mission-spec.md`: Draft Mission Spec content.
- `references/mission-design.md`: Draft Mission Design content.
- `references/task-contract.md`: Draft Task Contracts from the Mission baseline.
- `references/baseline-review.md`: Prepare baseline review and optional Challenger recommendation.
