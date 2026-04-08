# Per-Task Pipeline

The universal pipeline for every task, regardless of mission scope.

## Universal Requirements

EVERY task, regardless of dependencies or position in the batch, MUST execute ALL pipeline steps. No step may be skipped because "a prior task already did it" or "this is a dependent task."

## remaining_steps

```json
"remaining_steps": ["design", "design_guide", "implementation_contract", "implementation", "self_check", "specialist_review", "testing", "evidence_gate", "closure_packet", "challenger", "final_verdict", "resolve", "retrospective", "memory_extraction"]
```

Remove steps that will be skipped (e.g., remove "design" if no UI). After completing each step, remove it from the front of the array and update run.json.

## CLI Usage for Worktree Agents

Agents spawned with `isolation: "worktree"` cannot use the `geas` CLI alias directly because the `.geas/` directory is not present in their worktree. These agents must use the `--cwd` pattern to invoke CLI commands against the main project root:

```
node {project_root}/plugin/cli/index.js --cwd {project_root} <command> [args]
```

Where `{project_root}` is the absolute path of the main session working directory, resolved before spawning the agent (see mission/SKILL.md "Worktree state access rule").

Non-worktree agents can use `geas <command>` directly.

## Task File Precondition
The TaskContract MUST be written to `.geas/missions/{mission_id}/tasks/{task-id}.json` before the pipeline starts. Do NOT enter the pipeline without a task file on disk. This is required for Closure Packet validation and session recovery.

## Start Task
- Read TaskContract. Check dependencies are `"passed"`.
- **Classification Fallback**: If the TaskContract is missing classification fields at pipeline start:
  - `risk_level` missing → assign `"normal"`
  - `vote_round_policy` missing → assign `"auto"`
  - `task_kind` missing → assign `"implementation"`
  - `gate_profile` missing → assign `"implementation_change"`
  - Log: `{"event": "classification_defaulted", "task_id": "...", "fields_defaulted": [...], "timestamp": "<actual>"}`
- Update status to `"implementing"`. Log `task_started` event.
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

1. Read `base_commit` from the TaskContract
2. Get current integration branch tip: `git rev-parse HEAD`
3. If `base_commit == tip`: no staleness, proceed
4. If `base_commit != tip`: run revalidation:
   a. Compute changed files: `git diff {base_commit}..{tip} --name-only`
   b. Compare against the task's `scope.paths`
   c. **No overlap** -> classification = `clean_sync`. Update `base_commit` to current tip in the TaskContract. Proceed.
   d. **Overlap, auto-resolvable** -> classification = `review_sync`. Update `base_commit`, proceed. Flag for specialist re-review after implementation.
   e. **Overlap, not auto-resolvable** -> classification = `replan_required`. Do NOT proceed. Rewind task to `"ready"`. Update implementation contract.
   f. **Preconditions invalidated** -> classification = `blocking_conflict`. Set task status to `"blocked"`.
   g. Write the revalidation record to `.geas/missions/{mission_id}/tasks/{task-id}/revalidation-record.json` (use Write tool — no dedicated CLI command for revalidation-record)
   h. Log event: `Bash("geas event log --type revalidation --task {task-id} --data '{\"classification\":\"...\"}'")` 

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
- **[specialist_review, testing]** — design-authority and quality_specialist do not reference each other's output. Spawn both in one message. After both return, remove both from `remaining_steps` and log `step_complete` for each.

All other steps are strictly sequential. In particular:
- **challenger -> final_verdict** — product_authority's prompt requires `challenge-review.json` as input. challenger MUST complete and file MUST be verified before spawning product_authority.

## [MANDATORY] Event Logging

After each step completes and is removed from `remaining_steps`, log via CLI:
```bash
Bash("geas event log --type step_complete --task {task-id} --agent {agent_name} --data '{\"step\":\"{step_name}\"}'")
```
Exception: `implementation_contract`, `gate_result`, and `task_resolved` have their own event formats. Do not duplicate those.

## [MANDATORY] Session State Update

After each step completes and is logged, update the session context anchors via CLI:

```bash
Bash("geas state session-update --phase {phase} --task {task-id} --step {step_name} --summary '{summary_text}'")
```

```bash
Bash("geas state task-focus --id {task-id} --status {state} --step {step_name} --summary '{progress_summary}'")
```

