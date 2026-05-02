# 02. Missions, Phases, and Final Verdict

> Defines the Geas mission model, mission operating modes, the four-phase flow, phase reviews, mission-level deliberation, and the mission final verdict.

## Purpose

A mission is the top-level unit that turns a user request into an executable system of work. This document defines what a mission is, how it narrows through an approval sequence, and when it moves to the next phase and receives final approval.

## Mission

A mission is defined by three artifacts.

- **Mission spec** - what the mission must satisfy (opening contract)
- **Mission design** - how the mission will achieve it (plan)
- **Mission verdict** - how the mission closed (closing judgment)

Alongside these artifacts, the **operating mode** determines how deep the mission's judgment and review should go (the `mode` field in the spec).

Spec and design are fixed during the specifying phase; the verdict is fixed during the consolidating phase.

### Mission Operating Mode

Operating mode determines how much design, review, and consolidation depth Geas expects even for the same mission.

| mode | Default expectation |
|---|---|
| `lightweight` | Keep the structure simple, but do not skip approval or the minimum artifacts |
| `standard` | The default depth. Leave a balanced record of design, execution, review, and consolidation |
| `full_depth` | Make dissent, unresolved risk, and carry-forward rationale more explicit |

Operating mode changes judgment depth, not the approval order or responsibility for the final verdict.

### Mission Spec

The mission spec is the top-level contract that fixes "what this execution must satisfy." It is written by the Orchestrator and approved by the user. The canonical JSON artifact is `spec.json`, and the exact structure is owned by `mission-spec.schema.json`.

The mission spec defines the following fields.

| Core field | Meaning |
|---|---|
| `id` | Stable identifier for this mission |
| `name` | Mission name |
| `description` | What the user actually wants and why this mission is needed |
| `definition_of_done` | The top-level standard for deciding that the mission is complete |
| `mode` | Mission operating mode (`lightweight` / `standard` / `full_depth`) |
| `scope.in` / `scope.out` | What this mission owns and what it does not own |
| `affected_surfaces` | Surfaces likely to be affected by the mission result |
| `acceptance_criteria` | Concrete completion criteria derived from `definition_of_done`; used for phase gates and task derivation |
| `constraints` | Constraints that must be obeyed |
| `risks` | Mission-level risks known at the outset |
| `user_approved` | Whether the current mission spec has been approved by the user as the execution baseline |

The mission spec should be the result of clarifying the user's request through conversation or deliberation. The larger or more ambiguous the mission is, the more explicitly its `risks` and `constraints` should be surfaced. Assumptions and unknowns discovered during execution are spelled out in the mission design.

The mission spec is immutable after user approval. If scope needs to widen or `definition_of_done` needs to change, the current mission must be escalated or a new mission must be started. Regression back to `specifying` is not allowed.

### Mission Design

Mission design (`mission-design.md`) is the document that expands the approved mission spec into an actual implementation plan. It is written by the Design Authority and receives **final approval from the user**. The prerequisite process before user approval varies by mode: `lightweight` goes directly to the user, `standard` requires a Decision Maker review before user approval, and `full_depth` requires a deliberation involving the Decision Maker, Challenger, and one specialist before user approval. As the baseline for "how" the mission will proceed, it gathers the approach, design decisions, verification plan, risks, and failure modes in one place.

Mission design must contain the following sections. Every section is required. If a section does not apply, write a single line `N/A ({reason})`.

| Section | Contents |
|---|---|
| `## Strategy` | High-level approach, including the primary path and why it was chosen |
| `## Architecture & Integration` | Component structure, data flow, and touchpoints with existing surfaces |
| `## Task Breakdown Rationale` | Why the work was split along these task boundaries (the task list itself belongs in task contracts) |
| `## Verification Plan` | Verification activities by category. Each item names scope, tools, and the responsible slot |
| `## Key Design Decisions` | Major design choices, their rationale, and alternatives considered |
| `## Assumptions` | Design assumptions. `- {assumption}: {impact if false}` |
| `## Unknowns` | Open items. `- {item} - resolve at {phase} - {method}` |
| `## Risks` | Risks plus mitigation or acceptance rationale |
| `## Failure Modes` | Expected failure patterns and planned responses |
| `## Migration / Rollout` | Transition plan for existing functionality, or `N/A ({reason})` |

