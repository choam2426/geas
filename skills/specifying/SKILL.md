---
name: specifying
description: "Internal specifying procedure. Use only inside an active Mission or explicit mission handoff to elicit the User's goal, reduce ambiguity, draft baselines, and record accepted Mission Spec, Mission Design, and Task Contracts."
---

# Specifying

Use this skill to turn a User's unclear or high-level goal into a reviewable Geas Mission baseline.

Specifying is an interactive elicitation procedure. It prepares working drafts, asks only the questions that materially affect the Mission baseline, confirms the User's decisions, and records agreed Mission Spec, Mission Design, and initial Task Contract artifacts through the Geas CLI.

## Core Rules

- Treat the User's goal as the source of truth; turn assumptions into explicit draft assumptions or questions.
- Treat agent-created assumptions as candidates until the User confirms, delegates, or defers them.
- Ask one focused question at a time during elicitation unless a small batch of related choices lowers User burden.
- Prefer confirm-this prompts when repo facts or existing artifacts already suggest a likely answer.
- Keep drafts outside runtime until the User has reviewed the baseline.
- Accept and record Mission Spec, Mission Design, and Task Contracts in sequence; do not treat one User response as approval for all three artifact types.
- Treat `challenge spec`, `challenge design`, `challenge task contracts`, and `challenge deeper` as requests for a `challenger` role handoff. The specifying context prepares the handoff and briefs the returned result; it does not produce challenge findings itself.
- Include `read_first` artifact or draft payload paths in specifying-stage role handoffs. The role must read those paths before producing findings or design output.
- Record agreed baselines with the CLI; never hand-edit `.geas/` runtime artifacts.
- If the CLI or runtime write is unavailable, keep the accepted payload ready, brief recording unavailable, and wait for caller/User direction instead of inventing a runtime artifact.
- Keep User review and User Judgment separate from agent-side confidence or recommendations.

## Workflow

1. Prepare context.
   - Load `references/interview.md` and `references/ambiguity-patterns.md`.
   - Run the `references/interview.md` Project Pre-Scan before the first intake question.
   - Treat project documents found during the scan as target-project facts, not as prerequisites for using this Skill.
   - Separate observed facts from candidate interpretation.
   - Use `references/interview.md` Intake Output Flow to choose the next user-facing output.

2. Elicit the Mission.
   - Identify goal, background, success criteria, included scope, excluded scope, constraints, assumptions, risks, decision owners, and expected review burden.
   - Use `references/interview.md` for the interaction loop.
   - Use `references/ambiguity-patterns.md` whenever a request has multiple plausible interpretations.
   - Maintain an intake ledger: readiness gate, current value, source status, target artifact field, and whether it remains open.
   - Start user-facing intake with an Intake Sketch when the conversation does not already contain a User-accepted Baseline Candidate.
   - Use Intake Sketches for observed facts, candidate assumptions, gate status, and the next gate-closing choice. Do not include artifact acceptance choices in an Intake Sketch.
   - Present Intake Sketch and Baseline Candidate with `references/briefings.md`.
   - Move from intake to Mission Spec drafting only after a Baseline Candidate has no open readiness gates and the User has accepted it as the basis for a Mission Spec draft.

3. Draft the Mission Spec.
   - Load `references/mission-spec.md`.
   - Draft only after the User accepts a Baseline Candidate with no open readiness gates as the basis for a Mission Spec draft.
   - Draft all required Mission Spec fields.
   - Present the draft with `references/briefings.md` Mission Spec Review.
   - Revise, request a `challenger` role handoff, or stop according to the User's choice.
   - After the User accepts the Mission Spec, use `geas init` if runtime storage is absent, use `geas mission create` if no Mission is active, and record the accepted Spec before drafting Mission Design.

4. Draft the Mission Design.
   - Start only after an accepted Mission Spec has been recorded or is the explicit accepted basis for the current revision.
   - Load `references/mission-design.md`.
   - Make the Design Role Decision from `references/mission-design.md` before drafting.
   - Use `work-designer` as `role_required` when the Design creates or changes approach, Task graph, dependency order, alternatives, risk tradeoffs, or review-cost tradeoffs.
   - If `work-designer` is required, prepare the handoff packet with `read_first` pointing to the accepted Mission Spec path and wait for the role result. The specifying context does not author the Mission Design payload itself.
   - Use `role_omitted` only when the accepted Mission Spec or explicit User decision already supplies the approach and Task graph; include the omission reason in Mission Design Review.
   - Present the draft with `references/briefings.md` Mission Design Review.
   - Revise, request a `challenger` role handoff, return to Mission Spec, or stop according to the User's choice.
   - After the User accepts the Mission Design, record it before drafting initial Task Contracts.

5. Draft initial Task Contracts.
   - Start only after an accepted Mission Design has been recorded or is the explicit accepted basis for the current revision.
   - Load `references/task-contract.md`.
   - Create one Task Contract per User-judgment-worthy work unit.
   - Prepare Task Cards so the User can review goal, scope, acceptance, verification, review focus, and dependencies before Task Contract acceptance.
   - Ensure each Task has acceptance criteria, verification checks, review focus, and risks.
   - Present the drafts with `references/briefings.md` Task Contract Review.
   - Initial Task Contracts may be reviewed in one packet after Mission Design acceptance, but this approval is separate from Mission Spec and Mission Design approval.
   - After the User accepts the Task Contracts, record each accepted Task Contract before entering building.

6. Run baseline readiness review.
   - Load `references/baseline-review.md`.
   - Check accepted Mission Spec, accepted Mission Design, accepted Task Contracts, readiness gate status, Spec Self-Check, Task Cards, and transfer context for clarity, coverage, traceability, testability, and review cost.
   - If the review finds readiness blockers, return to interview, Mission Spec revision, Mission Design revision, or Task Contract revision before entering building.
   - Recommend Challenger involvement at the current approval stage when ambiguity, risk, irreversibility, or broad delegation justifies it. Proceed only by `challenger` role handoff when the User accepts the added role pass.
   - Use `references/briefings.md` Baseline Readiness when all accepted artifacts are ready for building transition.

7. Enter building after accepted baselines are recorded.
   - Use `geas mission transition --to building --task <task-id>` only after the first Task Contract is recorded and the User is ready to start building.

8. Consider session handoff before building.
   - Recommend a fresh building session when specifying consumed substantial context, required heavy research, produced five or more initial Tasks, or left many baseline decisions that must stay visible.
   - Use `references/briefings.md` Session Handoff.
   - If the User chooses a fresh session, stop after the briefing and leave building to resume from recorded runtime state.

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
- `references/briefings.md`: Prepare specifying-stage review, readiness, challenge, and session handoff briefings.
