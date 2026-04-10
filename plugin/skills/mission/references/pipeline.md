# Per-Task Pipeline

The universal pipeline for every task, regardless of mission scope.

## Universal Requirements

EVERY task, regardless of dependencies or position in the batch, MUST execute ALL pipeline steps. No step may be skipped because "a prior task already did it" or "this is a dependent task."

## remaining_steps

```json
"remaining_steps": ["design", "design_guide", "implementation_contract", "implementation", "self_check", "specialist_review", "testing", "evidence_gate", "integration", "closure_packet", "challenger", "final_verdict", "retrospective", "memory_extraction", "resolve"]
```

Remove steps that will be skipped (e.g., remove "design" if no UI). After completing each step, remove it from the front of the array and update run.json.

## CLI Usage for Worktree Agents

Worktree-isolated agents can use `geas` commands directly. The CLI auto-detects the `.geas/` directory via `git rev-parse --show-toplevel`, so `--cwd` is not needed even in worktrees.

## Task File Precondition
The TaskContract MUST be written to `.geas/missions/{mission_id}/tasks/{task-id}/contract.json` before the pipeline starts. Do NOT enter the pipeline without a task file on disk. This is required for closure validation and session recovery.

## Start Task
- Read TaskContract. Check dependencies are `"passed"`.
- **Classification Fallback**: If the TaskContract is missing classification fields at pipeline start:
  - `risk_level` missing → assign `"normal"`
  - `vote_round_policy` missing → assign `"auto"`
  - `task_kind` missing → assign `"implementation"`
  - `gate_profile` missing → assign `"implementation_change"`
  - Log: `{"event": "classification_defaulted", "task_id": "...", "fields_defaulted": [...], "timestamp": "<actual>"}`
- Transition to ready (guard checks contract.json exists with required fields):
  ```bash
  Bash("geas task transition --id {task-id} --to ready")
  ```
- Log `task_started` event: `Bash("geas event log --type task_started --task {task-id}")`
- Do NOT transition to `"implementing"` yet — that happens after the Implementation Contract is approved (the guard requires it).
- **Rubric check**: If the TaskContract is missing `rubric`, insert the default before proceeding:
  ```json
  "rubric": {
    "dimensions": [
      { "name": "core_interaction", "threshold": 3 },
      { "name": "feature_completeness", "threshold": 4 },
      { "name": "code_quality", "threshold": 4 },
      { "name": "regression_safety", "threshold": 4 }
    ]
  }
  ```
  Add `ux_clarity` (threshold 3) and `visual_coherence` (threshold 3) if the task has a UI component.

### Baseline Check (before implementing)

Before transitioning to `"implementing"`, check for staleness:

1. Read `base_snapshot` from the TaskContract
2. Get current integration branch tip: `git rev-parse HEAD`
3. If `base_snapshot == tip`: no staleness, proceed
4. If `base_snapshot != tip`: run revalidation:
   a. Compute changed files: `git diff {base_snapshot}..{tip} --name-only`
   b. Compare against the task's `scope.surfaces`
   c. **No overlap** -> classification = `clean_sync`. Update `base_snapshot` to current tip in the TaskContract. Proceed.
   d. **Overlap, auto-resolvable** -> classification = `review_sync`. Update `base_snapshot`, proceed. Flag for specialist re-review after implementation.
   e. **Overlap, not auto-resolvable** -> classification = `replan_required`. Do NOT proceed. Rewind task to `"ready"`. Update implementation contract.
   f. **Preconditions invalidated** -> classification = `blocking_conflict`. Set task status to `"blocked"`.
   g. Log event: `Bash("geas event log --type revalidation --task {task-id} --data '{\"classification\":\"...\",\"action_taken\":\"...\"}'")` 

Only proceed to `"implementing"` if classification is `clean_sync` or `review_sync`.

### Lock Acquisition

Before entering `"implementing"`, acquire locks in order (per doc 04):

1. **`path` locks**: Acquire via CLI which handles conflict detection automatically:
   ```bash
   Bash("geas lock acquire --task {task-id} --type path --targets 'src/auth/,tests/auth/' --session {session-id}")
   ```
   - If the CLI returns `acquired: false` with conflicts: **cannot proceed** — skip this task and try the next eligible task.

2. **`interface` locks**: If the task touches API contracts, acquire interface locks:
   ```bash
   Bash("geas lock acquire --task {task-id} --type interface --targets 'api-auth-contract' --session {session-id}")
   ```

