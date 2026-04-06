# Per-Task Pipeline

The universal pipeline for every task, regardless of mission scope.

## Universal Requirements

EVERY task, regardless of dependencies or position in the batch, MUST execute ALL pipeline steps. No step may be skipped because "a prior task already did it" or "this is a dependent task."

## remaining_steps

```json
"remaining_steps": ["design", "tech_guide", "implementation_contract", "implementation", "self_check", "code_review", "testing", "evidence_gate", "closure_packet", "challenger", "final_verdict", "resolve", "retrospective", "memory_extraction"]
```

Remove steps that will be skipped (e.g., remove "design" if no UI). After completing each step, remove it from the front of the array and update run.json.

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
   g. Write `.geas/missions/{mission_id}/tasks/{task-id}/revalidation-record.json` conforming to `schemas/revalidation-record.schema.json`
   h. Log event: `{"event": "revalidation", "task_id": "...", "classification": "...", "timestamp": "<actual>"}`

Only proceed to `"implementing"` if classification is `clean_sync` or `review_sync`.

### Lock Acquisition

Before entering `"implementing"`, acquire locks in order (per doc 04):

1. **`path` locks**: Read `scope.paths` from the TaskContract. For each path, check `.geas/state/locks.json` for existing `path` locks with overlapping targets held by other tasks.
   - If conflict: **cannot proceed** — skip this task and try the next eligible task.
   - If no conflict: add lock entry: `{ "lock_type": "path", "task_id": "{task-id}", "session_id": "{session-id}", "targets": [scope paths], "status": "held", "acquired_at": "<ISO 8601>" }`

2. **`interface` locks**: If the task touches API contracts (scope.paths containing API definition files, or task_kind = "config"), acquire interface locks for the relevant contract names.
   - Same conflict check as path locks.

3. **`resource` locks**: If the task uses shared resources (ports, DB migrations, fixtures — inferred from implementation contract), acquire resource locks.
   - Same conflict check.

Write updated `locks.json` after all acquisitions. If any acquisition fails (conflict), release any locks already acquired for this task and do NOT proceed.

## Step Groups

Within a single task's pipeline, these steps may run in parallel:
- **[code_review, testing]** — design-authority and quality_specialist do not reference each other's output. Spawn both in one message. After both return, remove both from `remaining_steps` and log `step_complete` for each.

All other steps are strictly sequential. In particular:
- **challenger -> final_verdict** — product_authority's prompt requires `challenge-review.json` as input. challenger MUST complete and file MUST be verified before spawning product_authority.

## [MANDATORY] Event Logging

After each step completes and is removed from `remaining_steps`, log:
```
Append to .geas/ledger/events.jsonl:
{"event": "step_complete", "task_id": "{task-id}", "step": "{step_name}", "agent": "{agent_name}", "timestamp": "<actual>"}
```
Exception: `implementation_contract`, `gate_result`, and `task_resolved` have their own event formats. Do not duplicate those.

## [MANDATORY] Session State Update

After each step completes and is logged, update the session context anchors:

Write `.geas/state/session-latest.md`:
```markdown
# Session State — {timestamp}

**Phase:** {current phase: specifying | building | polishing | evolving}
**Focus Task:** {task-id} — {title}
**Task State:** {current state from task contract}
**Last Step:** {step just completed}
**Next Step:** {first item in remaining_steps, or "phase transition"}

## Recent Events
- {last 3 events from .geas/ledger/events.jsonl}

## Open Risks
- {from closure packet open_risks, or "none yet"}

## Active Memory
- {count} active memory entries, {count} under review
```

Write `.geas/state/task-focus/{task-id}.md`:
```markdown
# {task-id}: {title}

**State:** {current state}
**Goal:** {from task contract}
**Pipeline Progress:** {completed steps count} / {total steps count}
**Last Step:** {step name} — {outcome}
**Remaining:** {remaining_steps as comma-separated list}
**Key Risks:** {from worker self-check known_risks or open_risks, or "none"}
```

## Pipeline Steps

