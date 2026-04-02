---
name: initiative
description: Start a new product with the Geas team — Discovery, Build, Polish, Evolution.
user-invocable: true
---

# Initiative Mission

4 phases: Discovery → Build → Polish → Evolution.

---

## Phase 1: Discovery

### 1.1 Seed Check
- `.geas/spec/seed.json` should exist from intake. If not, invoke `/geas:intake`.
- If completeness_checklist has any false values and no override: ask the user, re-run intake.

### 1.2 Vision (product_authority)
```
Agent(agent: "product-authority", prompt: "Then read .geas/spec/seed.json. Deliver vision, MVP scope, user value proposition. Write to .geas/evidence/discovery/product-authority.json")
```
Verify `.geas/evidence/discovery/product-authority.json` exists.

### 1.3 PRD & User Stories (product_authority)
```
Agent(agent: "product-authority", prompt: "Read .geas/spec/seed.json and .geas/evidence/discovery/product-authority.json. Create a PRD using write-prd skill, save to .geas/spec/prd.md. Then break it into user stories using write-stories skill, save to .geas/spec/stories.md.")
```
Verify both `.geas/spec/prd.md` and `.geas/spec/stories.md` exist.

### 1.4 Architecture (architecture_authority)
```
Agent(agent: "architecture-authority", prompt: "Then read .geas/spec/seed.json, .geas/evidence/discovery/product-authority.json, and .geas/spec/prd.md. Propose architecture and tech stack. Write conventions to .geas/memory/_project/conventions.md and evidence to .geas/evidence/discovery/architecture-authority.json")
```
Verify evidence exists. Write DecisionRecord to `.geas/decisions/dec-001.json`.

### 1.5 Vote Round
Invoke `/geas:vote-round` with:
- Proposal: `.geas/evidence/discovery/architecture-authority.json`
- Voters: backend-engineer, ui-ux-designer, critical-reviewer
- Output: `.geas/evidence/discovery/vote-{agent}.json`

If all agree: proceed. If any disagree: `/geas:decision` runs, then re-vote.
Verify all vote files exist before continuing.

### 1.6 Compile TaskContracts
- Use `.geas/spec/stories.md` as input. For each user story, invoke `/geas:task-compiler`.
- Each TaskContract MUST include a `rubric` object with a `dimensions` array. Base dimensions: core_interaction(3), feature_completeness(4), code_quality(4), regression_safety(4). Add ux_clarity(3), visual_coherence(3) for frontend tasks.
- Log each: `{"event": "task_compiled", "task_id": "...", "timestamp": "<actual>"}`

### 1.7 MCP Server Recommendations

Analyze the tech stack from architecture_authority's architecture decision and recommend helpful MCP servers to the user. Match by category, not by specific tool name:

| Stack category | MCP category | Reason |
|---------------|--------------|--------|
| Relational database | Database query MCP | Workers can inspect schemas and run read-only queries |
| Document database | Database query MCP | Workers can explore collections |
| Web frontend | Web standards MCP | Workers can reference specification docs |
| Has deploy target | Performance audit MCP | qa_engineer can audit performance and accessibility |
| Git-hosted | Git platform MCP | repository_manager can manage PRs and issues |

Present recommendations with install commands from the MCP registry.

### 1.8 Close Discovery

**Phase review** — verify gate criteria for discovery → build:
- Mission brief exists (seed.json)
- scope_in defined
- Initial tasks compiled

Write `.geas/state/phase-review.json` conforming to `docs/protocol/schemas/phase-review.schema.json`:
```json
{
  "version": "1.0",
  "artifact_type": "phase_review",
  "artifact_id": "pr-discovery",
  "producer_type": "orchestration_authority",
  "mission_phase": "discovery",
  "status": "ready_to_exit",
  "summary": "<discovery outcomes>",
  "gate_criteria_met": ["mission brief exists", "scope_in defined", "tasks compiled"],
  "gate_criteria_unmet": [],
  "risk_notes": [],
  "next_phase": "build",
  "created_at": "<ISO 8601>"
}
```

If any gate criteria unmet: set `status: "blocked"`, list unmet criteria in `gate_criteria_unmet`. Do not proceed until resolved. After 3 consecutive transition failures → enter decision mode.

- Update run state: `{ "phase": "build", "status": "in_progress" }`
- Log: `{"event": "phase_complete", "phase": "discovery", "timestamp": "<actual>"}`

---

## Phase 2: Build