3. **`resource` locks**: If the task uses shared resources:
   ```bash
   Bash("geas lock acquire --task {task-id} --type resource --targets 'port-3000,db-migration' --session {session-id}")
   ```

The CLI writes locks.json atomically. If any acquisition fails (conflict), release locks already acquired: `Bash("geas lock release --task {task-id}")`

## Step Groups

Within a single task's pipeline, these steps may run in parallel:
- **[specialist_review, testing]** — design-authority and quality-specialist do not reference each other's output. Spawn both in one message. After both return, remove both from `remaining_steps` and log `step_complete` for each.

All other steps are strictly sequential. In particular:
- **challenger -> final_verdict** — product-authority's prompt requires the `challenge_review` section in record.json. challenger MUST complete and section MUST be verified before spawning product-authority.

## [MANDATORY] Event Logging

After each step completes and is removed from `remaining_steps`, log via CLI:
```bash
Bash("geas event log --type step_complete --task {task-id} --agent {agent_name} --data '{\"step\":\"{step_name}\"}'")
```
Exception: `implementation_contract`, `gate_result`, and `task_resolved` have their own event formats. Do not duplicate those.

## [MANDATORY] Session State Update

After each step completes and is logged, update the session context anchor via CLI:

```bash
Bash("geas state session-update --phase {phase} --task {task-id} --step {step_name} --summary '{summary_text}'")
```

The CLI auto-generates timestamps and writes to `.geas/state/session-latest.md`. Task focus is tracked in run.json by the orchestrator (no separate task-focus files).

## Pipeline Steps

### Design (implementer — design-capable) [DEFAULT — skip-if: no user-facing interface]
**Must run if the task has any user-facing interface (pages, forms, dashboards).**
Select the appropriate agent for this role. Use profiles.json defaults if the mission has a domain_profile, but choose the best-fit agent based on the task's needs. If the selected implementer is design-capable, spawn it. Otherwise, the primary implementer handles design.
Compose the context packet inline and write via CLI: `Bash("geas packet create --task {task-id} --agent {resolved-implementer} --content '...'")`. Then:
Update checkpoint: `Bash("geas state checkpoint set --step design --agent {resolved-implementer}")`
```
Agent(agent: "{resolved-implementer}", prompt: "Read .geas/missions/{mission_id}/tasks/{task-id}/packets/{resolved-implementer}.md. Write your design spec as evidence. Run: geas evidence add --task {task-id} --agent {resolved-implementer}-design --role reviewer --set summary='<design summary>' --set verdict='approved' --set concerns='[]'")
```
Verify `.geas/missions/{mission_id}/tasks/{task-id}/evidence/{resolved-implementer}-design.json` exists.

### Design Guide (design-authority) [DEFAULT — skip when ALL: existing pattern, no new libs, single module, no schema change]
**Skip** when ALL of these are true:
- Task follows an existing pattern in rules.md
- No new external libraries or services
- Single module scope (no cross-boundary changes)
- No data model or schema changes

**Spawn** when ANY of these are true:
- New external library/service integration
- Architecture pattern change
- Cross-module dependencies
- New data model or schema changes

Select the appropriate agent for this role. Use profiles.json defaults if the mission has a domain_profile, but choose the best-fit agent based on the task's needs. Compose the context packet inline and write via CLI: `Bash("geas packet create --task {task-id} --agent {resolved-design-authority} --content '...'")`. Then:
Update checkpoint: `Bash("geas state checkpoint set --step design_guide --agent {resolved-design-authority}")`
```
Agent(agent: "{resolved-design-authority}", prompt: "Read .geas/missions/{mission_id}/tasks/{task-id}/packets/{resolved-design-authority}.md. Write your design guide as evidence. Run: geas evidence add --task {task-id} --agent {resolved-design-authority} --role reviewer --set summary='<guide summary>' --set verdict='approved' --set concerns='[]'")
```
Verify `.geas/missions/{mission_id}/tasks/{task-id}/evidence/{resolved-design-authority}.json` exists.

### Implementation Contract [MANDATORY]
Invoke `/geas:implementation-contract` — worker writes action plan, quality-specialist and design-authority approve before implementation.
Update checkpoint: `Bash("geas state checkpoint set --step implementation_contract --agent {worker}")`
Verify record.json has `implementation_contract` section with `status: "approved"`:
```bash
Bash("geas task record get --task {task-id} --section implementation_contract")
```

Transition to implementing (guard checks implementation_contract.status === "approved"):
```bash
Bash("geas task transition --id {task-id} --to implementing")
```

