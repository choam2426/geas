# 10. Session Recovery and Resumability

## Purpose

Even with long sessions, compaction, subagent interruption, or abnormal termination, it must be possible to **resume from a safe boundary**.

## Recovery Classes

- `post_compact_resume`
- `warm_session_resume`
- `interrupted_subagent_resume`
- `dirty_state_recovery`
- `manual_repair_required`

## Recovery Anchor

Minimum anchor:
- `run.json`
- `session-latest.md`
- `task-focus/<task-id>.md`
- latest `recovery-packet.json` (if available)
- active task artifacts

## Checkpoint Protocol

### write-before-launch
Record a checkpoint before starting a new subagent or risky step.

### write-after-step
Update the checkpoint after state has actually changed.

### two-phase checkpoint
1. intent write — record the intended state transition in `run.json`
2. artifact creation / state transition — create the actual artifact and change state
3. commit checkpoint — update the intent in `run.json` to completion status

**On failure in phase 2**: if an intent write exists but no commit checkpoint, the transition is considered incomplete. During recovery, read the intent write to determine which transition was attempted, verify whether the artifact was actually created, then handle according to the Recovery Decision Table.

### Step-Level Checkpoint (`remaining_steps`)

Maintain a `remaining_steps[]` array in `run.json` to track current pipeline progress.

Rules:
- At pipeline start, record the full list of steps in `remaining_steps`
- On each step completion, remove that step from the array
- On session resume, execute from `remaining_steps[0]`
- If `remaining_steps` is empty, the pipeline is considered complete
- Step removal is performed only after the step's artifact has been confirmed (same principle as two-phase checkpoint)

## Safe Boundary

Exact resume is allowed only at safe boundaries. Examples:
- task admitted, but implementation not started
- implementation finished and artifact persisted
- integration finished and result artifact persisted
- gate completed and result artifact persisted
- closure packet frozen

Unsafe in-flight states require replay or rewind.

## Recovery Decision Table

| observed state | artifact completeness | recovery outcome |
|---|---|---|
| task implementing, worktree clean, contract exists | high | `resume_with_revalidation` |
| task implementing, worktree dirty, partial artifacts | medium | `replay_current_step` or `rewind_to_safe_boundary` |
| integrated state claimed but no integration artifact | low | `rewind_to_safe_boundary` |
| verified claimed but gate result missing | low | `rewind_to_safe_boundary` |
| passed claimed but final verdict missing | invalid | hard block |
| multiple tasks in-flight, conflicting states | varies | evaluate each task individually; apply the most conservative recovery outcome |
| run.json itself corrupted/missing | none | `manual_repair_required`; traverse artifacts under `.geas/` to reconstruct state |

### Artifact Completeness Classification

The artifact completeness used in the recovery decision table is determined by the following criteria:

| grade | condition |
|---|---|
| `high` | all artifacts required up to the current task state exist and pass schema validation |
| `medium` | 50% or more of required artifacts exist and pass validation |
| `low` | fewer than 50% of required artifacts exist, or some existing artifacts fail validation |
| `none` | no task-related artifacts exist |
| `invalid` | artifact files exist but JSON parsing fails or schema validation fails entirely |

"Required artifacts" are determined by the task's current state (based on the artifacts needed for each transition in the doc 03 transition table).

### Decision Table Matching Rules

- If the observed state matches multiple rows, apply the recovery outcome from the row with the lowest artifact completeness (conservative principle).
- State combinations not covered by the table are handled as `manual_repair_required`.

## Recovery Packet

Required fields:
- `recovery_id` — unique identifier. Format: `"recovery-{ISO8601 timestamp}"` (e.g., `"recovery-2026-04-01T09-30-00Z"`)
- `recovery_class` — enum value from the 5 Recovery Classes above (`post_compact_resume` | `warm_session_resume` | `interrupted_subagent_resume` | `dirty_state_recovery` | `manual_repair_required`)
- `focus_task_id` — ID of the task that was in progress at the time of interruption
- `detected_problem` — specific description of the detected problem
- `last_safe_boundary` — the last confirmed safe boundary state
- `recommended_action` — recommended recovery action. enum: `exact_resume` | `replay_step` | `revalidate` | `rewind` | `manual_repair`
- `required_revalidation` — list of items requiring revalidation
- `artifact_refs[]` — list of artifacts whose existence has been verified. Only include artifacts that actually exist at the time of recovery

## Worktree Recovery Rules

