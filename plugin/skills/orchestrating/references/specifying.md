# Specifying Phase

Always runs. Scale adapts to the request.

## Always Run

### Seed Check
- `.geas/spec/mission-{mission_id}.json` should exist from intake. If not, invoke `/geas:intake`.
- If completeness_checklist has any false values and no override: ask the user, re-run intake.

### Onboard Check
If `.geas/memory/_project/conventions.md` is missing, invoke `/geas:onboard` to scan the existing project before proceeding.

### Compile TaskContracts
- Use `.geas/spec/stories.md` as input (if it exists from PRD step). If stories.md does not exist, compile directly from the current mission spec's user stories or feature description.
- For each user story, invoke `/geas:task-compiler`.
- Each TaskContract MUST include a `rubric` object with a `dimensions` array. Base dimensions: core_interaction(3), feature_completeness(4), code_quality(4), regression_safety(4). Add ux_clarity(3), visual_coherence(3) for frontend tasks.
- Log each: `{"event": "task_compiled", "task_id": "...", "timestamp": "<actual>"}`

### Close Specifying

**Phase review** — verify gate criteria for specifying -> building:
- Mission brief exists (mission-{mission_id}.json)
- scope_in defined
- Initial tasks compiled

Write `.geas/evolution/phase-review-specifying-to-building.json` conforming to `schemas/phase-review.schema.json`:
```json
{
  "version": "1.0",
  "artifact_type": "phase_review",
  "artifact_id": "pr-specifying",
  "producer_type": "orchestration_authority",
  "mission_phase": "specifying",
  "status": "ready_to_exit",
  "summary": "<specifying outcomes>",
  "gate_criteria_met": ["mission brief exists", "scope_in defined", "tasks compiled"],
  "gate_criteria_unmet": [],
  "risk_notes": [],
  "next_phase": "building",
  "created_at": "<ISO 8601>"
}
```

If any gate criteria unmet: set `status: "blocked"`, list unmet criteria in `gate_criteria_unmet`. Do not proceed until resolved. After 3 consecutive transition failures -> invoke `/geas:decision`.

- Update run state: `{ "phase": "building", "status": "in_progress" }`
- Log: `{"event": "phase_complete", "phase": "specifying", "timestamp": "<actual>"}`

## Conditional (orchestrator judges based on seed complexity)

### Vision (product-authority)
**Skip if** seed describes a single well-defined feature with clear acceptance criteria.

```
Agent(agent: "product-authority", prompt: "Then read .geas/spec/mission-{mission_id}.json (read mission_id from run.json). Deliver vision, MVP scope, user value proposition. Write to .geas/evidence/specifying/product-authority.json")
```
Verify `.geas/evidence/specifying/product-authority.json` exists.

### PRD & User Stories (product-authority)
**Skip if** scope is 1-2 tasks (seed already specific enough to compile directly).

```
Agent(agent: "product-authority", prompt: "Read .geas/spec/mission-{mission_id}.json (read mission_id from run.json) and .geas/evidence/specifying/product-authority.json. Create a PRD using write-prd skill, save to .geas/spec/prd.md. Then break it into user stories using write-stories skill, save to .geas/spec/stories.md.")
```
Verify both `.geas/spec/prd.md` and `.geas/spec/stories.md` exist.

### Architecture (architecture-authority) + Vote Round
**Skip if** existing project with conventions.md AND no new external services/libs AND single module scope.
**Always run if**: new project, new architecture patterns, cross-module changes.

```
Agent(agent: "architecture-authority", prompt: "Then read .geas/spec/mission-{mission_id}.json (read mission_id from run.json), .geas/evidence/specifying/product-authority.json, and .geas/spec/prd.md. Propose architecture and tech stack. Write conventions to .geas/memory/_project/conventions.md and evidence to .geas/evidence/specifying/architecture-authority.json")
```
Verify evidence exists. Write DecisionRecord to `.geas/decisions/dec-001.json`.

Invoke `/geas:vote-round` with:
- Proposal: `.geas/evidence/specifying/architecture-authority.json`
- Voters: backend-engineer, ui-ux-designer, critical-reviewer
- Output: `.geas/evidence/specifying/vote-{agent}.json`

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

### Stack-Specific Rules

After architecture decisions are finalized, add stack-specific rules to `.geas/rules.md`. This happens before the Building phase begins (before the rules-update workflow exists in the pipeline).

Examples:
- If React: "All components must be functional components with hooks"
- If REST API: "All endpoints must return consistent error shapes"
- If Python: "Use type hints for all public function signatures"

Read the architecture decision from `.geas/evidence/specifying/architecture-authority.json` and `.geas/memory/_project/conventions.md` to determine which rules to add. Append to the existing `.geas/rules.md` under a `## Stack Rules` section.
