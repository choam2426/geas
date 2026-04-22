# 03. Task Lifecycle and Evidence

> Defines task contracts, task state transitions, evidence structure, the evidence gate, task-level deliberation, task closure decisions, implementation contracts, and self-checks in Geas.

## Purpose

The task is the smallest contract that slices a mission into an actually executable unit. This document defines how a task begins, what evidence accumulates around it, and what judgments close it.

## Task Contract

The task contract is the work-unit agreement that defines what the task actually has to do and when it can close. If the mission defines overall scope and completion criteria at a higher level, the task contract defines the executable goal, routing, acceptance criteria, dependencies, and baseline underneath it. The canonical JSON artifact is `contract.json`, and the exact structure is owned by `task-contract.schema.json`.

### Fields in a Task Contract

| Field | Meaning |
|---|---|
| `mission_id` | Parent mission identifier used for path and consistency checks |
| `task_id`, `title`, `goal` | Identify what this task is trying to do |
| `risk_level` | Baseline risk level that controls review conservatism and closure strictness |
| `surfaces` | The surfaces this task actually touches |
| `routing` | Fixes the primary worker type and the list of required reviewer slots. The primary worker slot is always implicitly `implementer`. Concrete reviewer types are resolved at runtime from the mission's domain profile |
| `acceptance_criteria` | Observable criteria that must be checked before the task can close |
| `verification_plan` | Describes how this task will be verified |
| `base_snapshot` | The baseline reference point from which this task starts |
| `dependencies` | Tasks that must already be `passed`. Empty array if none |
| `supersedes` | Prior task id this task replaces. Set when taking over from a cancelled prior contract; otherwise `null` |
| `approved_by` | Who approved this contract as executable: `null` (not yet approved), `user` (direct user approval), or `decision-maker` (Decision Maker approval for in-scope additions) |

The task contract is the agreement file that carries intent and approval. Lifecycle status (`drafted -> ready -> ...`) lives in `task-state.json`, not in the contract. See [05_RUNTIME_STATE_AND_RECOVERY.md](./05_RUNTIME_STATE_AND_RECOVERY.md).

A task must not enter an execution state until `approved_by` is no longer `null`. Initial tasks and any task outside the current mission scope always require `user` approval. Mid-mission tasks within scope may be approved by the Decision Maker.

## Task Decomposition Rules

- A task must be small enough to close with a single closure decision.
- Acceptance criteria must be specific enough that a reviewer can observe task completion.
- `surfaces` must not hide the true change surface.
- A single task must not bundle multiple independent approval steps.
- When a new structural branch appears, split it into a new task instead of forcing it into the existing one.

## State and Transitions

Tasks cycle through six active states (`drafted`, `ready`, `implementing`, `reviewing`, `deciding`, `passed`) and three hold/terminal states (`blocked`, `escalated`, `cancelled`). Each active state is described below with its activities, slot responsibilities, outputs, and the condition for leaving it — laid out like the phase sections in doc 02. Hold/terminal states carry no work, so they follow as a short table. The full set of transition conditions and rewind paths lives in the transition table at the bottom.

### `drafted`

**Meaning**: a draft task contract exists but is not yet approved.

**Created when**: during the mission's specifying phase when the initial task set is produced. A task also enters this state during building or polishing when a new in-scope task contract is created (see doc 02).

**Activities in this state**:

1. Design Authority drafts the task contract (`goal`, `acceptance_criteria`, `surfaces`, `routing`, `verification_plan`, etc.)
2. The approval owner reviews the contract and sets `approved_by`

**Responsibilities by slot**:

| Slot | What they do |
|---|---|
| Design Authority | Draft the task contract |
| User | Approve initial task set or any task outside mission scope |
| Decision Maker | Approve in-scope mid-mission tasks |

**Outputs**: `contract.json` (unapproved).

**Condition to leave**: `approved_by` is not `null` and the phase gate passes → `ready`.

### `ready`

**Meaning**: approved and waiting to be dispatched.

**Activities in this state**:

