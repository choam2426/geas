# 01. Agents, Authority, and Evidence

> **Normative document.**
> This document defines the role taxonomy, authority boundaries, separation-of-duties rules, reviewer routing, specialist evidence obligations, and escalation model for Geas.

## 1. Role Architecture

Geas defines agents by **type**, not by friendly name. A type carries:

- decision authority
- required outputs
- blocking power
- prohibitions
- conflict-of-interest constraints
- audit expectations

An implementation MUST be able to answer, for every task: **who worked, who reviewed, who challenged, who decided, and under what authority.**

### Separation of Duties

The protocol enforces the following separation principles:

1. The role that coordinates work SHOULD be distinguishable from the role that issues product closure.
2. The role that wrote the primary implementation MUST NOT silently substitute for missing external review.
3. The role that performs critical challenge MUST be allowed to raise blocking concerns without being overridden by omission.
4. High-risk work MUST involve more than one evaluative perspective before final verdict.
5. A local implementation MAY collapse multiple types into one physical agent instance, but it MUST preserve logical role separation in artifacts.

### Authority Slots

Authority slots are fixed by the protocol and do not change across domains.

| slot | primary function | may schedule | may approve contract | may block | may issue final verdict |
|---|---|---:|---:|---:|---:|
| **Orchestrator** | mission control, routing, sequencing, packet assembly, recovery, memory management | yes | yes | yes | no |
| **Decision Maker** | product-level acceptance, trade-off judgment, final verdicts | no | during specifying only | yes | yes |
| **Design Authority** | structural coherence, methodology review, contract approval | no | yes | yes | no |
| **Challenger** | adversarial challenge, hidden-risk detection | no | no | yes | no |

Canonical type names for authority slots:

| slot | canonical type name |
|---|---|
| Orchestrator | `orchestration-authority` |
| Decision Maker | `product-authority` |
| Design Authority | `design-authority` |
| Challenger | `challenger` |

### Specialist Slots

Specialist slots define **functional categories** of domain expertise. Each domain profile maps these slots to concrete role types.

| slot | function | what it produces |
|---|---|---|
| **Implementer** | produces primary work outputs | the deliverable artifact — code, research output, content draft, analysis |
| **Quality Specialist** | verifies outputs against acceptance criteria | coverage evidence, negative-path analysis, reproducibility notes |
| **Risk Specialist** | assesses domain-specific risks and trust boundaries | risk notes, threat analysis, compliance observations |
| **Operations Specialist** | handles delivery, deployment, and operational readiness | operational readiness notes, delivery verification, rollback affordances |
| **Communication Specialist** | handles documentation, user-facing content, and clarity | documentation completeness, audience-appropriate guidance, clarity review |

A role MAY participate in multiple specialist slots. For example, a quality specialist may also act as an implementer (writing tests), or a communication specialist may also act as an implementer (writing documentation).

### Domain Profiles

A domain profile maps specialist slots to concrete role types. The protocol bundles three example profiles: software development, research, and content creation. Projects MUST declare their active domain profile.

#### Software Development Profile

| slot | concrete types | area of expertise | inspection focus |
|---|---|---|---|
| Implementer | `software-engineer` | full-stack implementation — UI, APIs, services, persistence, business logic, interaction design | changed UI paths, interaction states, responsive behavior, a11y surfaces, API contracts, data flows, migration safety, error semantics, idempotency |
| Quality Specialist | `qa-engineer` | acceptance criteria, tests, failure paths, regression risk | test coverage against criteria, negative paths, demo validation |
| Risk Specialist | `security-engineer` | auth, permissions, secret handling, abuse paths | authn/authz boundaries, secret handling, injection surfaces, abuse paths |
| Operations Specialist | `platform-engineer` | CI/CD, environments, deployability, runtime operations | CI reliability, deploy implications, config drift, provenance |
| Communication Specialist | `technical-writer` | docs, migrations, operator guidance | docs completeness, migration notes, operator caveats |

#### Research Profile (example)

| slot | concrete types | area of expertise | inspection focus |
|---|---|---|---|
| Implementer | `literature-analyst`, `research-analyst` | literature search and synthesis; experiment design, data analysis, modeling, simulation | methodology soundness, data collection validity, analysis reproducibility |
| Quality Specialist | `methodology-reviewer` | statistical rigor, reproducibility, methodological soundness | statistical rigor, sample adequacy, reproducibility of findings |
| Risk Specialist | `research-integrity-reviewer` | research ethics, data privacy, bias assessment, validity threats | ethics compliance, data privacy, bias assessment |
| Operations Specialist | `research-engineer` | data pipelines, compute infrastructure, reproducibility environments | data pipeline reliability, compute reproducibility, environment consistency |
| Communication Specialist | `research-writer` | paper drafting, reports, presentations, audience-appropriate communication | paper clarity, citation accuracy, audience-appropriate presentation |

