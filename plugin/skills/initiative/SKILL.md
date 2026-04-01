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

### 1.2 Vision (Nova)
```
Agent(agent: "nova", prompt: "Then read .geas/spec/seed.json. Deliver vision, MVP scope, user value proposition. Write to .geas/evidence/discovery/nova.json")
```
Verify `.geas/evidence/discovery/nova.json` exists.

### 1.3 PRD & User Stories (Nova)
```
Agent(agent: "nova", prompt: "Read .geas/spec/seed.json and .geas/evidence/discovery/nova.json. Create a PRD using write-prd skill, save to .geas/spec/prd.md. Then break it into user stories using write-stories skill, save to .geas/spec/stories.md.")
```
Verify both `.geas/spec/prd.md` and `.geas/spec/stories.md` exist.

### 1.4 Architecture (Forge)
```
Agent(agent: "forge", prompt: "Then read .geas/spec/seed.json, .geas/evidence/discovery/nova.json, and .geas/spec/prd.md. Propose architecture and tech stack. Write conventions to .geas/memory/_project/conventions.md and evidence to .geas/evidence/discovery/forge.json")
```
Verify evidence exists. Write DecisionRecord to `.geas/decisions/dec-001.json`.

### 1.5 Vote Round
Invoke `/geas:vote-round` with:
- Proposal: `.geas/evidence/discovery/forge.json`
- Voters: circuit, palette, critic
- Output: `.geas/evidence/discovery/vote-{agent}.json`

If all agree: proceed. If any disagree: `/geas:decision` runs, then re-vote.
Verify all vote files exist before continuing.

### 1.6 Compile TaskContracts
- Use `.geas/spec/stories.md` as input. For each user story, invoke `/geas:task-compiler`.
- Each TaskContract MUST include a `rubric` object with a `dimensions` array. Base dimensions: core_interaction(3), feature_completeness(4), code_quality(4), regression_safety(4). Add ux_clarity(3), visual_coherence(3) for frontend tasks.
- Log each: `{"event": "task_compiled", "task_id": "...", "timestamp": "<actual>"}`

### 1.7 MCP Server Recommendations

Analyze the tech stack from Forge's architecture decision and recommend helpful MCP servers to the user. Match by category, not by specific tool name:

| Stack category | MCP category | Reason |
|---------------|--------------|--------|
| Relational database | Database query MCP | Workers can inspect schemas and run read-only queries |
| Document database | Database query MCP | Workers can explore collections |
| Web frontend | Web standards MCP | Workers can reference specification docs |
| Has deploy target | Performance audit MCP | Sentinel can audit performance and accessibility |
| Git-hosted | Git platform MCP | Keeper can manage PRs and issues |

Present recommendations with install commands from the MCP registry.