**Every task runs the full pipeline. Code Review and Testing are mandatory for every task.**

### Parallel Execution

Before starting the first task, and after each task or batch resolves:
- Scan `.geas/tasks/` for eligible tasks (status `"ready"`, all `depends_on` are `"passed"`).
- If 2+ eligible: apply `/geas:scheduling` protocol.
- If 0-1 eligible: run the single task through the sequential pipeline below.

For **each** TaskContract in `.geas/tasks/` (ordered by dependencies):

### 2.0 Start Task
- Read TaskContract. Check dependencies are `"passed"`.

#### Baseline Check (before implementing)

Before transitioning to `"implementing"`, check for staleness:

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

- Update status to `"implementing"`. Log `task_started` event.
- **Write `remaining_steps` to checkpoint** — the full pipeline for this task:
  ```json
  "remaining_steps": ["design", "tech_guide", "implementation_contract", "implementation", "self_check", "code_review", "testing", "evidence_gate", "closure_packet", "critical_reviewer", "final_verdict", "resolve", "retrospective", "memory_extraction"]
  ```
  Remove steps that will be skipped (e.g., remove "design" if no UI). After completing each step, remove it from the front of the array and update run.json.
- **[MANDATORY] Event logging**: After each step completes and is removed from `remaining_steps`, log:
  ```
  Append to .geas/ledger/events.jsonl:
  {"event": "step_complete", "task_id": "{task-id}", "step": "{step_name}", "agent": "{agent_name}", "timestamp": "<actual>"}
  ```
  Exception: `implementation_contract`, `gate_result`, and `task_resolved` have their own event formats. Do not duplicate those.
