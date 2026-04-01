# 03. Task Model and Lifecycle

## Task Classification

### `task_kind`
- `code`
- `docs`
- `config`
- `design`
- `audit`
- `release`

### `risk_level`
- `low`
- `normal`
- `high`
- `critical`

### `gate_profile`
- `code_change`
- `artifact_only`
- `closure_ready`

### `vote_round_policy`
- `never`
- `auto`
- `always`

## Core Task Metadata

- `task_id`
- `title`
- `description`
- `task_kind`
- `risk_level`
- `state`
- `base_commit`
- `scope.paths`
- `acceptance_criteria[]`
- `routing.primary_worker_type`
- `routing.required_reviewer_types[]`
- `gate_profile`
- `vote_round_policy`
- `retry_budget`
- `worktree`

## Task States

### Primary
- `drafted`
- `ready`
- `implementing`
- `reviewed`
- `integrated`
- `verified`
- `passed`

### Auxiliary
- `blocked`
- `escalated`
- `cancelled`

## Failure Is Not a State
Failure is recorded via a `FailureRecord`. The task rewinds to the rewind target.

### FailureRecord Required Fields
- `task_id`
- `failed_at_state`: the task state at the time of failure
- `failure_reason`: summary of the failure cause
- `rewind_target`: the state to rewind to (`implementing | reviewed | ready | escalated`)
- `timestamp`
- `retry_budget_before`: remaining retry_budget at the time of failure
- `retry_budget_after`: remaining retry_budget after rewind

## Implementation Contract

The following must be established as a minimum before code is written.
- `plan_summary`
- `touched_paths`
- `non_goals`
- `demo_steps`
- `known_risks`
- `required_checks`

This contract must be readable by at least the primary worker and the designated reviewer, and must exist before entering `implementing`.

### When an Implementation Contract Is Rejected
If a reviewer requests changes (`changes_requested`) on the implementation contract, the task remains in the `ready` state. The transition to `implementing` is blocked until the contract is revised and the reviewer approves. After 3 consecutive rejections, orchestration_authority must either transition the task to `escalated` or decompose it into smaller tasks.

## Worker Self-Check

The primary worker must produce a `worker-self-check.json` before claiming implementation is complete.

Required fields:
- `known_risks[]`
- `untested_paths[]`
- `possible_stubs[]`
- `what_to_test_next[]`
- `confidence` (1-5)
- `summary`

Purpose:
- Helps `qa_engineer` prioritize which failure paths to examine first
- Helps `architecture_authority` focus review on `known_risks`
- Helps `critical_reviewer` quickly identify the points the worker themselves felt uncertain about
- Helps `frontend_engineer` / `backend_engineer` focus on technical details in their respective areas
- Provides evidence gate with grounds to apply low-confidence threshold adjustment and stub caps

## Debt Emission at Task Level

Any task may produce technical debt during review/verification. Debt differs from blocking defects and can accumulate in the following artifacts:
- `worker-self-check.json`
- `specialist-review.json`
- `integration-result.json`
- `closure-packet.json`
- `debt-register.json`

Minimum classification:
- `severity = low | medium | high | critical`
- `kind = code_quality | test_gap | architecture | security | docs | ops | product_gap`

## Transition Table

| from | to | required artifact / condition |
|---|---|---|
| drafted | ready | task compiled, baseline valid (base_commit is an ancestor of or equal to integration branch HEAD) |
| ready | implementing | implementation contract approved, worktree prepared |
| implementing | reviewed | worker self-check exists + required specialist review set exists (see doc 01 for the routing algorithm) |
| reviewed | integrated | integration result created |
| integrated | verified | gate result pass or block-resolved |
| verified | passed | closure packet complete + final verdict pass |
| any active | blocked | capability/resource/lock issue |
| any active | escalated | explicit escalation or unresolved conflict |
| any active | cancelled | explicit cancellation decision by orchestration_authority or product_authority. Cancellation reason recorded in task metadata |
| blocked | ready | blocking cause resolved + revalidation passed |
| escalated | ready | escalation resolved + orchestration_authority decides re-entry |
| verified | implementing | gate fail + verify-fix loop. retry_budget decremented by 1 |
| integrated | reviewed | integration failure. revalidation required |
| verified | ready | final verdict `iterate` (rewind target = ready). retry_budget not decremented; escalated after 3 cumulative iterates |
| verified | implementing | final verdict `iterate` (rewind target = implementing). retry_budget not decremented |
| blocked | cancelled | explicit cancellation decision by orchestration_authority or product_authority |
| escalated | cancelled | explicit cancellation decision by orchestration_authority or product_authority |