Heading names must match the table exactly. The CLI validates only whether the sections exist.

### Mission Verdict

The mission verdict is the closing judgment for a mission. Its value is one of `approved`, `changes_requested`, `escalated`, or `cancelled`, and only the Decision Maker may issue it. All verdicts for a mission are appended in time order to the `verdicts` array of a single file, `mission-verdicts.json`. The exact structure is owned by `mission-verdicts.schema.json`.

If additional work happens after `changes_requested` or `escalated` and consolidating ends again, a new verdict object is appended. The latest entry is the current judgment.

Each verdict object has the following fields.

| Field | Meaning |
|---|---|
| `verdict` | This judgment: `approved`, `changes_requested`, `escalated`, or `cancelled` |
| `rationale` | The basis for the judgment. It may cite specific artifact paths inside the prose |
| `carry_forward` | Items passed forward to future work, such as risks, debt, or unresolved gap items. Empty array if none |
| `created_at` | When the verdict was written |

When issuing a verdict, the Decision Maker reads the mission's full artifact set: mission spec, mission design, phase reviews, gap, debts, memory update, every mission-level deliberation, and each task's contract, evidence, and closure. The basis for the judgment is captured in `rationale`.

A mission does not become `approved` automatically just because every task is `passed`. There may still be mission-level gap, accepted debt, or carry-forward work that matters to the final judgment.

#### Handling a Cancelled Mission

If a mission must stop because of a user request or an external reason, it closes with verdict `cancelled`. Any mission that has progressed even slightly must still go through `consolidating`, organize debts, gap, and memory updates as far as possible, and then record verdict `cancelled`. The only exception is abandoning the mission during `specifying` before the mission spec has user approval; in that case, the mission may skip consolidating, transition directly to `complete`, and record verdict `cancelled`.

## 4-Phase Model

Every mission follows `specifying -> building -> polishing -> consolidating`. Once consolidating finishes, the mission phase transitions to the terminal state `complete`. If polishing introduces a new task, however, the mission may return to building.

### Phase Review

A phase review is the official record created at a phase gate to decide "may this mission enter or leave this phase?" All phase reviews for a mission are appended in time order to the `reviews` array of a single file, `phase-reviews.json`. The exact structure is owned by `phase-reviews.schema.json`.

Each review object has the following fields.

| Field | Meaning |
|---|---|
| `mission_phase` | Which phase this review applies to |
| `status` | The gate result for this review: `passed`, `blocked`, or `escalated` |
| `summary` | Summary supporting the judgment |
| `next_phase` | The phase to enter next when the status is `passed` |
| `created_at` | When this review was written |

A phase review records mission-level judgment. It does not replace task-level verification passes or closure decisions. If the same phase is blocked and later retried, a new review object with the same `mission_phase` is appended to the array.

### `specifying`

**Purpose**: turn the user request into an approvable mission baseline and design the initial task set.

**Activities in this phase** (approval order is fixed):

1. Orchestrator drafts the mission spec through conversation and deliberation with the user
2. User approves the mission spec
3. Design Authority writes the mission design
4. Mode-dependent prerequisite:
   - `lightweight`: none
   - `standard`: Decision Maker reviews before user approval
   - `full_depth`: deliberation with Decision Maker, Challenger, and one specialist (mandatory before user approval)
5. User approves the mission design
6. Design Authority writes the initial task contract set
7. Mode-dependent prerequisite (same rule as step 4)
8. User approves the initial task contract set
9. Orchestrator checks execution feasibility and reviewer composition, then the phase gate fires

**Responsibilities by slot**:

