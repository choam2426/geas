# 01. Agents and Authority

> Defines the slot families Geas uses and the authority boundaries for design, coordination, approval, and challenge.

## Purpose

Geas fixes authority boundaries first. When it is unclear who decides what, design, coordination, approval, and challenge collapse into a single agent and the basis for judgment gets weaker. This document defines the slot families and authority boundaries.

## Slot Families

### Authority Family

| Display Name | slot id | Core responsibility |
|---|---|---|
| Orchestrator | `orchestrator` | Coordinates task order, state, reviewer composition, and phase progression |
| Decision Maker | `decision-maker` | Handles mission-level approval and the final judgment |
| Design Authority | `design-authority` | Structures the mission and designs the set of task contracts |
| Challenger | `challenger` | Challenges hidden complexity, boundary violations, and ambiguous contracts |

### Specialist Family

| Display Name | slot id | Core responsibility |
|---|---|---|
| Implementer | `implementer` | Executes work according to an approved task contract |
| Verifier | `verifier` | Independently checks the acceptance criteria and verification procedure |
| Risk Assessor | `risk-assessor` | Surfaces shortfalls from safety, quality, and risk perspectives |
| Operator | `operator` | Examines operations, deployment, recovery, and observability concerns |
| Communicator | `communicator` | Checks user-facing deliverables, documentation, explanations, and handoff quality |

Slots are role positions. An implementation may map them to concrete agent types, but protocol meaning is always interpreted from the slot names.

## Authority Role Boundaries

### Orchestrator

**Responsibilities**

- Turns the user request into a mission spec.
- Coordinates task flow against the approved mission spec and mission design.
- Finalizes each task's `routing` and locks the reviewer composition.
- Manages task state transitions, baseline rechecks, and workspace collision avoidance.
- Reads the relevant artifacts and records the task closure decision.
- Writes phase reviews and prepares phase transitions.

**What it cannot do**

- It cannot approve the mission spec, mission design, or initial set of task contracts.
- It cannot write the implementation, review, or verification evidence that specialists are supposed to leave.
- It cannot issue the mission final verdict.

### Decision Maker

**Responsibilities**

- Approves intermediate task contracts that are added within the current mission scope.
- Judges mission-level structural trade-offs and reasons to hold work back.
- Issues the mission final verdict.
- Reviews the mission design and initial task contract set before user approval in `standard` missions.
- Participates in the required deliberation on the mission design and initial task contract set in `full_depth` missions.

**What it cannot do**

- Because only the user can approve the mission spec, mission design, and initial task contract set, the Decision Maker cannot approve them on the user's behalf.
- It cannot write implementation evidence for an individual task.
- It cannot substitute for the task-by-task closure decision.
- It cannot approve a task contract that falls outside the current mission scope. Work outside scope is not handled within this mission; the user must escalate the mission or create a follow-on mission.
- It cannot issue the mission final verdict while required reviewers are missing.

### Design Authority

**Responsibilities**

- Writes the mission design from the approved mission spec.
- Decomposes the mission into a set of task contracts.
- Checks whether each task can close as a single unit and whether the acceptance criteria are sufficient.
- Re-establishes the decomposition approach when new tasks become necessary during execution.

**What it cannot do**

- It cannot finalize reviewer routing in place of the Orchestrator.
- It cannot change task state arbitrarily.
- It cannot issue the mission final verdict.

### Challenger

**Responsibilities**

- Surfaces hidden complexity, layering violations, contract ambiguity, and excessive optimism.
- When it sees serious risk, records a challenge with explicit blocking reasons.
- Signals when a deliberation item needs to be opened.

**What it cannot do**

- It cannot exercise approval authority on its own.
- It cannot treat vague preference as a blocking reason.
- It cannot substitute for a required reviewer.

## Minimum Obligations by Specialist Slot

| slot id | Minimum obligation |
|---|---|
| `implementer` | Works within the approved task contract and implementation contract, and leaves a traceable record of the actual change |
| `verifier` | Checks the acceptance criteria and verification procedure independently, and records the result with supporting grounds |
| `risk-assessor` | Explicitly points out risk, safety issues, structural flaws, and verification gaps |
| `operator` | Surfaces defects from the standpoint of operability, deployability, recoverability, and observability |
| `communicator` | Checks whether user-facing deliverables and explanations stay aligned with purpose, scope, and constraints |

The specialist family is the minimum shared classification across domains. Implementations may add more specific types, but they must not weaken these minimum responsibilities.

## Naming Convention

Use the following conventions consistently throughout the protocol.

- **Slot identifier**: kebab-case. Examples: `decision-maker`, `design-authority`, `risk-assessor`. The schema's slot enum, the task contract's `required_reviewers` values, the evidence `slot` field, and file paths like `evidence/{agent}.{slot}.json` all use this form.
- **Concrete agent type**: kebab-case. Examples: `software-engineer`, `security-engineer`. For authority slots, the concrete type matches the slot name itself (`decision-maker`, and so on).
- **Field enum values and event actors**: values tied to a slot id also stay in **kebab-case**. Examples: `approved_by: "decision-maker"`, `events.actor: "decision-maker"`. The same concept does not split into multiple spellings inside the protocol.

## Common Operating Principles

- A single concrete agent may fill multiple slots, and within one task it may even combine reviewer/verifier-family slots. But the `implementer` slot is exclusive: an agent acting as implementer on a task cannot hold any other slot on that same task. Role changes must be explicit in evidence paths like `evidence/{agent}.{slot}.json`.
- Authority slots must not stand in for missing specialist work.
- Missing specialist review must not be bypassed through closure or the final verdict.
- Task-level evidence, gate, deliberation, and closure are owned by [03_TASK_LIFECYCLE_AND_EVIDENCE.md](./03_TASK_LIFECYCLE_AND_EVIDENCE.md).
- Mission phases and the mission final verdict are owned by [02_MISSIONS_PHASES_AND_FINAL_VERDICT.md](./02_MISSIONS_PHASES_AND_FINAL_VERDICT.md).
- Canonical paths and schema links are owned by [08_RUNTIME_ARTIFACTS_AND_SCHEMAS.md](./08_RUNTIME_ARTIFACTS_AND_SCHEMAS.md).