### Implementation [MANDATORY — worktree isolated]
Compose the context packet inline and write via CLI: `Bash("geas packet create --task {task-id} --agent {worker} --content '...'")`. Then:
Resolve `project_root` — the absolute path of the main session working directory (see mission/SKILL.md "Worktree state access rule").
Update checkpoint: `Bash("geas state checkpoint set --step implementation --agent {worker}")`
```
Agent(agent: "{worker}", isolation: "worktree", prompt: "IMPORTANT: You are running in a worktree. The .geas/ directory is NOT available via relative paths. Use the absolute paths below for ALL .geas/ access. Read {project_root}/.geas/missions/{mission_id}/tasks/{task-id}/packets/{worker}.md. Implement the feature. Write your evidence by running: geas evidence add --task {task-id} --agent {worker} --role implementer --set summary='<implementation summary>' --set files_changed='[\"file1\",\"file2\"]'")
```
Verify `.geas/missions/{mission_id}/tasks/{task-id}/evidence/{worker}.json` exists.

### Worker Self-Check [MANDATORY]
The worker self-check runs in the same worktree as the implementation step (worktree is still alive — merge happens later at Integration). Resolve `project_root` — the absolute path of the main session working directory (see mission/SKILL.md "Worktree state access rule").
Update checkpoint: `Bash("geas state checkpoint set --step self_check --agent {worker}")`
```
Agent(agent: "{worker}", isolation: "worktree", prompt: "IMPORTANT: You are running in a worktree. The .geas/ directory is NOT available via relative paths. Use the absolute paths below for ALL .geas/ access. Implementation for {task-id} is complete. Before handing off to review, write your self-check to record.json. Run: geas task record add --task {task-id} --section self_check --data '<your-json>'. Required fields: confidence (integer 1-5), known_risks (string[]), untested_paths (string[]), summary (string). The CLI validates against the record schema automatically.")
```
Verify record.json has `self_check` section: `Bash("geas task record get --task {task-id} --section self_check")`. Do NOT proceed to Specialist Review without this section.

### Specialist Review (design-authority) [MANDATORY]
Select the appropriate agent for this role. Use profiles.json defaults if the mission has a domain_profile, but choose the best-fit agent based on the task's needs. Compose the context packet inline and write via CLI: `Bash("geas packet create --task {task-id} --agent {resolved-design-authority}-review --content '...'")`. Then:
Update checkpoint: `Bash("geas state checkpoint set --step specialist_review --agent {resolved-design-authority}")`
```
Agent(agent: "{resolved-design-authority}", prompt: "Read .geas/missions/{mission_id}/tasks/{task-id}/packets/{resolved-design-authority}-review.md. Review implementation. Write your review as evidence. Run: geas evidence add --task {task-id} --agent {resolved-design-authority}-review --role reviewer --set summary='<review summary>' --set verdict='approved' --set concerns='[]'")
```
Verify `.geas/missions/{mission_id}/tasks/{task-id}/evidence/{resolved-design-authority}-review.json` exists.
Update checkpoint: `Bash("geas state checkpoint set --step specialist_review --agent null")`

### Testing (quality-specialist) [MANDATORY]
Select the appropriate agent for this role. Use profiles.json defaults if the mission has a domain_profile, but choose the best-fit agent based on the task's needs. Compose the context packet inline and write via CLI: `Bash("geas packet create --task {task-id} --agent {resolved-quality-specialist} --content '...'")`. Then:
Update checkpoint: `Bash("geas state checkpoint set --step testing --agent {resolved-quality-specialist}")`
```
Agent(agent: "{resolved-quality-specialist}", prompt: "Read .geas/missions/{mission_id}/tasks/{task-id}/packets/{resolved-quality-specialist}.md. Test the implementation. Write your test results as evidence. Run: geas evidence add --task {task-id} --agent {resolved-quality-specialist} --role tester --set summary='<test summary>' --set verdict='pass' --set criteria_results='[{\"criterion\":\"...\",\"passed\":true}]'")
```
Verify `.geas/missions/{mission_id}/tasks/{task-id}/evidence/{resolved-quality-specialist}.json` exists.
Update checkpoint: `Bash("geas state checkpoint set --step testing --agent null")`

After BOTH specialist_review and testing complete:
1. Update TaskContract status: `Bash("geas task transition --id {task-id} --to reviewed")`

Do NOT update status to `"reviewed"` until both steps finish.

