# 02. Missions and Runtime

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

## Initiative 4-Phase Model

Every mission progresses sequentially through the following four phases as needed.

### Phase Flow

```
specifying --[gate 1]--> building --[gate 2]--> polishing --[gate 3]--> evolving
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

### 1) `specifying`
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

### 2) `building`
Goals:
- Implement the essential value paths defined in scope_in
- Iterate on task-level closures

Phase exit conditions:
- All MVP-critical tasks `passed`
- No blocking_conflict
- Zero `critical` severity debt, and zero `high` severity debt items lacking a mitigation plan

### 3) `polishing`
Goals:
- UX/QA/security/docs/perf/debt hardening
- Achieve release-readiness
- Entropy scan: detect and clean up dead code, AI boilerplate, convention drift, and code duplication
- Items found by the entropy scan are either recorded in the debt register or fixed immediately

Phase exit conditions:
- All `high` and `critical` severity debt is `triaged` (one of: accept, defer with rationale, or resolve)
- Required documentation/security/ops reviews are complete (the relevant specialist's review has `approved` status)
- A shipping rationale is recorded for every known risk item

### 4) `evolving`
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

Runtime phase describes where within the current work the session currently is; mission phase describes where the session stands in terms of initiative progression.

## `run.json` Key Fields

- `session_start_ref`
- `integration_branch`
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
| `specifying` -> `building` | (phase-review.json recommended, not required) |
| `building` -> `polishing` | `phase-review.json`, `gap-assessment.json` |
| `polishing` -> `evolving` | `phase-review.json`, `gap-assessment.json` |
| `evolving` -> close/next mission | `phase-review.json`, `gap-assessment.json` |

### Recommended artifacts (produce when applicable)
- `debt-register.json`: recommended at every transition when technical debt has been identified
- `rules-update.json`: produce when protocol rule changes have been proposed

### When a phase transition fails
If required artifacts are missing or phase exit conditions are not met, the phase transition is rejected. In that case:
1. orchestration_authority identifies the missing items and adds them as tasks or incorporates them into existing tasks.
2. After 3 consecutive transition attempt failures, invoke the decision skill to discuss scope adjustment or criteria relaxation.
3. Transition attempt failure history is recorded in `phase-review.json`.

## Scope In / Scope Out

- `scope_in`: the scope committed during the specifying phase
- `scope_out`: a summary of the results of tasks that have actually `passed` to date

At every phase boundary, `scope_in` and `scope_out` must be compared. This comparison is the input to the **gap assessment**.