- No active work. The Orchestrator periodically re-verifies whether dependency tasks are `passed` and whether the baseline is still valid; when both hold, the task is dispatched.

**Responsibilities by slot**:

| Slot | What they do |
|---|---|
| Orchestrator | Re-verify baseline and dependency state; dispatch when ready |

**Outputs**: —.

**Condition to leave**: dependency tasks are `passed` and the baseline is valid → `implementing`.

### `implementing`

**Meaning**: the Implementer writes the implementation contract, performs the work, and records the self-check.

**Activities in this state**:

1. Implementer writes the implementation contract (`change_scope`, `planned_actions`, `non_goals`, `alternatives_considered`, `assumptions`, `open_questions`)
2. Implementer performs the actual implementation
3. Implementer appends an implementation evidence entry (work summary and observed artifacts)
4. Implementer records the self-check (`completed_work`, `reviewer_focus`, `known_risks`, `deviations_from_plan`, `gap_signals`)

**Responsibilities by slot**:

| Slot | What they do |
|---|---|
| Implementer | Implementation contract, implementation, implementation evidence, self-check |

**Verify-fix re-entry**: when the task returns from `reviewing` on gate verdict `fail`, it re-enters the same `implementing` state. Two differences — (1) prior reviewer/verifier concerns are folded back into the implementation contract (amended in place), and (2) the new implementation evidence entry's `revision_ref` points to the prior entry. The activity order is otherwise identical, and once a new self-check is appended the task transitions back to `reviewing`.

**Outputs**: `implementation-contract.json`, `self-check.json`, implementation evidence entry.

**Condition to leave**: self-check is submitted → `reviewing`.

### `reviewing`

**Meaning**: required reviewers and the verifier submit their evidence, and the Orchestrator runs the evidence gate.

**Activities in this state**:

1. Each required reviewer slot submits review evidence from its own lens (`verdict`, `concerns`, `scope_examined`, `methods_used`, `scope_excluded`)
2. Verifier independently executes the contract's `verification_plan` and submits verification evidence (every acceptance criterion mapped to a `criteria_results` entry)
3. When reviewer verdicts conflict or a Challenger raises a blocking claim, the Orchestrator convenes task-level deliberation
4. Orchestrator runs the evidence gate → Tier 0/1/2 judgment

**Responsibilities by slot**:

| Slot | What they do |
|---|---|
| Required reviewer | Submit review evidence from their slot's lens |
| Verifier | Execute `verification_plan`, submit verification evidence |
| Challenger | Raise a blocking review when needed, vote in task-level deliberation |
| Orchestrator | Run the evidence gate, convene task-level deliberation when needed |

**Outputs**: review evidence (one per required reviewer slot), verification evidence, a new gate run appended to `gate-results.json`.

**Condition to leave**:

- gate verdict `pass` → `deciding`
- gate verdict `fail` → rewind to `implementing` (verify-fix loop; reviewer/verifier concerns are folded back into the implementation and the task returns to `reviewing`)
- gate verdict `block` → `blocked`
- gate verdict `error` → fix the cause and rerun the gate

### `deciding`

**Meaning**: the Orchestrator is writing the task closure decision.

**Activities in this state**:

1. Orchestrator synthesizes implementation contract, self-check, review evidence, verification evidence, the latest gate result, and any task-level deliberation
2. Orchestrator writes closure evidence — `verdict`, `rationale`, and the four retrospective fields (`what_went_well`, `what_broke`, `what_was_surprising`, `next_time_guidance`)

**Responsibilities by slot**:

| Slot | What they do |
|---|---|
| Orchestrator | Synthesize every task artifact and write the closure evidence |

**Outputs**: closure evidence (`evidence/orchestrator.orchestrator.json`).

**Condition to leave**:

- closure verdict `approved` → `passed`
- closure verdict `changes_requested` → Orchestrator restores to `ready`, `implementing`, or `reviewing` based on its judgment
- closure verdict `escalated` → `escalated`
- closure verdict `cancelled` → `cancelled`

### `passed`

**Meaning**: the task has closed.

**Activities in this state**:

- No task-level activity. During the mission's consolidating phase, the task's evidence-side `memory_suggestions`, `debt_candidates`, and `gap_signals` feed into mission-level aggregation (see doc 02 consolidating).

**Responsibilities by slot**:

| Slot | What they do |
|---|---|
| (terminal) | No task-level work in this state |

**Outputs**: —.

**Condition to leave**: in the normal path this is terminal. The only exception is a transition to `cancelled` for external reasons, defined in the transition table below.

### Hold / Terminal States

| State | Meaning |
|---|---|
| `blocked` | Explicitly blocked and cannot proceed under current conditions |
| `escalated` | Could not close at task level and has been handed upward for judgment |
| `cancelled` | It has been decided that this contract will not continue |

None of these three states carry task-level activity. Entry and recovery paths are defined in the transition table below.

### Failure Is Not a State

Verification failure and `changes_requested` are not separate states. If the gate returns `fail` or the closure decision returns `changes_requested`, the Orchestrator rewinds the task to the status that matches the reason.

### Transition Table

| Current state | Next state | Condition |
|---|---|---|
| `drafted` | `ready` | `approved_by` is not `null` and the phase gate has passed |
| `ready` | `implementing` | Dependency tasks are `passed` and the baseline is valid |
| `implementing` | `reviewing` | Self-check is submitted |
| `reviewing` | `deciding` | Evidence gate run verdict is `pass` |
| `deciding` | `passed` | The Orchestrator records task closure decision `approved` |
| `implementing`, `reviewing`, `deciding` | `blocked` | A blocking reason has been confirmed that prevents further progress under current conditions |
| `blocked` | `ready`, `implementing`, `reviewing` | The blocking reason has been resolved and work resumes |
| `blocked`, `deciding` | `escalated` | The issue exceeds task-level judgment and is handed upward |
| `escalated` | `passed` | Higher-level judgment is `approved` (only when the task was escalated from `deciding`) |
| `escalated` | `ready`, `implementing`, `reviewing` | Higher-level judgment is `changes_requested` and the Orchestrator restores the task to that state |
| `drafted`, `ready`, `implementing`, `reviewing`, `deciding`, `blocked`, `escalated` | `cancelled` | Mission scope changed, a replacement task exists, or higher-level judgment stopped the work (`deciding` may be cancelled only for external reasons) |

When a task is rewound, the exact target state is not fixed by the table alone; it is Orchestrator judgment. But the reason for the rewind and the rationale for the restored state must appear in the closure decision or related evidence.

## Evidence

Evidence is the role-specific record of work and judgment on a task. In Geas, evidence is a task-level artifact, and its exact structure is owned by the single schema `evidence.schema.json`. For a given task, evidence left by one agent acting in one slot accumulates in a single file, `evidence/{agent}.{slot}.json`, and entries are appended to the file's `entries` array. If one concrete agent fills multiple slots on the same task, evidence is split by slot. For example, if the same `security-engineer` acts as both `risk-assessor` and `operator`, it produces two files: `evidence/security-engineer.risk-assessor.json` and `evidence/security-engineer.operator.json`. The `evidence_kind` field on each entry determines the specific kind, along with kind-specific required fields and `verdict` enums.

### Who May Write Which Evidence

- The `implementer` slot is exclusive. The agent assigned as implementer for a task may not write reviewer, verifier, or authority-slot evidence on the same task.
- Reusing reviewer-side slots is allowed. The same concrete agent may fill multiple reviewer slots, or combine reviewer and verifier on one task. In that case, the same expertise answers different viewpoint-specific questions, such as risk vs operations vs documentation, and it still writes separate evidence files by slot.
- Across different tasks, the same concrete agent may be reassigned to any slot combination. Role changes happen at task boundaries.

### File Structure

At the top level, an evidence file contains `mission_id`, `task_id`, `agent`, `slot`, `entries`, `created_at`, and `updated_at`. Rework or later revisions never overwrite prior entries. They append a new entry to `entries` and may point back to an earlier entry in the same file through `revision_ref`.

### Common Entry Fields

