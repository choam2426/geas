---
name: sprint
description: Add a bounded feature to an existing project with the Geas team — Design, Build, Review, QA.
user-invocable: true
---

# Delivery Mode (Sprint Pattern)

One feature, one pipeline. Skips Discovery.

**Every step in the pipeline is executed. Code Review and Testing are mandatory.**

---

## Pre-conditions

1. `.geas/spec/seed.json` — read-only project context. If it exists (from Initiative or prior Sprint), read it for mission/constraints. If it doesn't exist, intake will create a minimal one. Sprint NEVER modifies seed.json after it exists.
2. `.geas/memory/_project/conventions.md` — if missing, spawn architecture_authority for onboarding:
   ```
   Agent(agent: "architecture-authority", prompt: "Scan this codebase. Write conventions to .geas/memory/_project/conventions.md")
   ```

---

## Sprint Pipeline

### Task File Precondition
The TaskContract MUST be written to `.geas/tasks/{task-id}.json` before the pipeline starts. Do NOT enter the pipeline without a task file on disk. This is required for Closure Packet validation and session recovery.

### 1. Compile TaskContract
Invoke `/geas:task-compiler` for the feature. The TaskContract MUST include a `rubric` object with a `dimensions` array. Base dimensions: core_interaction(3), feature_completeness(4), code_quality(4), regression_safety(4). Add ux_clarity(3), visual_coherence(3) for frontend tasks.

After compilation, write `remaining_steps` to checkpoint:
```json
"remaining_steps": ["design", "tech_guide", "implementation_contract", "implementation", "self_check", "code_review", "testing", "evidence_gate", "closure_packet", "critical_reviewer", "final_verdict", "resolve", "retrospective", "sprint_wrapup"]
```
Remove steps that will be skipped. After completing each step, remove it from the front of the array and update run.json.

**Rubric check**: If the TaskContract is missing `rubric`, insert the default:
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

**[MANDATORY] Event logging**: After each step completes and is removed from `remaining_steps`, log:
```
Append to .geas/ledger/events.jsonl:
{"event": "step_complete", "task_id": "{task-id}", "step": "{step_name}", "agent": "{agent_name}", "timestamp": "<actual>"}
```
Exception: `implementation_contract`, `gate_result`, and `task_resolved` have their own event formats. Do not duplicate those.