The CLI auto-generates timestamps and writes the markdown files to `.geas/state/session-latest.md` and `.geas/state/task-focus/{task-id}.md` respectively.

## Pipeline Steps

### Design (implementer — design-capable) [DEFAULT — skip-if: no user-facing interface]
**Must run if the task has any user-facing interface (pages, forms, dashboards).**
Resolve the implementer slot via profiles.json. If the profile provides a design-capable implementer, spawn it. Otherwise, the primary implementer handles design.
Generate ContextPacket, then:
Update checkpoint: `Bash("geas state checkpoint set --step design --agent {resolved-implementer}")`
```
Agent(agent: "{resolved-implementer}", prompt: "Read .geas/missions/{mission_id}/packets/{task-id}/{resolved-implementer}.md. Write your design spec as evidence. Run: geas evidence record --mission {mission_id} --task {task-id} --agent {resolved-implementer}-design --data '<your-json>'")
```
Verify `.geas/missions/{mission_id}/evidence/{task-id}/{resolved-implementer}-design.json` exists.

### Design Guide (design-authority) [DEFAULT — skip when ALL: existing pattern, no new libs, single module, no schema change]
**Skip** when ALL of these are true:
- Task follows an existing pattern in conventions.md
- No new external libraries or services
- Single module scope (no cross-boundary changes)
- No data model or schema changes

**Spawn** when ANY of these are true:
- New external library/service integration
- Architecture pattern change
- Cross-module dependencies
- New data model or schema changes

Resolve the design-authority slot via profiles.json. Generate ContextPacket, then:
Update checkpoint: `Bash("geas state checkpoint set --step design_guide --agent {resolved-design-authority}")`
```
Agent(agent: "{resolved-design-authority}", prompt: "Read .geas/missions/{mission_id}/packets/{task-id}/{resolved-design-authority}.md. Write your design guide as evidence. Run: geas evidence record --mission {mission_id} --task {task-id} --agent {resolved-design-authority} --data '<your-json>'")
```
Verify `.geas/missions/{mission_id}/evidence/{task-id}/{resolved-design-authority}.json` exists.

### Implementation Contract [MANDATORY]
Invoke `/geas:implementation-contract` — worker writes action plan, quality_specialist and design_authority approve before implementation.
Update checkpoint: `Bash("geas state checkpoint set --step implementation_contract --agent {worker}")`
Verify `.geas/missions/{mission_id}/contracts/{task-id}.json` exists with `status: "approved"`.

### Implementation [MANDATORY — worktree isolated]
Generate ContextPacket, then:
Resolve `project_root` — the absolute path of the main session working directory (see mission/SKILL.md "Worktree state access rule").
Update checkpoint: `Bash("geas state checkpoint set --step implementation --agent {worker}")`
```
Agent(agent: "{worker}", isolation: "worktree", prompt: "IMPORTANT: You are running in a worktree. The .geas/ directory is NOT available via relative paths. Use the absolute paths below for ALL .geas/ access. Read {project_root}/.geas/missions/{mission_id}/packets/{task-id}/{worker}.md. Implement the feature. Write your evidence by running: node {project_root}/plugin/cli/index.js --cwd {project_root} evidence record --mission {mission_id} --task {task-id} --agent {worker} --data '<your-json>'")
```
Verify evidence exists.

#### Pre-Integration Staleness Check

Before merging the worktree:

1. Re-check: compare `base_commit` with current `tip(integration_branch)` using `git diff {base_commit}..HEAD --name-only`
2. Compare against `scope.paths`
3. Classify:
   - `clean_sync` -> fast-forward merge or trivial rebase, proceed
   - `review_sync` -> merge, then specialist re-review required for changed areas
   - `replan_required` -> rewind task to `"ready"`, update implementation contract
   - `blocking_conflict` -> task -> `"blocked"`
4. If revalidation was needed, write an updated `.geas/missions/{mission_id}/tasks/{task-id}/revalidation-record.json` (use Write tool — no dedicated CLI command for revalidation-record)

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

After successful merge, status remains `"implementing"` — the task is not yet reviewed or complete.

