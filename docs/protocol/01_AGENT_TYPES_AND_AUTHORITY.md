# 01. Agent Types and Authority

> **Normative document.**
> This document defines the role taxonomy, authority boundaries, separation-of-duties rules, reviewer routing rules, and escalation model for Geas.

## Purpose

Geas defines agents by **type**, not by friendly name. A type carries:

- decision authority
- required outputs
- blocking power
- prohibitions
- conflict-of-interest constraints
- audit expectations

An implementation MUST be able to answer, for every task: **who worked, who reviewed, who challenged, who decided, and under what authority.**

## Separation of Duties

The protocol enforces the following separation principles:

1. The role that coordinates work SHOULD be distinguishable from the role that issues product closure.
2. The role that wrote the primary implementation MUST NOT silently substitute for missing external review.
3. The role that performs critical challenge MUST be allowed to raise blocking concerns without being overridden by omission.
4. High-risk work MUST involve more than one evaluative perspective before final verdict.
5. A local implementation MAY collapse multiple types into one physical agent instance, but it MUST preserve logical role separation in artifacts.

## Role Architecture

Geas roles are organized in two tiers:

- **Authority slots** — domain-agnostic roles defined by the protocol. Present in every conformant implementation.
- **Specialist slots** — functional categories that each domain profile fills with concrete role types.

A single physical agent MAY occupy multiple slots. Slot assignment describes **primary responsibility**, not exclusive ownership.

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

| slot | concrete types | area of expertise |
|---|---|---|
| Implementer | `software-engineer` | full-stack implementation — UI, APIs, services, persistence, business logic, interaction design |
| Quality Specialist | `qa-engineer` | acceptance criteria, tests, failure paths, regression risk |
| Risk Specialist | `security-engineer` | auth, permissions, secret handling, abuse paths |
| Operations Specialist | `platform-engineer` | CI/CD, environments, deployability, runtime operations |
| Communication Specialist | `technical-writer` | docs, migrations, operator guidance |

#### Research Profile (example)

| slot | concrete types | area of expertise |
|---|---|---|
| Implementer | `literature-analyst`, `research-analyst` | literature search and synthesis; experiment design, data analysis, modeling, simulation |
| Quality Specialist | `methodology-reviewer` | statistical rigor, reproducibility, methodological soundness |
| Risk Specialist | `research-integrity-reviewer` | research ethics, data privacy, bias assessment, validity threats |
| Operations Specialist | `research-engineer` | data pipelines, compute infrastructure, reproducibility environments |
| Communication Specialist | `research-writer` | paper drafting, reports, presentations, audience-appropriate communication |

#### Content Creation Profile (example)

| slot | concrete types | area of expertise |
|---|---|---|
| Implementer | `content-writer`, `content-designer` | content drafting; visual design and layout |
| Quality Specialist | `fact-checker` | source verification, claim accuracy, consistency |
| Risk Specialist | `legal-reviewer` | copyright, liability, regulatory compliance |
| Operations Specialist | `publishing-engineer` | CMS, distribution, scheduling, format conversion |
| Communication Specialist | `editor` | tone, clarity, audience fit, style consistency |

A conformant implementation MAY define additional domain profiles or extend existing ones, but MUST NOT weaken the authority model.

## Detailed Responsibilities and Prohibitions

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
- SHOULD produce memory_suggestions when discovering information that would help future invocations of the same agent type

In software: architecture review. In research: methodology review. In content: editorial direction review.

Prohibitions:

- MUST NOT assume quality, risk, or product approval by default
- MUST NOT replace missing execution evidence with design confidence alone

### Challenger (`challenger`)

Responsibilities:

- perform adversarial pre-ship challenge
- search for assumptions the main path ignored
- force articulation of why shipping may be unsafe, incomplete, or strategically weak
- SHOULD produce memory_suggestions when discovering information that would help future invocations of the same agent type

Prohibitions:

- MUST NOT reduce their review to a rubber-stamp summary
- MUST NOT skip challenge on `high` or `critical` work unless the task is explicitly cancelled

## Minimum Review Obligations by Specialist Slot

The following checks are minimum expectations per slot, not exhaustive lists. Domain profiles refine these into concrete checklists.

### Implementer (when reviewing peer work)

MUST consider:

- whether the approach matches the approved contract
- interface correctness and boundary behavior
- regression risk from the change
- whether the change requires involvement from other specialist slots
- SHOULD produce memory_suggestions when discovering information that would help future invocations of the same agent type

### Quality Specialist

MUST consider:

- traceability from acceptance criteria to verification evidence
- negative paths and regressions
- whether untested paths remain material
- reproducibility of the submitted evidence
- SHOULD produce memory_suggestions when discovering information that would help future invocations of the same agent type

### Risk Specialist

MUST consider:

- trust boundaries and privilege handling
- sensitive data exposure or mishandling
- abuse paths and adversarial scenarios relevant to the domain
- compliance with applicable policies
- SHOULD produce memory_suggestions when discovering information that would help future invocations of the same agent type

### Operations Specialist

MUST consider:

- delivery pipeline impact
- operational readiness and rollback capability
- configuration drift
- environment or infrastructure implications
- SHOULD produce memory_suggestions when discovering information that would help future invocations of the same agent type

### Communication Specialist

MUST consider:

- whether changes are documented at the right audience level
- migration, upgrade, or transition guidance
- clarity and accuracy of user-facing content
- whether examples or references have become stale
- SHOULD produce memory_suggestions when discovering information that would help future invocations of the same agent type

## Task Kind Taxonomy

The canonical `task_kind` values are domain-agnostic:

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

## Decision Boundary

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

## Required Reviewer Routing Algorithm

A task's `required_reviewer_types[]` MUST be computed cumulatively.

### Step 0 — Phase and mission sanity check

Before routing reviewers, the Orchestrator MUST confirm:

- the task belongs to the current mission and phase
- the task kind and risk level are set
- the task scope is concrete enough to infer affected surfaces

If these are missing, reviewer routing MUST block.

### Step 1 — Default reviewers by `task_kind`

| task_kind | minimum required reviewer slot |
|---|---|
| `implementation` | Design Authority |
| `documentation` | Communication Specialist |
| `configuration` | Operations Specialist |
| `design` | Design Authority |
| `review` | Risk Specialist |
| `analysis` | Design Authority, Quality Specialist |
| `delivery` | Operations Specialist, Quality Specialist |

The domain profile maps each slot to concrete reviewer types.

### Step 2 — Risk expansion

| risk_level | additional required reviewers |
|---|---|
| `low` | none |
| `normal` | none |
| `high` | Challenger, Risk Specialist |
| `critical` | Challenger, Risk Specialist, Quality Specialist |

### Step 3 — Surface-signal expansion

The following scope signals MUST add reviewer slots when detected:

| signal | reviewer slots to add |
|---|---|
| presentation surfaces — user-facing output, interaction flows, visual design | Implementer (presentation domain), Communication Specialist |
| core logic — domain model, data handling, algorithms, interfaces | Implementer (logic domain), Design Authority |
| trust boundaries — credentials, sensitive data, permissions | Risk Specialist |
| operational configuration — delivery pipeline, infrastructure, environments, runtime config | Operations Specialist |
| verification surfaces — acceptance criteria, coverage artifacts, reproducibility | Quality Specialist |
| documentation, guides, user-facing text | Communication Specialist |

### Step 4 — Gate profile and mission mode adjustment

- `closure_ready` MUST include Quality Specialist.
- `artifact_only` MAY omit implementation-specialist reviewers when no implementation surface is affected.
- `recovery_first` missions SHOULD add whichever specialist owns the damaged surface.

### Step 5 — Cross-cutting change expansion

The following conditions SHOULD trigger additional review even if surface heuristics did not:

- public interface or contract change
- data model or schema change
- migration, backfill, or bulk transformation
- trust boundary or permission change
- user-visible content or flow change
- delivery pipeline or versioning change

### Step 6 — Deduplicate and preserve expertise need

Duplicate reviewer types MUST be removed. If `primary_worker_type` also appears in the review set, that means the expertise is required; it does **not** mean self-review is sufficient.

### Step 7 — Minimum guarantee

Every task MUST have at least one reviewer type that differs from `primary_worker_type`. If the computed set contains only the worker's own type or is empty, add Design Authority.

## Conflict Resolution

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

## Quorum Rules

### Proposal-round quorum

Minimum: proposer plus one independent reviewer.
Recommended for cross-cutting changes: proposer plus Design Authority plus one affected domain specialist.

### Readiness-round quorum

Minimum for `high` or `critical` risk:

- Orchestrator
- Decision Maker
- at least one independent specialist
- Challenger when required by risk

If quorum cannot be reached after two attempts, the task SHOULD transition to `escalated` unless a local policy explicitly allows deferred decision with recorded rationale.

## Single-Agent and Small-Team Operation

A single physical agent MAY play multiple logical types, but the artifacts MUST show explicit role switching. In single-agent mode:

- the implementation role and review role MUST be recorded separately
- dissent or self-conflict MUST be captured in a decision record
- `high` and `critical` conflicts SHOULD escalate to the user
- final verdict MUST be rendered under an explicit Decision Maker role switch
- the system MUST NOT pretend independent review happened if it did not

## User Escalation Boundary

A conformant implementation SHOULD escalate to the user when any of the following occur:

- legal, privacy, or policy uncertainty
- repeated `iterate` or repeated recovery failure without narrowing uncertainty
- unresolved critical risk disagreement
- delivery of regulated or safety-sensitive output under a profile that requires user approval
- a policy override that weakens a normal hard-stop

## Audit Requirements

The following MUST remain reconstructible from artifacts:

- who the primary worker was
- who reviewed
- who challenged
- who issued the final verdict
- which role raised each blocking concern
- which dissenting positions were overruled and why
- whether any logical role separation collapsed into a single physical agent instance

## Type Naming Rules for Artifacts

Artifact types map to storage locations as follows:

| artifact type | storage |
|---|---|
| evidence (specialist review, challenge, verdict) | `evidence/{agent}.json` — role field inside, not filename |
| pipeline step output (self-check, gate, closure, etc.) | `record.json` section — section name identifies type |
| vote round / decision | `decisions/vote-round-{topic}.json` |
| task contract | `tasks/{tid}/contract.json` |

Role identity belongs inside validated fields, not inside ad hoc filenames.

## Key Statement

Authority in Geas is not ornamental. A role exists to constrain who may decide, what evidence they must inspect, and how a future auditor can verify that the decision was legitimate.