### Evidence Gate
Run eval_commands from TaskContract. Check acceptance criteria against all evidence at `.geas/missions/{mission_id}/tasks/{task-id}/evidence/`.
Write gate result to record.json:
```bash
Bash("geas task record add --task {task-id} --section gate_result --data '<gate_result_json>'")
```
The gate_result section must include: `verdict` (pass/fail/block/error), `tier_results`, `rubric_scores`, `blocking_dimensions`. The CLI validates automatically.

**gate_result fields:** `verdict` (pass|fail|block|error), `tier_results` (object with `tier_0`, `tier_1`, `tier_2` keys, each having `status` and optional `details`), `rubric_scores[]` (items: `dimension`, `score`, `passed`, optional `threshold`), `blocking_dimensions[]`

If fail -> invoke `/geas:verify-fix-loop`. **Spawn the worker agent to fix.** After fix, re-run gate.

On gate pass, proceed to Integration.

### Integration [MANDATORY — after gate pass]

Merge the worktree into the integration baseline. The worktree has been alive since the Implementation step.

#### Pre-Integration Staleness Check

Before merging the worktree:

1. Re-check: compare `base_snapshot` with current `tip(integration_branch)` using `git diff {base_snapshot}..HEAD --name-only`
2. Compare against `scope.surfaces`
3. Classify:
   - `clean_sync` -> fast-forward merge or trivial rebase, proceed
   - `review_sync` -> merge, then specialist re-review required for changed areas
   - `replan_required` -> rewind task to `"ready"`, update implementation contract
   - `blocking_conflict` -> task -> `"blocked"`
4. If revalidation was needed, log event: `Bash("geas event log --type revalidation --task {task-id} --data '{\"classification\":\"...\",\"action_taken\":\"...\"}'")` 

#### Integration Lock

Before merging the worktree to the integration branch:

1. Acquire integration lock via CLI:
   ```bash
   Bash("geas lock acquire --task {task-id} --type integration --targets integration_branch --session {session-id}")
   ```
2. If the CLI returns `acquired: false` with conflicts: **wait**. The CLI automatically creates a waiting entry.
3. Merge the worktree branch
4. **Release the integration lock immediately** after merge:
   ```bash
   Bash("geas lock release --task {task-id}")
   ```

This ensures integration is single-flight — only one task merges at a time.

#### Transition and Worktree Cleanup

After successful merge:
1. Transition to `"integrated"` (guard checks gate_result.verdict === "pass"):
   ```bash
   Bash("geas task transition --id {task-id} --to integrated")
   ```
2. Clean up the worktree — it is no longer needed after merge.
3. Transition to `"verified"`:
   ```bash
   Bash("geas task transition --id {task-id} --to verified")
   ```

### Closure Packet Assembly [MANDATORY — after gate pass]

orchestration-authority (Orchestrator) assembles the closure packet by reading all task artifacts. This is NOT an agent spawn — Orchestrator reads and writes directly.

**Read required artifacts:**
- TaskContract: `.geas/missions/{mission_id}/tasks/{task-id}/contract.json`
- Self-Check: record.json `self_check` section (`Bash("geas task record get --task {task-id} --section self_check")`)
- Gate Result: record.json `gate_result` section (`Bash("geas task record get --task {task-id} --section gate_result")`)
- Specialist Reviews: `.geas/missions/{mission_id}/tasks/{task-id}/evidence/{resolved-design-authority}-review.json`, `.geas/missions/{mission_id}/tasks/{task-id}/evidence/{resolved-quality-specialist}.json`
- Integration Result: from worktree merge (commit hash, conflict status)

**If ANY required artifact is missing: go back and execute the missing step. Do NOT proceed.**

**Write** the closure section to record.json via CLI:
```bash
Bash("geas task record add --task {task-id} --section closure --data '<closure_json>'")
```
The closure section must include: `change_summary` (required), `reviews` (array with reviewer_type/status/summary), `open_risks`, `debt_items`. The CLI validates against the record schema automatically.

**closure fields:** `change_summary`, `reviews[]` (items: `reviewer_type`, `status` (approved|changes_requested|blocked), optional `summary`), `open_risks[]`, `debt_items[]`

**Verify** record.json has `closure` section: `Bash("geas task record get --task {task-id} --section closure")`. Confirm all required fields are populated before proceeding.

Update checkpoint: `Bash("geas state checkpoint set --step closure_packet --agent orchestrator")`

### Challenger Review [CONDITIONAL — mandatory for high/critical risk]