### Worker Self-Check [MANDATORY]
The worker self-check runs in the same worktree as the implementation step. Resolve `project_root` — the absolute path of the main session working directory (see mission/SKILL.md "Worktree state access rule").
Update checkpoint: `Bash("geas state checkpoint set --step self_check --agent {worker}")`
```
Agent(agent: "{worker}", isolation: "worktree", prompt: "IMPORTANT: You are running in a worktree. The .geas/ directory is NOT available via relative paths. Use the absolute paths below for ALL .geas/ access. Implementation for {task-id} is complete. Before handing off to review, produce your self-check artifact. Run: node {project_root}/plugin/cli/index.js --cwd {project_root} task self-check --mission {mission_id} --task {task-id} --data '<your-json>'. Required fields: version (\"1.0\"), artifact_type (\"worker_self_check\"), artifact_id (e.g. \"self-check-{task-id}\"), producer_type (your agent type from the domain profile), task_id, known_risks (string[]), untested_paths (string[]), possible_stubs (string[]), what_to_test_next (string[]), confidence (integer 1-5: 1=very_low ... 5=very_high), summary (string), created_at (ISO 8601 timestamp).")
```
Verify `{project_root}/.geas/missions/{mission_id}/tasks/{task-id}/worker-self-check.json` exists. Do NOT proceed to Specialist Review without this file.

### Specialist Review (design-authority) [MANDATORY]
Resolve the design-authority slot via profiles.json. Generate ContextPacket, then:
Update checkpoint: `Bash("geas state checkpoint set --step specialist_review --agent {resolved-design-authority}")`
```
Agent(agent: "{resolved-design-authority}", prompt: "Read .geas/missions/{mission_id}/packets/{task-id}/{resolved-design-authority}-review.md. Review implementation. Write your review as evidence. Run: geas evidence record --mission {mission_id} --task {task-id} --agent {resolved-design-authority}-review --data '<your-json>'")
```
Verify `.geas/missions/{mission_id}/evidence/{task-id}/{resolved-design-authority}-review.json` exists.
Update checkpoint: `Bash("geas state checkpoint set --step specialist_review --agent null")`

### Testing (quality_specialist) [MANDATORY]
Resolve the quality_specialist slot via profiles.json. Generate ContextPacket, then:
Update checkpoint: `Bash("geas state checkpoint set --step testing --agent {resolved-quality-specialist}")`
```
Agent(agent: "{resolved-quality-specialist}", prompt: "Read .geas/missions/{mission_id}/packets/{task-id}/{resolved-quality-specialist}.md. Test the implementation. Write your test results as evidence. Run: geas evidence record --mission {mission_id} --task {task-id} --agent {resolved-quality-specialist} --data '<your-json>'")
```
Verify `.geas/missions/{mission_id}/evidence/{task-id}/{resolved-quality-specialist}.json` exists.
Update checkpoint: `Bash("geas state checkpoint set --step testing --agent null")`

After BOTH specialist_review and testing complete:
1. Update TaskContract status: `Bash("geas task transition --mission {mission_id} --id {task-id} --to reviewed")`
2. Write `.geas/missions/{mission_id}/tasks/{task-id}/integration-result.json` (use Write tool — no dedicated CLI command for integration-result).
3. Update TaskContract status: `Bash("geas task transition --mission {mission_id} --id {task-id} --to integrated")`

Do NOT update status to `"reviewed"` until both steps finish. The three operations happen atomically after both agents return.

### Evidence Gate
Run eval_commands from TaskContract. Check acceptance criteria against all evidence.
Log detailed result with tier breakdown.
On gate pass: update TaskContract status to `"verified"`.
If fail -> invoke `/geas:verify-fix-loop`. **Spawn the worker agent to fix.** After fix, re-run gate.

### Closure Packet Assembly [MANDATORY — after gate pass]

orchestration_authority (Orchestrator) assembles the closure packet by reading all task artifacts. This is NOT an agent spawn — Orchestrator reads and writes directly.

**Read required artifacts:**
- TaskContract: `.geas/missions/{mission_id}/tasks/{task-id}.json`
- Worker Self-Check: `.geas/missions/{mission_id}/tasks/{task-id}/worker-self-check.json`
- Gate Result: `.geas/missions/{mission_id}/tasks/{task-id}/gate-result.json`
- Specialist Reviews: `.geas/missions/{mission_id}/evidence/{task-id}/{resolved-design-authority}-review.json`, `.geas/missions/{mission_id}/evidence/{task-id}/{resolved-quality-specialist}.json`
- Integration Result: from worktree merge (commit hash, conflict status)

**If ANY required artifact is missing: go back and execute the missing step. Do NOT proceed.**

