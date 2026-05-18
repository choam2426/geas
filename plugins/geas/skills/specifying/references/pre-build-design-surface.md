# Pre-build Design Surface Reference

## Purpose

Use this reference after the User accepts Mission Design and before drafting the initial Task Contract Set.

Pre-build Design Surface lowers User decision cost when Markdown alone is a weak medium for deciding Task Contract inputs. It can use HTML, Mermaid, SVG, tables, static mockups, prototypes, comparisons, or small JS editors to help the User compare, visualize, manipulate, or explore implementation-before-build choices.

The surface is temporary decision support. It is not a runtime artifact, Evidence, User Judgment, Mission Design, or Task Contract. Selected decisions become execution baseline only when they are reflected in the Task Contract Set.

## Trigger

Create or request a Pre-build Design Surface when all of these are true:

- Mission Design has been accepted.
- A remaining implementation-before-build decision can affect Task scope, dependencies, deliverables, acceptance criteria, verification checks, review focus, risk level, or first building Task.
- The User can judge the decision at lower cost through comparison, visualization, interaction, exploration, or dense annotation than through prose alone.

Common trigger shapes:

- Option comparison: approach, architecture, library, data model, UI direction, rollout strategy.
- Spatial structure: ERD, module map, dependency graph, system boundary, ownership map.
- Flow and time: user journey, sequence diagram, state transition, deployment flow, incident timeline.
- State and variants: component variants, permission matrix, feature flag combinations, error states.
- Interaction: clickable flow, animation sandbox, form behavior, editor prototype.
- Dense understanding: annotated diff, code path explorer, config explainer, PR walkthrough.
- Decision input tool: triage board, priority sorter, scope picker, prompt/config tuner, exportable checklist.
- Risk decision: tradeoff matrix, failure-mode map, migration risk board.
- Operations plan: release plan, rollback plan, monitoring map, runbook preview.
- Explanation: concept explainer, glossary-linked diagram, tabbed examples.

## Skip Conditions

Skip the surface and state the reason in the baseline briefing when one of these applies:

- The Mission is a small document edit or small bug fix.
- The design choice is already explicit and accepted.
- The result can be judged directly through tests, verification checks, or a short Task Contract.
- The surface would not change Task Contract quality or User decision cost.
- The User explicitly asks for fast execution and accepts the risk of prose-only Task Contract drafting.

## Surface Rules

- Prefer self-contained HTML for interactive or multi-view surfaces.
- Use static Markdown tables, Mermaid, or SVG when interaction does not lower decision cost.
- Make the surface answer a concrete decision question.
- Present distinct options, constraints, risks, and expected Task Contract implications.
- Include an exportable or copyable decision summary when the surface is interactive.
- Keep visual or interactive detail tied to decisions that will affect Task Contracts.
- Preserve any generated file refs in the briefing when files are created outside runtime storage.
- Do not require a build system, external service, or repo root document to understand the surface.
- Do not store selected decisions only in the surface; carry them into Task Contract Set drafts.

## Decision Capture Shape

Use this shape in the User briefing or handoff result:

```markdown
Pre-build Design Surface:
- Purpose: <decision the surface exists to support>
- Surface refs: <file paths, URLs, or "briefing only">
- Options shown: <option labels and short meanings>
- User decisions needed: <decisions still required>
- Selected decisions: <decisions the User accepted>
- Task Contract implications: <scope, dependencies, deliverables, acceptance criteria, verification checks, review focus, risk level, or first Task impact>
- Unresolved decisions: <none, non-blocking, or blocking with reason>
- Skip reason: <only when skipped>
```

## Task Contract Mapping

Map selected decisions into Task Contract Set drafts as follows:

- Scope decisions go to `Scope / In` and `Scope / Out`.
- Output decisions go to `Deliverables`.
- Behavior, quality, or comparison decisions go to `Acceptance Criteria`.
- Checkability decisions go to `Verification Checks`.
- Risk, boundary, and quality concerns go to `Review Focus` and `Risks`.
- Ordering decisions go to `depends_on`.
- Mission coverage decisions go to `mission_acceptance_refs`.
- Risk severity decisions go to `risk_level`.
- Conditions that invalidate the selected design go to `Change Triggers`.

When a selected decision affects Mission purpose, scope, or approach rather than Task execution, return to Mission Spec or Mission Design revision before drafting Task Contracts.

## Record Boundary

- Record Mission Spec, Mission Design, and Task Contracts through `geas-cli` only after User acceptance.
- Do not record a Pre-build Design Surface through `geas-cli`.
- Do not treat surface acceptance as Task result User Judgment.
- Do not treat a surface screenshot, file, or export as Evidence.
- Mention surface refs in briefings only as decision context unless a later accepted Task Contract explicitly uses them as target outputs.

## Stop Conditions

Stop and return a specifying briefing when:

- A required surface cannot be prepared or read.
- The surface does not answer the decision it was meant to support.
- The User has not selected among blocking options.
- An unresolved decision can affect Task Contract Set contents, dependencies, or first building Task.
- The selected decision requires Mission Spec or Mission Design revision.

## Stop Briefing Shape

```markdown
Pre-build Design Surface stopped:
- Purpose: <decision the surface was meant to support>
- Reason: <missing input, unreadable surface, unresolved User decision, Mission baseline revision needed, or insufficient decision surface>
- Inputs available: <Mission Design ref, candidate surface refs, User preferences>
- Blocking decisions: <decisions blocking Task Contract Set drafting>
- Suggested route: <revise Mission Spec, revise Mission Design, prepare another surface, ask User, or stop>
```
