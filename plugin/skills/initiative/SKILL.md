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

```
Agent(agent: "shield", prompt: "Security review of the project. Write to .geas/evidence/polish/shield.json")
```
Verify `.geas/evidence/polish/shield.json` exists.

```
Agent(agent: "scroll", prompt: "Write README and docs. Write to .geas/evidence/polish/scroll.json")
```
Verify `.geas/evidence/polish/scroll.json` exists.

Fix issues found. Log phase complete.

---

## Phase 4: Scoped Evolution [MANDATORY — do not skip]

Assess remaining work within seed's `scope_in`. Reject `scope_out` features.
Spawn agents as needed for improvements.

**Nova final briefing is MANDATORY:**
```
Agent(agent: "nova", prompt: "Final product review. Read all evidence. Deliver strategic summary and recommendations. Write to .geas/evidence/evolution/nova-final.json")
```

**Keeper release management:**
```
Agent(agent: "keeper", prompt: "Create release: version bump, changelog, final commit. Write to .geas/evidence/evolution/keeper-release.json")
```

Invoke `/geas:run-summary` to generate session audit trail.

Close out. Log: `{"event": "phase_complete", "phase": "complete", "timestamp": "<actual>"}`
