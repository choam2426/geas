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

### 1.2 Linear Bootstrap (if enabled)
- Check `.geas/config.json` for `linear_enabled`.
- If enabled: create project, milestones (Genesis, MVP, Polish, Evolution), discover IDs.
- Save to `.geas/memory/_project/linear-config.json`.
- **Update `.geas/rules.md`**: set Linear section `enabled` to true, fill in linear-cli path and team/project IDs with actual values.

### 1.3 Vision (Nova)
```
Agent(agent: "nova", prompt: "Then read .geas/spec/seed.json. Deliver vision, MVP scope, user value proposition. Write to .geas/evidence/genesis/nova.json")
```
Verify `.geas/evidence/genesis/nova.json` exists.

### 1.4 PRD & User Stories (Nova)
```
Agent(agent: "nova", prompt: "Read .geas/spec/seed.json and .geas/evidence/genesis/nova.json. Create a PRD using write-prd skill, save to .geas/spec/prd.md. Then break it into user stories using write-stories skill, save to .geas/spec/stories.md.")
```
Verify both `.geas/spec/prd.md` and `.geas/spec/stories.md` exist.

### 1.5 Architecture (Forge)
```
Agent(agent: "forge", prompt: "Then read .geas/spec/seed.json, .geas/evidence/genesis/nova.json, and .geas/spec/prd.md. Propose architecture and tech stack. Write conventions to .geas/memory/_project/conventions.md and evidence to .geas/evidence/genesis/forge.json")
```
Verify evidence exists. Write DecisionRecord to `.geas/decisions/dec-001.json`.

### 1.6 Vote Round
```
Agent(agent: "circuit", prompt: "Read .geas/evidence/genesis/forge.json. Vote agree/disagree with rationale. Write to .geas/evidence/genesis/vote-circuit.json")
Agent(agent: "palette", prompt: "Read .geas/evidence/genesis/forge.json. Vote agree/disagree with rationale. Write to .geas/evidence/genesis/vote-palette.json")
Agent(agent: "critic", prompt: "Read .geas/evidence/genesis/forge.json. Play devil's advocate: identify risks, blind spots, and trade-offs even if you agree overall. Vote agree/disagree with rationale. Write to .geas/evidence/genesis/vote-critic.json")
```
Critic MUST participate in every vote round. If all agree: proceed. If any disagree: run debate, then re-vote.

### 1.7 Compile TaskContracts
- Use `.geas/spec/stories.md` as input. For each user story, invoke `/geas:task-compiler`.
- If Linear enabled: create issues, store IDs in TaskContracts.
- Log each: `{"event": "task_compiled", "task_id": "...", "timestamp": "<actual>"}`

### 1.8 MCP Server Recommendations

Analyze the tech stack from Forge's architecture decision and recommend helpful MCP servers to the user.

| Detected | Recommended MCP | Install command | Reason |
|----------|----------------|-----------------|--------|
| PostgreSQL | PostgreSQL MCP | `claude mcp add postgres -- npx -y @modelcontextprotocol/server-postgres <connection-string>` | Circuit can query schemas directly |
| MongoDB | MongoDB MCP | `claude mcp add mongodb -- npx -y mongodb-mcp-server --readOnly` | Circuit can explore collections |
| Web frontend | MDN MCP | `claude mcp add --transport http mdn https://mcp.mdn.mozilla.net/` | Pixel can reference web standards |
| Has deploy target | Lighthouse MCP | `claude mcp add lighthouse -- npx -y @anthropic/lighthouse-mcp` | Sentinel can audit performance/a11y |
| GitHub hosted | GitHub MCP | `claude mcp add --transport http github https://mcp.github.com/anthropic` | Keeper can manage PRs/issues |

Recommendation format:
```
Recommended MCP servers for your tech stack:
- [PostgreSQL MCP] → Circuit can query DB schemas directly
  Install: claude mcp add postgres -- npx -y @modelcontextprotocol/server-postgres <connection-string>

Would you like to connect? (optional, you can proceed without them)
```

If the user connects, record in `.geas/config.json` under `connected_mcp`.

### 1.9 Close Genesis
- Update run state: `{ "phase": "mvp", "status": "in_progress" }`
- Log: `{"event": "phase_complete", "phase": "genesis", "timestamp": "<actual>"}`

---

## Phase 2: MVP Build

**Every task runs the full pipeline. Code Review and Testing are mandatory for every task.**

For **each** TaskContract in `.geas/tasks/` (ordered by dependencies):

### 2.0 Start Task
- Read TaskContract. Check dependencies are `"passed"`.
- Update status to `"in_progress"`. Log `task_started` event.

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

### 2.3 Implementation [MANDATORY — worktree isolated]
Generate ContextPacket, then:
Update run.json checkpoint: `pipeline_step` = "implementation", `agent_in_flight` = "{worker}"
```
Agent(agent: "{worker}", isolation: "worktree", prompt: "Read .geas/packets/{task-id}/{worker}.md. Implement the feature. Write evidence to .geas/evidence/{task-id}/{worker}.json")
```
Verify evidence exists. Merge worktree branch.

### 2.4 Code Review (Forge) [MANDATORY]
Generate ContextPacket, then:
Update run.json checkpoint: `pipeline_step` = "code_review", `agent_in_flight` = "forge"
```
Agent(agent: "forge", prompt: "Read .geas/packets/{task-id}/forge-review.md. Review implementation. Write to .geas/evidence/{task-id}/forge-review.json")
```
Verify `.geas/evidence/{task-id}/forge-review.json` exists.

### 2.5 Testing (Sentinel) [MANDATORY]
Generate ContextPacket, then:
Update run.json checkpoint: `pipeline_step` = "testing", `agent_in_flight` = "sentinel"
```
Agent(agent: "sentinel", prompt: "Read .geas/packets/{task-id}/sentinel.md. Test the feature. Write QA results to .geas/evidence/{task-id}/sentinel.json")
```
Verify `.geas/evidence/{task-id}/sentinel.json` exists.

### 2.6 Evidence Gate
Run eval_commands from TaskContract. Check acceptance criteria against all evidence.
Log detailed result with tier breakdown.
If fail → invoke `/geas:verify-fix-loop`. **Spawn the worker agent to fix.** After fix, re-run gate.

### 2.7 Critic Pre-ship Review [MANDATORY]
Update run.json checkpoint: `pipeline_step` = "critic_review", `agent_in_flight` = "critic"
```
Agent(agent: "critic", prompt: "Read all evidence at .geas/evidence/{task-id}/. Challenge: is this truly ready to ship? Identify risks, missing edge cases, or technical debt. Write to .geas/evidence/{task-id}/critic-review.json")
```

### 2.8 Nova Product Review [MANDATORY]
Update run.json checkpoint: `pipeline_step` = "nova_review", `agent_in_flight` = "nova"
```
Agent(agent: "nova", prompt: "Read all evidence at .geas/evidence/{task-id}/ including critic-review.json. Verdict: Ship, Iterate, or Cut. Write to .geas/evidence/{task-id}/nova-verdict.json")
```

### 2.9 Ship Gate — verify before marking passed
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

### 2.10 Resolve
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