#### Content Creation Profile (example)

| slot | concrete types | area of expertise | inspection focus |
|---|---|---|---|
| Implementer | `content-writer`, `content-designer` | content drafting; visual design and layout | factual accuracy, tone consistency, source attribution |
| Quality Specialist | `fact-checker` | source verification, claim accuracy, consistency | claim verification, source reliability, cross-reference consistency |
| Risk Specialist | `legal-reviewer` | copyright, liability, regulatory compliance | copyright compliance, liability exposure, regulatory alignment |
| Operations Specialist | `publishing-engineer` | CMS, distribution, scheduling, format conversion | CMS integration, format conversion, distribution readiness |
| Communication Specialist | `editor` | tone, clarity, audience fit, style consistency | audience fit, style consistency, clarity |

A conformant implementation MAY define additional domain profiles or extend existing ones, but MUST NOT weaken the authority model.

## 2. Authority Detailed Responsibilities

### Orchestrator (`orchestration-authority`)

Responsibilities:

- normalize user intent into a mission
- choose mission mode and current phase
- compile tasks and assign routing
- manage concurrency, locks, revalidation, and recovery
- invoke vote rounds when required
- assemble closure packets
- coordinate learning artifacts at phase boundaries
- manage memory: extract lessons to rules.md and agent memory from retrospectives and reviews
- update own agent memory file based on next_time_guidance from retrospective

Prohibitions:

- MUST NOT issue product final verdict
- MUST NOT silently downgrade required review
- MUST NOT "green-light" missing evidence by policy convenience
- MUST NOT hide unresolved conflict from the closure packet

### Decision Maker (`product-authority`)

Responsibilities:

- judge product trade-offs during specifying and final closure
- approve or reject the design brief for full-depth missions
- issue `pass | iterate | escalate` final verdicts
- resolve irreducible trade-off disputes when specialist consensus fails

Prohibitions:

- MUST NOT approve a `passed` task with an incomplete closure packet
- MUST NOT erase recorded blocking concerns without rationale
- SHOULD NOT be the primary implementation worker
- MUST NOT weaken integrity invariants without an explicit, auditable override

### Design Authority (`design-authority`)

Responsibilities:

- review structural decisions, interfaces, dependencies, and maintainability
- challenge hidden complexity, layering violations, and contract ambiguity
- approve or reject implementation contracts for implementation-bearing tasks

In software: architecture review. In research: methodology review. In content: editorial direction review.

Prohibitions:

- MUST NOT assume quality, risk, or product approval by default
- MUST NOT replace missing execution evidence with design confidence alone

### Challenger (`challenger`)

Responsibilities:

- perform adversarial pre-ship challenge
- search for assumptions the main path ignored
- force articulation of why shipping may be unsafe, incomplete, or strategically weak

Prohibitions:

- MUST NOT reduce their review to a rubber-stamp summary
- MUST NOT skip challenge on `high` or `critical` work unless the task is explicitly cancelled

## 3. Specialist Evidence Obligations

Specialist participation counts only when it changes evidence quality. A specialist slot is not satisfied by mere presence on a task; it is satisfied when the role inspects the appropriate surfaces and records a review outcome.

### Common Specialist Review Artifact

Specialist reviews are stored as role-based evidence files in `evidence/{agent}.json` via `geas evidence add`. Every specialist review SHOULD include, at minimum:

| field | description |
|---|---|
| `agent` | which agent produced this review |
| `task_id` | the task this review applies to |
| `role` | the agent's role in this task: `implementer`, `reviewer`, `tester`, or `authority` |
| `summary` | review findings and rationale |
| `verdict` | `approved`, `changes_requested`, or `blocked` |
| `concerns[]` | individually addressable blocking issues |
| `criteria_results[]` | per-criterion pass/fail assessments |
| `rationale` | explanation of the overall verdict |
| `artifacts[]` | artifacts examined or modified during review |

A review with no evidence reference MAY still exist, but it SHOULD be treated as lower-confidence input and SHOULD NOT be enough to justify closure by itself on higher-assurance work.

### Status Semantics