- **[MANDATORY] Session state update**: After each step completes and is logged, update the session context anchors:

  Write `.geas/state/session-latest.md`:
  ```markdown
  # Session State — {timestamp}

  **Mode:** initiative
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

### Step Groups

Within a single task's pipeline, these steps may run in parallel:
- **[code_review, testing]** — architecture-authority and qa-engineer do not reference each other's output. Spawn both in one message. After both return, remove both from `remaining_steps` and log `step_complete` for each.

All other steps are strictly sequential. In particular:
- **critical_reviewer → final_verdict** — product_authority's prompt requires `challenge-review.json` as input. critical_reviewer MUST complete and file MUST be verified before spawning product_authority.

### 2.1 Design (ui_ux_designer) [DEFAULT — skip-if: no user-facing interface (DB, API, CI, Docker, etc.)]
**Must run if the task has any user-facing interface (pages, forms, dashboards).**
Generate ContextPacket, then:
Update run.json checkpoint: `pipeline_step` = "design", `agent_in_flight` = "ui-ux-designer"
```
Agent(agent: "ui-ux-designer", prompt: "Read .geas/packets/{task-id}/ui-ux-designer.md. Write design spec to .geas/evidence/{task-id}/ui-ux-designer.json")
```
Verify `.geas/evidence/{task-id}/ui-ux-designer.json` exists.

### 2.2 Tech Guide (architecture_authority) [DEFAULT — skip when ALL: existing pattern, no new libs, single module, no schema change]
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
Verify `.geas/evidence/{task-id}/architecture-authority.json` exists.

### 2.3 Implementation Contract [MANDATORY]
Invoke `/geas:implementation-contract` — worker writes action plan, qa_engineer and architecture_authority approve before coding.
Update run.json checkpoint: `pipeline_step` = "implementation_contract", `agent_in_flight` = "{worker}"
Verify `.geas/contracts/{task-id}.json` exists with `status: "approved"`.

### 2.4 Implementation [MANDATORY — worktree isolated]
Generate ContextPacket, then:
Update run.json checkpoint: `pipeline_step` = "implementation", `agent_in_flight` = "{worker}"
```
Agent(agent: "{worker}", isolation: "worktree", prompt: "Read .geas/packets/{task-id}/{worker}.md. Implement the feature. Write evidence to .geas/evidence/{task-id}/{worker}.json")
```
Verify evidence exists.

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

### 2.4.5 Worker Self-Check [MANDATORY]
Update run.json checkpoint: `pipeline_step` = "self_check", `agent_in_flight` = "{worker}"
```
Agent(agent: "{worker}", prompt: "Implementation for {task-id} is complete. Before handing off to code review, produce your self-check artifact. Write .geas/tasks/{task-id}/worker-self-check.json conforming to docs/protocol/schemas/worker-self-check.schema.json. Required fields: version (\"1.0\"), artifact_type (\"worker_self_check\"), artifact_id (e.g. \"self-check-{task-id}\"), producer_type (your agent type: frontend_engineer | backend_engineer | devops_engineer | technical_writer), task_id, known_risks (string[]), untested_paths (string[]), possible_stubs (string[]), what_to_test_next (string[]), confidence (integer 1-5: 1=very_low … 5=very_high), summary (string), created_at (ISO 8601 timestamp).")
```
Verify `.geas/tasks/{task-id}/worker-self-check.json` exists. Do NOT proceed to Code Review without this file.

### 2.5 Code Review (architecture_authority) [MANDATORY]
Generate ContextPacket, then:
Update run.json checkpoint: `pipeline_step` = "code_review", `agent_in_flight` = "architecture-authority"
```
Agent(agent: "architecture-authority", prompt: "Read .geas/packets/{task-id}/architecture-authority-review.md. Review implementation. Write to .geas/evidence/{task-id}/architecture-authority-review.json")
```
Verify `.geas/evidence/{task-id}/architecture-authority-review.json` exists.
Update TaskContract status to `"reviewed"`.
Update run.json checkpoint: `pipeline_step` = "code_review"

### 2.6 Testing (qa_engineer) [MANDATORY]
Generate ContextPacket, then:
Update run.json checkpoint: `pipeline_step` = "testing", `agent_in_flight` = "qa-engineer"
```
Agent(agent: "qa-engineer", prompt: "Read .geas/packets/{task-id}/qa-engineer.md. Test the feature. Write QA results to .geas/evidence/{task-id}/qa-engineer.json")
```
Verify `.geas/evidence/{task-id}/qa-engineer.json` exists.
Update run.json checkpoint: `pipeline_step` = "testing"

### 2.7 Evidence Gate
Run eval_commands from TaskContract. Check acceptance criteria against all evidence.
Log detailed result with tier breakdown.
On gate pass: update TaskContract status to `"verified"`.
If fail → invoke `/geas:verify-fix-loop`. **Spawn the worker agent to fix.** After fix, re-run gate.

### 2.7.5 Closure Packet Assembly [MANDATORY — after gate pass]

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

### 2.8 Critical Reviewer Challenge [CONDITIONAL — mandatory for high/critical risk]

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

### 2.9 Final Verdict (product_authority) [MANDATORY — after critical_reviewer only]
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

### 2.10 Pre-Resolve Check
**Before marking any task as "passed", verify:**
- `.geas/tasks/{task-id}/closure-packet.json` exists (assembled in Step 2.7.5)
- `.geas/tasks/{task-id}/challenge-review.json` exists OR critical_reviewer was explicitly skipped (low/normal risk)
- `.geas/tasks/{task-id}/final-verdict.json` exists with `verdict: "pass"`
**If ANY is missing: go back and execute the missing step. Do NOT proceed without all three.**

### 2.11 Resolve

#### Lock Release

On task completion (Ship, Cut, or Escalate):
1. Read `.geas/state/locks.json`
2. Remove ALL lock entries where `task_id` matches this task (path, interface, resource locks)
3. Write updated `locks.json`
4. Log: `{"event": "locks_released", "task_id": "...", "timestamp": "<actual>"}`

- **Ship**: Read `.geas/tasks/{task-id}.json`, set `"status": "passed"`, Write it back. Then spawn repository_manager for commit:
  Update run.json checkpoint: `pipeline_step` = "resolve", `agent_in_flight` = "repository-manager"
  ```
  Agent(agent: "repository-manager", prompt: "Commit all changes for {task-id} with conventional commit format. Write to .geas/evidence/{task-id}/repository-manager.json")
  ```
- **Iterate** (Final Verdict only): does NOT deduct retry_budget (iterate is a product judgment, not a gate failure). Track iterate_count — after 3 cumulative iterates, escalate to orchestration_authority. Repopulate remaining_steps with the full pipeline (same skip conditions as original). Include product_authority's feedback in all subsequent ContextPackets. Resume from the rewind_target specified in the final verdict.
- **Cut**: status → `"cancelled"`. Write DecisionRecord.

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

### Memory Extraction [after Retrospective, Ship only]

**Skip condition:** Same as retrospective — only run when task was Ship (passed).

Invoke the `memorizing` skill for per-task candidate extraction:

1. Read `.geas/tasks/{task-id}/retrospective.json` → extract `memory_candidates[]`
2. If `memory_candidates` is empty: log `{"event": "memory_extraction", "task_id": "...", "candidates": 0, "timestamp": "<actual>"}` and skip.
3. For each candidate: invoke `/geas:memorizing` candidate extraction procedure:
   - Determine memory_type and scope
   - Run deduplication against memory-index
   - Write candidate to `.geas/memory/candidates/{memory-id}.json`
   - Update `.geas/state/memory-index.json`
4. Run application logging: for memories that were in this task's packet, record effects based on task outcome.
5. Log: `{"event": "memory_extraction", "task_id": "...", "candidates": N, "timestamp": "<actual>"}`

Update run.json checkpoint: `pipeline_step` = "memory_extraction"

### Close Phase 2

**Phase review** — verify gate criteria for build → polish:
- All MVP-critical tasks passed
- No blocking_conflict active
- 0 critical debt in `.geas/state/debt-register.json`
- 0 unmitigated high debt (status must not be "open" for high severity)

Write `.geas/state/gap-assessment.json` if not yet produced for this transition (same procedure as 4.1 but scoped to build phase).
Write `.geas/state/phase-review.json` with `mission_phase: "build"`, `next_phase: "polish"`.

If any gate criteria unmet: set `status: "blocked"`. List unmet criteria. After 3 consecutive failures → enter decision mode.

Log: `{"event": "phase_complete", "phase": "build", "timestamp": "<actual>"}`

---

## Phase 3: Polish [MANDATORY — do not skip]

### 3.1 Security Review (security_engineer)
Update run.json checkpoint: `pipeline_step` = "security_review", `agent_in_flight` = "security-engineer"
```
Agent(agent: "security-engineer", prompt: "Full security review of the project. Check OWASP top 10, auth flows, input validation, secrets exposure, dependency vulnerabilities. Write findings with severity (CRITICAL/HIGH/MEDIUM/LOW) to .geas/evidence/polish/security-engineer.json")
```
Verify `.geas/evidence/polish/security-engineer.json` exists.

### 3.2 Triage security_engineer Findings
Read `.geas/evidence/polish/security-engineer.json`. Classify each finding by severity:
- **CRITICAL / HIGH** → create a fix task (mini-pipeline, see 3.3)
- **MEDIUM / LOW** → add to `.geas/state/debt-register.json` as structured debt items with severity, kind, status, target_phase

If no CRITICAL/HIGH findings: skip 3.3 and proceed to 3.4.

### 3.3 Fix Critical Security Issues
For each CRITICAL/HIGH finding, run a reduced pipeline:
1. Generate ContextPacket for the appropriate worker (frontend-engineer for frontend, backend-engineer for backend) with security_engineer's finding as primary context
2. Update run.json checkpoint: `pipeline_step` = "security_fix", `agent_in_flight` = "{worker}"
3. Spawn worker with worktree isolation:
   ```
   Agent(agent: "{worker}", isolation: "worktree", prompt: "Read .geas/packets/polish/{worker}-fix-{N}.md. Fix the security issue. Write evidence to .geas/evidence/polish/{worker}-fix-{N}.json")
   ```
4. Merge worktree branch
5. Code Review (architecture_authority) — verify the fix is correct and doesn't introduce regressions
6. Testing (qa_engineer) — verify the fix with `eval_commands` from conventions.md
7. If fix fails: retry once (`retry_budget: 2`). If still fails: register as HIGH debt and proceed — do not block Polish phase indefinitely

### 3.4 Documentation (technical_writer)
Update run.json checkpoint: `pipeline_step` = "documentation", `agent_in_flight` = "technical-writer"
```
Agent(agent: "technical-writer", prompt: "Read .geas/spec/seed.json, .geas/spec/prd.md, and all evidence at .geas/evidence/. Write README, API docs, and user-facing documentation. Write to .geas/evidence/polish/technical-writer.json")
```
Verify `.geas/evidence/polish/technical-writer.json` exists.

### 3.5 Entropy Scan
Update run.json checkpoint: `pipeline_step` = "cleanup", `agent_in_flight` = "architecture-authority"
Invoke `/geas:cleanup` — architecture_authority scans for dead code, AI boilerplate, convention drift, and duplication.
Results are recorded in `.geas/state/debt-register.json`.

### 3.6 Close Phase 3

**Phase review** — verify gate criteria for polish → evolution:
- All high/critical debt triaged in `.geas/state/debt-register.json` (no items with severity high/critical and status "open")
- Required reviews approved
- Shipping rationale recorded for every known risk
- Zero open CRITICAL/HIGH security issues

Write `.geas/state/gap-assessment.json` if not yet produced for this transition.
Write `.geas/state/phase-review.json` with `mission_phase: "polish"`, `next_phase: "evolution"`.

If any gate criteria unmet: set `status: "blocked"`. List unmet criteria. After 3 consecutive failures → enter decision mode.

Log: `{"event": "phase_complete", "phase": "polish", "timestamp": "<actual>"}`

---

## Phase 4: Scoped Evolution [MANDATORY — do not skip]

### 4.1 Gap Assessment

Produce a structured gap assessment comparing what was planned vs what was delivered.

1. Read `.geas/spec/seed.json` — extract `scope_in` and `scope_out` items
2. Read all TaskContracts in `.geas/tasks/` — categorize by status
3. Read `.geas/state/debt-register.json` — get open items
4. Classify each `scope_in` item:
   - Task exists with `status: "passed"` → `fully_delivered`
   - Task exists but partially complete or with caveats → `partially_delivered`
   - No corresponding task or task cancelled → `not_delivered`
5. Check for `scope_out` items that were delivered anyway → `unexpected_additions` (need traceability note)
6. Items explicitly dropped by product_authority decision → `intentional_cuts`
7. Write `.geas/state/gap-assessment.json` conforming to `docs/protocol/schemas/gap-assessment.schema.json`:

```json
{
  "version": "1.0",
  "artifact_type": "gap_assessment",
  "artifact_id": "ga-evolution",
  "producer_type": "product_authority",
  "scope_in_summary": "<what was planned — summarize from seed.json scope_in>",
  "scope_out_summary": "<what was explicitly excluded — from seed.json scope_out>",
  "fully_delivered": ["item 1", "item 2"],
  "partially_delivered": ["item 3 — missing error handling"],
  "not_delivered": ["item 4"],
  "intentional_cuts": ["item 5 — cut per decision dec-003"],
  "unexpected_additions": [],
  "recommended_followups": ["Complete item 3 error handling", "Address item 4 in next mission"],
  "created_at": "<ISO 8601>"
}
```

8. **Forward-feeding rule**: Items appearing in `partially_delivered` or `not_delivered` across 2+ gap assessments are automatically fed into the next discovery phase's seed.json constraints.
9. Reject any work that falls under `scope_out` — Evolution refines, it does not expand.

### 4.2 Prioritize Remaining Work
Classify remaining items:
- **P0 (must)**: unimplemented `scope_in` items that are core to the mission + HIGH severity debt
- **P1 (nice-to-have)**: `scope_in` items that are enhancements + MEDIUM severity debt

Present the prioritized list to the user:
```
[Orchestrator] Evolution scope:
  P0 (will execute):
    1. <item>
    2. <item>
  P1 (skipped unless you request):
    1. <item>

  Proceed with P0 items?