- **[MANDATORY] Session state update**: After each step completes and is logged, update the session context anchors:

  Write `.geas/state/session-latest.md`:
  ```markdown
  # Session State — {timestamp}

  **Mode:** sprint
  **Phase:** {current phase: discovery | build | polish | evolution}
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

### Step Groups

Within a single task's pipeline, these steps may run in parallel:
- **[code_review, testing]** — architecture-authority and qa-engineer do not reference each other's output. Spawn both in one message. After both return, remove both from `remaining_steps` and log `step_complete` for each.

All other steps are strictly sequential. In particular:
- **critical_reviewer → final_verdict** — product_authority's prompt requires `challenge-review.json` as input. critical_reviewer MUST complete and file MUST be verified before spawning product_authority.

#### Baseline Check (before implementing)

Before the pipeline enters `"implementing"`, check for staleness:

1. Read `base_commit` from the TaskContract
2. Get current integration branch tip: `git rev-parse HEAD`
3. If `base_commit == tip`: no staleness, proceed
4. If `base_commit != tip`: run revalidation:
   a. Compute changed files: `git diff {base_commit}..{tip} --name-only`
   b. Compare against the task's `scope.paths`
   c. **No overlap** → classification = `clean_sync`. Update `base_commit` to current tip in the TaskContract. Proceed.
   d. **Overlap, auto-resolvable** → classification = `review_sync`. Update `base_commit`, proceed. Flag for specialist re-review after implementation.
   e. **Overlap, not auto-resolvable** → classification = `replan_required`. Do NOT proceed. Rewind task to `"ready"`. Update implementation contract.
   f. **Preconditions invalidated** → classification = `blocking_conflict`. Set task status to `"blocked"`.
   g. Write `.geas/tasks/{task-id}/revalidation-record.json` conforming to `docs/protocol/schemas/revalidation-record.schema.json`
   h. Log event: `{"event": "revalidation", "task_id": "...", "classification": "...", "timestamp": "<actual>"}`

Only proceed to `"implementing"` if classification is `clean_sync` or `review_sync`.

#### Lock Acquisition

Before entering `"implementing"`, acquire locks in order (per doc 04):

1. **`path` locks**: Read `scope.paths` from the TaskContract. For each path, check `.geas/state/locks.json` for existing `path` locks with overlapping targets held by other tasks.
   - If conflict: **cannot proceed** — skip this task and try the next eligible task.
   - If no conflict: add lock entry: `{ "lock_type": "path", "task_id": "{task-id}", "session_id": "{session-id}", "targets": [scope paths], "status": "held", "acquired_at": "<ISO 8601>" }`

2. **`interface` locks**: If the task touches API contracts (scope.paths containing API definition files, or task_kind = "config"), acquire interface locks for the relevant contract names.
   - Same conflict check as path locks.

3. **`resource` locks**: If the task uses shared resources (ports, DB migrations, fixtures — inferred from implementation contract), acquire resource locks.
   - Same conflict check.

Write updated `locks.json` after all acquisitions. If any acquisition fails (conflict), release any locks already acquired for this task and do NOT proceed.

### 2. Design (ui_ux_designer) [DEFAULT — skip-if: no user-facing interface]
**Must run if the task has any user-facing interface (pages, forms, dashboards).**
Generate ContextPacket, then:
Update run.json checkpoint: `pipeline_step` = "design", `agent_in_flight` = "ui-ux-designer"
```
Agent(agent: "ui-ux-designer", prompt: "Read .geas/packets/{task-id}/ui-ux-designer.md. Write design to .geas/evidence/{task-id}/ui-ux-designer.json")
```
Verify evidence exists.

### 3. Tech Guide (architecture_authority) [DEFAULT — skip when ALL: existing pattern, no new libs, single module, no schema change]
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

Generate ContextPacket, then:
Update run.json checkpoint: `pipeline_step` = "tech_guide", `agent_in_flight` = "architecture-authority"
```
Agent(agent: "architecture-authority", prompt: "Read .geas/packets/{task-id}/architecture-authority.md. Write tech guide to .geas/evidence/{task-id}/architecture-authority.json")
```
Verify evidence exists.

### 4. Implementation Contract [MANDATORY]
Invoke `/geas:implementation-contract` — worker writes action plan, qa_engineer and architecture_authority approve before coding.
Update run.json checkpoint: `pipeline_step` = "implementation_contract", `agent_in_flight` = "{worker}"
Verify `.geas/contracts/{task-id}.json` exists with `status: "approved"`.

### 5. Implementation [MANDATORY — worktree isolated]
Generate ContextPacket, then:
Update run.json checkpoint: `pipeline_step` = "implementation", `agent_in_flight` = "{worker}"
```
Agent(agent: "{worker}", isolation: "worktree", prompt: "Read .geas/packets/{task-id}/{worker}.md. Implement. Write evidence to .geas/evidence/{task-id}/{worker}.json")
```
Verify evidence.

#### Pre-Integration Staleness Check

Before merging the worktree:

1. Re-check: compare `base_commit` with current `tip(integration_branch)` using `git diff {base_commit}..HEAD --name-only`
2. Compare against `scope.paths`
3. Classify:
   - `clean_sync` → fast-forward merge or trivial rebase, proceed
   - `review_sync` → merge, then specialist re-review required for changed areas
   - `replan_required` → rewind task to `"ready"`, update implementation contract
   - `blocking_conflict` → task → `"blocked"`
4. If revalidation was needed, write an updated `.geas/tasks/{task-id}/revalidation-record.json`

#### Integration Lock

Before merging the worktree to the integration branch:

1. Read `.geas/state/locks.json`
2. Check if any other task holds an `integration` lock:
   - If yes: **wait**. Add a lock entry with `"status": "waiting"` and `wait_start` timestamp. Do NOT merge until the lock is released.
   - If no: acquire the lock: `{ "lock_type": "integration", "task_id": "{task-id}", "session_id": "{session-id}", "targets": ["integration_branch"], "status": "held", "acquired_at": "<ISO 8601>" }`
3. Merge the worktree branch
4. **Release the integration lock immediately** after merge (remove the entry from locks.json)

This ensures integration is single-flight — only one task merges at a time.

After successful merge, update TaskContract status to `"integrated"`.

### 5.5 Worker Self-Check [MANDATORY]
Update run.json checkpoint: `pipeline_step` = "self_check", `agent_in_flight` = "{worker}"
```
Agent(agent: "{worker}", prompt: "Implementation for {task-id} is complete. Before handing off to code review, produce your self-check artifact. Write .geas/tasks/{task-id}/worker-self-check.json conforming to docs/protocol/schemas/worker-self-check.schema.json. Required fields: version (\"1.0\"), artifact_type (\"worker_self_check\"), artifact_id (e.g. \"self-check-{task-id}\"), producer_type (your agent type: frontend_engineer | backend_engineer | devops_engineer | technical_writer), task_id, known_risks (string[]), untested_paths (string[]), possible_stubs (string[]), what_to_test_next (string[]), confidence (integer 1-5: 1=very_low … 5=very_high), summary (string), created_at (ISO 8601 timestamp).")
```
Verify `.geas/tasks/{task-id}/worker-self-check.json` exists. Do NOT proceed to Code Review without this file.

### 6. Code Review (architecture_authority) [MANDATORY]
Generate ContextPacket, then:
Update run.json checkpoint: `pipeline_step` = "code_review", `agent_in_flight` = "architecture-authority"
```
Agent(agent: "architecture-authority", prompt: "Read .geas/packets/{task-id}/architecture-authority-review.md. Review code. Write to .geas/evidence/{task-id}/architecture-authority-review.json")
```
Verify evidence.
Update TaskContract status to `"reviewed"`.
Update run.json checkpoint: `pipeline_step` = "code_review"

### 7. Testing (qa_engineer) [MANDATORY]
Generate ContextPacket, then:
Update run.json checkpoint: `pipeline_step` = "testing", `agent_in_flight` = "qa-engineer"
```
Agent(agent: "qa-engineer", prompt: "Read .geas/packets/{task-id}/qa-engineer.md. Test feature. Write to .geas/evidence/{task-id}/qa-engineer.json")
```
Verify evidence.
Update run.json checkpoint: `pipeline_step` = "testing"

### 8. Evidence Gate
Run eval_commands. Check acceptance criteria. Log detailed result.
On gate pass: update TaskContract status to `"verified"`.
If fail → invoke `/geas:verify-fix-loop`. **Spawn the worker agent to fix.** After fix, re-run gate.

### 8.25 Closure Packet Assembly [MANDATORY — after gate pass]

orchestration_authority (Orchestrator) assembles the closure packet by reading all task artifacts. This is NOT an agent spawn — Orchestrator reads and writes directly.

**Read required artifacts:**
- TaskContract: `.geas/tasks/{task-id}.json`
- Worker Self-Check: `.geas/tasks/{task-id}/worker-self-check.json`
- Gate Result: `.geas/tasks/{task-id}/gate-result.json`
- Specialist Reviews: `.geas/evidence/{task-id}/architecture-authority-review.json`, `.geas/evidence/{task-id}/qa-engineer.json`
- Integration Result: from worktree merge (commit hash, conflict status)

**If ANY required artifact is missing: go back and execute the missing step. Do NOT proceed.**

**Write** `.geas/tasks/{task-id}/closure-packet.json` conforming to `docs/protocol/schemas/closure-packet.schema.json`:

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
      "reviewer_type": "architecture_authority",
      "status": "approved",
      "summary": "<key finding from architecture-authority-review.json>"
    },
    {
      "reviewer_type": "qa_engineer",
      "status": "approved",
      "summary": "<key finding from qa-engineer.json>"
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

Set `readiness_round: null` initially — may be updated by the critical reviewer step.

**Verify** `.geas/tasks/{task-id}/closure-packet.json` exists and all required fields are populated before proceeding.

Update run.json checkpoint: `pipeline_step` = "closure_packet"

### 8.5 Critical Reviewer Challenge [CONDITIONAL — mandatory for high/critical risk]

**Skip condition:** If `risk_level` is `low` or `normal`, this step is at orchestration_authority's discretion. If skipped: remove `"critical_reviewer"` from `remaining_steps`, update run.json checkpoint, and proceed directly to Final Verdict.

**Mandatory condition:** If `risk_level` is `high` or `critical`, this step MUST run.

Update run.json checkpoint: `pipeline_step` = "critical_reviewer", `agent_in_flight` = "critical-reviewer"
```
Agent(agent: "critical-reviewer", prompt: "Read the closure packet at .geas/tasks/{task-id}/closure-packet.json. Read all evidence at .geas/evidence/{task-id}/. You MUST raise at least 1 substantive concern — surface a real risk, edge case, or technical debt item. For each concern, state clearly whether it is BLOCKING or non-blocking. Write .geas/tasks/{task-id}/challenge-review.json with the following fields: reviewer_type (\"critical_reviewer\"), concerns (array of strings, each prefixed with \"[BLOCKING]\" or \"[non-blocking]\"), blocking (boolean — true if ANY concern is blocking).")
```

Verify `.geas/tasks/{task-id}/challenge-review.json` exists.

**After critical_reviewer returns:**

1. Read `.geas/tasks/{task-id}/challenge-review.json`.
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

Update run.json checkpoint: `pipeline_step` = "critical_reviewer"

### 9. Final Verdict (product_authority) [MANDATORY — after critical_reviewer only]
**Preconditions:**
- `.geas/tasks/{task-id}/challenge-review.json` must exist OR `critical_reviewer` was explicitly skipped for low/normal risk
- Closure Packet must be assembled (all required fields populated)
- Do NOT spawn product_authority until both preconditions are verified

Update run.json checkpoint: `pipeline_step` = "final_verdict", `agent_in_flight` = "product-authority"
```
Agent(agent: "product-authority", prompt: "Read the closure packet at .geas/tasks/{task-id}/closure-packet.json (which includes the challenge_review field if critical_reviewer ran) and all evidence at .geas/evidence/{task-id}/. Decide: pass, iterate, or escalate. Write .geas/tasks/{task-id}/final-verdict.json conforming to docs/protocol/schemas/final-verdict.schema.json. Required fields: version (\"1.0\"), artifact_type (\"final_verdict\"), artifact_id (e.g. \"verdict-{task-id}\"), producer_type (\"product_authority\"), created_at (ISO 8601 timestamp), task_id, verdict (\"pass\" | \"iterate\" | \"escalate\"), rationale (why this verdict), closure_packet_ref (path to closure packet). If iterate: include rewind_target (\"ready\" | \"implementing\" | \"reviewed\") and iterate_count. If escalate: include escalation_reason. Also write to .geas/evidence/{task-id}/product-authority-verdict.json for backward compatibility.")
```

**Verdict rules:**
- `pass` -> task proceeds to Resolve (status `"passed"`)
- `iterate` -> specify `rewind_target` (ready/implementing/reviewed). Does NOT consume `retry_budget`. After 3 cumulative iterates for the same task -> `escalated`.
- `escalate` -> requires higher-level decision-making. Include `escalation_reason`.

Note: "iterate" is only valid as a Final Verdict outcome. Gate verdicts (evidence-gate) are pass/fail/block/error.

### Pre-Resolve Check
**Before marking "passed", verify:**
- `.geas/tasks/{task-id}/closure-packet.json` exists (assembled in Step 8.25)
- `.geas/tasks/{task-id}/challenge-review.json` exists OR critical_reviewer was explicitly skipped (low/normal risk)
- `.geas/tasks/{task-id}/final-verdict.json` exists with `verdict: "pass"`
**If ANY missing: execute the missing step. Do NOT proceed without all three.**

### 10. Resolve

#### Lock Release

On task completion (Ship, Cut, or Escalate):
1. Read `.geas/state/locks.json`
2. Remove ALL lock entries where `task_id` matches this task (path, interface, resource locks)
3. Write updated `locks.json`
4. Log: `{"event": "locks_released", "task_id": "...", "timestamp": "<actual>"}`

- Ship → Read `.geas/tasks/{task-id}.json`, set `"status": "passed"`, Write it back. Then spawn repository_manager for commit:
  Update run.json checkpoint: `pipeline_step` = "resolve", `agent_in_flight` = "repository-manager"
  ```
  Agent(agent: "repository-manager", prompt: "Commit all changes for {task-id} with conventional commit format. Write to .geas/evidence/{task-id}/repository-manager.json")
  ```
- Iterate (Final Verdict only) → does NOT deduct retry_budget (iterate is a product judgment, not a gate failure). Track iterate_count — after 3 cumulative iterates, escalate to orchestration_authority. Repopulate remaining_steps with full pipeline (same skip conditions). Include product_authority's feedback in all ContextPackets. Resume from the rewind_target specified in the final verdict.
- Cut → `"cancelled"`, write DecisionRecord

### Retrospective (process_lead) [MANDATORY — Ship only, after Resolve]

**Skip condition:** If the Final Verdict was Cut or Escalate, skip retrospective. Only run when the task has been resolved as Ship (status = `"passed"`).

Update run.json checkpoint: `pipeline_step` = "retrospective", `agent_in_flight` = "process-lead"
```
Agent(agent: "process-lead", prompt: "Read all evidence at .geas/evidence/{task-id}/ and the closure packet at .geas/tasks/{task-id}/closure-packet.json. Write a structured retrospective to .geas/tasks/{task-id}/retrospective.json conforming to docs/protocol/schemas/retrospective.schema.json. Required fields:
- version: '1.0'
- artifact_type: 'retrospective'
- artifact_id: 'retro-{task-id}'
- producer_type: 'process_lead'
- task_id: '{task-id}'
- what_went_well: things that worked in this task
- what_broke: problems encountered during implementation, review, or gate
- what_was_surprising: unexpected findings or outcomes
- rule_candidates: proposed changes to rules.md (DO NOT modify rules.md directly — list proposals here)
- memory_candidates: lessons worth remembering for future tasks
- debt_candidates: new technical debt discovered during retrospective review
- next_time_guidance: specific advice for similar future tasks
- created_at: ISO 8601 timestamp")
```

Verify `.geas/tasks/{task-id}/retrospective.json` exists.

### 11. Sprint Wrap-Up [after Retrospective, before Run Summary]

Lightweight post-resolve section for rules and debt processing.

#### 11.1 Rules Update

1. Read `.geas/tasks/{task-id}/retrospective.json` → extract `rule_candidates[]`
2. If no candidates: write `.geas/state/rules-update.json` with `status: "none"`, `reason: "no rule candidates"`, `evidence_refs: []`, `applies_to: []`. Skip to 11.2.
3. If candidates exist:
   - Check approval conditions: do the candidates have evidence_refs >= 2 (same pattern in 2+ prior sessions) AND contradiction_count = 0?
   - If conditions met: auto-approve. Apply changes to `.geas/rules.md`. Write `.geas/state/rules-update.json` conforming to `docs/protocol/schemas/rules-update.schema.json` with `status: "approved"`, `affected_rule_ids`, `reason`, `evidence_refs`, `applies_to`.
   - If conditions not met: write `.geas/state/rules-update.json` with `status: "proposed"`. Note for future review.
4. Log: `{"event": "rules_update", "status": "approved|proposed|none", "timestamp": "<actual>"}`

#### 11.2 Debt Register Update

1. Read `.geas/tasks/{task-id}/retrospective.json` → extract `debt_candidates[]`
2. If no candidates: skip.
3. For each candidate: add as structured item to `.geas/state/debt-register.json` with `debt_id` (sequential), `severity`, `kind`, `title`, `description`, `introduced_by_task_id: "{task-id}"`, `owner_type`, `status: "open"`, `target_phase: "future"`.
4. Update `rollup_by_severity` and `rollup_by_kind` counts.
5. Write back debt-register.json.

#### 11.3 Sprint Result

Brief confirmation: what was requested (from seed.json or task goal) vs what was delivered. This is NOT a full gap assessment — just a one-line confirmation for the session record.

#### 11.4 Memory Extraction and Promotion

1. Read `.geas/tasks/{task-id}/retrospective.json` → extract `memory_candidates[]`
2. If empty: skip.
3. For each candidate: invoke `/geas:memorizing` candidate extraction:
   - Determine memory_type and scope
   - Run deduplication against memory-index
   - Write candidate to `.geas/memory/candidates/{memory-id}.json`
4. **Inline promotion check**: If candidate has evidence_refs >= 2 (from deduplication merge) or comes from a repeated pattern (auto-extraction trigger): auto-promote to provisional.
   - Move from `candidates/` to `entries/`
   - Update memory-index.json
   - Otherwise: leave as candidate for future sessions
5. Run application logging: for memories in this task's packet, record effects.
6. Update `.geas/state/memory-index.json`

### 12. Run Summary
Invoke `/geas:run-summary` to generate session audit trail.
