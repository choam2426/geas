---
name: initiative
description: Start a new product with the Geas team — Genesis, MVP Build, Polish, Evolution.
user-invocable: true
---

# Initiative Mode

4 phases: Genesis → MVP Build → Polish → Evolution.

---

## Phase 1: Genesis

### 1.1 Seed Check
- `.geas/spec/seed.json` should exist from intake. If not, invoke `/geas:intake`.
- If completeness_checklist has any false values and no override: ask the user, re-run intake.

### 1.2 Vision (Nova)
```
Agent(agent: "nova", prompt: "Then read .geas/spec/seed.json. Deliver vision, MVP scope, user value proposition. Write to .geas/evidence/genesis/nova.json")
```
Verify `.geas/evidence/genesis/nova.json` exists.

### 1.3 PRD & User Stories (Nova)
```
Agent(agent: "nova", prompt: "Read .geas/spec/seed.json and .geas/evidence/genesis/nova.json. Create a PRD using write-prd skill, save to .geas/spec/prd.md. Then break it into user stories using write-stories skill, save to .geas/spec/stories.md.")
```
Verify both `.geas/spec/prd.md` and `.geas/spec/stories.md` exist.

### 1.4 Architecture (Forge)
```
Agent(agent: "forge", prompt: "Then read .geas/spec/seed.json, .geas/evidence/genesis/nova.json, and .geas/spec/prd.md. Propose architecture and tech stack. Write conventions to .geas/memory/_project/conventions.md and evidence to .geas/evidence/genesis/forge.json")
```
Verify evidence exists. Write DecisionRecord to `.geas/decisions/dec-001.json`.

### 1.5 Vote Round
```
Agent(agent: "circuit", prompt: "Read .geas/evidence/genesis/forge.json. Vote agree/disagree with rationale. Write to .geas/evidence/genesis/vote-circuit.json")
Agent(agent: "palette", prompt: "Read .geas/evidence/genesis/forge.json. Vote agree/disagree with rationale. Write to .geas/evidence/genesis/vote-palette.json")
Agent(agent: "critic", prompt: "Read .geas/evidence/genesis/forge.json. Play devil's advocate: identify risks, blind spots, and trade-offs even if you agree overall. Vote agree/disagree with rationale. Write to .geas/evidence/genesis/vote-critic.json")
```
Critic MUST participate in every vote round. If all agree: proceed. If any disagree: run debate, then re-vote.

### 1.6 Compile TaskContracts
- Use `.geas/spec/stories.md` as input. For each user story, invoke `/geas:task-compiler`.
- Each TaskContract MUST include a `rubric` array. Base dimensions: core_interaction(3), feature_completeness(4), code_quality(4), regression_safety(4). Add ux_clarity(3), visual_coherence(3) for frontend tasks.
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

Present recommendations with install commands from the MCP registry. If the user connects, record in `.geas/config.json` under `connected_mcp`.

### 1.8 Close Genesis
- Update run state: `{ "phase": "mvp", "status": "in_progress" }`
- Log: `{"event": "phase_complete", "phase": "genesis", "timestamp": "<actual>"}`

---

## Phase 2: MVP Build

**Every task runs the full pipeline. Code Review and Testing are mandatory for every task.**

For **each** TaskContract in `.geas/tasks/` (ordered by dependencies):

### 2.0 Start Task
- Read TaskContract. Check dependencies are `"passed"`.
- Update status to `"in_progress"`. Log `task_started` event.
- **Write `remaining_steps` to checkpoint** — the full pipeline for this task:
  ```json
  "remaining_steps": ["design", "tech_guide", "implementation_contract", "implementation", "code_review", "testing", "evidence_gate", "critic_review", "nova_review", "retrospective", "resolve"]
  ```
  Remove steps that will be skipped (e.g., remove "design" if no UI). After completing each step, remove it from the front of the array and update run.json.
- **Event logging**: After each step completes and is removed from `remaining_steps`, log:
  ```
  Append to .geas/ledger/events.jsonl:
  {"event": "step_complete", "task_id": "{task-id}", "step": "{step_name}", "agent": "{agent_name}", "timestamp": "<actual>"}
  ```
  Exception: `implementation_contract`, `gate_result`, and `task_resolved` have their own event formats. Do not duplicate those.
- **Rubric check**: If the TaskContract is missing `rubric`, insert the default before proceeding:
  ```json
  "rubric": [
    { "dimension": "core_interaction", "evaluator": "sentinel", "threshold": 3 },
    { "dimension": "feature_completeness", "evaluator": "sentinel", "threshold": 4 },
    { "dimension": "code_quality", "evaluator": "forge", "threshold": 4 },
    { "dimension": "regression_safety", "evaluator": "sentinel", "threshold": 4 }
  ]
  ```
  Add `ux_clarity` (threshold 3) and `visual_coherence` (threshold 3) if the task has a UI component.

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
Verify evidence exists. Merge worktree branch.

### 2.5 Code Review (Forge) [MANDATORY]
Generate ContextPacket, then:
Update run.json checkpoint: `pipeline_step` = "code_review", `agent_in_flight` = "forge"
```
Agent(agent: "forge", prompt: "Read .geas/packets/{task-id}/forge-review.md. Review implementation. Write to .geas/evidence/{task-id}/forge-review.json")
```
Verify `.geas/evidence/{task-id}/forge-review.json` exists.