```

If no P0 items remain: skip to 4.4.

### 4.2.5 Rules Update Approval

1. Read all per-task retrospectives: `.geas/tasks/*/retrospective.json`
2. Collect all `rule_candidates[]` across tasks
3. If no candidates across any task: write `.geas/state/rules-update.json` with `status: "none"`, `reason: "no rule candidates from any task retrospective"`, `evidence_refs: []`, `applies_to: []`. Skip to next step.
4. For each candidate, check approval conditions:
   - `evidence_refs` >= 2 (same pattern observed in 2+ tasks) AND `contradiction_count` = 0 → auto-approve
   - Otherwise → spawn domain authority for review
5. Write `.geas/state/rules-update.json` conforming to `docs/protocol/schemas/rules-update.schema.json`:
   ```json
   {
     "version": "1.0",
     "artifact_type": "rules_update",
     "artifact_id": "ru-{mission-id}",
     "producer_type": "process_lead",
     "status": "approved",
     "affected_rule_ids": ["rule-001", "rule-002"],
     "reason": "<aggregated rationale>",
     "evidence_refs": ["retro-task-001", "retro-task-003"],
     "applies_to": ["rules.md section X"],
     "created_at": "<ISO 8601>"
   }
   ```
6. If `status: "approved"`: apply changes to `.geas/rules.md`
7. Log: `{"event": "rules_update", "status": "approved|none", "timestamp": "<actual>"}`

### 4.2.7 Memory Promotion

Batch review and promotion of accumulated memory candidates across the mission.

1. Read all candidates from `.geas/memory/candidates/`
2. For each candidate:
   a. Check promotion conditions: evidence_refs >= 2 OR similar incidents >= 2 OR explicit approval
   b. If conditions met and no domain review yet: spawn domain authority (per memorizing skill section 3)
   c. If domain authority approves (promote_provisional): promote candidate → provisional
      - Move from `candidates/` to `entries/`
      - Update state, set `review_after` to 30 days from now
      - Update memory-index.json
   d. If rejected: set state to `rejected` in candidate file, update index
   e. If keep: leave as candidate for future evidence
3. Check existing provisional entries for stable promotion:
   - 3+ successful_reuses + 0 contradictions → spawn domain authority for stable review
4. Run decay detection (memorizing skill section 6)
5. Run application logging for all mission tasks (memorizing skill section 5)
6. Log: `{"event": "memory_promotion_batch", "promoted": N, "rejected": M, "decayed": K, "timestamp": "<actual>"}`

### 4.3 Execute P0 Items
For each P0 item, run the **full Phase 2 pipeline**:
- Compile TaskContract → Design → Tech Guide → Implementation Contract → Implementation → Code Review → Testing → Evidence Gate → Critical Reviewer Challenge → Final Verdict → Resolve → Retrospective

Same mandatory steps, same Closure Packet verification, same checkpoint management as Phase 2.

**Exit criteria** — stop executing when ANY of:
- All P0 items are complete
- User requests stop

### 4.4 product_authority Final Briefing [MANDATORY]
```
Agent(agent: "product-authority", prompt: "Final product review. Read .geas/spec/seed.json, .geas/state/gap-assessment.json, .geas/state/debt-register.json, and all evidence across all phases. Deliver strategic summary: what shipped, what was cut, product health assessment, and recommendations for future work. Write JSON to .geas/evidence/evolution/product-authority-final.json. ALSO write a human-readable markdown summary to .geas/evidence/evolution/mission-summary.md covering: mission goal, delivered scope, known gaps, debt status, and recommendations.")
```
Verify `.geas/evidence/evolution/product-authority-final.json` exists.
Verify `.geas/evidence/evolution/mission-summary.md` exists.

### 4.5 repository_manager Release Management [MANDATORY]
```
Agent(agent: "repository-manager", prompt: "Create release: version bump, changelog from .geas/ledger/events.jsonl, final commit. Write to .geas/evidence/evolution/repository-manager-release.json")
```
Verify `.geas/evidence/evolution/repository-manager-release.json` exists.

### 4.6 Run Summary
Invoke `/geas:run-summary` to generate session audit trail.

### 4.7 Evolution Exit Gate and Close

**Before closing, verify ALL 5 required artifacts exist:**

1. `.geas/state/gap-assessment.json` — produced in Step 4.1
2. `.geas/state/debt-register.json` — all open debt triaged (no items with `severity: "high"` or `"critical"` and `status: "open"`)
3. `.geas/state/rules-update.json` — exists with `status: "approved"` or `"none"` (produced in Step 4.2.5)
4. `.geas/evidence/evolution/mission-summary.md` — produced in Step 4.4
5. `.geas/state/phase-review.json` — write now (see below)

**If ANY artifact is missing: go back and execute the missing step. Do NOT close without all 5.**

**Debt triage check**: Read debt-register.json. If any item has `severity: "critical"` and `status: "open"`, the exit gate fails. Product_authority must decide: (a) immediate fix as task, (b) accept with mandatory rationale, or (c) defer to next mission. Record decision in a DecisionRecord with `decision_type: "critical_debt_triage"`.

Write `.geas/state/phase-review.json`:
```json
{
  "version": "1.0",
  "artifact_type": "phase_review",
  "artifact_id": "pr-evolution",
  "producer_type": "orchestration_authority",
  "mission_phase": "evolution",
  "status": "ready_to_exit",
  "summary": "<evolution outcomes>",
  "gate_criteria_met": ["gap-assessment exists", "debt triaged", "rules-update exists", "mission-summary exists"],
  "gate_criteria_unmet": [],
  "risk_notes": [],
  "created_at": "<ISO 8601>"
}
```

Update run state: `{ "phase": "complete", "status": "complete" }`
Log: `{"event": "phase_complete", "phase": "complete", "timestamp": "<actual>"}`