### Design (implementer — design-capable) [DEFAULT — skip-if: no user-facing interface]
**Must run if the task has any user-facing interface (pages, forms, dashboards).**
Resolve the implementer slot via profiles.json. If the profile provides a design-capable implementer, spawn it. Otherwise, the primary implementer handles design.
Generate ContextPacket, then:
Update run.json checkpoint: `pipeline_step` = "design", `agent_in_flight` = "{resolved-implementer}"
```
Agent(agent: "{resolved-implementer}", prompt: "Read .geas/missions/{mission_id}/packets/{task-id}/{resolved-implementer}.md. Write design spec to .geas/missions/{mission_id}/evidence/{task-id}/{resolved-implementer}-design.json")
```
Verify `.geas/missions/{mission_id}/evidence/{task-id}/{resolved-implementer}-design.json` exists.

### Tech Guide (design-authority) [DEFAULT — skip when ALL: existing pattern, no new libs, single module, no schema change]
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
Update run.json checkpoint: `pipeline_step` = "tech_guide", `agent_in_flight` = "{resolved-design-authority}"
```
Agent(agent: "{resolved-design-authority}", prompt: "Read .geas/missions/{mission_id}/packets/{task-id}/{resolved-design-authority}.md. Write tech guide to .geas/missions/{mission_id}/evidence/{task-id}/{resolved-design-authority}.json")
```
Verify `.geas/missions/{mission_id}/evidence/{task-id}/{resolved-design-authority}.json` exists.

### Implementation Contract [MANDATORY]
Invoke `/geas:implementation-contract` — worker writes action plan, quality_specialist and design_authority approve before implementation.
Update run.json checkpoint: `pipeline_step` = "implementation_contract", `agent_in_flight` = "{worker}"
Verify `.geas/missions/{mission_id}/contracts/{task-id}.json` exists with `status: "approved"`.