Valid rewind targets for a final verdict of `iterate` are `ready`, `implementing`, or `reviewed`. Rewinding to `drafted` or `integrated` is not permitted.

`blocked` and `escalated` are included in "active" states. Therefore, the transitions `blocked` -> `cancelled` and `escalated` -> `cancelled` are valid.

## Transition Invariants

1. `implementation-contract.json` must exist before `implementing`.
2. `worker-self-check.json` and all required specialist reviews must exist before `reviewed`.
3. The integration lane must be passed before `integrated`.
4. A gate result must exist before `verified`.
5. A closure packet and final verdict must exist before `passed`.

## Default Rewind Rules

- implementation failure -> `implementing`
- integration failure -> `reviewed`
- invalidated assumptions -> `ready`
- unresolved major conflict -> `escalated`

## retry_budget Depletion Rules

`retry_budget` limits the number of retries permitted in the verify-fix loop.

### Initial Values (by gate_profile)

| gate_profile | initial retry_budget |
|---|---|
| `code_change` | 3 |
| `artifact_only` | 3 |
| `closure_ready` | 2 |

If risk_level is `high`, the initial value is reduced by 1; if `critical`, reduced by 1 (minimum value is 1).

### Depletion Rules

1. When a gate result is `fail`, performing one verify-fix iteration decrements `retry_budget` by 1.
2. When `retry_budget` reaches 0, further verify-fix iterations are prohibited.
3. When `retry_budget == 0`, one of the following must be performed:
   - Transition to `escalated` to request a forge-review
   - Request a product-decision from product_authority (scope reduction, criteria relaxation, etc.)
   - Pivot the task by splitting it into a new task

### Exception

orchestration_authority may grant 1 additional retry_budget with explicit justification. In that case, the justification must be recorded in the task metadata as `budget_extension_reason`. This extension is limited to once per task.

## Worker Self-Check Confidence and Gate Strictness Linkage

The `confidence` value in worker-self-check.json affects gate verification strictness. See the "Low Confidence Threshold Adjustment" section in doc 05 for detailed application rules.

Summary:
- `confidence` 3-5: no adjustment (default thresholds apply)
- `confidence` 1-2: threshold for **all** rubric dimensions raised by +1

Since `confidence` in worker-self-check.json is a single scalar (1-5), the threshold adjustment applies uniformly across all dimensions. If per-dimension confidence is added to the schema in the future, the adjustment can be scoped to only the relevant dimension.

Example: if `confidence` in worker-self-check.json is 2, all dimension thresholds are raised by +1 (`core_interaction` 3->4, `feature_completeness` 4->5, etc.).

The purpose of this adjustment is to apply a higher verification bar to implementations where the worker has expressed uncertainty.

## Representative Task Flow Examples

### Example 1: Standard code task (happy path)

This is the full flow for a typical code task with `task_kind = code`, `risk_level = normal`, `gate_profile = code_change`, `retry_budget = 3`.

**1. `drafted` -> `ready`**
- **Artifact**: `task-contract.json` (`.geas/tasks/{task_id}/task-contract.json`)
- **Performed by**: `task_compiler` (under orchestration_authority direction)
- **Conditions**: task contract compilation is complete, and `base_commit` must be an ancestor of or equal to `tip(integration_branch)`. `acceptance_criteria[]`, `routing`, and `gate_profile` must all be finalized.

**2. `ready` -> `implementing`**
- **Artifact**: `implementation-contract.json` (`.geas/tasks/{task_id}/implementation-contract.json`)
- **Performed by**: primary worker (the agent matching routing.primary_worker_type)
- **Conditions**: the implementation contract must be written and readable by the designated reviewer. The worktree must be prepared at `worktree.path`. Required path_lock / interface_lock must be acquired.

**3. `implementing` (implementation work)**
- **Artifacts**: code changes (commits in the worktree), `worker-self-check.json` (`.geas/tasks/{task_id}/worker-self-check.json`)
- **Performed by**: primary worker
- **Conditions**: the worker completes implementation and fills in all required fields of `worker-self-check.json` including `confidence`, `known_risks[]`, `untested_paths[]`, etc.

**4. `implementing` -> `reviewed`**
- **Artifact**: `specialist-review.json` (`.geas/tasks/{task_id}/specialist-review.json`, created separately per reviewer type)
- **Performed by**: specialist agents designated in `routing.required_reviewer_types[]` (e.g., `architecture_authority`, `qa_engineer`)
- **Conditions**: `worker-self-check.json` must exist, and all required specialist reviews must be complete. Each review must have no blocking defects, or if there were any, they must be resolved.

