# 00. Protocol Foundations

> **Normative document.**
> This document defines the constitutional layer of Geas. It specifies the control objectives, invariants, scope boundaries, and precedence rules that every conformant implementation MUST follow.
>
> **Normative language.** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, and **MAY** are to be interpreted as requirement levels for protocol conformance.

## Purpose

Geas exists to make long-running, multi-agent structured work behave like a disciplined organization instead of an unbounded prompt loop. A conformant implementation MUST, at minimum, achieve all of the following objectives:

1. Treat the **task** as the only first-class unit of closure.
2. Separate implementation, integration, verification, readiness, and product judgment.
3. Prevent false completion caused by stale baselines, missing evidence, skipped review, or weak recovery.
4. Preserve a complete post-hoc explanation of what changed, why it changed, who approved it, and what evidence justified shipping.
5. Make interruption, compaction, tool failure, and sub-agent loss recoverable from a safe boundary.
6. Convert repeated success and repeated failure into durable future behavior through rules, memory, debt tracking, and scope discipline.
7. Keep the protocol compatible with structured tool contracts, explicit handoffs, traceability, evaluation, and secure delivery controls.
8. Prefer the simplest workflow that can satisfy the mission while escalating rigor as risk rises.

## What This Document Governs

This document is authoritative for:

- the **control objectives** of the protocol
- the **order of precedence** between artifacts, schemas, hooks, and prose
- the **system invariants** that every implementation MUST preserve
- the **threat and failure model** Geas is designed to resist
- the **scope / non-scope** boundary of the standard
- the **conformance units** to which compliance claims apply

This document is not a field-by-field schema reference. See doc 09 for artifact contracts and doc 10 for enforcement and metrics.

## Conformance Units

A Geas implementation MAY claim conformance only for the specific unit it actually implements:

| conformance unit | description |
|---|---|
| `protocol_runtime` | the orchestrator and state machine that executes missions, tasks, gates, votes, recovery, and evolution |
| `artifact_producer` | any agent or subsystem that emits canonical Geas artifacts |
| `artifact_validator` | any hook, CLI, service, or CI component that validates schema and invariant compliance |
| `reviewer_runtime` | a specialist reviewer or critical reviewer implementation |
| `memory_engine` | rules.md management, agent memory injection, and memory candidate extraction |
| `recovery_engine` | checkpointing, safe-boundary detection, and state restoration / resume logic |

A system MUST NOT advertise “full Geas compliance” unless all listed units that it exposes satisfy the mandatory rules of this document.

## Order of Precedence

When two signals disagree, the following precedence order MUST apply:

1. **Safety and integrity constraints**
2. **Current mission contract and approved task artifacts**
3. **Canonical protocol prose in `docs/protocol/`**
4. **Canonical JSON schemas**
5. **Validated runtime artifacts under `.geas/`**
6. **Local rules in `.geas/rules.md`**
7. **Memory packets and summaries**
8. **Throughput or convenience heuristics**

Corollaries:

- A memory entry in rules.md MUST NOT override an explicit current-task acceptance criterion.
- A local rule MUST NOT weaken a higher-order safety or integrity invariant without an explicit, logged override path.
- A hook MUST NOT “repair” missing evidence by inventing synthetic evidence.
- Throughput optimization MUST yield to evidence integrity.

## Control Objectives: The Four Pillars

The protocol is organized around four control objectives. Every mechanism in Geas MUST strengthen at least one of them and MUST NOT materially undermine any of the others.

### 1) Governance

Governance answers: **who may decide, in what order, on the basis of what evidence?**

Governance is bound to the protocol through:

- explicit authority scopes
- separation of duties
- transition invariants
- vote-round and escalation rules
- final-verdict ownership
- phase review and exception handling

### 2) Traceability

Traceability answers: **can a reviewer reconstruct the story of this mission after the fact?**

Traceability is bound to the protocol through:

- append-only ledger events
- immutable or versioned runtime artifacts
- checkpoint and recovery records
- specialist reviews and dissent capture
- decision records
- debt, rules, retrospective, and gap-assessment artifacts
- event log and health signals