| status | meaning |
|---|---|
| `approved` | the reviewer found the task acceptable within their jurisdiction |
| `changes_requested` | the reviewer requires additional work before acceptance |
| `blocked` | the reviewer found a structural issue that should prevent forward motion absent explicit escalation |

### Per-Slot Obligations

The following expectations are minimum per slot, not exhaustive lists. Domain profiles refine these into concrete checklists.

#### Implementer (when reviewing peer work)

| MUST inspect | SHOULD produce | common blocking conditions |
|---|---|---|
| approach vs contract, interface correctness, regression risk | implementation review notes, boundary observations | contract violation, broken interface, regression introduced |

Additional MUST consider:
- whether the change requires involvement from other specialist slots

#### Quality Specialist

| MUST inspect | SHOULD produce | common blocking conditions |
|---|---|---|
| acceptance criteria, verification coverage, negative paths | coverage analysis, missing-path notes, reproducibility assessment | unmet criteria, unverified negative path, irreproducible evidence |

Additional MUST consider:
- traceability from acceptance criteria to verification evidence
- whether untested paths remain material

#### Risk Specialist

| MUST inspect | SHOULD produce | common blocking conditions |
|---|---|---|
| trust boundaries, sensitive data handling, domain-specific threats | risk notes, threat observations | privilege escalation, data exposure, unsafe trust assumption |

Additional MUST consider:
- abuse paths and adversarial scenarios relevant to the domain
- compliance with applicable policies

#### Operations Specialist

| MUST inspect | SHOULD produce | common blocking conditions |
|---|---|---|
| delivery pipeline, environment readiness, rollback capability | operational readiness notes | deployment breakage, config drift, missing rollback path |

Additional MUST consider:
- configuration drift
- environment or infrastructure implications

#### Communication Specialist

| MUST inspect | SHOULD produce | common blocking conditions |
|---|---|---|
| documentation impact, user-facing changes, clarity | documentation completeness notes, audience-fit assessment | stale instructions, missing guidance, misleading content |

Additional MUST consider:
- migration, upgrade, or transition guidance
- whether examples or references have become stale

### Slot vs Evidence Role

A **slot** is the organizational function an agent fills (e.g., Design Authority, Challenger). The **evidence role** determines the required fields when writing evidence via CLI.

| Slot | Evidence Role | Rationale |
|------|--------------|-----------|
| Design Authority | `reviewer` | Reviews structural quality; evidence requires verdict + concerns |
| Challenger | `authority` | Issues blocking/non-blocking decisions; evidence requires verdict + rationale |
| Product Authority | `authority` | Issues final verdict; evidence requires verdict + rationale |

Challenger also writes to `record.json:challenge_review` (dual-write) because the `verified→passed` transition guard checks this section directly.

## 4. Required Reviewer Routing

### Task Kind Taxonomy

| task_kind | meaning | typical primary worker slot |
|---|---|---|
| `implementation` | produce the core deliverable of the task | Implementer |
| `documentation` | create or update documentation, guides, or references | Communication Specialist |
| `configuration` | set up or modify parameters, environments, or templates | Operations Specialist |
| `design` | create or revise structural, visual, or methodological designs | Implementer or Design Authority |
| `review` | perform assessment, audit, or evaluation of existing work | Risk Specialist or Quality Specialist |
| `analysis` | investigate, explore, or extract insight from data, systems, or sources | Implementer or Quality Specialist |
| `delivery` | package and ship a release, publication, or final output | Operations Specialist |

Projects MAY define local sub-kinds (e.g., `implementation:frontend`, `review:security`) but the canonical kind MUST remain identifiable.

Canonical enum: `docs/protocol/schemas/task-contract.schema.json`.

### Routing Algorithm

A task's `required_reviewer_types[]` MUST be computed cumulatively.

#### Step 0 — Phase and mission sanity check

Before routing reviewers, the Orchestrator MUST confirm:

- the task belongs to the current mission and phase
- the task kind and risk level are set
- the task scope is concrete enough to infer affected surfaces

If these are missing, reviewer routing MUST block.

#### Step 1 — Default reviewers by `task_kind`

| task_kind | minimum required reviewer slot | commonly additional slots |
|---|---|---|
| `implementation` | Design Authority | Quality, Risk, Implementer (peer), Operations, Communication |
| `documentation` | Communication Specialist | Quality, Design Authority if structural semantics changed |
| `configuration` | Operations Specialist | Risk, Quality, Design Authority |
| `design` | Design Authority | Communication, Implementer, Quality |
| `review` | Risk Specialist | Design Authority, Quality, Operations |
| `analysis` | Design Authority, Quality Specialist | Risk, Communication |
| `delivery` | Operations Specialist, Quality Specialist | Communication, Risk |