### Implementation [MANDATORY — worktree isolated]
Generate ContextPacket, then:
Update run.json checkpoint: `pipeline_step` = "implementation", `agent_in_flight` = "{worker}"
```
Agent(agent: "{worker}", isolation: "worktree", prompt: "Read .geas/missions/{mission_id}/packets/{task-id}/{worker}.md. Implement the feature. Write evidence to .geas/missions/{mission_id}/evidence/{task-id}/{worker}.json")
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
4. If revalidation was needed, write an updated `.geas/missions/{mission_id}/tasks/{task-id}/revalidation-record.json`

#### Integration Lock

Before merging the worktree to the integration branch:

1. Read `.geas/state/locks.json`
2. Check if any other task holds an `integration` lock:
   - If yes: **wait**. Add a lock entry with `"status": "waiting"` and `wait_start` timestamp. Do NOT merge until the lock is released.
   - If no: acquire the lock: `{ "lock_type": "integration", "task_id": "{task-id}", "session_id": "{session-id}", "targets": ["integration_branch"], "status": "held", "acquired_at": "<ISO 8601>" }`
3. Merge the worktree branch
4. **Release the integration lock immediately** after merge (remove the entry from locks.json)

This ensures integration is single-flight — only one task merges at a time.

After successful merge, status remains `"implementing"` — the task is not yet reviewed or complete.

### Worker Self-Check [MANDATORY]
Update run.json checkpoint: `pipeline_step` = "self_check", `agent_in_flight` = "{worker}"
```
Agent(agent: "{worker}", prompt: "Implementation for {task-id} is complete. Before handing off to review, produce your self-check artifact. Write .geas/missions/{mission_id}/tasks/{task-id}/worker-self-check.json. Required fields: version (\"1.0\"), artifact_type (\"worker_self_check\"), artifact_id (e.g. \"self-check-{task-id}\"), producer_type (your agent type from the domain profile), task_id, known_risks (string[]), untested_paths (string[]), possible_stubs (string[]), what_to_test_next (string[]), confidence (integer 1-5: 1=very_low ... 5=very_high), summary (string), created_at (ISO 8601 timestamp).")
```
Verify `.geas/missions/{mission_id}/tasks/{task-id}/worker-self-check.json` exists. Do NOT proceed to Code Review without this file.

### Code Review (design-authority) [MANDATORY]
Resolve the design-authority slot via profiles.json. Generate ContextPacket, then:
Update run.json checkpoint: `pipeline_step` = "code_review", `agent_in_flight` = "{resolved-design-authority}"
```
Agent(agent: "{resolved-design-authority}", prompt: "Read .geas/missions/{mission_id}/packets/{task-id}/{resolved-design-authority}-review.md. Review implementation. Write to .geas/missions/{mission_id}/evidence/{task-id}/{resolved-design-authority}-review.json")
```
Verify `.geas/missions/{mission_id}/evidence/{task-id}/{resolved-design-authority}-review.json` exists.
Update run.json checkpoint: `pipeline_step` = "code_review"

### Testing (quality_specialist) [MANDATORY]
Resolve the quality_specialist slot via profiles.json. Generate ContextPacket, then:
Update run.json checkpoint: `pipeline_step` = "testing", `agent_in_flight` = "{resolved-quality-specialist}"
```
Agent(agent: "{resolved-quality-specialist}", prompt: "Read .geas/missions/{mission_id}/packets/{task-id}/{resolved-quality-specialist}.md. Test the implementation. Write results to .geas/missions/{mission_id}/evidence/{task-id}/{resolved-quality-specialist}.json")
```
Verify `.geas/missions/{mission_id}/evidence/{task-id}/{resolved-quality-specialist}.json` exists.
Update run.json checkpoint: `pipeline_step` = "testing"

After BOTH code_review and testing complete:
1. Update TaskContract status to `"reviewed"` (specialist reviews done).
2. Write `.geas/missions/{mission_id}/tasks/{task-id}/integration-result.json` with: `merge_commit` (hash from worktree merge), `conflict_status` ("clean" | "resolved" | "failed"), `base_commit`, `timestamp`. This artifact records the integration outcome.
3. Update TaskContract status to `"integrated"` (worktree merge + reviews confirmed integration is sound).

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

**Write** `.geas/missions/{mission_id}/tasks/{task-id}/closure-packet.json` conforming to `schemas/closure-packet.schema.json`:

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

Update run.json checkpoint: `pipeline_step` = "closure_packet"

### Challenger Review [CONDITIONAL — mandatory for normal/high/critical risk]

**Skip condition:** If `risk_level` is `low`, this step is at orchestration_authority's discretion. If skipped: remove `"challenger"` from `remaining_steps`, update run.json checkpoint, and proceed directly to Final Verdict.

**Mandatory condition:** If `risk_level` is `normal`, `high`, or `critical`, this step MUST run.

Resolve the challenger agent. Update run.json checkpoint: `pipeline_step` = "challenger", `agent_in_flight` = "challenger"
```
Agent(agent: "challenger", prompt: "Read the closure packet at .geas/missions/{mission_id}/tasks/{task-id}/closure-packet.json. Read all evidence at .geas/missions/{mission_id}/evidence/{task-id}/. You MUST raise at least 1 substantive concern — surface a real risk, edge case, or technical debt item. For each concern, state clearly whether it is BLOCKING or non-blocking. Write .geas/missions/{mission_id}/tasks/{task-id}/challenge-review.json with the following fields: reviewer_type (\"challenger\"), concerns (array of strings, each prefixed with \"[BLOCKING]\" or \"[non-blocking]\"), blocking (boolean — true if ANY concern is blocking).")
```

Verify `.geas/missions/{mission_id}/tasks/{task-id}/challenge-review.json` exists.

**[MANDATORY] Log step_complete immediately after verification:**
```
Append to .geas/ledger/events.jsonl:
{"event": "step_complete", "task_id": "{task-id}", "step": "challenger", "agent": "challenger", "timestamp": "<actual>"}
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

Update run.json checkpoint: `pipeline_step` = "challenger"

### Final Verdict (product-authority) [MANDATORY]
**Preconditions:**
- `.geas/missions/{mission_id}/tasks/{task-id}/challenge-review.json` must exist OR challenger was explicitly skipped for low risk
- Closure Packet must be assembled (all required fields populated)
- Do NOT spawn product-authority until both preconditions are verified