### 3) Verification

Verification answers: **what proves that the task is actually done?**

Verification is bound to the protocol through:

- implementation contracts
- worker self-checks
- specialist reviews
- evidence gates
- rubric scoring and explicit thresholds
- closure packets
- critical-review challenge
- final verdicts
- conformance and evaluation signals

### 4) Evolution

Evolution answers: **how does the system get better instead of merely getting older?**

Evolution is bound to the protocol through:

- retrospectives
- rule update loops
- memory updates to rules.md and agent notes
- technical debt registration and resolution
- gap assessment
- mission-to-mission carry-forward

## Design Axioms

The following axioms are protocol-wide and non-negotiable.

### Axiom 1 — The task is the sole unit of closure

Only tasks become `passed`. Missions, epics, or initiatives MAY conclude, but they do so as aggregates of task outcomes, not as independent closure objects.

### Axiom 2 — Assertions do not change state

Natural-language claims such as “implemented”, “verified”, or “done” MUST NOT mutate protocol state. State changes require the correct artifact, evidence, and transition conditions.

### Axiom 3 — The canonical state repository is the baseline authority

The current integration baseline is read from the canonical state repository (e.g., a version control system such as Git, a document versioning system, or a dataset snapshot store). Runtime artifacts may reference baseline snapshots, but they MUST NOT become a competing source of truth for the live baseline state.

### Axiom 4 — Verification and product judgment are separate

A gate result is not a ship decision. A passing gate shows that required verification succeeded; a final verdict decides whether the product should accept the change.

### Axiom 5 — Memory is a behavior-control mechanism

Memory is not archival decoration. To remain in the system, memory MUST change future behavior through context assembly, review focus, gate strictness, scheduling caution, or rule changes.

### Axiom 6 — Rigor is risk-scaled

Low-risk work MAY use lighter process, but no work may bypass the mandatory integrity invariants. High-risk work MUST receive additional review, traceability, and challenge.

### Axiom 7 — Simplicity before autonomy

The system SHOULD prefer direct, compositional workflows over unnecessary autonomy. Additional agentic complexity MUST be justified by measurable benefit, risk reduction, or irreducible task complexity.

### Axiom 8 — Context is loaded just in time

Context SHOULD be retrieved and assembled from provenance-bearing references as late as practical. The protocol SHOULD avoid monolithic prompt stuffing and SHOULD favor targeted packet assembly.

### Axiom 9 — Tooling is contract-driven

Tool usage MUST be mediated through explicit interfaces, structured inputs, and structured outputs. A tool or handoff without a reliable contract is not a trusted protocol surface.

### Axiom 10 — Learning without audit is not learning

Any rule, memory, or process hardening that changes future behavior MUST remain linked to the evidence that justified it.

## System Invariants

The following invariants apply across all documents.

1. A task MUST NOT enter `implementing` without an approved implementation contract.
2. A task MUST NOT enter `reviewed` without a worker self-check and the required review set.
3. A task MUST NOT enter `verified` without a gate result.
4. A task MUST NOT enter `passed` without a complete closure packet and final verdict.
5. A reviewer MUST NOT silently approve their own missing evidence.
6. High-risk and critical work MUST receive critical-review challenge before final product judgment.
7. Recovery MUST resume from a safe boundary or restore to one; it MUST NOT pretend an unsafe in-flight state is complete.
8. A stale baseline MUST be revalidated before integration or resumed verification.
9. Outdated memory entries MUST be removed or updated rather than left to coexist with contradictory current guidance.
10. Every phase transition MUST preserve scope clarity, debt visibility, and evidence continuity.
11. Evidence loss MUST block forward motion unless a documented, conservative recovery path exists.
12. An override MUST be explicit, attributable, scoped, and auditable.

## Failure and Threat Model

Geas is designed to reduce the following recurrent failure classes.