Every entry shares the following fields. Array fields must be present as empty arrays when there is nothing to record.

| Field | Meaning |
|---|---|
| `entry_id` | Monotonically increasing integer id starting at 1 within the file |
| `evidence_kind` | What kind of entry this is |
| `summary` | Summary of the key judgment |
| `artifacts` | Files, outputs, or deliverables examined as the basis for judgment |
| `memory_suggestions` | Candidate memory items to forward to [06_MEMORY.md](./06_MEMORY.md) |
| `debt_candidates` | Candidate debt items to forward to [07_DEBT_AND_GAP.md](./07_DEBT_AND_GAP.md) |
| `gap_signals` | Gap signals to forward to [07_DEBT_AND_GAP.md](./07_DEBT_AND_GAP.md) |
| `revision_ref` | The prior `entry_id` in the same file. `null` if new or not a revision |
| `created_at` | When this entry was written |

### Additional Fields by Evidence Kind

| `evidence_kind` | Primary producer | Additional required fields | `verdict` enum |
|---|---|---|---|
| `implementation` | Implementer | (none) | - |
| `review` | Specialist reviewer or Challenger | `verdict`, `concerns`, `rationale`, `scope_examined`, `methods_used`, `scope_excluded` | approved / changes_requested / blocked |
| `verification` | Verifier | All additional fields from `review`, plus `criteria_results` | approved / changes_requested / blocked |
| `closure` | Orchestrator | `verdict`, `rationale`, `what_went_well`, `what_broke`, `what_was_surprising`, `next_time_guidance` | approved / changes_requested / escalated / cancelled |

`implementation` evidence never carries a `verdict`. When the `closure` verdict is `changes_requested`, the state to which the Orchestrator restores the task (`ready` / `implementing` / `reviewing`) is expressed through the subsequent transition, and the intended rewind should be recorded in the rationale. When writing closure that exits `escalated`, the rationale should also name the original state at the moment escalation began, usually `deciding` or `blocked`, so later readers can trace whether the follow-up transition was justified. If a task is replaced by a new contract, the new task contract's `supersedes` field points back to this task. A challenge from the Challenger is stored as `review` evidence, and the fact that it came from the Challenger is identified through the `agent` field. When the `closure` verdict is `escalated` or `cancelled`, the work itself did not complete, so the four retrospective fields (`what_went_well`, `what_broke`, `what_was_surprising`, `next_time_guidance`) may be left as empty arrays.

`scope_examined`, `methods_used`, and `scope_excluded` are the fields that make review and verification explicit about what was checked, how it was checked, and what was excluded. Even when there are no empty observations, these fields should still contain meaningful content; only `scope_excluded` may be empty.

### Mapping Slots to Evidence

- `implementer` usually writes `implementation` evidence.
- `verifier` writes independent verification results as `verification` evidence.
- `risk-assessor`, `operator`, and `communicator` usually write `review` evidence.
- `challenger` writes `review` evidence, with the `agent` field making the Challenger role visible.
- `orchestrator` records the task closure decision as `closure` evidence.

A slot is not the same thing as an evidence kind. The evidence kind depends on what judgment that slot performed.

## Evidence Gate

The evidence gate decides whether verification evidence is sufficient to allow a task to close. All gate runs for a task are appended in time order to the `runs` array of a single file, `gate-results.json`, and the exact structure is owned by `gate-results.schema.json`. If the gate is run again, a new run object is appended rather than overwriting the prior run, preserving history.

### Tiers

| Tier | Meaning |
|---|---|
| Tier 0 | Preflight check that required artifacts and required reviewer reviews have been submitted |
| Tier 1 | Objective verification following the repeatable procedure described in `verification_plan`, whether automated or a fixed manual procedure |
| Tier 2 | Judgment verification that reads the contract together with the review verdicts |

The gate proceeds in order: Tier 0 -> Tier 1 -> Tier 2. If any tier returns `fail`, `block`, or `error`, that verdict becomes the overall gate verdict.

Tier 2 aggregates reviewer verdicts using the following default rules.