| Slot | What they do |
|---|---|
| Orchestrator | Lead user conversation, draft mission spec, check execution feasibility and reviewer composition |
| Design Authority | Write mission design and initial task contract set |
| Decision Maker | Pre-user review (`standard`) or deliberation voter (`full_depth`) |
| Challenger | Deliberation voter in `full_depth` (mandatory) |
| Specialist | Deliberation voter in `full_depth` (one, mandatory) |
| User | Final approver of mission spec, mission design, and initial task set |

**The final approver is always the user.** Mode only changes the depth of the prerequisite process before user approval.

**Outputs**: mission spec, mission design, initial task contract set, phase review.

**Phase gate checks**: whether the mission spec is user-approved, whether the mission design is consistent with the mission spec, and whether the initial task contract set is user-approved.

**On passing the phase gate**: change the initial tasks' `status` from `drafted` to `ready`, then transition to `building`.

### `building`

**Purpose**: execute approved task contracts and accumulate task-level evidence and closure rationale.

**Activities in this phase** (repeated per task):

1. Scheduler dispatches a `ready` task (dependencies `passed` and baseline valid)
2. Implementer writes the implementation contract, performs the implementation, and records the self-check
3. Required reviewers submit review evidence; verifier submits verification evidence
4. Orchestrator runs the evidence gate
5. Orchestrator writes the task closure decision (closure evidence)
6. When needed, Orchestrator convenes task-level deliberation
7. When needed, Decision Maker approves an additional in-scope task contract
8. Once every task targeted for this phase is `passed` or organized as carry-forward, the phase gate fires

**Responsibilities by slot**:

| Slot | What they do |
|---|---|
| Orchestrator | Manage task order and state, run evidence gate, record task closure decision, convene task-level deliberation when needed |
| Specialist | Act as implementer / reviewer / verifier per task (see doc 03) |
| Challenger | Raise task-level challenge when needed |
| Decision Maker | Approve in-scope additional task contracts, task-level deliberation voter |

**Outputs**: implementation contract, self-check, task evidence, gate result, task closure decision, phase review.

**Phase gate checks**: whether the tasks intended to finish in this phase are `passed`, or whether remaining work is explicitly represented as new tasks or carry-forward items.

**On passing the phase gate**: transition into `polishing`, where the integrated result is refined at mission level.

In building, the Decision Maker does not repeatedly issue per-task final verdicts. Task closure is handled through the Orchestrator's task closure decision, while the Decision Maker stays focused on mission-level judgment.

When new task contracts are added during building or polishing, the approval owner depends on whether the work falls within the current mission scope. Tasks that remain inside current scope are approved by the Decision Maker, and the task contract records `approved_by: decision-maker`. Work outside current scope is not handled inside this mission. Because the mission spec is immutable, the user must escalate the mission or create a follow-on mission and connect it through carry-forward.

### `polishing`

**Purpose**: re-evaluate task-level completion as mission-level completeness.

**Activities in this phase**:

1. Orchestrator inspects the integration state
2. Design Authority and relevant specialists identify any remaining structural shortfall
3. Each shortfall is classified as: new task / debt / gap / no action
4. If new tasks are needed, write contracts, approve, and return to `building`
5. If no new tasks are needed, the phase gate fires and the mission transitions to `consolidating`

**Responsibilities by slot**:

| Slot | What they do |
|---|---|
| Orchestrator | Synthesize integration state, decide how each shortfall is treated |
| Design Authority | Identify structural shortfall, write new task contracts when needed |
| Specialist | Help identify structural shortfall from their lens |
| Decision Maker | Approve new in-scope task contracts |

**Outputs**: additional task contracts when needed, phase review.

**Phase gate checks**: whether the remaining shortfall should become new tasks, remain as debt/gap, or be left with no additional action.

**On passing the phase gate**: if new tasks are needed, write the contracts and return to `building`; otherwise transition to `consolidating`.

Polishing is not a stage for cosmetic cleanup. It is the point where the mission identifies remaining shortfall and decides whether to absorb it, defer it, or drive it back into execution.