**Skip condition:** If `risk_level` is `low`, skip this step. Remove `"challenger"` from `remaining_steps`, update run.json checkpoint, and proceed directly to Final Verdict.

**Discretionary:** If `risk_level` is `normal`, this step is at orchestration-authority's discretion.

**Mandatory condition:** If `risk_level` is `high` or `critical`, this step MUST run.

Resolve the challenger agent. Update checkpoint: `Bash("geas state checkpoint set --step challenger --agent challenger")`
```
Agent(agent: "challenger", prompt: "Read the closure from record.json via: geas task record get --task {task-id} --section closure. Read all evidence at .geas/missions/{mission_id}/tasks/{task-id}/evidence/. Perform your challenge review per your Review Protocols. Write your challenge review to record.json. Run: geas task record add --task {task-id} --section challenge_review --data '<your-json>'. The CLI validates automatically.")

**challenge_review fields:** `concerns[]` (strings or objects with `severity` (blocking|non_blocking) and `description`), `blocking` (boolean), optional `summary`
```

Verify record.json has `challenge_review` section: `Bash("geas task record get --task {task-id} --section challenge_review")`.

**[MANDATORY] Log step_complete immediately after verification:**
```bash
Bash("geas event log --type step_complete --task {task-id} --agent challenger --data '{\"step\":\"challenger\"}'")
```
Do NOT skip this log entry — it is required for conformance verification and session recovery.

**After challenger returns:**

1. Read the `challenge_review` section from record.json.
2. **If `blocking` is true:**
   - Update the `closure` section in record.json: append blocking concerns to `open_risks`.
   - Invoke `/geas:vote-round` as a readiness_round:
     - Participants: orchestration-authority, product-authority, 1 specialist (most relevant to the blocking concern)
     - Vote options: ship / iterate / escalate
   - **If ship:** convert blocking concerns to acknowledged risks in `closure.open_risks`. Proceed to Final Verdict.
   - **If iterate:** rewind to resolve the blocking concern. Repopulate `remaining_steps` from the rewind point.
   - **If escalate:** set task status to `"escalated"`. Write a DecisionRecord. Stop pipeline.
3. **If `blocking` is false:** proceed to Final Verdict.

Update checkpoint: `Bash("geas state checkpoint set --step challenger --agent null")`

### Final Verdict (product-authority) [MANDATORY]
**Preconditions:**
- record.json must have `challenge_review` section OR challenger was explicitly skipped for low risk
- record.json must have `closure` section with all required fields populated
- Do NOT spawn product-authority until both preconditions are verified

Update checkpoint: `Bash("geas state checkpoint set --step final_verdict --agent product-authority")`
```
Agent(agent: "product-authority", prompt: "Read the closure and challenge_review sections from record.json via: geas task record get --task {task-id}. Read all evidence at .geas/missions/{mission_id}/tasks/{task-id}/evidence/. Issue your final verdict per your Review Protocols. Write your verdict to record.json. Run: geas task record add --task {task-id} --section verdict --data '<verdict_json>'. The CLI validates automatically. Also write evidence. Run: geas evidence add --task {task-id} --agent product-authority-verdict --role authority --set summary='<verdict summary>' --set verdict='pass' --set rationale='<rationale>'")
```

**Verdict rules:**
- `pass` -> task proceeds to Resolve (status `"passed"`)
- `iterate` -> specify `rewind_target` (ready/implementing/reviewed). Does NOT consume `retry_budget`. After 3 cumulative iterates for the same task -> `escalated`.
- `escalate` -> requires higher-level decision-making. Include `escalation_reason`.

Note: "iterate" is only valid as a Final Verdict outcome. Gate verdicts (evidence-gate) are pass/fail/block/error.

### Pre-Resolve Check (Mechanical Artifact Gate)
**Before marking any task as "passed", verify ALL required record.json sections exist.** This is a mechanical gate enforced at the `verified -> passed` transition. The CLI `geas task transition --to passed` command validates these sections exist in record.json before allowing the transition.

**Required record.json sections (verified -> passed):**
- `closure` section exists (assembled in Closure Packet Assembly)
- `challenge_review` section exists OR challenger was explicitly skipped (low risk)
- `verdict` section exists with `verdict: "pass"`
- `retrospective` section exists

**If ANY is missing: go back and execute the missing step. Do NOT proceed.** The CLI will reject the transition with an error listing the missing sections.

### Retrospective [MANDATORY — before Resolve]