| failure / threat | protocol response surface |
|---|---|
| “done” without proof | contracts, reviews, gates, closure packet, final verdict |
| stale baseline and hidden integration drift | baseline rules, revalidation, integration lane, scheduler locks |
| scope creep after approval | contract amendments, gap assessment, phase review |
| review theater without real checking | required reviewer matrix, closure completeness, critical challenge |
| prompt / context contamination from stale or hostile inputs | selective context injection, rules.md curation, agent memory review |
| tool misuse or over-delegation | structured tool contracts, authority boundaries, mission mode rigor |
| recovery hallucination after interruption | two-phase checkpoints, safe boundaries, recovery tables |
| memory bloat or harmful reuse | rules.md curation, direct deletion of wrong entries, agent memory review |
| supply-chain or provenance ambiguity | artifact lineage, validation, release expectations |
| silent weakening of protocol rigor | conformance hooks, health signals, rules audit, explicit overrides |

Geas does **not** claim to eliminate these threats completely. It claims to make them visible, attributable, and structurally harder to ignore.

## Scope

A conformant baseline Geas implementation covers:

- single-workspace or project-local orchestration
- task-based multi-agent work and review
- isolated execution contexts (e.g., worktrees, sandboxes, dedicated workspaces)
- bounded parallelism with explicit lock semantics
- evidence gating and final task verdicts
- memory, rules, debt, and retrospectives
- checkpointing, recovery, and resumability
- mission-level phase progression
- conformance and health monitoring

## Non-Scope

Unless explicitly extended, Geas does not standardize:

- distributed multi-session cluster scheduling
- multi-repo federation and cross-org orchestration
- human HR, issue tracker, or ticketing workflows
- vendor-specific model behavior guarantees
- training-time model safety
- universal security compliance for all regulated environments
- autonomous production deployment without local policy review
- automatic legal, privacy, or policy determination

## Schema Compatibility and Hardening Guidance

Several documents in this protocol distinguish between:

- **schema-minimum requirements** — mandatory for current canonical artifacts
- **hardening recommendations** — additional operational rigor that a project MAY adopt

A project MUST NOT inject unschematized fields into canonical JSON artifacts unless its local schema extension explicitly permits them. If hardened metadata is needed before schemas are extended, the implementation SHOULD place that information in:

- companion artifacts
- human-readable summaries
- ledger events
- documented local schema extensions

This rule exists to preserve validator predictability while allowing the standard to evolve.

## Glossary

### Core concepts

- **Task** — the only first-class unit that can become `passed`
- **Mission** — the higher-level objective that normalizes a user request into executable protocol work
- **Mission Phase** — `specifying | building | polishing | evolving | complete`
- **Baseline** — the last verified snapshot of the work state that a task was validated against (e.g., a Git commit, a document version, a dataset checkpoint)
- **Workspace** — an isolated task execution context (e.g., a Git worktree, a sandboxed environment, a dedicated working directory)
- **Integration** — the process of merging a task's outputs into the shared baseline (e.g., a Git merge, a document version publish, a dataset update)
### Verification concepts

- **Evidence** — a traceable, independently verifiable artifact that supports a claim about task completion. In software this may be test results; in research, cited sources; in content, verified claims with provenance
- **Evidence Gate** — the ordered verification mechanism that produces `pass | fail | block | error`
- **Rubric** — a set of scored dimensions with explicit thresholds used in Tier 2 verification
- **Closure Packet** — the compressed, final evidence bundle submitted for product judgment
- **Final Verdict** — the product-level task decision: `pass | iterate | escalate`
- **Vote Round** — a structured deliberation used for proposal resolution or ship readiness
- **Approval** — an explicit, recorded act by an authorized role that permits a transition or accepts an artifact. Approval is not implied by silence or inactivity
- **Evidence Integrity** — the property that evidence has not been fabricated, silently altered, or disconnected from its source artifact

### Role concepts

- **Agent** — a logical role instance that performs work within the protocol. An agent has a type, authority scope, and required outputs
- **Orchestrator** — the coordinating authority that manages mission flow, task routing, and recovery
- **Specialist** — a domain-specific agent type that produces evidence within its area of expertise
- **Worker** — the agent assigned as primary implementer for a task
- **Reviewer** — an agent that evaluates a worker's output within a specific jurisdiction
- **Critical Reviewer** — an adversarial reviewer that challenges assumptions before product judgment
- **Independent Reviewer** — a reviewer whose specialist slot differs from the primary worker's slot and who did not produce the artifact being reviewed