**5. `reviewed` -> `integrated`**
- **Artifact**: `integration-result.json` (`.geas/tasks/{task_id}/integration-result.json`)
- **Performed by**: orchestration_authority (manages the integration lane)
- **Conditions**: `integration_lock` must be acquired, and the worktree changes merged into the integration branch. The staleness classification must be `clean_sync` or `review_sync` (rewind if `replan_required` or `blocking_conflict`). The integration-result.json records the merge commit hash, conflict status, and drift information.

**6. `integrated` -> `verified`**
- **Artifact**: `gate-result.json` (`.geas/tasks/{task_id}/gate-result.json`)
- **Performed by**: evidence gate (3-tier verification: mechanical -> semantic+rubric -> product)
- **Conditions**: gate result must be `pass`. In this example, all tiers pass and `verdict = pass` is recorded.

**7. `verified` -> `passed`**
- **Artifact**: `closure-packet.json` (`.geas/tasks/{task_id}/closure-packet.json`)
- **Performed by**: orchestration_authority
- **Conditions**: closure packet must be complete. Final verdict is `pass`, and all acceptance criteria are recorded as met. Any debt is registered in `debt-register.json`. All locks for the task are released, and the worktree becomes a cleanup candidate.

```
drafted --[task-contract.json]--> ready
  --[implementation-contract.json]--> implementing
  --[worker-self-check.json + specialist-review.json]--> reviewed
  --[integration-result.json]--> integrated
  --[gate-result.json (pass)]--> verified
  --[closure-packet.json]--> passed ✓
```

### Example 2: Task that fails gate and uses retry budget

This is the flow for a task with `task_kind = code`, `risk_level = normal`, `gate_profile = code_change`, initial `retry_budget = 3` that fails the evidence gate twice before passing. The detailed flow from `integrated` onward is shown.

**1. First gate execution (retry_budget = 3)**
- **State**: `integrated` -> gate execution
- **Artifact**: `gate-result.json` -- `verdict = fail`, rubric score fell short of threshold at tier 2 (semantic+rubric)
- **Failure details**: rubric score for `acceptance_criteria[2]` ("error responses must follow the standard format") was 2/5, below the threshold of 3. Specific violations are recorded in `gate-result.json`'s `failures[]`.
- **Result**: enter verify-fix loop. `retry_budget` 3 -> **2**.

**2. Verify-fix iteration 1 (retry_budget = 2)**
- **State**: `verified(fail)` -> rewind to `implementing` (Default Rewind Rules: implementation failure -> `implementing`)
- **Performed by**: primary worker references `gate-result.json`'s `failures[]` to apply fixes
- **Artifacts**:
  - code fix commits (in worktree)
  - updated `worker-self-check.json` (`confidence` adjusted, previous failure reflected in `known_risks[]`)
  - specialist re-review if needed -> updated `specialist-review.json`
  - re-integration -> updated `integration-result.json`
- **Gate re-execution**: `gate-result.json` -- `verdict = fail`, tier 1 (mechanical) passed this time but rubric score 2/5 at tier 2 (different criterion failed)
- **Result**: `retry_budget` 2 -> **1**.

**3. Verify-fix iteration 2 (retry_budget = 1)**
- **State**: rewind to `implementing` again
- **Performed by**: primary worker references the second `gate-result.json`'s `failures[]` to apply fixes
- **Artifacts**:
  - code fix commits
  - updated `worker-self-check.json`
  - re-review -> re-integration
- **Gate re-execution**: `gate-result.json` -- `verdict = pass`, all tiers passed
- **Result**: verification passed. `retry_budget` remains at 1 (no deduction on pass).

**4. Subsequent flow**
- `verified(pass)` -> `closure-packet.json` written -> `passed`
- The closure packet records the retry history: 2 total verify-fix iterations, with the failure reason and fix details for each iteration.

```
integrated --[gate fail, rubric shortfall]--> verified(fail)
  --retry_budget: 3->2--> implementing (rewind)
  --[fix + re-review + re-integrate]--> integrated
  --[gate fail, different criterion shortfall]--> verified(fail)
  --retry_budget: 2->1--> implementing (rewind)
  --[fix + re-review + re-integrate]--> integrated
  --[gate pass]--> verified(pass)
  --[closure-packet.json]--> passed ✓
```

**If iteration 2 had also failed (retry_budget = 0):**
- Further verify-fix iterations are prohibited.
- One of the following must be chosen:
  1. Transition to `escalated` to request a forge-review
  2. Request scope reduction or criteria relaxation from `product_authority`
  3. Pivot by splitting the task into a new task
- orchestration_authority may grant 1 additional retry with explicit justification via `budget_extension_reason` (once per task maximum).