**Skip condition:** If the Final Verdict was Escalate, skip retrospective. Only run when the verdict is `pass`.

Update checkpoint: `Bash("geas state checkpoint set --step retrospective --agent orchestrator")`

Orchestrator reads all evidence at `.geas/missions/{mission_id}/tasks/{task-id}/evidence/` and the closure section from record.json. Then writes the retrospective section to record.json via CLI:

```bash
Bash("geas task record add --task {task-id} --section retrospective --data '<retrospective_json>'")
```
The retrospective section must include: `what_went_well` (required), `what_broke` (required), `what_was_surprising`, `rule_candidates` (proposed changes to rules.md -- DO NOT modify rules.md directly), `memory_candidates`, `debt_candidates`, `next_time_guidance`. The CLI validates against the record schema automatically.

Verify record.json has `retrospective` section: `Bash("geas task record get --task {task-id} --section retrospective")`.

#### Agent Memory Update

After the retrospective, harvest `memory_suggestions` from the task's artifacts to update per-agent memory files.

Collect `memory_suggestions` from:
- All specialist reviews at `.geas/missions/{mission_id}/tasks/{task-id}/evidence/`
- Challenge review from record.json `challenge_review` section (if exists)
- Self-check from record.json `self_check` section

Agent type mapping:
- For specialist reviews: read from the evidence file's `agent` or `role` field
- For challenge review: challenger agent
- For self-check: use the task's `routing.primary_worker_type`

Items written to agent memory files SHOULD NOT be duplicated in the retrospective section's `memory_candidates[]`.

For each agent type that produced suggestions, update via CLI:
```bash
Bash("geas memory agent-note --agent {agent_type} --add '<lesson learned>'")
```

Additionally, update Orchestrator's own memory based on `next_time_guidance[]` from the retrospective:
```bash
Bash("geas memory agent-note --agent orchestration-authority --add '<guidance>'")
```

Agent memory update is performed regardless of mission mode.

### Memory Extraction [MANDATORY after Retrospective, Ship only]

**DO NOT SKIP THIS STEP.** Only skip when task was Escalate (same as retrospective).

Invoke `/geas:memorizing` with the task ID for per-task memory extraction:

1. Read record.json `retrospective` section -> extract `memory_candidates[]`
2. If `memory_candidates` is empty: still invoke `/geas:memorizing` for auto-extraction from evidence files at `.geas/missions/{mission_id}/tasks/{task-id}/evidence/`. Do NOT skip.
3. For each candidate that is project-level knowledge (conventions, patterns, rules):
   - Evaluate if it should be added to `.geas/rules.md`
   - If approved (evidence_refs >= 2 or domain authority approval): apply to rules.md
4. For each candidate that is agent-specific:
   - Write to the relevant agent's memory file via CLI:
     ```bash
     Bash("geas memory agent-note --agent {agent_type} --add '<lesson>'")
     ```
5. Log: `Bash("geas event log --type memory_extraction --task {task-id} --data '{\"candidates\": N}'")`

Update checkpoint: `Bash("geas state checkpoint set --step memory_extraction --agent orchestrator")`

### Resolve [MANDATORY — after Retrospective + Memory Extraction]

#### Lock Release

On task completion (Pass, Cancel, or Escalate):
```bash
Bash("geas lock release --task {task-id}")
Bash("geas event log --type locks_released --task {task-id}")
```
The CLI removes ALL lock entries where `task_id` matches this task and promotes any waiting locks.

- **Ship**: Transition task to passed and commit (the guard now passes because retrospective exists):
  ```bash
  Bash("geas task transition --id {task-id} --to passed")
  Bash("geas state checkpoint set --step resolve --agent orchestrator")
  ```
  ```bash
  git add -A && git commit -m "{conventional commit message for task-id}"
  ```
  Log: `Bash("geas event log --type task_resolved --task {task-id} --data '{\"commit\":\"{hash}\"}'")` 
- **Iterate** (Final Verdict only): does NOT deduct retry_budget (iterate is a product judgment, not a gate failure). Track iterate_count — after 3 cumulative iterates, escalate to orchestration-authority. Repopulate remaining_steps with the full pipeline (same skip conditions as original). Include product-authority's feedback in all subsequent ContextPackets. Resume from the rewind_target specified in the final verdict.
- **Cancel**: status -> `"cancelled"`. Transition via `Bash("geas task transition --mission {mission_id} --id {task-id} --to cancelled")`. Write DecisionRecord.
