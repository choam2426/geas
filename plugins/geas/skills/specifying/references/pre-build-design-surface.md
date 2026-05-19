# Pre-build Design Surface Reference

## Purpose

Use this reference after the User accepts Mission Spec and before accepting the baseline artifact that would otherwise lock a costly decision.

Pre-build Design Surface lowers User decision cost when prose alone is a weak medium for deciding baseline inputs. It can use HTML, Mermaid, SVG, tables, static mockups, prototypes, comparisons, concrete examples, or small JS editors to help the User compare, visualize, manipulate, or explore implementation-before-build choices.

The surface is temporary decision support. It is not a runtime artifact, Evidence, User Judgment, Mission Design, or Task Contract. A selected Mission-level decision becomes baseline only when reflected in Mission Design. A selected Task-level decision becomes execution baseline only when reflected in the Task Contract Set.

## Trigger

Create or request a Pre-build Design Surface when all of these are true:

- Mission Spec has been accepted.
- The next baseline artifact would commit to a decision that is expensive to reject after implementation begins.
- The decision can affect Mission approach, output shape, external interface contract, domain or structural model, Task slicing, dependencies, deliverables, acceptance criteria, verification checks, review focus, risk level, or first building Task.
- The User can judge the decision at lower cost through comparison, visualization, interaction, exploration, concrete examples, or annotation than through prose alone.

Resolve a design-level surface before the User accepts Mission Design when the decision affects Mission approach, final output shape, external interface contract, domain or structural model, or a hard-to-reverse tradeoff.

Resolve a contract-level surface after the User accepts Mission Design and before Task Contract Set acceptance when the decision affects Task slicing, deliverables, acceptance criteria, verification checks, dependencies, risk level, or the first building Task.

Common trigger shapes:

- Final output shape: report format, generated artifact structure, document, deck, HTML artifact, CLI output, or user-facing briefing structure.
- External interface contract: CLI command surface, API shape, config format, schema, error shape, response shape, or compatibility boundary.
- Domain or structural model: ERD, state machine, event flow, module map, dependency graph, system boundary, or ownership map.
- Acceptance examples: rule-heavy behavior, policy logic, edge cases, decision tables, example maps, or concrete expected outputs.
- Scope and acceptance slicing: competing Task boundaries, dependency order, acceptance checkpoint placement, or first building Task.
- Hard-to-reverse tradeoff: architecture, library, storage, migration, rollout, compatibility, or operational strategy.
- Operational artifact: release plan, rollback plan, monitoring map, migration sequence, or runbook preview when the artifact itself shapes Mission or Task acceptance.
- Decision input tool: triage board, priority sorter, scope picker, prompt/config tuner, or decision worksheet.

## Skip Conditions

Skip the surface and state the reason in the baseline briefing when one of these applies:

- The Mission is a small document edit or small bug fix with no decision matching the trigger.
- The choice is already explicit and accepted in the baseline artifact that owns it.
- The result can be judged directly through tests, verification checks, or a short Task Contract.
- The surface would not change Mission Design quality, Task Contract quality, or User decision cost.
- The User explicitly asks for fast execution and accepts the risk of prose-only baseline drafting.

## Surface Rules

- Prefer self-contained HTML for interactive or multi-view surfaces.
- Use static Markdown tables, Mermaid, or SVG when interaction does not lower decision cost.
- Make the surface answer a concrete baseline decision question.
- Present distinct options, constraints, risks, and expected Mission Design or Task Contract implications.
- Include an exportable or copyable decision summary when the surface is interactive.
- Keep visual or interactive detail tied to decisions that will affect Mission Design or Task Contracts.
- Preserve any generated file refs in the briefing when files are created outside runtime storage.
- Do not require a build system, external service, or repo root document to understand the surface.
- Do not store selected decisions only in the surface; carry them into Mission Design or Task Contract Set drafts.

## Decision Capture Shape

Use this shape in the User briefing or handoff result:

```markdown
Pre-build Design Surface:
- Purpose: <decision the surface exists to support>
- Surface refs: <file paths, URLs, or "briefing only">
- Options shown: <option labels and short meanings>
- User decisions needed: <decisions still required>
- Selected decisions: <decisions the User accepted>
- Baseline level: <Mission Design, Task Contract Set, or both>
- Mission Design implications: <approach, output shape, external interface contract, domain or structural model, key tradeoff, risks, assumptions, or change triggers>
- Task Contract implications: <scope, dependencies, deliverables, acceptance criteria, verification checks, review focus, risk level, or first Task impact>
- Unresolved decisions: <none, non-blocking, or blocking with reason>
- Skip reason: <only when skipped>
```

## Mission Design Mapping

Map selected design-level decisions into Mission Design drafts as follows:

- Mission approach decisions go to `Approach Strategy` and `Plan Outline`.
- Final output shape decisions go to `Plan Summary`, `Scope / In`, and `Scope / Out`.
- External interface, domain, or structural model decisions go to `Key Concepts`, `Approach Strategy`, and `Assumptions`.
- Hard-to-reverse tradeoffs go to `Alternatives Considered`, `Risks`, and `Change Triggers`.
- Conditions that invalidate the selected direction go to `Change Triggers`.

When a selected decision changes Mission purpose, scope, or acceptance criteria, return to Mission Spec revision before accepting Mission Design.

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

When a selected decision affects Mission purpose, scope, or approach rather than Task execution, return to Mission Spec or Mission Design revision before drafting or accepting Task Contracts.

## Record Boundary

- Record Mission Spec, Mission Design, and Task Contracts through `geas-cli` only after User acceptance.
- Do not record a Pre-build Design Surface through `geas-cli`.
- Do not treat surface acceptance as Task result User Judgment.
- Do not treat a surface screenshot, file, or export as Evidence.
- Mention surface refs in briefings only as decision context unless a later accepted Task Contract explicitly uses them as target outputs.

## Boundary

Pre-build Design Surface excludes Geas internal role choreography, handoff order, verification/review/challenge sequence, reviewer presentation format, Evidence rendering style, and other runtime procedure choices unless the Mission itself is to design or modify that procedure.

## Stop Conditions

Stop and return a specifying briefing when:

- A required surface cannot be prepared or read.
- The surface does not answer the decision it was meant to support.
- The User has not selected among blocking options.
- An unresolved decision can affect Mission Design, Task Contract Set contents, dependencies, or first building Task.
- The selected decision requires Mission Spec or Mission Design revision.

## Stop Briefing Shape

```markdown
Pre-build Design Surface stopped:
- Purpose: <decision the surface was meant to support>
- Reason: <missing input, unreadable surface, unresolved User decision, Mission baseline revision needed, or insufficient decision surface>
- Inputs available: <Mission Spec ref, Mission Design ref when available, candidate surface refs, User preferences>
- Blocking decisions: <decisions blocking Mission Design or Task Contract Set drafting>
- Suggested route: <revise Mission Spec, revise Mission Design, prepare another surface, ask User, or stop>
```