- If any reviewer returns `blocked`, the Tier 2 result is `block`.
- If there is no `blocked` verdict but at least one `changes_requested`, the Tier 2 result is `fail`.
- If all reviewers return `approved`, the Tier 2 result is `pass`.

If the Orchestrator judges that multiple verdicts rest on mutually incompatible reasoning, it convenes task-level deliberation before aggregation and then determines Tier 2 in light of the deliberation result.

### Gate Verdict

| Verdict | Meaning |
|---|---|
| `pass` | The task may move on to closure judgment |
| `fail` | Rework is needed, but there is no blocking condition |
| `block` | A blocking condition prevents closure under the current state |
| `error` | The gate itself was invalid or the verification run could not be trusted |

`fail` signals rework. `block` signals a blocking condition. Neither can lead directly to `passed`.

## Task-level Deliberation

Task-level deliberation is the structured record used when conflicts among review, verification, and challenge need explicit resolution. The exact structure is owned by `deliberation.schema.json`, and the same schema is used for mission-level deliberation. All deliberations for a task are appended in time order to the `entries` array of a single file, `deliberations.json`. The file's top-level `level` is fixed as `task`, and it also records `task_id`.

A deliberation entry is appended only after every voter's vote and the final `result` are both fixed. In-progress deliberation is not persisted. This is the same rule used for mission-level deliberation and preserves append-only immutability.

Task-level deliberation is usually opened in the following cases.

- required reviewers have conflicting verdicts
- a challenge claims the task should be blocked and the issue cannot be cleanly resolved through the closure decision alone
- the rework scope or rewind target requires structural judgment

Mission-level deliberation and the mission final verdict are owned by [02_MISSIONS_PHASES_AND_FINAL_VERDICT.md](./02_MISSIONS_PHASES_AND_FINAL_VERDICT.md).

## Task Closure Decision

The task closure decision is the official judgment on whether the task can close. Only the Orchestrator may make this decision, and `closure` evidence stores both the judgment and the rationale.

### Artifacts That Must Be Read

To issue a task closure decision, the Orchestrator must assemble and read at least the following artifacts.

- the implementation contract and self-check
- required reviewer evidence
- verification evidence or equivalent verification basis
- the latest gate result
- challenge evidence when relevant

If required reviewer evidence is missing or the gate is unresolved, the judgment basis is incomplete.

End-of-task summaries such as change summary or open risk should be captured in `closure` evidence fields such as `summary`, `debt_candidates`, and `gap_signals`.

### Verdict

| Verdict | Meaning |
|---|---|
| `approved` | The task may close now |
| `changes_requested` | Enough basis exists to judge the task, but not enough to close it; rework is required |
| `escalated` | The task could not be closed at task level and is handed upward |
| `cancelled` | The task will be abandoned and not continued |

`approved` does not happen automatically just because the gate passed. The Orchestrator must explicitly read the required artifacts and record the decision.

## Implementation Contract

The implementation contract is the internal plan that fixes how an approved task contract will be executed. It is written by the task's assigned `implementer`. If the task contract is the external agreement that defines what must be done and how it will be verified, the implementation contract is the reviewer-visible plan for how the implementer will approach that work, what steps they will take, and what they will not do within the approved scope. The canonical artifact is `implementation-contract.json`, and the exact structure is owned by `implementation-contract.schema.json`.

| Field | Meaning |
|---|---|
| `mission_id`, `task_id` | Identifiers used for path and consistency checks |
| `summary` | One sentence stating what the implementer actually intends to change |
| `rationale` | Why this approach was chosen and the background behind it |
| `change_scope` | The surfaces this implementation will actually modify or add |
| `planned_actions` | Execution steps organized so a reviewer can follow the implementation flow |
| `non_goals` | Scope explicitly left out of this task. Empty array if none |
| `alternatives_considered` | Rejected approaches and why they were rejected. Empty array if none |
| `assumptions` | Preconditions that must be true for this plan to hold. Empty array if none |
| `open_questions` | Unresolved questions the implementer must answer before or during execution. Empty array if none |