### Lifecycle concepts

- **Implementation Contract** — a pre-approved agreement defining what will be built, how, and what will not be changed
- **Worker Self-Check** — a structured self-assessment produced by the worker before claiming implementation completion
- **Failure Record** — the artifact describing a failure, restoration target, and retry impact
- **Decision Record** — a persistent record of conflicting positions, chosen outcome, and rationale
- **Retrospective** — a structured post-task reflection producing rule, memory, and debt candidates
- **Safe Boundary** — a task state where all preceding artifacts are complete and validated, making exact resume or conservative restoration possible (e.g., implementation complete with self-check persisted, all reviews persisted, gate result persisted)

### Evolution concepts

- **Memory** — structured operational knowledge intended to change future behavior
- **Debt** — an acknowledged compromise or deferred concern with future cost
- **Gap Assessment** — the comparison between promised scope and delivered scope
- **Rules** — shared behavioral constraints accumulated from retrospectives and approved through review

### Infrastructure concepts

- **Artifact** — a structured, schema-validated JSON object that records a protocol event or decision
- **Hook** — an enforcement mechanism triggered at lifecycle events to validate invariants
- **Ledger** — the append-only event log at `.geas/state/events.jsonl` recording significant protocol actions
- **Record** — the single execution record file per task (`record.json`) accumulating all pipeline step outputs
- **Packet** — an assembled context bundle delivered to an agent for a specific task or decision
- **Context Engineering** — the practice of curating the minimal high-signal token set for each agent interaction (doc 07)
- **Canonical** — the single authoritative version of a given artifact, state, or definition. When multiple representations exist, the canonical one is the source of truth

## Canonical Ownership

The canonical ownership model is:

- protocol semantics: `docs/protocol/`
- architecture and supporting design rationale: `docs/architecture/`
- schema contracts: `docs/protocol/schemas/`
- runtime evidence and summaries: `.geas/`
- human reference material: `docs/reference/`

If a reference document conflicts with a normative protocol document, the normative protocol document wins.

## Change Control and Versioning

A project adopting Geas SHOULD maintain a visible protocol version. Any change that affects one of the following MUST be treated as a protocol change:

- state machine transitions
- required evidence or approval rules
- artifact completeness conditions
- recovery safety boundaries
- memory system semantics

Protocol changes SHOULD be introduced by:

1. a rationale and change summary
2. the affected document updates
3. schema and hook impact analysis
4. migration notes if existing artifacts become incompatible

## Domain Applicability

Geas was first designed for multi-agent software development, but its core mechanisms — governed decisions, evidence-based closure, checkpoint recovery, and learnable feedback loops — are domain-agnostic.

The protocol applies to any structured work where an AI agent team must:

- clarify what needs to be done before doing it
- produce verifiable outputs against agreed criteria
- recover from interruption without losing progress
- learn from outcomes and improve future performance

Domain-specific configuration is expressed through:

| configuration surface | examples by domain |
|---|---|
| role catalog | software: software_engineer, platform_engineer, qa_engineer / research: literature_specialist, methodology_reviewer, domain_expert / content: writer, editor, fact_checker |
| evidence types | software: test results, build logs / research: cited sources with DOI, statistical analyses / content: source-verified claims, style-checked drafts |
| Tier 1 verification | software: build, lint, test / research: source verification, citation check / content: grammar, style lint, fact verification / data: schema validation, pipeline reproducibility |
| workspace model | software: Git worktree / research: literature corpus + notes / content: draft versioning / data: dataset snapshots |
| baseline model | software: Git commit / research: literature snapshot / content: approved outline version / data: validated dataset version |

The protocol core (phases, gates, verdicts, memory, recovery) remains identical across domains. Only the content that fills these structures changes.

## Key Statement

Geas is not a style preference. It is an operational constitution for AI-assisted structured work. A conformant implementation MUST preserve evidence integrity, role clarity, recovery conservatism, and learnable feedback loops even when that slows the fastest path.