**Write** the closure packet via CLI:
```bash
Bash("geas task closure --mission {mission_id} --task {task-id} --data '<closure_packet_json>'")
```
The data must conform to `schemas/closure-packet.schema.json`:

```json
{
  "version": "1.0",
  "artifact_type": "closure_packet",
  "artifact_id": "closure-{task-id}",
  "producer_type": "orchestration_authority",
  "created_at": "<ISO 8601 timestamp>",
  "task_id": "{task-id}",
  "task_summary": "<one-line summary from TaskContract description>",
  "change_summary": "<brief description of what was implemented>",
  "specialist_reviews": [
    {
      "reviewer_type": "design_authority",
      "status": "approved",
      "summary": "<key finding from design-authority review>"
    },
    {
      "reviewer_type": "quality_specialist",
      "status": "approved",
      "summary": "<key finding from quality_specialist review>"
    }
  ],
  "integration_result": {
    "status": "success",
    "merge_commit": "<commit hash from worktree merge>"
  },
  "verification_result": {
    "gate_verdict": "pass",
    "rubric_scores": [
      { "dimension": "core_interaction", "score": 4, "passed": true },
      { "dimension": "feature_completeness", "score": 4, "passed": true },
      { "dimension": "code_quality", "score": 4, "passed": true },
      { "dimension": "regression_safety", "score": 4, "passed": true }
    ]
  },
  "worker_self_check": {
    "confidence": 4,
    "known_risks": ["<from worker-self-check.json known_risks>"],
    "untested_paths": ["<from worker-self-check.json untested_paths>"]
  },
  "open_risks": {
    "status": "none",
    "items": []
  },
  "debt_snapshot": {
    "status": "none",
    "items": []
  },
  "readiness_round": null
}
```

Set `readiness_round: null` initially — may be updated by the challenger step.

**Verify** `.geas/missions/{mission_id}/tasks/{task-id}/closure-packet.json` exists and all required fields are populated before proceeding.

Update checkpoint: `Bash("geas state checkpoint set --step closure_packet --agent orchestrator")`

### Challenger Review [CONDITIONAL — mandatory for normal/high/critical risk]

**Skip condition:** If `risk_level` is `low`, this step is at orchestration_authority's discretion. If skipped: remove `"challenger"` from `remaining_steps`, update run.json checkpoint, and proceed directly to Final Verdict.

**Mandatory condition:** If `risk_level` is `normal`, `high`, or `critical`, this step MUST run.

Resolve the challenger agent. Update checkpoint: `Bash("geas state checkpoint set --step challenger --agent challenger")`
```
Agent(agent: "challenger", prompt: "Read the closure packet at .geas/missions/{mission_id}/tasks/{task-id}/closure-packet.json. Read all evidence at .geas/missions/{mission_id}/evidence/{task-id}/. You MUST raise at least 1 substantive concern — surface a real risk, edge case, or technical debt item. For each concern, state clearly whether it is BLOCKING or non-blocking. Write your challenge review to .geas/missions/{mission_id}/tasks/{task-id}/challenge-review.json (use Write tool — no dedicated CLI command for challenge-review). Required fields: reviewer_type (\"challenger\"), concerns (array of strings, each prefixed with \"[BLOCKING]\" or \"[non-blocking]\"), blocking (boolean — true if ANY concern is blocking).")
```

Verify `.geas/missions/{mission_id}/tasks/{task-id}/challenge-review.json` exists.

**[MANDATORY] Log step_complete immediately after verification:**
```bash
Bash("geas event log --type step_complete --task {task-id} --agent challenger --data '{\"step\":\"challenger\"}'")
```
Do NOT skip this log entry — it is required for conformance verification and session recovery.

**After challenger returns:**

1. Read `.geas/missions/{mission_id}/tasks/{task-id}/challenge-review.json`.
2. Update the closure packet: add a `challenge_review` field populated from the review.
3. **If `blocking` is true:**
   - Add blocking concerns to `open_risks` in the closure packet: set `status: "present"` and append each blocking concern as an item.
   - Invoke `/geas:vote-round` as a readiness_round:
     - Participants: orchestration_authority, product_authority, 1 specialist (most relevant to the blocking concern)
     - Vote options: ship / iterate / escalate
     - Record the outcome in the closure packet `readiness_round` field
   - **If ship:** convert blocking concerns to acknowledged risks (add `acknowledged: true` to each item in `open_risks`). Proceed to Final Verdict.
   - **If iterate:** rewind to resolve the blocking concern. Repopulate `remaining_steps` from the rewind point.
   - **If escalate:** set task status to `"escalated"`. Write a DecisionRecord. Stop pipeline.