If the implementation direction changes materially, the implementer must update the implementation contract before pushing ahead so reviewers can follow the new intent.

## Implementer Self-Check

The implementer self-check is the append-only self-review log left by the task's assigned `implementer` after each implementation pass and before independent review begins. The canonical artifact is `self-check.json`, and the exact structure is owned by `self-check.schema.json`. The envelope mirrors the evidence file shape: one file per task holds a sequence of self-check entries, one per implementer pass.

### File envelope

| Field | Meaning |
|---|---|
| `mission_id`, `task_id` | Identifiers used for path and consistency checks |
| `entries` | Append-only array of self-check entries in chronological order. At least one entry must exist |
| `created_at` | When the file was first written |
| `updated_at` | When the last entry was appended |

### Entry fields

| Field | Meaning |
|---|---|
| `entry_id` | Monotonically increasing integer starting at 1 within the file |
| `completed_work` | What the implementer believes was actually completed in this pass |
| `reviewer_focus` | Places the implementer believes reviewers should examine first, based on this pass. Empty array if none |
| `known_risks` | Forward-looking concerns that remain after this pass. Empty array if none |
| `deviations_from_plan` | Where execution diverged from `planned_actions` in the implementation contract during this pass. Empty array if execution matched the plan |
| `gap_signals` | Early signals of scope or expectation mismatch discovered during this pass. These later flow into closure evidence and mission gap. Empty array if none |
| `revision_ref` | `entry_id` of the prior self-check entry this revises, or `null`. Set on verify-fix re-entries to link back to the previous pass |
| `created_at` | When this entry was appended |

### Iteration model

The first implementer pass on a task appends `entry_id: 1` with `revision_ref: null`. Each verify-fix re-entry appends a new entry with `revision_ref` pointing to the prior `entry_id`, preserving the iteration history without mutating earlier content. Reviewers read the latest entry to find the current `reviewer_focus`; the earlier entries remain available for tracing how the implementer's self-assessment evolved across passes.

The self-check does not replace review. It helps reviewers focus their first pass.

## Task-level Retrospective Signals

Tasks do not finalize memory, debts, or gap on their own. Task evidence only records signals that "this issue existed." The decision about how to handle them is made during the consolidating phase. Official memory is owned by [06_MEMORY.md](./06_MEMORY.md), and official debts and gap are owned by [07_DEBT_AND_GAP.md](./07_DEBT_AND_GAP.md).

A task can emit the following signals.

- `memory_suggestions` (common evidence field) - candidate learning items received by [06_MEMORY.md](./06_MEMORY.md)
- `debt_candidates` (common evidence field) - candidate technical debt received by [07_DEBT_AND_GAP.md](./07_DEBT_AND_GAP.md)
- `gap_signals` (common evidence field) - signals of scope / expectation mismatch received by [07_DEBT_AND_GAP.md](./07_DEBT_AND_GAP.md)
- the retrospective fields in closure evidence (`what_went_well`, `what_broke`, `what_was_surprising`, `next_time_guidance`) - recorded by the Orchestrator at task closure after synthesizing the self-check, each evidence file, the gate result, and any deliberation

In `self-check.json`, `gap_signals` are raw string flags recorded quickly by the implementer during the work. They are shaped differently from the structured `gap_signals` in evidence (`kind` + `summary`) and are not promoted directly into consolidating inputs. When the Orchestrator writes closure evidence, it rewrites any meaningful self-check flags into structured form inside closure evidence, and only that structured evidence enters consolidation candidate aggregation. In other words, automatic consolidation scans only the evidence-side fields.

## Cancellation Rules

A task may become `cancelled` in the following cases.

- the upper mission scope changed and this contract is no longer needed
- a better new task contract replaced the current contract
- a blocking condition cannot be resolved and keeping the current contract no longer has value

Cancellation is recorded as verdict `cancelled` in `closure` evidence, with the reason captured in `rationale`. If a replacement contract exists, the new task contract's `supersedes` field refers back to this task. Cancellation is never silent; both the reason and the replacement relationship must be explicit.
