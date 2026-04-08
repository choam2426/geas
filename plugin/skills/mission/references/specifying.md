# Specifying Phase

Always runs. Scale adapts to the request.

## Always Run

### 1. Seed Check

- `.geas/missions/{mission_id}/spec.json` should exist from intake (read `mission_id` from `run.json`).
- If not, invoke `/geas:intake`.
- If `completeness_checklist` has any false values and no override: ask the user, re-run intake.

### 2. Onboard Check

If `.geas/memory/_project/conventions.md` is missing, invoke `/geas:setup` to scan the existing project before proceeding.

### 3. Design Brief

#### 3a. Draft

Orchestrator reads the mission spec at `.geas/missions/{mission_id}/spec.json` and explores the codebase. Then:

Ensure the mission directory exists (the CLI creates all subdirectories automatically):
```bash
Bash("geas mission create --id {mission_id}")
```

1. Write an initial design-brief draft via CLI with schema validation:
   ```bash
   Bash("geas mission write-brief --id {mission_id} --data '<design_brief_json>'")
   ```
   The brief must conform to `schemas/design-brief.schema.json` with `status: "draft"`.
2. Propose a mission mode to the user:
   - **`lightweight`**: Mission has clear scope, existing patterns apply, low ambiguity. Only minimum fields: `chosen_approach`, `non_goals`, `verification_strategy`.
   - **`standard`**: Mission has moderate scope, some architectural decisions, normal risk. Adds: `architecture_decisions`, `risks`, `preserve_list`.
   - **`full_depth`**: Mission has multiple valid approaches, cross-module impact, or significant risk. Adds: `alternatives_considered`, `unresolved_assumptions`. Requires vote round.
3. User confirms or overrides the mission mode.
4. If user selects `standard` or `full_depth`: populate the additional fields before proceeding.

#### 3b. Design Review (always)

Resolve the design-authority slot via profiles.json. Spawn the resolved agent to review and enrich the design-brief:

```
Agent(agent: "{resolved-design-authority}", prompt: "Read the design-brief at .geas/missions/{mission_id}/design-brief.json and the mission spec at .geas/missions/{mission_id}/spec.json. Review the design brief: verify the chosen approach is sound, check for missing risks or concerns, and add any necessary architecture decisions. If the project requires stack-specific rules, add them to .geas/rules.md under a '## Stack Rules' section. Update the design-brief: populate the design_review field with your review summary and any additions you made. Write the updated design-brief via CLI. Run: geas mission write-brief --id {mission_id} --data '<updated_design_brief_json>' with status: 'reviewing'.")
```

Verify: Read `.geas/missions/{mission_id}/design-brief.json` and confirm `design_review` is populated.

Log: `{"event": "step_complete", "step": "design_brief_design_review", "agent": "{resolved-design-authority}", "timestamp": "<actual>"}`

#### 3c. Vote Round (full_depth only)

**Skip if** mission mode is `lightweight` or `standard`.

Invoke `/geas:vote-round` as a `proposal_round`:
- Proposal: `.geas/missions/{mission_id}/design-brief.json`
- Voters: orchestrator selects based on design-brief content. Minimum quorum: design-authority + 1 specialist (per doc 05 proposal_round rules).
  - Implementation work → include relevant implementer (resolved via profiles.json)
  - High risk → include `challenger`
- Output: vote-round artifact in `.geas/missions/{mission_id}/decisions/`
- Record `vote_round_ref` in the design-brief.

If any disagree: invoke `/geas:vote-round`, then re-vote.

#### 3d. User Approval

Present a structured design brief to the user:

```
═══════════════════════════════════════════════════
  DESIGN BRIEF — {mission_id}
  Mode: {lightweight | standard | full_depth}
═══════════════════════════════════════════════════

─── APPROACH ──────────────────────────────────────

  {chosen_approach — what we're building and why this way}

─── NON-GOALS ─────────────────────────────────────

  • {what this mission explicitly will NOT do}
  • ...

─── VERIFICATION STRATEGY ─────────────────────────

  {how we'll verify the work is complete and correct}

─── ARCHITECTURE DECISIONS ──────── [standard+] ───

  1. {decision}
     → Rationale: {why}
     → Constraints: {if any}
  2. ...

─── RISKS & MITIGATIONS ────────── [standard+] ───

  1. {risk description}
     → Mitigation: {how we handle it}
  2. ...

─── PRESERVE LIST ──────────────── [standard+] ───

  • {existing behavior/files that must not change}
  • ...

─── ALTERNATIVES CONSIDERED ────── [full_depth] ───

  A. {approach}
     → Rejected because: {reason}
  B. ...

─── UNRESOLVED ASSUMPTIONS ─────── [full_depth] ───

  • {assumption not yet validated}
  • ...

─── DESIGN REVIEW ─────────────────────────────────

  Reviewer: {design-authority}
  Summary: {review findings}
  Additions: {what the reviewer added or changed}

─── VOTE ROUND ─────────────────── [full_depth] ───

  Result: {ship | iterate | escalate}
  Participants: {list}
  Dissent: {if any}

═══════════════════════════════════════════════════
```