- worktree exists + dirty: record a fingerprint and determine whether safe resume is possible
- worktree missing + task implementing: re-execute implementation or manual repair
- passed/cancelled task worktree still exists: cleanup candidate
- paused task + integration branch moved: revalidation required before resume

## Recovery Safety Rules

1. Do not trust claimed states without evidence. All claimed states are accepted only after verifying the existence and content of the corresponding artifact.
2. If artifacts are missing, rewind to an earlier stage. The rewind target stage follows the `recovery outcome` from the Recovery Decision Table.
3. Never maintain `passed` in an unsafe ambiguous state. Handle such tasks with `rewind_to_safe_boundary`.
4. Recovery outcomes must always be recorded as a `recovery-packet.json` artifact.
5. **Evidence preservation principle**: existing evidence artifacts must not be deleted or overwritten during recovery. Recovery may only append new artifacts or create recovery-specific artifacts (e.g., `recovery-packet.json`, `revalidation-record.json`).

### Nested Recovery (Recovery Failure During Recovery)

When the recovery procedure itself fails (e.g., session interruption while writing recovery-packet.json, error during revalidation):

1. **Detection**: at next session start, if `recovery-packet.json` has a `recommended_action` recorded but no completion artifact for that action exists, it is classified as a nested failure.
2. **Escalation**: nested recovery does not attempt automatic resolution. Set `recovery_class` to `manual_repair_required` and report the state to the `orchestration_authority`.
3. **Safety guarantee**: in a nested failure state, no task may progress beyond `implementing`. The `orchestration_authority` must manually confirm the safe boundary and complete the `recovery-packet.json` before proceeding.

## Recovery to Evolution Feedback

Whenever a non-trivial recovery (`dirty_state_recovery` or `manual_repair_required`) occurs, create a recovery incident record.

### Recovery Incident Record
- Storage location: `.geas/memory/incidents/`
- Filename: `incident-{recovery_id}.json`
- Required fields: `recovery_id`, `recovery_class`, `focus_task_id`, `root_cause`, `resolution_steps`, `time_to_recover`, `prevention_suggestion`

### Learning Loop
1. `process_lead` reviews recovery incidents from the session during retrospective.
2. If the same `recovery_class` occurs **2 or more times**, the pattern is automatically registered as a rule candidate.
3. The rule candidate follows the Retrospective to Rule Update process in doc 14 for approval and application.
4. Approved rules are implemented as checkpoints or hooks to prevent recurrence of that recovery class.

## Recovery Scenarios

### Scenario 1: Session interrupted during gate execution

**Situation:**
- Task `T-042` is in `verifying` state.
- During evidence gate 3-tier verification, tier 1 (mechanical check) passed and `gate-result.json` has `tier1.verdict = pass` recorded.
- Session terminated abnormally during tier 2 (semantic+rubric) execution.
- `.geas/missions/{mission_id}/tasks/T-042/gate-result.json` contains only `tier1` results; the `tier2` field is `in_progress` or absent.

**Recovery class:** `interrupted_subagent_resume`

**Recovery procedure:**

1. **State detection**: on session restart, confirm from `run.json` that `T-042`'s state is `verifying`. Read `gate-result.json` to detect that tier1 is complete and tier2 is incomplete.
2. **Safe boundary determination**: tier 1 completion qualifies as a safe boundary (artifact is persisted). Tier 2 is an unsafe in-flight state.
3. **Recovery packet creation**:
   ```json
   {
     "recovery_id": "recovery-2026-04-01T14-30-00Z",
     "recovery_class": "interrupted_subagent_resume",
     "focus_task_id": "T-042",
     "detected_problem": "Session interrupted during gate tier 2 (semantic+rubric) execution. Tier 1 pass complete, tier 2 incomplete.",
     "last_safe_boundary": "gate tier 1 completed",
     "recommended_action": "replay_step",
     "required_revalidation": ["gate_tier2", "gate_tier3"],
     "artifact_refs": [
       ".geas/missions/{mission_id}/tasks/T-042/gate-result.json",
       ".geas/missions/{mission_id}/tasks/T-042/integration-result.json",
       ".geas/missions/{mission_id}/tasks/T-042/worker-self-check.json"
     ]
   }
   ```
4. **Execution**: re-execute tier 2 from the beginning (idempotent -- same input produces same result). Tier 1 results are preserved (evidence preservation principle). Once tier 2 results are available, proceed with closure packet assembly, critical reviewer challenge, and final verdict in order.
5. **Completion**: once the full gate result is finalized, return to normal flow.

### Scenario 2: Session crashed after integration completion but before verdict generation