The domain profile maps each slot to concrete reviewer types.

#### Step 2 — Risk expansion

| risk_level | additional required reviewers | minimum independent review expectation |
|---|---|---|
| `low` | none | at least one independent reviewer |
| `normal` | none | at least one independent reviewer, plus domain expansion when affected surfaces justify it |
| `high` | Challenger, Risk Specialist | independent reviewer set plus Challenger and Risk Specialist where applicable |
| `critical` | Challenger, Risk Specialist, Quality Specialist | strong multi-perspective review including Challenger; closure SHOULD not rely on one perspective alone |

#### Step 3 — Surface-signal expansion

The following scope signals MUST add reviewer slots when detected:

| signal | reviewer slots to add |
|---|---|
| presentation surfaces — user-facing output, interaction flows, visual design | Implementer (presentation domain), Communication Specialist |
| core logic — domain model, data handling, algorithms, interfaces | Implementer (logic domain), Design Authority |
| trust boundaries — credentials, sensitive data, permissions | Risk Specialist |
| operational configuration — delivery pipeline, infrastructure, environments, runtime config | Operations Specialist |
| verification surfaces — acceptance criteria, coverage artifacts, reproducibility | Quality Specialist |
| documentation, guides, user-facing text | Communication Specialist |

#### Step 4 — Gate profile and mission mode adjustment

- `closure_ready` MUST include Quality Specialist.
- `artifact_only` MAY omit implementation-specialist reviewers when no implementation surface is affected.

#### Step 5 — Cross-cutting change expansion

The following conditions SHOULD trigger additional review even if surface heuristics did not:

- public interface or contract change
- data model or schema change
- migration, backfill, or bulk transformation
- trust boundary or permission change
- user-visible content or flow change
- delivery pipeline or versioning change

#### Step 6 — Deduplicate and preserve expertise need

Duplicate reviewer types MUST be removed. If `primary_worker_type` also appears in the review set, that means the expertise is required; it does **not** mean self-review is sufficient.

#### Step 7 — Minimum guarantee

Every task MUST have at least one reviewer type that differs from `primary_worker_type`. If the computed set contains only the worker's own type or is empty, add Design Authority.

## 5. Conflict Resolution and Quorum

### Decision Boundary

| decision | primary owner | mandatory participants / notes |
|---|---|---|
| mission phase selection | Orchestrator | informed by mission intent, mission mode, and current evidence |
| task decomposition and routing | Orchestrator | Design Authority input recommended for large or cross-cutting work |
| design-brief approval | Decision Maker | Design Authority review REQUIRED for full-depth work |
| implementation contract approval | reviewer set led by Design Authority | may include domain specialist sign-off |
| evidence gate verdict | gate runner / validator | objective mechanism; not a product trade-off decision |
| readiness vote | reviewer participants | governed by task risk and vote policy |
| final verdict | Decision Maker | based on closure packet, not intuition alone |
| memory update (rules.md, agent notes) | Orchestrator | see doc 07 |
| policy override | local governance path | see doc 10; MUST be explicit and audited |

### Conflict Resolution

A protocol conflict exists when required reviewers produce materially incompatible conclusions, for example:

- `approved` vs `blocked`
- mutually exclusive conditional approvals
- scope interpretations that imply different acceptance outcomes
- a Challenger raises a blocking concern that others treat as acceptable risk

Conflict handling MUST follow this order:

1. **Detect** — record the incompatible positions.
2. **Clarify** — check whether disagreement is factual, evaluative, or jurisdictional.
3. **Deliberate** — run a vote round if required by doc 05.
4. **Record dissent** — minority positions MUST remain visible in the decision record.
5. **Resolve or escalate** — unresolved structural conflict becomes `escalated`.

A conflict MUST NOT disappear simply because the Orchestrator prefers throughput.

### Quorum Rules

#### Proposal-round quorum

Minimum: proposer plus one independent reviewer.
Recommended for cross-cutting changes: proposer plus Design Authority plus one affected domain specialist.

#### Readiness-round quorum

Minimum for `high` or `critical` risk:

- Orchestrator
- Decision Maker
- at least one independent specialist
- Challenger when required by risk

If quorum cannot be reached after two attempts, the task SHOULD transition to `escalated` unless a local policy explicitly allows deferred decision with recorded rationale.

