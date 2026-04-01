# 02. Modes, Missions, and Runtime

## Mission Model

A mission is a higher-level objective that normalizes a user request into a form the protocol can execute.

Minimum fields:
- `mission_id`
- `intent`
- `goal`
- `constraints`
- `source_request`
- `entry_signals`
- `scope_in`
- `current_phase`

## Mission Intent Enum

- `explore`
- `plan`
- `build`
- `fix`
- `review`
- `decide`
- `recover`

## Automatic Mode Branching

### Rule A -- Decision takes priority
If **any** of the following signals are present, enter `decision` mode (OR logic).
- proposal disagreement
- specialist review conflict
- product scope ambiguity
- repeated rewind without convergence (2 or more rewinds on the same task)
- manual escalation

Rule A takes priority over Rule B. That is, even if an executable backlog exists, entering `decision` mode first to resolve the situation is mandatory when any of the above signals are detected.

### Rule B -- Entering delivery
Enter `delivery` when **all** of the following conditions are met (AND logic).
- Executable backlog exists: at least one task with status `ready`, and that task's `base_commit` is valid (an ancestor of or equal to the integration branch HEAD)
- Required baseline secured: the integration branch exists and is accessible
- Required capabilities met: an agent matching the task's primary_worker_type is available
- No unresolved strategic disagreement: none of Rule A's signals are detected

### Rule C -- Everything else is discovery
If neither Rule A nor Rule B applies, enter `discovery`. In this mode, specs, task backlogs, and decision records are created to satisfy Rule B's entry conditions.

### Edge Case -- Empty backlog
If there are 0 `ready` tasks and no Rule A signals, Rule C applies and the system enters `discovery`. At least one task must be moved from `drafted` to `ready` in discovery before a transition to `delivery` is possible. If no tasks can be created, the mission transitions to `escalated`.

### Mode Branching Evaluation Order
```
1. Check Rule A conditions -> if signal present -> decision mode
2. Check Rule B conditions -> if all met -> delivery mode
3. None of the above apply -> discovery mode
```

## Top-Level Modes

### `discovery`
- Code modification is prohibited. Exceptions: read-only exploration of existing code, or conducting a prototype spike on a separate throwaway branch. Spike results are recorded in a `decision-record`; the code itself is not merged.
- Deliverables: task backlog, decision record, design note, mission clarification, `scope_in`

### `delivery`
- Task lifecycle execution
- Worktree creation permitted
- Integration/gate/verdict allowed

### `decision`
- For resolving disputes/conflicts/pivots
- Code modification is prohibited. No exceptions. Decisions that require code changes are recorded in a `decision-record` and executed as tasks in `delivery` mode.
- Deliverables: `decision-record`

## Initiative 4-Phase Model

Every mission progresses sequentially through the following four phases as needed.

### Phase Flow

```
discovery --[gate 1]--> build --[gate 2]--> polish --[gate 3]--> evolution
                                                                        |
                                                                   [gate 4]
                                                                        |
                                                                      close
                                                                   (or next mission)

gate 1: mission brief + scope_in + initial tasks exist
gate 2: all MVP-critical tasks passed + no blocking_conflict + 0 critical debt + 0 unmitigated high debt
         required artifacts: phase-review.json, gap-assessment.json
gate 3: all high/critical debt triaged + required reviews approved + shipping rationale recorded for every known risk
         required artifacts: phase-review.json, gap-assessment.json
gate 4: gap-assessment.json + retrospective.json + rules update + debt snapshot + mission summary
         required artifacts: phase-review.json, gap-assessment.json
```

### 1) `discovery`
Goals:
- Finalize the mission definition
- Produce the MVP scope_in
- Settle architecture / conventions decisions
- Compile the initial backlog

Required deliverables:
- mission brief
- `scope_in`
- decision records
- initial tasks
- conventions / project memory seed

### 2) `build`
Goals:
- Implement the essential value paths defined in scope_in
- Iterate on task-level closures

Phase exit conditions:
- All MVP-critical tasks `passed`
- No blocking_conflict
- Zero `critical` severity debt, and zero `high` severity debt items lacking a mitigation plan

### 3) `polish`
Goals:
- UX/QA/security/docs/perf/debt hardening
- Achieve release-readiness
- Entropy scan: detect and clean up dead code, AI boilerplate, convention drift, and code duplication
- Items found by the entropy scan are either recorded in the debt register or fixed immediately

Phase exit conditions:
- All `high` and `critical` severity debt is `triaged` (one of: accept, defer with rationale, or resolve)
- Required documentation/security/ops reviews are complete (the relevant specialist's review has `approved` status)
- A shipping rationale is recorded for every known risk item

### 4) `evolution`
Goals:
- Evaluate the actually delivered scope
- Perform gap assessment
- Aggregate retrospectives
- Update rules.md / memory / debt register
- Produce the backlog for the next mission or next cycle

Phase exit conditions:
- `gap-assessment.json` exists
- `retrospective.json` bundle is finalized
- Approved rules update is applied
- Debt snapshot is applied
- Mission summary is produced

## Runtime Phases

- `bootstrap`
- `planning`
- `scheduling`
- `executing`
- `integrating`
- `verifying`
- `learning`
- `idle`

Mode describes what kind of work the session is doing; runtime phase describes where within that work the session currently is; mission phase describes where the session stands in terms of initiative progression.

## `run.json` Key Fields

- `session_start_ref`
- `integration_branch`
- `mode`
- `phase`
- `mission_phase`
- `focus_task_id`
- `checkpoint_seq`
- `recovery_state`
- `active_locks`
- `packet_refs`

## Phase Semantics

- `bootstrap`: load repo state/lock/summary/recovery anchor
- `planning`: mission clarification / task compile / contract refinement / scope update
- `scheduling`: select ready tasks, compute the parallel window
- `executing`: implementation/modification/local review within a worktree
- `integrating`: serialized integration lane
- `verifying`: gate / readiness / closure packet finalization
- `learning`: retrospective, memory extraction, rules/debt/gap update
- `idle`: no active in-flight work

## Phase Review Artifacts

### Required artifacts (phase transition is blocked without them)

| transition | required artifact |
|---|---|
| `discovery` -> `build` | (phase-review.json recommended, not required) |
| `build` -> `polish` | `phase-review.json`, `gap-assessment.json` |
| `polish` -> `evolution` | `phase-review.json`, `gap-assessment.json` |
| `evolution` -> close/next mission | `phase-review.json`, `gap-assessment.json` |

### Recommended artifacts (produce when applicable)
- `debt-register.json`: recommended at every transition when technical debt has been identified
- `rules-update.json`: produce when protocol rule changes have been proposed

### When a phase transition fails
If required artifacts are missing or phase exit conditions are not met, the phase transition is rejected. In that case:
1. orchestration_authority identifies the missing items and adds them as tasks or incorporates them into existing tasks.
2. After 3 consecutive transition attempt failures, enter `decision` mode to discuss scope adjustment or criteria relaxation.
3. Transition attempt failure history is recorded in `phase-review.json`.

## Scope In / Scope Out

- `scope_in`: the scope committed during discovery
- `scope_out`: a summary of the results of tasks that have actually `passed` to date

At every phase boundary, `scope_in` and `scope_out` must be compared. This comparison is the input to the **gap assessment**.