### 1.8 Close Discovery
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
  "remaining_steps": ["design", "tech_guide", "implementation_contract", "implementation", "self_check", "code_review", "testing", "evidence_gate", "closure_packet", "critical_reviewer", "final_verdict", "resolve", "retrospective"]
  ```
  Remove steps that will be skipped (e.g., remove "design" if no UI). After completing each step, remove it from the front of the array and update run.json.
- **[MANDATORY] Event logging**: After each step completes and is removed from `remaining_steps`, log:
  ```
  Append to .geas/ledger/events.jsonl:
  {"event": "step_complete", "task_id": "{task-id}", "step": "{step_name}", "agent": "{agent_name}", "timestamp": "<actual>"}
  ```
  Exception: `implementation_contract`, `gate_result`, and `task_resolved` have their own event formats. Do not duplicate those.
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
- **[code_review, testing]** — forge and sentinel do not reference each other's output. Spawn both in one message. After both return, remove both from `remaining_steps` and log `step_complete` for each.

All other steps are strictly sequential. In particular:
- **critical_reviewer → final_verdict** — Nova's prompt requires `challenge-review.json` as input. Critic MUST complete and file MUST be verified before spawning Nova.

### 2.1 Design (Palette) [DEFAULT — skip-if: no user-facing interface (DB, API, CI, Docker, etc.)]
**Must run if the task has any user-facing interface (pages, forms, dashboards).**
Generate ContextPacket, then:
Update run.json checkpoint: `pipeline_step` = "design", `agent_in_flight` = "palette"
```
Agent(agent: "palette", prompt: "Read .geas/packets/{task-id}/palette.md. Write design spec to .geas/evidence/{task-id}/palette.json")
```
Verify `.geas/evidence/{task-id}/palette.json` exists.

### 2.2 Tech Guide (Forge) [DEFAULT — skip when ALL: existing pattern, no new libs, single module, no schema change]
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
Update run.json checkpoint: `pipeline_step` = "tech_guide", `agent_in_flight` = "forge"
```
Agent(agent: "forge", prompt: "Read .geas/packets/{task-id}/forge.md. Write tech guide to .geas/evidence/{task-id}/forge.json")
```
Verify `.geas/evidence/{task-id}/forge.json` exists.

### 2.3 Implementation Contract [MANDATORY]
Invoke `/geas:implementation-contract` — worker writes action plan, Sentinel and Forge approve before coding.
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

### 2.5 Code Review (Forge) [MANDATORY]
Generate ContextPacket, then:
Update run.json checkpoint: `pipeline_step` = "code_review", `agent_in_flight` = "forge"
```
Agent(agent: "forge", prompt: "Read .geas/packets/{task-id}/forge-review.md. Review implementation. Write to .geas/evidence/{task-id}/forge-review.json")
```
Verify `.geas/evidence/{task-id}/forge-review.json` exists.
Update TaskContract status to `"reviewed"`.
Update run.json checkpoint: `pipeline_step` = "code_review"

### 2.6 Testing (Sentinel) [MANDATORY]
Generate ContextPacket, then:
Update run.json checkpoint: `pipeline_step` = "testing", `agent_in_flight` = "sentinel"
```
Agent(agent: "sentinel", prompt: "Read .geas/packets/{task-id}/sentinel.md. Test the feature. Write QA results to .geas/evidence/{task-id}/sentinel.json")
```
Verify `.geas/evidence/{task-id}/sentinel.json` exists.
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
- Specialist Reviews: `.geas/evidence/{task-id}/forge-review.json`, `.geas/evidence/{task-id}/sentinel.json`
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
      "summary": "<key finding from forge-review.json>"
    },
    {
      "reviewer_type": "qa_engineer",
      "status": "approved",
      "summary": "<key finding from sentinel.json>"
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

Update run.json checkpoint: `pipeline_step` = "critical_reviewer", `agent_in_flight` = "critic"
```
Agent(agent: "critic", prompt: "Read the closure packet at .geas/tasks/{task-id}/closure-packet.json. Read all evidence at .geas/evidence/{task-id}/. You MUST raise at least 1 substantive concern — surface a real risk, edge case, or technical debt item. For each concern, state clearly whether it is BLOCKING or non-blocking. Write .geas/tasks/{task-id}/challenge-review.json with the following fields: reviewer_type (\"critical_reviewer\"), concerns (array of strings, each prefixed with \"[BLOCKING]\" or \"[non-blocking]\"), blocking (boolean — true if ANY concern is blocking).")
```

Verify `.geas/tasks/{task-id}/challenge-review.json` exists.

**After critic returns:**

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

### 2.9 Final Verdict (Nova) [MANDATORY — after critical_reviewer only]
**Preconditions:**
- `.geas/tasks/{task-id}/challenge-review.json` must exist OR `critical_reviewer` was explicitly skipped for low/normal risk
- Closure Packet must be assembled (all required fields populated)
- Do NOT spawn Nova until both preconditions are verified

Update run.json checkpoint: `pipeline_step` = "final_verdict", `agent_in_flight` = "nova"
```
Agent(agent: "nova", prompt: "Read the closure packet at .geas/tasks/{task-id}/closure-packet.json (which includes the challenge_review field if critic ran) and all evidence at .geas/evidence/{task-id}/. Decide: pass, iterate, or escalate. Write .geas/tasks/{task-id}/final-verdict.json conforming to docs/protocol/schemas/final-verdict.schema.json. Required fields: version (\"1.0\"), artifact_type (\"final_verdict\"), artifact_id (e.g. \"verdict-{task-id}\"), producer_type (\"product_authority\"), created_at (ISO 8601 timestamp), task_id, verdict (\"pass\" | \"iterate\" | \"escalate\"), rationale (why this verdict), closure_packet_ref (path to closure packet). If iterate: include rewind_target (\"ready\" | \"implementing\" | \"reviewed\") and iterate_count. If escalate: include escalation_reason. Also write to .geas/evidence/{task-id}/nova-verdict.json for backward compatibility.")
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

- **Ship**: Read `.geas/tasks/{task-id}.json`, set `"status": "passed"`, Write it back. Then spawn Keeper for commit:
  Update run.json checkpoint: `pipeline_step` = "resolve", `agent_in_flight` = "keeper"
  ```
  Agent(agent: "keeper", prompt: "Commit all changes for {task-id} with conventional commit format. Write to .geas/evidence/{task-id}/keeper.json")
  ```
- **Iterate** (Final Verdict only): does NOT deduct retry_budget (iterate is a product judgment, not a gate failure). Track iterate_count — after 3 cumulative iterates, escalate to orchestration_authority. Repopulate remaining_steps with the full pipeline (same skip conditions as original). Include Nova's feedback in all subsequent ContextPackets. Resume from the rewind_target specified in the final verdict.
- **Cut**: status → `"cancelled"`. Write DecisionRecord.

### Retrospective (Scrum) [MANDATORY — Ship only, after Resolve]

**Skip condition:** If the Final Verdict was Cut or Escalate, skip retrospective. Only run when the task has been resolved as Ship (status = `"passed"`).