4. **If `blocking` is false:** record concerns in the closure packet `challenge_review` field. Proceed to Final Verdict.

Update checkpoint: `Bash("geas state checkpoint set --step challenger --agent null")`

### Final Verdict (product-authority) [MANDATORY]
**Preconditions:**
- `.geas/missions/{mission_id}/tasks/{task-id}/challenge-review.json` must exist OR challenger was explicitly skipped for low risk
- Closure Packet must be assembled (all required fields populated)
- Do NOT spawn product-authority until both preconditions are verified

Update checkpoint: `Bash("geas state checkpoint set --step final_verdict --agent product-authority")`
```
Agent(agent: "product-authority", prompt: "Read the closure packet at .geas/missions/{mission_id}/tasks/{task-id}/closure-packet.json (which includes the challenge_review field if challenger ran) and all evidence at .geas/missions/{mission_id}/evidence/{task-id}/. Decide: pass, iterate, or escalate. Write your verdict via CLI. Run: geas task verdict --mission {mission_id} --task {task-id} --data '<verdict_json>'. Required fields: version (\"1.0\"), artifact_type (\"final_verdict\"), artifact_id (e.g. \"verdict-{task-id}\"), producer_type (\"product_authority\"), created_at (ISO 8601 timestamp), task_id, verdict (\"pass\" | \"iterate\" | \"escalate\"), rationale (why this verdict), closure_packet_ref (path to closure packet). If iterate: include rewind_target (\"ready\" | \"implementing\" | \"reviewed\") and iterate_count. If escalate: include escalation_reason. Also write evidence copy. Run: geas evidence record --mission {mission_id} --task {task-id} --agent product-authority-verdict --data '<verdict_json>'")
```

**Verdict rules:**
- `pass` -> task proceeds to Resolve (status `"passed"`)
- `iterate` -> specify `rewind_target` (ready/implementing/reviewed). Does NOT consume `retry_budget`. After 3 cumulative iterates for the same task -> `escalated`.
- `escalate` -> requires higher-level decision-making. Include `escalation_reason`.

Note: "iterate" is only valid as a Final Verdict outcome. Gate verdicts (evidence-gate) are pass/fail/block/error.

### Pre-Resolve Check (Mechanical Artifact Gate)
**Before marking any task as "passed", verify ALL required artifacts exist.** This is a mechanical gate enforced at the `verified -> passed` transition. The CLI `geas task transition --to passed` command validates these artifacts exist on disk before allowing the transition.

**Required artifacts (verified -> passed):**
- `.geas/missions/{mission_id}/tasks/{task-id}/closure-packet.json` exists (assembled in Closure Packet Assembly)
- `.geas/missions/{mission_id}/tasks/{task-id}/challenge-review.json` exists OR challenger was explicitly skipped (low risk)
- `.geas/missions/{mission_id}/tasks/{task-id}/final-verdict.json` exists with `verdict: "pass"`

**If ANY is missing: go back and execute the missing step. Do NOT proceed without all three.** The CLI will reject the transition with an error listing the missing artifacts.

### Resolve

#### Lock Release

On task completion (Ship, Cut, or Escalate):
```bash
Bash("geas lock release --task {task-id}")
Bash("geas event log --type locks_released --task {task-id}")
```
The CLI removes ALL lock entries where `task_id` matches this task and promotes any waiting locks.

- **Ship**: Transition task to passed and commit:
  ```bash
  Bash("geas task transition --mission {mission_id} --id {task-id} --to passed")
  Bash("geas state checkpoint set --step resolve --agent orchestrator")
  ```
  ```bash
  git add -A && git commit -m "{conventional commit message for task-id}"
  ```
  Log: `Bash("geas event log --type task_resolved --task {task-id} --data '{\"commit\":\"{hash}\"}'")` 
- **Iterate** (Final Verdict only): does NOT deduct retry_budget (iterate is a product judgment, not a gate failure). Track iterate_count — after 3 cumulative iterates, escalate to orchestration_authority. Repopulate remaining_steps with the full pipeline (same skip conditions as original). Include product_authority's feedback in all subsequent ContextPackets. Resume from the rewind_target specified in the final verdict.
- **Cut**: status -> `"cancelled"`. Write DecisionRecord.

