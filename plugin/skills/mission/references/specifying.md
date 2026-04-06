# Specifying Phase

Always runs. Scale adapts to the request.

## Always Run

### 1. Seed Check

- `.geas/missions/{mission_id}/spec.json` should exist from intake (read `mission_id` from `run.json`).
- If not, invoke `/geas:intake`.
- If `completeness_checklist` has any false values and no override: ask the user, re-run intake.

### 2. Onboard Check

If `.geas/memory/_project/conventions.md` is missing, invoke `/geas:onboard` to scan the existing project before proceeding.

### 3. Design Brief

#### 3a. Draft

Orchestrator reads the mission spec at `.geas/missions/{mission_id}/spec.json` and explores the codebase. Then:

Ensure the mission directory exists:
```bash
mkdir -p .geas/missions/{mission_id}
```

1. Write an initial design-brief draft to `.geas/missions/{mission_id}/design-brief.json` conforming to `schemas/design-brief.schema.json` with `status: "draft"`.
2. Propose a depth level to the user:
   - **`lightweight`**: Mission has clear scope, existing codebase patterns apply, low ambiguity. Only minimum fields: `chosen_approach`, `non_goals`, `verification_strategy`.
   - **`full`**: Mission has architectural decisions, multiple valid approaches, cross-module impact, or significant risk. Adds: `alternatives_considered`, `architecture_decisions`, `risks`, `preserve_list`, `unresolved_assumptions`.
3. User confirms or overrides the depth level.
4. If user overrides to `full`: populate the additional fields before proceeding.

#### 3b. Architecture Review (always)

Resolve the design-authority slot via profiles.json. Spawn the resolved agent to review and enrich the design-brief:

```
Agent(agent: "{resolved-design-authority}", prompt: "Read the design-brief at .geas/missions/{mission_id}/design-brief.json and the mission spec at .geas/missions/{mission_id}/spec.json. Review the design brief: verify the chosen approach is sound, check for missing risks or concerns, and add any necessary architecture decisions. If the project requires stack-specific rules, add them to .geas/rules.md under a '## Stack Rules' section. Update the design-brief: populate the arch_review field with your review summary and any additions you made. Write the updated design-brief back to .geas/missions/{mission_id}/design-brief.json with status: 'reviewing'.")
```

Verify: Read `.geas/missions/{mission_id}/design-brief.json` and confirm `arch_review` is populated.

Log: `{"event": "step_complete", "step": "design_brief_arch_review", "agent": "{resolved-design-authority}", "timestamp": "<actual>"}`

#### 3c. Vote Round (full depth only)

**Skip if** `depth` is `lightweight`.

Invoke `/geas:vote-round` as a `proposal_round`:
- Proposal: `.geas/missions/{mission_id}/design-brief.json`
- Voters: orchestrator selects based on design-brief content. Minimum quorum: design-authority + 1 specialist (per doc 05 proposal_round rules).
  - Implementation work → include relevant implementer (resolved via profiles.json)
  - High risk → include `challenger`
- Output: vote-round artifact in `.geas/missions/{mission_id}/decisions/`
- Record `vote_round_ref` in the design-brief.

If any disagree: invoke `/geas:decision`, then re-vote.

#### 3d. User Approval

Present the design-brief to the user. Show:
- Chosen approach and rationale
- Non-goals
- Verification strategy
- [Full] Alternatives considered and why rejected
- [Full] Architecture decisions
- [Full] Risks and mitigations
- Architecture-authority review summary
- [Full] Vote round result

**If approved**: update design-brief `status` to `"approved"`, set `approved_at`.

**If rejected**:
1. Record the rejection reason in `rejection_history[]` with timestamp
2. Revise the design-brief based on user feedback
3. Return to step 3b (design-authority re-reviews the revised version)
4. [Full only] Run a new vote round (step 3c)
5. Present to user again (step 3d)

### 4. Compile TaskContracts

- Input: mission spec (`.geas/missions/{mission_id}/spec.json`) + approved design-brief (`.geas/missions/{mission_id}/design-brief.json`)
- For each logical unit of work, invoke `/geas:task-compiler`.
- Each TaskContract MUST include a `rubric` object with a `dimensions` array. Base dimensions: core_interaction(3), feature_completeness(4), code_quality(4), regression_safety(4). Add ux_clarity(3), visual_coherence(3) for frontend tasks.
- Output: `.geas/missions/{mission_id}/tasks/{task-id}.json`
- Log each: `{"event": "task_compiled", "task_id": "...", "timestamp": "<actual>"}`

### 5. Task List User Approval

Present the compiled task list to the user:
- Task ID, title, goal
- Dependencies between tasks
- Suggested execution order
- Risk level per task

**If approved**: log `{"event": "task_list_approved", "mission_id": "...", "task_count": N, "timestamp": "<actual>"}`

**If rejected**: take user feedback, adjust tasks (re-compile, split, merge, reorder), then re-present.

### 6. Environment Setup

Orchestrator analyzes the design-brief and task contracts to identify required environment dependencies:
- Runtimes/languages (e.g., Node.js, Go, Python)
- External services (e.g., PostgreSQL, Redis)
- MCP servers relevant to the tech stack
- Package manager initialization
- Other required tooling

Present a checklist to the user:
- **Auto-installable items**: execute with user consent
- **Manual items**: provide clear instructions for the user to follow

After all items are resolved:
- Log `{"event": "environment_setup_complete", "mission_id": "...", "items": [...], "timestamp": "<actual>"}`

If no dependencies are needed:
- Log `{"event": "environment_setup_complete", "mission_id": "...", "items": [], "timestamp": "<actual>"}`

### 7. Close Specifying

**Phase review** — verify gate criteria for specifying -> building.

All conditions must be true:
- Mission spec frozen (`.geas/missions/{mission_id}/spec.json` exists)
- Design-brief approved (`status: "approved"` AND `arch_review` exists in `.geas/missions/{mission_id}/design-brief.json`)
- Tasks compiled (at least 1 task in `.geas/missions/{mission_id}/tasks/` for this mission)
- Task list approved (`task_list_approved` event in ledger for this mission)
- Environment setup completed (`environment_setup_complete` event in ledger for this mission)

Write `.geas/missions/{mission_id}/phase-reviews/specifying-to-building.json` conforming to `schemas/phase-review.schema.json`:
```json
{
  "version": "1.0",
  "artifact_type": "phase_review",
  "artifact_id": "pr-specifying-{mission_id}",
  "producer_type": "orchestration_authority",
  "mission_phase": "specifying",
  "status": "ready_to_exit",
  "summary": "<specifying outcomes>",
  "gate_criteria_met": [
    "mission spec frozen",
    "design-brief approved",
    "tasks compiled",
    "task list approved",
    "environment setup completed"
  ],
  "gate_criteria_unmet": [],
  "risk_notes": [],
  "next_phase": "building",
  "created_at": "<ISO 8601>"
}
```

If any gate criteria unmet: set `status: "blocked"`, list unmet criteria in `gate_criteria_unmet`. Do not proceed until resolved. After 3 consecutive transition failures -> invoke `/geas:decision`.

- Update run state: `{ "phase": "building", "status": "in_progress" }`
- Log: `{"event": "phase_complete", "phase": "specifying", "timestamp": "<actual>"}`