Update run.json checkpoint: `pipeline_step` = "final_verdict", `agent_in_flight` = "product-authority"
```
Agent(agent: "product-authority", prompt: "Read the closure packet at .geas/missions/{mission_id}/tasks/{task-id}/closure-packet.json (which includes the challenge_review field if challenger ran) and all evidence at .geas/missions/{mission_id}/evidence/{task-id}/. Decide: pass, iterate, or escalate. Write .geas/missions/{mission_id}/tasks/{task-id}/final-verdict.json. Required fields: version (\"1.0\"), artifact_type (\"final_verdict\"), artifact_id (e.g. \"verdict-{task-id}\"), producer_type (\"product_authority\"), created_at (ISO 8601 timestamp), task_id, verdict (\"pass\" | \"iterate\" | \"escalate\"), rationale (why this verdict), closure_packet_ref (path to closure packet). If iterate: include rewind_target (\"ready\" | \"implementing\" | \"reviewed\") and iterate_count. If escalate: include escalation_reason. Also write to .geas/missions/{mission_id}/evidence/{task-id}/product-authority-verdict.json for backward compatibility.")
```

**Verdict rules:**
- `pass` -> task proceeds to Resolve (status `"passed"`)
- `iterate` -> specify `rewind_target` (ready/implementing/reviewed). Does NOT consume `retry_budget`. After 3 cumulative iterates for the same task -> `escalated`.
- `escalate` -> requires higher-level decision-making. Include `escalation_reason`.

Note: "iterate" is only valid as a Final Verdict outcome. Gate verdicts (evidence-gate) are pass/fail/block/error.

### Pre-Resolve Check
**Before marking any task as "passed", verify:**
- `.geas/missions/{mission_id}/tasks/{task-id}/closure-packet.json` exists (assembled in Closure Packet Assembly)
- `.geas/missions/{mission_id}/tasks/{task-id}/challenge-review.json` exists OR challenger was explicitly skipped (low risk)
- `.geas/missions/{mission_id}/tasks/{task-id}/final-verdict.json` exists with `verdict: "pass"`
**If ANY is missing: go back and execute the missing step. Do NOT proceed without all three.**

### Resolve

#### Lock Release

On task completion (Ship, Cut, or Escalate):
1. Read `.geas/state/locks.json`
2. Remove ALL lock entries where `task_id` matches this task (path, interface, resource locks)
3. Write updated `locks.json`
4. Log: `{"event": "locks_released", "task_id": "...", "timestamp": "<actual>"}`

- **Ship**: Read `.geas/missions/{mission_id}/tasks/{task-id}.json`, set `"status": "passed"`, Write it back. Then commit directly:
  Update run.json checkpoint: `pipeline_step` = "resolve"
  ```bash
  git add -A && git commit -m "{conventional commit message for task-id}"
  ```
  Log: `{"event": "task_resolved", "task_id": "{task-id}", "commit": "{hash from git rev-parse HEAD}", "timestamp": "<actual>"}`
- **Iterate** (Final Verdict only): does NOT deduct retry_budget (iterate is a product judgment, not a gate failure). Track iterate_count — after 3 cumulative iterates, escalate to orchestration_authority. Repopulate remaining_steps with the full pipeline (same skip conditions as original). Include product_authority's feedback in all subsequent ContextPackets. Resume from the rewind_target specified in the final verdict.
- **Cut**: status -> `"cancelled"`. Write DecisionRecord.

### Retrospective [MANDATORY — Ship only, after Resolve]

**Skip condition:** If the Final Verdict was Cut or Escalate, skip retrospective. Only run when the task has been resolved as Ship (status = `"passed"`).

Update run.json checkpoint: `pipeline_step` = "retrospective"

Orchestrator reads all evidence at `.geas/missions/{mission_id}/evidence/{task-id}/` and the closure packet at `.geas/missions/{mission_id}/tasks/{task-id}/closure-packet.json`. Then writes `.geas/missions/{mission_id}/tasks/{task-id}/retrospective.json`:

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
   - Write candidate to `.geas/memory/candidates/{memory-id}.json`
   - Update `.geas/state/memory-index.json`
4. Run application logging: for memories that were in this task's packet, record effects based on task outcome.
5. Log: `{"event": "memory_extraction", "task_id": "...", "candidates": N, "timestamp": "<actual>"}`

Update run.json checkpoint: `pipeline_step` = "memory_extraction"