### 2.6 Testing (Sentinel) [MANDATORY]
Generate ContextPacket, then:
Update run.json checkpoint: `pipeline_step` = "testing", `agent_in_flight` = "sentinel"
```
Agent(agent: "sentinel", prompt: "Read .geas/packets/{task-id}/sentinel.md. Test the feature. Write QA results to .geas/evidence/{task-id}/sentinel.json")
```
Verify `.geas/evidence/{task-id}/sentinel.json` exists.

### 2.7 Evidence Gate
Run eval_commands from TaskContract. Check acceptance criteria against all evidence.
Log detailed result with tier breakdown.
If fail → invoke `/geas:verify-fix-loop`. **Spawn the worker agent to fix.** After fix, re-run gate.

### 2.8 Critic Pre-ship Review [MANDATORY]
Update run.json checkpoint: `pipeline_step` = "critic_review", `agent_in_flight` = "critic"
```
Agent(agent: "critic", prompt: "Read all evidence at .geas/evidence/{task-id}/. Challenge: is this truly ready to ship? Identify risks, missing edge cases, or technical debt. Write to .geas/evidence/{task-id}/critic-review.json")
```

### 2.9 Nova Product Review [MANDATORY]
Update run.json checkpoint: `pipeline_step` = "nova_review", `agent_in_flight` = "nova"
```
Agent(agent: "nova", prompt: "Read all evidence at .geas/evidence/{task-id}/ including critic-review.json. Verdict: Ship, Iterate, or Cut. Write to .geas/evidence/{task-id}/nova-verdict.json")
```

### 2.10 Ship Gate — verify before marking passed
**Before marking any task as "passed", verify:**
- `.geas/evidence/{task-id}/forge-review.json` exists (Read it)
- `.geas/evidence/{task-id}/sentinel.json` exists (Read it)
- `.geas/evidence/{task-id}/critic-review.json` exists (Read it)
- `.geas/evidence/{task-id}/nova-verdict.json` exists (Read it)
**If ANY is missing: go back and execute the missing step. Do NOT proceed without all four.**

### Retrospective (Scrum) [MANDATORY]
Update run.json checkpoint: `pipeline_step` = "retrospective", `agent_in_flight` = "scrum"
```
Agent(agent: "scrum", prompt: "Read all evidence at .geas/evidence/{task-id}/. Run retrospective: update rules.md with new conventions, write lessons to .geas/memory/retro/{task-id}.json")
```
Verify `.geas/memory/retro/{task-id}.json` exists.

### 2.11 Resolve
- **Ship**: Read `.geas/tasks/{task-id}.json`, set `"status": "passed"`, Write it back. Then spawn Keeper for commit:
  Update run.json checkpoint: `pipeline_step` = "resolve", `agent_in_flight` = "keeper"
  ```
  Agent(agent: "keeper", prompt: "Commit all changes for {task-id} with conventional commit format. Write to .geas/evidence/{task-id}/keeper.json")
  ```
- **Iterate**: re-dispatch with Nova's feedback.
- **Cut**: status → `"failed"`. Write DecisionRecord.

### Close Phase 2
Log: `{"event": "phase_complete", "phase": "mvp", "timestamp": "<actual>"}`

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
- **MEDIUM / LOW** → register in `.geas/debt.json` with `source_task: "polish"`, `found_by: "shield"`

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
Results are recorded in `.geas/debt.json`.

### 3.6 Close Phase 3
**Completion criteria:** zero open CRITICAL/HIGH security issues. MEDIUM/LOW items in debt.json are acceptable — they carry into Phase 4.

Log: `{"event": "phase_complete", "phase": "polish", "timestamp": "<actual>"}`

---

## Phase 4: Scoped Evolution [MANDATORY — do not skip]

### 4.1 Gap Assessment
1. Read `.geas/spec/seed.json` — get `scope_in` items
2. Read all TaskContracts in `.geas/tasks/` — get items with `status: "passed"`
3. Diff: identify `scope_in` items that have no corresponding completed task
4. Read `.geas/debt.json` — get open items with severity HIGH
5. Reject any work that falls under `scope_out` — Evolution refines, it does not expand

### 4.2 Prioritize Remaining Work
Classify remaining items:
- **P0 (must)**: unimplemented `scope_in` items that are core to the mission + HIGH severity debt
- **P1 (nice-to-have)**: `scope_in` items that are enhancements + MEDIUM severity debt

Present the prioritized list to the user:
```
[Compass] Evolution scope:
  P0 (will execute):
    1. <item>
    2. <item>
  P1 (skipped unless you request):
    1. <item>

  Proceed with P0 items?
```

If no P0 items remain: skip to 4.4.

### 4.3 Execute P0 Items
For each P0 item, run the **full Phase 2 pipeline**:
- Compile TaskContract → Design → Tech Guide → Implementation Contract → Implementation → Code Review → Testing → Evidence Gate → Critic Review → Nova Review → Retrospective → Resolve

Same mandatory steps, same Ship Gate, same checkpoint management as Phase 2.

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