Update run.json checkpoint: `pipeline_step` = "retrospective", `agent_in_flight` = "scrum"
```
Agent(agent: "scrum", prompt: "Read all evidence at .geas/evidence/{task-id}/ and the closure packet at .geas/tasks/{task-id}/closure-packet.json. Write a structured retrospective to .geas/tasks/{task-id}/retrospective.json conforming to docs/protocol/schemas/retrospective.schema.json. Required fields:
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

### Close Phase 2
Log: `{"event": "phase_complete", "phase": "build", "timestamp": "<actual>"}`

---

## Phase 3: Polish [MANDATORY — do not skip]

### 3.1 Security Review (Shield)
Update run.json checkpoint: `pipeline_step` = "security_review", `agent_in_flight` = "shield"
```
Agent(agent: "shield", prompt: "Full security review of the project. Check OWASP top 10, auth flows, input validation, secrets exposure, dependency vulnerabilities. Write findings with severity (CRITICAL/HIGH/MEDIUM/LOW) to .geas/evidence/polish/shield.json")
```
Verify `.geas/evidence/polish/shield.json` exists.

### 3.2 Triage Shield Findings
Read `.geas/evidence/polish/shield.json`. Classify each finding by severity:
- **CRITICAL / HIGH** → create a fix task (mini-pipeline, see 3.3)
- **MEDIUM / LOW** → add to `.geas/state/debt-register.json` as structured debt items with severity, kind, status, target_phase

If no CRITICAL/HIGH findings: skip 3.3 and proceed to 3.4.

### 3.3 Fix Critical Security Issues
For each CRITICAL/HIGH finding, run a reduced pipeline:
1. Generate ContextPacket for the appropriate worker (Pixel for frontend, Circuit for backend) with Shield's finding as primary context
2. Update run.json checkpoint: `pipeline_step` = "security_fix", `agent_in_flight` = "{worker}"
3. Spawn worker with worktree isolation:
   ```
   Agent(agent: "{worker}", isolation: "worktree", prompt: "Read .geas/packets/polish/{worker}-fix-{N}.md. Fix the security issue. Write evidence to .geas/evidence/polish/{worker}-fix-{N}.json")
   ```
4. Merge worktree branch
5. Code Review (Forge) — verify the fix is correct and doesn't introduce regressions
6. Testing (Sentinel) — verify the fix with `eval_commands` from conventions.md
7. If fix fails: retry once (`retry_budget: 2`). If still fails: register as HIGH debt and proceed — do not block Polish phase indefinitely

### 3.4 Documentation (Scroll)
Update run.json checkpoint: `pipeline_step` = "documentation", `agent_in_flight` = "scroll"
```
Agent(agent: "scroll", prompt: "Read .geas/spec/seed.json, .geas/spec/prd.md, and all evidence at .geas/evidence/. Write README, API docs, and user-facing documentation. Write to .geas/evidence/polish/scroll.json")
```
Verify `.geas/evidence/polish/scroll.json` exists.

### 3.5 Entropy Scan
Update run.json checkpoint: `pipeline_step` = "cleanup", `agent_in_flight` = "forge"
Invoke `/geas:cleanup` — Forge scans for dead code, AI boilerplate, convention drift, and duplication.
Results are recorded in `.geas/state/debt-register.json`.

### 3.6 Close Phase 3
**Completion criteria:** zero open CRITICAL/HIGH security issues. MEDIUM/LOW items in debt-register.json are acceptable — they carry into Phase 4.

Log: `{"event": "phase_complete", "phase": "polish", "timestamp": "<actual>"}`

---

## Phase 4: Scoped Evolution [MANDATORY — do not skip]

### 4.1 Gap Assessment
1. Read `.geas/spec/seed.json` — get `scope_in` items
2. Read all TaskContracts in `.geas/tasks/` — get items with `status: "passed"`
3. Diff: identify `scope_in` items that have no corresponding completed task
4. Read `.geas/state/debt-register.json` — get open items with severity HIGH
5. Reject any work that falls under `scope_out` — Evolution refines, it does not expand

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

### 4.3 Execute P0 Items
For each P0 item, run the **full Phase 2 pipeline**:
- Compile TaskContract → Design → Tech Guide → Implementation Contract → Implementation → Code Review → Testing → Evidence Gate → Critical Reviewer Challenge → Final Verdict → Resolve → Retrospective

Same mandatory steps, same Closure Packet verification, same checkpoint management as Phase 2.

**Exit criteria** — stop executing when ANY of:
- All P0 items are complete
- User requests stop

### 4.4 Nova Final Briefing [MANDATORY]
```
Agent(agent: "nova", prompt: "Final product review. Read .geas/spec/seed.json and all evidence across all phases. Deliver strategic summary: what shipped, what was cut, product health assessment, and recommendations for future work. Write to .geas/evidence/evolution/nova-final.json")
```
Verify `.geas/evidence/evolution/nova-final.json` exists.

### 4.5 Keeper Release Management [MANDATORY]
```
Agent(agent: "keeper", prompt: "Create release: version bump, changelog from .geas/ledger/events.jsonl, final commit. Write to .geas/evidence/evolution/keeper-release.json")
```
Verify `.geas/evidence/evolution/keeper-release.json` exists.

### 4.6 Run Summary
Invoke `/geas:run-summary` to generate session audit trail.

### 4.7 Close
Update run state: `{ "phase": "complete", "status": "complete" }`
Log: `{"event": "phase_complete", "phase": "complete", "timestamp": "<actual>"}`