Omit sections marked `[standard+]` for lightweight missions. Omit sections marked `[full_depth]` for lightweight and standard missions.

**If approved**: update design-brief `status` to `"approved"`, set `approved_at`.

**If rejected**:
1. Record the rejection reason in `rejection_history[]` with timestamp
2. Revise the design-brief based on user feedback
3. Return to step 3b (design-authority re-reviews the revised version)
4. [full_depth only] Run a new vote round (step 3c)
5. Present to user again (step 3d)

### 4. Compile TaskContracts

- Input: mission spec (`.geas/missions/{mission_id}/spec.json`) + approved design-brief (`.geas/missions/{mission_id}/design-brief.json`)
- For each logical unit of work, invoke `/geas:task-compiler`.
- Each TaskContract MUST include a `rubric` object with a `dimensions` array. Base dimensions: core_interaction(3), feature_completeness(4), output_quality(4), regression_safety(4). Add ux_clarity(3), visual_coherence(3) for frontend tasks.
- Output: `.geas/missions/{mission_id}/tasks/{task-id}.json`
- Log each: `{"event": "task_compiled", "task_id": "...", "timestamp": "<actual>"}`

### 5. Task List User Approval

Present a structured task list to the user:

```
═══════════════════════════════════════════════════
  TASK LIST — {mission_id} ({N} tasks)
═══════════════════════════════════════════════════

─── EXECUTION ORDER ───────────────────────────────

  {task-001} → {task-002} → {task-003}
                          ↘ {task-004} (parallel OK)

─── TASK DETAILS ──────────────────────────────────

  ┌ {task-001}: {title}
  │ Kind:       {task_kind}
  │ Risk:       {risk_level}
  │ Worker:     {primary_worker_type (slot)} → {concrete agent}
  │ Reviewers:  {required_reviewer_types (slots)}
  │ Gate:       {gate_profile}
  │ Vote:       {vote_round_policy}
  │ Goal:       {goal — what this task accomplishes}
  │ Criteria:
  │   1. {acceptance criterion}
  │   2. {acceptance criterion}
  │   3. ...
  │ Surfaces:   {scope.surfaces — what areas are affected}
  │ Depends on: {dependencies, or "none"}
  └─────────────────────────────────────────────

  ┌ {task-002}: {title}
  │ ...
  └─────────────────────────────────────────────

─── SUMMARY ───────────────────────────────────────

  Total:        {N} tasks
  Risk profile: {X low, Y normal, Z high}
  Parallelizable: {list of tasks that can run in parallel}
  Estimated review slots: {which specialist slots will be active}

═══════════════════════════════════════════════════
```

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
- Design-brief approved (`status: "approved"` AND `design_review` exists in `.geas/missions/{mission_id}/design-brief.json`)
- Tasks compiled (at least 1 task in `.geas/missions/{mission_id}/tasks/` for this mission)
- Task list approved (`task_list_approved` event in ledger for this mission)
- Environment setup completed (`environment_setup_complete` event in ledger for this mission)

Write the phase review via CLI with schema validation:
```bash
Bash("geas phase write --mission {mission_id} --data '<phase_review_json>'")
```
The phase review must conform to `schemas/phase-review.schema.json`:
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

If any gate criteria unmet: set `status: "blocked"`, list unmet criteria in `gate_criteria_unmet`. Do not proceed until resolved. After 3 consecutive transition failures -> invoke `/geas:vote-round`.

- Update run state:
  ```bash
  Bash("geas state update --field phase --value building")
  Bash("geas state update --field status --value in_progress")
  ```
- Log: `Bash("geas event log --type phase_complete --data '{\"phase\":\"specifying\"}'")` 