## 6. Evidence Flow and Closure Integration

All specialists SHOULD emit `memory_suggestions` in their output artifacts when they encounter reusable knowledge. The Orchestrator harvests confirmed suggestions during retrospective and writes them to the appropriate agent memory file at `.geas/memory/agents/{agent_type}.md`.

### Evidence Source Priority

When available, specialists SHOULD prefer direct evidence in this order:

| priority | source | trust level |
|---|---|---|
| 1 | canonical artifacts produced for the current task | highest |
| 2 | reproducible command, test, or verification output | high |
| 3 | direct inspection of the work output | high |
| 4 | rules.md entries and agent memory notes | medium |
| 5 | prose claims not tied to artifacts | lowest |

Lower-priority evidence MUST NOT overrule higher-priority contradictory evidence without rationale.

### Worker Artifacts Consumed by Specialists

All specialists MAY consume worker artifacts, but the following pairings are especially important:

| worker artifact | primary consumer slot | expected effect |
|---|---|---|
| `known_risks[]` | Design Authority, Risk Specialist, Challenger | focus review where the worker is already uncertain |
| `unverified_cases[]` | Quality Specialist | prioritize verification effort |
| `possible_stubs[]` | Quality Specialist, Design Authority, Challenger | force explicit placeholder validation |
| `what_to_test_next[]` | Quality Specialist | accelerate verification scenario design |
| `summary` | all reviewers | orient review focus, not replace review |

### Rule When Worker Self-Check Is Absent

If a worker self-check is required but absent:

- the review set MUST NOT pretend the task is review-ready
- the task SHOULD remain pre-review or be rewound
- specialists MAY note the absence, but the absence itself is not a substitute artifact

### Required Reviewer Resolution

A task is not review-complete until the required review set has been satisfied according to routing rules. This means:

- every required reviewer type has either produced a review
- or a formally documented substitution path exists
- or the task has been escalated

The Orchestrator MUST NOT infer silent approval from inactivity.

### Closure Inclusion Rule

If a specialist participated materially, the closure packet SHOULD include their review or a traceable summary reference to it. Participation that affected a decision MUST be auditable later.

### Evolution Handoff Rule

Specialists SHOULD emit memory and rule candidates when they observe:

| observation | priority |
|---|---|
| repeated blocking failure | highest — immediate rule candidate |
| repeated preventable regression | high — pattern worth capturing |
| high-value reusable success pattern | high — worth standardizing |
| reviewer checklist gap | medium — improves future review quality |
| domain-specific anti-pattern | medium — prevents recurrence |
| lower-value advisory observation | low — capture if evidence is strong |

## 7. Operational Rules

### Single-Agent and Small-Team Operation

A single physical agent MAY play multiple logical types, but the artifacts MUST show explicit role switching. In single-agent mode:

- the implementation role and review role MUST be recorded separately
- dissent or self-conflict MUST be captured in a decision record
- `high` and `critical` conflicts SHOULD escalate to the user
- final verdict MUST be rendered under an explicit Decision Maker role switch
- the system MUST NOT pretend independent review happened if it did not

### User Escalation Boundary

A conformant implementation SHOULD escalate to the user when any of the following occur:

- legal, privacy, or policy uncertainty
- repeated `iterate` or repeated recovery failure without narrowing uncertainty
- unresolved critical risk disagreement
- delivery of regulated or safety-sensitive output under a profile that requires user approval
- a policy override that weakens a normal hard-stop

### Audit Requirements

The following MUST remain reconstructible from artifacts:

- who the primary worker was
- who reviewed
- who challenged
- who issued the final verdict
- which role raised each blocking concern
- which dissenting positions were overruled and why
- whether any logical role separation collapsed into a single physical agent instance

### Type Naming Rules for Artifacts

Artifact types map to storage locations as follows:

| artifact type | storage |
|---|---|
| evidence (specialist review, challenge, verdict) | `evidence/{agent}.json` — role field inside, not filename |
| pipeline step output (self-check, gate, closure, etc.) | `record.json` section — section name identifies type |
| vote round / decision | `decisions/vote-round-{topic}.json` |
| task contract | `tasks/{tid}/contract.json` |

Role identity belongs inside validated fields, not inside ad hoc filenames.

## Key Statement

Authority in Geas is not ornamental and specialist evidence is not ceremonial. A role exists to constrain who may decide, what evidence they must inspect, and how a future auditor can verify that the decision was legitimate.
