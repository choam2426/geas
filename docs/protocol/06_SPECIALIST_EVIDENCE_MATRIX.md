# 06. Specialist Evidence Matrix

> **Normative document.**
> This document defines what evidence each specialist slot is expected to inspect, what minimum outputs their reviews should produce, and how specialist evidence flows into closure and evolution.

## Principle

Specialist participation counts only when it changes evidence quality. A specialist slot is not satisfied by mere presence on a task; it is satisfied when the role inspects the appropriate surfaces and records a review outcome.

## Common Specialist Review Artifact

Every specialist review SHOULD include, at minimum:

| field | description |
|---|---|
| `reviewer_type` | which specialist slot produced this review |
| `status` | `approved`, `changes_requested`, or `blocked` |
| `summary` | review findings and rationale |
| `blocking_concerns[]` | individually addressable blocking issues |
| `evidence_refs[]` | artifacts examined during review |
| `notes_on_risk[]` | risk observations relevant to the specialist's jurisdiction |
| `rubric_scores[]` | optional rubric dimension scores |

A review with no evidence reference MAY still exist, but it SHOULD be treated as lower-confidence input and SHOULD NOT be enough to justify closure by itself on higher-assurance work.

## Status Semantics

| status | meaning |
|---|---|
| `approved` | the reviewer found the task acceptable within their jurisdiction |
| `changes_requested` | the reviewer requires additional work before acceptance |
| `blocked` | the reviewer found a structural issue that should prevent forward motion absent explicit escalation |

## Minimum Evidence Expectations by Specialist Slot

### Authority slots

| slot | MUST inspect | SHOULD produce | common blocking conditions |
|---|---|---|---|
| Design Authority | structural decisions, interfaces, dependencies, maintainability | design review summary, structural fit assessment | incompatible boundary, brittle coupling, unsafe complexity |
| Challenger | entire closure story from an adversarial perspective | challenge review with at least one substantive concern | hidden assumption, unexamined risk, premature closure logic |

### Specialist slots

| slot | MUST inspect | SHOULD produce | common blocking conditions |
|---|---|---|---|
| Implementer (peer review) | approach vs contract, interface correctness, regression risk | implementation review notes, boundary observations | contract violation, broken interface, regression introduced |
| Quality Specialist | acceptance criteria, verification coverage, negative paths | coverage analysis, missing-path notes, reproducibility assessment | unmet criteria, unverified negative path, irreproducible evidence |
| Risk Specialist | trust boundaries, sensitive data handling, domain-specific threats | risk notes, threat observations | privilege escalation, data exposure, unsafe trust assumption |
| Operations Specialist | delivery pipeline, environment readiness, rollback capability | operational readiness notes | deployment breakage, config drift, missing rollback path |
| Communication Specialist | documentation impact, user-facing changes, clarity | documentation completeness notes, audience-fit assessment | stale instructions, missing guidance, misleading content |

### Software domain examples

For projects using the software development domain profile, slots map to concrete evidence expectations:

| slot | concrete types | domain-specific inspection focus |
|---|---|---|
| Implementer | `frontend_engineer` | changed UI paths, interaction states, responsive behavior, a11y surfaces |
| Implementer | `backend_engineer` | API contracts, data flows, migration safety, error semantics, idempotency |
| Quality Specialist | `qa_engineer` | test coverage against criteria, negative paths, demo validation |
| Risk Specialist | `security_engineer` | authn/authz boundaries, secret handling, injection surfaces, abuse paths |
| Operations Specialist | `devops_engineer` | CI reliability, deploy implications, config drift, provenance |
| Communication Specialist | `technical_writer` | docs completeness, migration notes, operator caveats |
| Communication Specialist | `ui_ux_designer` | user flow coherence, copy clarity, visual consistency |

## Matrix by Task Kind

The minimum review expectation per task kind, expressed in specialist slots:

| task_kind | mandatory review slot | commonly additional slots |
|---|---|---|
| `implementation` | Design Authority | Quality, Risk, Implementer (peer), Operations, Communication |
| `documentation` | Communication Specialist | Quality, Design Authority if structural semantics changed |
| `configuration` | Operations Specialist | Risk, Quality, Design Authority |
| `design` | Design Authority | Communication, Implementer, Quality |
| `review` | Risk Specialist | Design Authority, Quality, Operations |
| `analysis` | Design Authority, Quality Specialist | Risk, Communication |
| `delivery` | Operations Specialist, Quality Specialist | Communication, Risk |

## Matrix by Risk Level

| risk_level | minimum independent review expectation |
|---|---|
| `low` | at least one independent reviewer |
| `normal` | at least one independent reviewer, plus domain expansion when affected surfaces justify it |
| `high` | independent reviewer set plus Challenger and Risk Specialist where applicable |
| `critical` | strong multi-perspective review including Challenger; closure SHOULD not rely on one perspective alone |

## Evidence Source Priority

When available, specialists SHOULD prefer direct evidence in this order:

| priority | source | trust level |
|---|---|---|
| 1 | canonical artifacts produced for the current task | highest |
| 2 | reproducible command, test, or verification output | high |
| 3 | direct inspection of the work output | high |
| 4 | summaries and memory packets | medium |
| 5 | prose claims not tied to artifacts | lowest |

Lower-priority evidence MUST NOT overrule higher-priority contradictory evidence without rationale.

## Worker Artifacts Consumed by Specialists

All specialists MAY consume worker artifacts, but the following pairings are especially important:

| worker artifact | primary consumer slot | expected effect |
|---|---|---|
| `known_risks[]` | Design Authority, Risk Specialist, Challenger | focus review where the worker is already uncertain |
| `untested_paths[]` | Quality Specialist | prioritize verification effort |
| `possible_stubs[]` | Quality Specialist, Design Authority, Challenger | force explicit placeholder validation |
| `what_to_test_next[]` | Quality Specialist | accelerate verification scenario design |
| `summary` | all reviewers | orient review focus, not replace review |

## Rule When Worker Self-Check Is Absent

If a worker self-check is required but absent:

- the review set MUST NOT pretend the task is review-ready
- the task SHOULD remain pre-review or be rewound
- specialists MAY note the absence, but the absence itself is not a substitute artifact

## Required Reviewer Resolution

A task is not review-complete until the required review set has been satisfied according to routing rules. This means:

- every required reviewer type has either produced a review
- or a formally documented substitution path exists
- or the task has been escalated

The Orchestrator MUST NOT infer silent approval from inactivity.

## Closure Inclusion Rule

If a specialist participated materially, the closure packet SHOULD include their review or a traceable summary reference to it. Participation that affected a decision MUST be auditable later.

## Evolution Handoff Rule

Specialists SHOULD emit memory and rule candidates when they observe:

| observation | priority |
|---|---|
| repeated blocking failure | highest — immediate rule candidate |
| repeated preventable regression | high — pattern worth capturing |
| high-value reusable success pattern | high — worth standardizing |
| reviewer checklist gap | medium — improves future review quality |
| domain-specific anti-pattern | medium — prevents recurrence |
| lower-value advisory observation | low — capture if evidence is strong |

## Key Statement

Specialist review is only valuable when it is evidence-bearing, jurisdiction-aware, and preserved in a form that later reviewers can audit rather than reconstruct from memory.