**Situation:**
- Task `T-078` is in `integrating` state.
- `.geas/missions/{mission_id}/tasks/T-078/integration-result.json` exists with merge commit hash and `status = success` recorded.
- However, `closure-packet.json` has not yet been created, and `gate-result.json` has no gate execution record after this integration.
- The `integration_lock` is still held by `T-078` when the session terminated.

**Recovery class:** `warm_session_resume`

**Recovery procedure:**

1. **State detection**: on session restart, confirm from `run.json` that `T-078`'s state is `integrating`. Since `integration-result.json` exists with `status = success`, determine that the integration itself is complete.
2. **Orphan lock cleanup**: detect the `integration_lock` held by `T-078` in `.geas/state/locks.json`. Since the owning session has terminated, classify it as an orphan lock and release it.
3. **Safe boundary determination**: integration completion + result artifact persisted qualifies as a safe boundary.
4. **Recovery packet creation**:
   ```json
   {
     "recovery_id": "recovery-2026-04-01T16-45-00Z",
     "recovery_class": "warm_session_resume",
     "focus_task_id": "T-078",
     "detected_problem": "Session crashed after integration completion (integration-result.json exists, status=success) but before gate execution and closure packet creation.",
     "last_safe_boundary": "integration completed and result persisted",
     "recommended_action": "exact_resume",
     "required_revalidation": [],
     "artifact_refs": [
       ".geas/missions/{mission_id}/tasks/T-078/integration-result.json",
       ".geas/missions/{mission_id}/tasks/T-078/specialist-review.json",
       ".geas/missions/{mission_id}/tasks/T-078/worker-self-check.json",
       ".geas/missions/{mission_id}/contracts/T-078.json"
     ]
   }
   ```
5. **Execution**: transition the task state to `integrated` and resume exactly from evidence gate execution (exact_resume). Do not re-execute integration -- `integration-result.json` already exists.
6. **Completion**: continue the normal flow through gate, closure packet, and passed.

### Scenario 3: Dirty worktree with uncommitted changes

**Situation:**
- Task `T-115` is in `implementing` state.
- The worktree (`worktree.path = .geas/worktrees/T-115`) has uncommitted changes: 3 files modified, 1 file newly added.
- `worker-self-check.json` has not been created yet. `worker-evidence.json` also does not exist.
- Session terminated abnormally.

**Recovery class:** `dirty_state_recovery`

**Recovery procedure:**

1. **State detection**: on session restart, confirm from `run.json` that `T-115`'s state is `implementing`. Check the worktree path and detect the dirty state (uncommitted changes).
2. **Fingerprint creation**: fingerprint the current state of the worktree. Record the list of changed files, diff size, and last commit hash.
   ```
   fingerprint:
     last_commit: a1b2c3d
     dirty_files: ["src/api/handler.ts", "src/api/validator.ts", "src/api/types.ts", "src/api/errors.ts (new)"]
     diff_lines: +187 / -23
     worktree_exists: true
   ```
3. **Recovery packet creation**:
   ```json
   {
     "recovery_id": "recovery-2026-04-01T20-15-00Z",
     "recovery_class": "dirty_state_recovery",
     "focus_task_id": "T-115",
     "detected_problem": "Worktree dirty -- 4 files with uncommitted changes, no worker-self-check.json, no worker-evidence.json. Session terminated abnormally during implementation.",
     "last_safe_boundary": "implementation started, implementation-contract.json exists",
     "recommended_action": "revalidate",
     "required_revalidation": ["worktree_integrity", "implementation_progress"],
     "artifact_refs": [
       ".geas/missions/{mission_id}/contracts/T-115.json",
       ".geas/missions/{mission_id}/tasks/T-115.json"
     ]
   }
   ```
4. **Present diff to orchestration_authority**: show the full diff along with the fingerprint to the orchestration_authority and present the following two options:
   - **commit-and-continue**: commit the current changes to the worktree and maintain the `implementing` state to continue implementation. Compare the `touched_paths` from `implementation-contract.json` against the currently changed files to check for scope deviation.
   - **rewind**: discard uncommitted changes, revert to the last commit (`a1b2c3d`), and restart implementation from the `implementing` state. The changes are preserved as a diff in the recovery packet and can be used as reference material.
5. **After decision**: execute the chosen action and record the recovery outcome in `recovery-packet.json`. Record the `dirty_state_recovery` occurrence itself as an incident record at `.geas/memory/incidents/incident-recovery-2026-04-01T20-15-00Z.json`.