### `consolidating`

**Purpose**: decide what must be preserved and what must be carried forward before the mission closes.

**Activities in this phase**:

1. Orchestrator scans every evidence, closure, and deliberation to aggregate `memory_suggestions`, `debt_candidates`, and `gap_signals`
2. Design Authority checks scope closure and writes the gap artifact
3. Orchestrator finalizes debt and memory updates
4. Decision Maker synthesizes all mission artifacts and issues the mission final verdict
5. Phase gate fires and the mission phase transitions to `complete`

**Responsibilities by slot**:

| Slot | What they do |
|---|---|
| Orchestrator | Finalize memory and debt, organize carry-forward, assemble closure rationale |
| Design Authority | Check scope closure, write gap artifact |
| Decision Maker | Issue mission final verdict |

**Outputs**: gap, debts, memory inputs, mission final verdict, final phase review.

**Phase gate checks**: whether debt and gap are organized, whether carry-forward items are visible, and whether the rationale for a final verdict is sufficient.

**On passing the phase gate**: transition the mission phase to `complete`.

### Phase Regression Rules

After a phase gate ends with `passed`, only the following regressions are allowed when selecting the next phase beyond the normal path.

- `polishing -> building`: when the remaining structural shortfall can only be addressed through new tasks.
- `consolidating -> polishing` or `consolidating -> building`: when consolidating reveals shortfalls that cannot be carried forward as debt or gap and must be handled within the current mission.

Regression to `specifying` is not allowed. If the mission spec itself must change, escalate the current mission or start a new one.

## Mission-level Deliberation

Deliberation is the structured record used when mission-level judgment requires an explicit multi-party decision. The exact structure is owned by `deliberation.schema.json`, and the same schema is used for task-level deliberation. All deliberations for a scope are appended in time order to the `entries` array of a single file (`deliberations.json` at mission level, or each task's own `deliberations.json` at task level). The top-level `level` field distinguishes the scope, and task-level records also include `task_id`.

A deliberation entry is appended only after every voter's vote and the final `result` are both fixed. There is no persisted "open deliberation" state; in-progress deliberation is tracked only in Orchestrator context. This preserves append-only immutability: once written, an entry is never modified.

Mission-level deliberation is usually opened in the following cases.

- there is major disagreement over the structural direction of the mission spec or mission design
- polishing or consolidating produces disagreement over what should be carried forward
- before the final verdict, the mission needs an explicit record of why it is being held, approved, or escalated

### Operating Mode Requirements

- `lightweight`: open deliberation ad hoc when disagreement appears. The user approves the mission design and initial task contract set directly.
- `standard`: open deliberation when any of the three situations above occurs. The Decision Maker reviews the mission design and initial task contract set before user approval.
- `full_depth`: on top of the standard rule, before the user approves the mission design and initial task contract set, each must go through at least one deliberation. That deliberation must include the Decision Maker, the Challenger, and one specialist slot appropriate to the mission context as voters (minimum three voters). If that deliberation passes, the separate Decision Maker review may be skipped.

Challenger participation is optional in `lightweight` and `standard`, but mandatory in `full_depth`. Because voter slots are recorded in the artifact, the phase gate checks whether a `full_depth` mission's deliberation entry includes `voter: challenger` and at least three voters. If either condition is missing, the phase cannot pass. This three-voter plus Challenger rule is enforced by phase review. The CLI `deliberation append` command accepts anything meeting the schema minimum of two voters, so violations are detected when the phase is being closed.

The Orchestrator may increase the voter count beyond this minimum. If the weight or scope of the issue calls for a wider perspective, the Orchestrator includes additional specialists as voters. The minimum requirements above are fixed by mode; anything beyond them is left to Orchestrator judgment.

Deliberation used to close a task is owned by [03_TASK_LIFECYCLE_AND_EVIDENCE.md](./03_TASK_LIFECYCLE_AND_EVIDENCE.md).
