# Discovery Phase

Always runs. Scale adapts to the request.

## Always Run

### Seed Check
- `.geas/spec/seed.json` should exist from intake. If not, invoke `/geas:intake`.
- If completeness_checklist has any false values and no override: ask the user, re-run intake.

### Onboard Check
If `.geas/memory/_project/conventions.md` is missing, invoke `/geas:onboard` to scan the existing project before proceeding.

### Compile TaskContracts
- Use `.geas/spec/stories.md` as input (if it exists from PRD step). If stories.md does not exist, compile directly from seed.json user stories or feature description.
- For each user story, invoke `/geas:task-compiler`.
- Each TaskContract MUST include a `rubric` object with a `dimensions` array. Base dimensions: core_interaction(3), feature_completeness(4), code_quality(4), regression_safety(4). Add ux_clarity(3), visual_coherence(3) for frontend tasks.
- Log each: `{"event": "task_compiled", "task_id": "...", "timestamp": "<actual>"}`

### Close Discovery

**Phase review** — verify gate criteria for discovery -> build:
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

If any gate criteria unmet: set `status: "blocked"`, list unmet criteria in `gate_criteria_unmet`. Do not proceed until resolved. After 3 consecutive transition failures -> enter decision mode.

- Update run state: `{ "phase": "build", "status": "in_progress" }`
- Log: `{"event": "phase_complete", "phase": "discovery", "timestamp": "<actual>"}`

## Conditional (orchestrator judges based on seed complexity)

### Vision (product-authority)
**Skip if** seed describes a single well-defined feature with clear acceptance criteria.

```
Agent(agent: "product-authority", prompt: "Then read .geas/spec/seed.json. Deliver vision, MVP scope, user value proposition. Write to .geas/evidence/discovery/product-authority.json")
```
Verify `.geas/evidence/discovery/product-authority.json` exists.

### PRD & User Stories (product-authority)
**Skip if** scope is 1-2 tasks (seed already specific enough to compile directly).

```
Agent(agent: "product-authority", prompt: "Read .geas/spec/seed.json and .geas/evidence/discovery/product-authority.json. Create a PRD using write-prd skill, save to .geas/spec/prd.md. Then break it into user stories using write-stories skill, save to .geas/spec/stories.md.")
```
Verify both `.geas/spec/prd.md` and `.geas/spec/stories.md` exist.

### Architecture (architecture-authority) + Vote Round
**Skip if** existing project with conventions.md AND no new external services/libs AND single module scope.
**Always run if**: new project, new architecture patterns, cross-module changes.

```
Agent(agent: "architecture-authority", prompt: "Then read .geas/spec/seed.json, .geas/evidence/discovery/product-authority.json, and .geas/spec/prd.md. Propose architecture and tech stack. Write conventions to .geas/memory/_project/conventions.md and evidence to .geas/evidence/discovery/architecture-authority.json")
```
Verify evidence exists. Write DecisionRecord to `.geas/decisions/dec-001.json`.

Invoke `/geas:vote-round` with:
- Proposal: `.geas/evidence/discovery/architecture-authority.json`
- Voters: backend-engineer, ui-ux-designer, critical-reviewer
- Output: `.geas/evidence/discovery/vote-{agent}.json`

If all agree: proceed. If any disagree: `/geas:decision` runs, then re-vote.
Verify all vote files exist before continuing.

### MCP Server Recommendations
**Skip if** existing project (already configured).

Analyze the tech stack from architecture_authority's architecture decision and recommend helpful MCP servers to the user. Match by category, not by specific tool name:

| Stack category | MCP category | Reason |
|---------------|--------------|--------|
| Relational database | Database query MCP | Workers can inspect schemas and run read-only queries |
| Document database | Database query MCP | Workers can explore collections |
| Web frontend | Web standards MCP | Workers can reference specification docs |
| Has deploy target | Performance audit MCP | qa_engineer can audit performance and accessibility |
| Git-hosted | Git platform MCP | repository_manager can manage PRs and issues |

Present recommendations with install commands from the MCP registry.
