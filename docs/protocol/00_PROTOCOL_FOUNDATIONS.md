# 00. Protocol Foundations

## Purpose

This protocol defines **operational rules for single-session, worktree-based multi-agent coding**. The core objectives are the following seven:

1. Fix the task as the sole unit of closure.
2. Separate implementation, integration, verification, and closure decisions.
3. Structurally prevent stale baselines, integration drift, false greens, and incomplete closures.
4. Ensure the team improves across sessions -- retrospective, rule updates, memory promotion, debt tracking, and gap assessment form a single **Evolution loop**.
5. Enable recovery after long sessions, compaction, and sub-agent execution.
6. Re-measure scope, debt, and learning status at every phase boundary.
7. Align every mechanism in the protocol under the **4 Pillars**.

## Four Pillars as Control Objectives

The Geas protocol is not merely a collection of procedures; it must satisfy four control objectives.

### 1) Governance
It must be clear who is authorized to make which decisions, and which decisions enforce a specific ordering.

Protocol binding:
- agent authority matrix
- transition invariants
- vote rounds
- final verdict ownership
- phase review / escalation

### 2) Traceability
Every significant action must be explainable after the fact.

Protocol binding:
- append-only ledger events
- runtime artifacts
- specialist reviews
- failure / revalidation / recovery records
- debt register / gap assessment / retrospective

### 3) Verification
The standard is not "it's done" but **contract fulfilled**.

Protocol binding:
- implementation contract
- worker self-check
- evidence gate
- rubric scoring
- specialist review matrix
- closure packet + final verdict

### 4) Evolution
The team must get better with each session.

Protocol binding:
- per-task retrospective
- rules.md update loop
- agent_memory / project_memory / risk_memory
- memory promotion / weakening / supersession
- debt tracking
- gap assessment
- initiative evolution phase

## Design Principles

### 1) The task is the sole unit of closure
The protocol does not model issue/epic/initiative closure as first-class entities. Only tasks can be closed.

### 2) Orchestration and final product judgment are separated
- `orchestration_authority` designs, assembles, and enforces the flow.
- `product_authority` issues the final verdict from a product perspective.

### 3) State transitions are artifact-based
State cannot be changed by natural-language declaration. Each transition requires the appropriate artifact, evidence, review, or verdict.

### 4) Git is the source of truth for the live baseline
The live HEAD is not redundantly stored in runtime artifacts. A task holds a `base_commit`, and the current baseline is read from Git.

### 5) Memory is a behavior-change device, not a data store
Memory must change future behavior through future packets, reviewer focus, gate strictness, scheduling caution, and rules.md.

### 6) Passing tests and closure are different things
`verified` means technical verification has passed; `passed` means the task is eligible for protocol-level closure.

### 7) Strict before start, lenient during implementation
- Before start: stale tasks must be revalidated.
- During implementation: upstream movement alone does not trigger an immediate halt.
- Before integration: reconciliation is mandatory.

### 8) Gates are verification devices; vote rounds are decision devices
- Evidence gates provide objective verification.
- Vote rounds provide disagreement resolution / ship-readiness deliberation.
- Final verdicts provide product closure decisions.

### 9) Specialist participation must be reflected in evidence
Who participated must be recorded in the closure packet and artifact matrix.

## Scope / Non-Scope

### Scope
- single-session orchestration
- worktree-based task execution
- bounded parallelism
- task lifecycle / gate / verdict / recovery / memory / context management
- initiative 4-phase mission progression
- retrospective / debt / gap assessment feedback loops

### Non-Scope
- multi-session distributed scheduler
- human issue tracker sync
- multi-repo federation
- global knowledge graph

## Glossary

- **Task**: The sole unit of work that can be closed
- **Mission**: The higher-level objective a session aims to resolve. May spawn one or more tasks
- **Mode**: `discovery | delivery | decision`
- **Runtime Phase**: `bootstrap | planning | scheduling | executing | integrating | verifying | learning | idle`
- **Mission Phase**: `discovery | build | polish | evolution`
- **Baseline**: The commit on the integration branch that a task was last validated against
- **Worktree**: A task-dedicated workspace
- **Gate**: Objective verification. Result is one of `pass | fail | block | error` (see doc 05)
- **Gate Profile**: Classification that determines how a task's gate verification is conducted. `code_change | artifact_only | closure_ready`
- **Vote Round**: Consensus or readiness check among specialists. Two types: `proposal_round` and `readiness_round`
- **Vote Round Policy**: Per-task condition for executing a vote round. `never | auto | always`
- **Closure Packet**: A compressed evidence bundle for the final verdict
- **Final Verdict**: The definitive judgment issued by `product_authority` based on the closure packet. `pass | iterate | escalate`
- **FailureRecord**: A record created on task failure. Includes failure cause, rewind target, and timestamp. Failure is not a separate state; it is tracked through this record
- **Decision Record**: A result artifact that documents disputes/conflicts/pivots resolved in decision mode
- **Memory**: Structured operational knowledge reused at the task/mission/project level
- **Debt**: A known compromise that is not blocking now but incurs future cost
- **Gap Assessment**: A procedure that evaluates the difference between the original scope_in and the actually delivered scope_out
- **Implementation Contract**: A pre-implementation agreement between worker and reviewers before code is written (see doc 03)
- **Worker Self-Check**: A self-inspection artifact the primary worker produces before claiming implementation is complete (see doc 03)
- **Specialist Review**: A review result artifact produced by a specialist for a task (see doc 06)

## Canonical Ownership

- canonical documents: `docs/`
- canonical schemas: `schemas/`
- runtime/output: `.geas/`
- reference only: `reference/`