### Retrospective [MANDATORY — Ship only, after Resolve]

**Skip condition:** If the Final Verdict was Cut or Escalate, skip retrospective. Only run when the task has been resolved as Ship (status = `"passed"`).

Update checkpoint: `Bash("geas state checkpoint set --step retrospective --agent orchestrator")`

Orchestrator reads all evidence at `.geas/missions/{mission_id}/evidence/{task-id}/` and the closure packet at `.geas/missions/{mission_id}/tasks/{task-id}/closure-packet.json`. Then writes `.geas/missions/{mission_id}/tasks/{task-id}/retrospective.json` (use Write tool — retrospective is an orchestrator-authored artifact with no dedicated CLI command):

```json
{
  "version": "1.0",
  "artifact_type": "retrospective",
  "artifact_id": "retro-{task-id}",
  "producer_type": "orchestration_authority",
  "task_id": "{task-id}",
  "what_went_well": ["things that worked in this task"],
  "what_broke": ["problems encountered during implementation, review, or gate"],
  "what_was_surprising": ["unexpected findings or outcomes"],
  "rule_candidates": ["proposed changes to rules.md — DO NOT modify rules.md directly"],
  "memory_candidates": ["lessons worth remembering for future tasks"],
  "debt_candidates": ["new technical debt discovered during retrospective review"],
  "next_time_guidance": ["specific advice for similar future tasks"],
  "created_at": "<ISO 8601>"
}
```

Verify `.geas/missions/{mission_id}/tasks/{task-id}/retrospective.json` exists.

#### Agent Memory Update

After the retrospective, harvest `memory_suggestions` from the task's artifacts to update per-agent memory files.

Collect `memory_suggestions` from:
- All specialist reviews at `.geas/missions/{mission_id}/evidence/{task-id}/`
- Challenge review at `.geas/missions/{mission_id}/tasks/{task-id}/challenge-review.json` (if exists)
- Worker self-check at `.geas/missions/{mission_id}/tasks/{task-id}/worker-self-check.json`

Agent type mapping:
- For specialist reviews and challenge review: read from the artifact's `producer_type` or `reviewer_type` field
- For worker self-check: use the task's `routing.primary_worker_type`

Items written to agent memory files SHOULD NOT be duplicated in `retrospective.json`'s `memory_candidates[]`.

For each agent type that produced suggestions:
1. Read `.geas/memory/agents/{agent_type}.md` (if exists)
2. Review each suggestion: useful beyond this task? already known? contradicts existing content?
3. Rewrite the file: merge new suggestions, remove contradicted or stale entries (when uncertain, keep existing content)
4. Write the complete updated file

Additionally, update Orchestrator's own memory file (`.geas/memory/agents/orchestration_authority.md`) based on `next_time_guidance[]` from the retrospective.

Agent memory update is performed regardless of mission mode.

### Memory Extraction [MANDATORY after Retrospective, Ship only]

**DO NOT SKIP THIS STEP.** Only skip when task was Cut or Escalate (same as retrospective).

Invoke `/geas:memorizing` with the task ID for per-task candidate extraction:

1. Read `.geas/missions/{mission_id}/tasks/{task-id}/retrospective.json` -> extract `memory_candidates[]`
2. If `memory_candidates` is empty: still invoke `/geas:memorizing` for auto-extraction from evidence files at `.geas/missions/{mission_id}/evidence/{task-id}/`. Do NOT skip.
3. For each candidate: invoke `/geas:memorizing` candidate extraction procedure:
   - Determine memory_type and scope
   - Run deduplication against memory-index
   - Write candidate via CLI: `Bash("geas memory candidate-write --data '<candidate_json>'")`
   - Update index via CLI: `Bash("geas memory index-update --data '<index_entry_json>'")`
4. Run application logging: for memories that were in this task's packet, record effects via CLI:
   `Bash("geas memory log-write --task {task-id} --memory {mem-id} --data '<log_json>'")`
5. Log: `Bash("geas event log --type memory_extraction --task {task-id} --data '{\"candidates\": N}'")`

Update checkpoint: `Bash("geas state checkpoint set --step memory_extraction --agent orchestrator")`
