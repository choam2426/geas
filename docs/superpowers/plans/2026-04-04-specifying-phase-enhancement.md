# Specifying Phase Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the Specifying phase with a design-brief artifact, user approval gates, and environment setup — eliminating legacy PRD/Stories/Vision steps.

**Architecture:** New design-brief artifact sits between mission spec (WHAT/WHY) and task contracts (UNIT OF WORK). Orchestrator drafts, architecture-authority reviews, user approves. design-brief uses new `.geas/missions/{id}/` path; mission spec and tasks stay at existing paths to avoid cascading changes to context-packet, evolving, polishing, and ledger-query skills. Full path migration is a separate future mission.

**Tech Stack:** JSON Schema draft 2020-12, Markdown skill files, protocol documents.

**Spec:** `docs/superpowers/specs/2026-04-04-specifying-phase-enhancement-design.md`

---

### Task 1: Create design-brief schema

**Files:**
- Create: `docs/protocol/schemas/design-brief.schema.json`
- Create: `plugin/skills/orchestrating/schemas/design-brief.schema.json`

- [ ] **Step 1: Create protocol canonical schema**

Write `docs/protocol/schemas/design-brief.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "DesignBrief",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "version",
    "artifact_type",
    "artifact_id",
    "producer_type",
    "mission_id",
    "depth",
    "status",
    "chosen_approach",
    "non_goals",
    "verification_strategy",
    "created_at"
  ],
  "properties": {
    "version": {
      "type": "string",
      "const": "1.0"
    },
    "artifact_type": {
      "type": "string",
      "const": "design_brief"
    },
    "artifact_id": {
      "type": "string",
      "description": "e.g., design-brief-mission-003"
    },
    "producer_type": {
      "type": "string",
      "description": "orchestration_authority"
    },
    "mission_id": {
      "type": "string"
    },
    "depth": {
      "type": "string",
      "enum": ["lightweight", "full"]
    },
    "status": {
      "type": "string",
      "enum": ["draft", "reviewing", "approved"]
    },
    "chosen_approach": {
      "type": "string",
      "minLength": 1,
      "description": "Selected implementation direction and rationale"
    },
    "non_goals": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1,
      "description": "What this mission explicitly will not do"
    },
    "verification_strategy": {
      "type": "string",
      "minLength": 1,
      "description": "How completion will be verified"
    },
    "alternatives_considered": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["approach", "rejected_reason"],
        "additionalProperties": false,
        "properties": {
          "approach": { "type": "string" },
          "rejected_reason": { "type": "string" }
        }
      },
      "description": "Full depth only. Other approaches and why they were rejected."
    },
    "architecture_decisions": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["decision", "rationale"],
        "additionalProperties": false,
        "properties": {
          "decision": { "type": "string" },
          "rationale": { "type": "string" },
          "constraints": {
            "type": "array",
            "items": { "type": "string" }
          }
        }
      },
      "description": "Full depth only. Technical decisions with rationale."
    },
    "risks": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["description", "mitigation"],
        "additionalProperties": false,
        "properties": {
          "description": { "type": "string" },
          "mitigation": { "type": "string" }
        }
      },
      "description": "Full depth only. Identified risks with mitigation plans."
    },
    "preserve_list": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Full depth only. Existing behavior/files that must not change."
    },
    "unresolved_assumptions": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Full depth only. Assumptions not yet validated."
    },
    "arch_review": {
      "type": "object",
      "required": ["reviewer_type", "summary"],
      "additionalProperties": false,
      "properties": {
        "reviewer_type": {
          "type": "string",
          "const": "architecture_authority"
        },
        "summary": {
          "type": "string",
          "description": "Review summary from architecture-authority"
        },
        "additions": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Items added or modified by the reviewer"
        }
      }
    },
    "vote_round_ref": {
      "type": ["string", "null"],
      "description": "Path to vote round artifact, or null if no vote"
    },
    "rejection_history": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["reason", "revision_summary", "rejected_at"],
        "additionalProperties": false,
        "properties": {
          "reason": { "type": "string" },
          "revision_summary": { "type": "string" },
          "rejected_at": { "type": "string" }
        }
      },
      "description": "Record of user rejections and subsequent revisions"
    },
    "created_at": {
      "type": "string",
      "description": "ISO 8601 timestamp"
    },
    "approved_at": {
      "type": ["string", "null"],
      "description": "ISO 8601 timestamp when user approved, or null"
    }
  }
}
```

- [ ] **Step 2: Copy to skill-local schemas**

Copy the exact same file to `plugin/skills/orchestrating/schemas/design-brief.schema.json`. This is the runtime copy per the Runtime Accessibility Rule — skills cannot access `docs/protocol/schemas/` at runtime.

- [ ] **Step 3: Verify schema count**

Run: `ls docs/protocol/schemas/*.json | wc -l`
Expected: 30 (was 29 + 1 new)

Run: `ls plugin/skills/orchestrating/schemas/*.json | wc -l`
Expected: 10 (was 9 + 1 new)

- [ ] **Step 4: Commit**

```bash
git add docs/protocol/schemas/design-brief.schema.json plugin/skills/orchestrating/schemas/design-brief.schema.json
git commit -m "feat(schema): add design-brief.schema.json for Specifying phase enhancement"
```

---

### Task 2: Update protocol doc 02 — gate 1 and deliverables

**Files:**
- Modify: `docs/protocol/02_MODES_MISSIONS_AND_RUNTIME.md:34-62`

- [ ] **Step 1: Update gate 1 definition**

In `docs/protocol/02_MODES_MISSIONS_AND_RUNTIME.md`, find the gate 1 line in the Phase Flow diagram (around line 37):

Replace:
```
gate 1: mission brief + scope_in + initial tasks exist
```

With:
```
gate 1: mission frozen + design-brief approved + tasks compiled + task list approved + environment setup completed
```

- [ ] **Step 2: Update Specifying phase goals**

Find the `### 1) specifying` section (around line 50). Replace the Goals and Required deliverables:

Replace:
```markdown
Goals:
- Finalize the mission definition
- Produce the MVP scope_in
- Settle architecture / conventions decisions
- Compile the initial backlog

Required deliverables:
- mission brief
- `scope_in`
- decision records
- initial tasks
- conventions / project memory seed
```

With:
```markdown
Goals:
- Finalize the mission definition
- Produce a user-approved design-brief (HOW decisions)
- Settle architecture / conventions decisions
- Compile and approve the initial backlog
- Set up the development environment

Required deliverables:
- mission spec (frozen)
- design-brief (user-approved, architecture-authority reviewed)
- decision records (from design-brief architecture_decisions, when applicable)
- initial tasks (user-approved)
- conventions / project memory seed
- environment setup (when applicable)
```

- [ ] **Step 3: Update phase review artifact table**

Find the phase review required artifacts table (around line 140). The `specifying -> building` row currently says "(phase-review.json recommended, not required)".

Replace:
```
| `specifying` -> `building` | (phase-review.json recommended, not required) |
```

With:
```
| `specifying` -> `building` | `phase-review.json` (required: mission frozen, design-brief approved, tasks compiled, task list approved, environment setup completed) |
```

- [ ] **Step 4: Verify no stale references**

Run: `grep -n "PRD\|stories\.md\|Vision" docs/protocol/02_MODES_MISSIONS_AND_RUNTIME.md`
Expected: no output (these terms should not appear in protocol docs)

- [ ] **Step 5: Commit**

```bash
git add docs/protocol/02_MODES_MISSIONS_AND_RUNTIME.md
git commit -m "docs(protocol): update doc 02 gate 1 criteria and Specifying deliverables"
```

---

### Task 3: Update protocol doc 05 — vote round clarification

**Files:**
- Modify: `docs/protocol/05_GATE_VOTE_AND_FINAL_VERDICT.md:134-138`

- [ ] **Step 1: Add design-brief vote round clarification**

Find the `### proposal_round` section, specifically the "When to use" list (around line 136). Currently:

```markdown
When to use:
- Cross-cutting proposals during the specifying phase
- Major design/API boundary decisions during the building phase
```

Replace with:

```markdown
When to use:
- Design-brief approval during the specifying phase (mandatory for full-depth, skipped for lightweight)
- Cross-cutting proposals during the specifying phase
- Major design/API boundary decisions during the building phase
```

- [ ] **Step 2: Commit**

```bash
git add docs/protocol/05_GATE_VOTE_AND_FINAL_VERDICT.md
git commit -m "docs(protocol): add design-brief vote round to doc 05 proposal_round"
```

---

### Task 4: Update protocol doc 11 — artifact registration

**Files:**
- Modify: `docs/protocol/11_RUNTIME_ARTIFACTS_AND_SCHEMAS.md:9-55`

- [ ] **Step 1: Add Specifying Artifacts section**

Find the `### Session & Orchestration Artifacts` table (around line 27). Add a new section BEFORE it:

```markdown
### Specifying Artifacts

| Artifact | Schema | Storage path | Producer |
|----------|--------|-------------|----------|
| `mission-spec.json` | `mission-spec.schema.json` | `.geas/missions/{mission_id}/spec.json` | orchestration_authority |
| `design-brief.json` | `design-brief.schema.json` | `.geas/missions/{mission_id}/design-brief.json` | orchestration_authority |
```

- [ ] **Step 2: Add design-brief to Artifact Purpose Highlights**

Find the `## Artifact Purpose Highlights` section. Add after the `### vote-round.json` entry:

```markdown
### `design-brief.json`
Captures the HOW decisions between mission spec (WHAT/WHY) and task contracts (UNIT OF WORK). Always reviewed by architecture-authority. Full-depth briefs also go through a vote round. Must be user-approved before tasks are compiled.
```

- [ ] **Step 3: Update Schema Inventory count**

Find: `28 JSON Schemas + 1 shared definitions file (`_defs.schema.json`) = 29 files total in `schemas/`.`

Replace with: `29 JSON Schemas + 1 shared definitions file (`_defs.schema.json`) = 30 files total in `schemas/`.`

- [ ] **Step 4: Commit**

```bash
git add docs/protocol/11_RUNTIME_ARTIFACTS_AND_SCHEMAS.md
git commit -m "docs(protocol): register design-brief artifact in doc 11"
```

---

### Task 5: Rewrite specifying.md

This is the core change. Full rewrite of the Specifying phase procedure.

**Files:**
- Modify: `plugin/skills/orchestrating/references/specifying.md` (full rewrite)

- [ ] **Step 1: Read current file to confirm content**

Read `plugin/skills/orchestrating/references/specifying.md` to confirm it matches what we analyzed.

- [ ] **Step 2: Write the new specifying.md**

Replace the entire content of `plugin/skills/orchestrating/references/specifying.md` with:

```markdown
# Specifying Phase

Always runs. Scale adapts to the request.

## Always Run

### 1. Seed Check

- `.geas/spec/mission-{mission_id}.json` should exist from intake (read `mission_id` from `run.json`).
- If not, invoke `/geas:intake`.
- If `completeness_checklist` has any false values and no override: ask the user, re-run intake.

### 2. Onboard Check

If `.geas/memory/_project/conventions.md` is missing, invoke `/geas:onboard` to scan the existing project before proceeding.

### 3. Design Brief

#### 3a. Draft

Orchestrator reads the mission spec at `.geas/spec/mission-{mission_id}.json` and explores the codebase. Then:

Ensure the mission directory exists: `mkdir -p .geas/missions/{mission_id}`

1. Write an initial design-brief draft to `.geas/missions/{mission_id}/design-brief.json` conforming to `schemas/design-brief.schema.json` with `status: "draft"`.
2. Propose a depth level to the user:
   - **`lightweight`**: Mission has clear scope, existing codebase patterns apply, low ambiguity. Only minimum fields: `chosen_approach`, `non_goals`, `verification_strategy`.
   - **`full`**: Mission has architectural decisions, multiple valid approaches, cross-module impact, or significant risk. Adds: `alternatives_considered`, `architecture_decisions`, `risks`, `preserve_list`, `unresolved_assumptions`.
3. User confirms or overrides the depth level.
4. If user overrides to `full`: populate the additional fields before proceeding.

#### 3b. Architecture Review (always)

Spawn architecture-authority to review and enrich the design-brief:

```
Agent(agent: "architecture-authority", prompt: "Read the design-brief at .geas/missions/{mission_id}/design-brief.json and the mission spec at .geas/spec/mission-{mission_id}.json. Review the design brief: verify the chosen approach is sound, check for missing risks or architectural concerns, and add any necessary architecture decisions. If the project requires stack-specific rules, add them to .geas/rules.md under a '## Stack Rules' section. Update the design-brief: populate the arch_review field with your review summary and any additions you made. Write the updated design-brief back to .geas/missions/{mission_id}/design-brief.json with status: 'reviewing'.")
```

Verify: Read `.geas/missions/{mission_id}/design-brief.json` and confirm `arch_review` is populated.

Log: `{"event": "step_complete", "step": "design_brief_arch_review", "agent": "architecture-authority", "timestamp": "<actual>"}`

#### 3c. Vote Round (full depth only)

**Skip if** `depth` is `lightweight`.

Invoke `/geas:vote-round` as a `proposal_round`:
- Proposal: `.geas/missions/{mission_id}/design-brief.json`
- Voters: orchestrator selects based on design-brief content. Minimum quorum: architecture-authority + 1 specialist (per doc 05 proposal_round rules).
  - Frontend work → include `ui-ux-designer`
  - Backend work → include `backend-engineer`
  - High risk → include `critical-reviewer`
- Output: vote-round artifact in `.geas/decisions/`
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
3. Return to step 3b (architecture-authority re-reviews the revised version)
4. [Full only] Run a new vote round (step 3c)
5. Present to user again (step 3d)

### 4. Compile TaskContracts

- Input: mission spec (`.geas/spec/mission-{mission_id}.json`) + approved design-brief (`.geas/missions/{mission_id}/design-brief.json`)
- For each logical unit of work, invoke `/geas:task-compiler`.
- Each TaskContract MUST include a `rubric` object with a `dimensions` array. Base dimensions: core_interaction(3), feature_completeness(4), code_quality(4), regression_safety(4). Add ux_clarity(3), visual_coherence(3) for frontend tasks.
- Output: `.geas/tasks/{task-id}.json`
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
- Mission spec frozen (`.geas/spec/mission-{mission_id}.json` exists)
- Design-brief approved (`status: "approved"` AND `arch_review` exists in `.geas/missions/{mission_id}/design-brief.json`)
- Tasks compiled (at least 1 task in `.geas/tasks/` for this mission)
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
```

- [ ] **Step 3: Verify no legacy references remain**

Run: `grep -n "PRD\|stories\.md\|Vision\|prd\.md\|write-prd\|write-stories\|MCP Recommend\|Stack-Specific Rules" plugin/skills/orchestrating/references/specifying.md`
Expected: no output

Run: `grep -n "design-brief" plugin/skills/orchestrating/references/specifying.md`
Expected: multiple matches confirming the new content

- [ ] **Step 4: Commit**

```bash
git add plugin/skills/orchestrating/references/specifying.md
git commit -m "feat(specifying): rewrite Specifying phase with design-brief, user approvals, environment setup"
```

---

### Task 6: Update intake/SKILL.md — minor cleanup

**Note:** Mission spec stays at `.geas/spec/mission-{n}.json`. Context-packet, evolving, polishing, and ledger-query all reference this path. Moving it requires updating those skills too — deferred to the full directory migration mission. Only seed.json legacy language is cleaned up here.

**Files:**
- Modify: `plugin/skills/intake/SKILL.md:83,131`

- [ ] **Step 1: Remove seed.json backward-compatibility language**

Find (around line 83):
```markdown
Determine the next mission ID by scanning `.geas/spec/mission-*.json` — pick the next sequential number (mission-001, mission-002, etc.). If `.geas/spec/seed.json` exists (legacy), count it as mission-001.
```

Replace with:
```markdown
Determine the next mission ID by scanning `.geas/spec/mission-*.json` — pick the next sequential number (mission-001, mission-002, etc.).
```

Find (around line 131):
```markdown
- **Backward compatibility**: If `.geas/spec/seed.json` exists (pre-migration project), treat it as mission-001 equivalent. Next mission creates `mission-002.json`.
```

Remove this line entirely.

- [ ] **Step 2: Commit**

```bash
git add plugin/skills/intake/SKILL.md
git commit -m "chore(intake): remove stale seed.json backward-compatibility references"
```

---

### Task 7: Update task-compiler/SKILL.md — add design-brief input

**Files:**
- Modify: `plugin/skills/task-compiler/SKILL.md:12-17`

- [ ] **Step 1: Add design-brief to Inputs section**

Find (around line 12-17):
```markdown
## Inputs

You need these before compiling:

1. **User story or feature description** — what needs to be built
2. **Mission spec** — read from `.geas/spec/mission-{mission_id}.json` for mission-level context
3. **Architecture context** — from `.geas/memory/_project/conventions.md`
4. **Existing task contracts** — check `.geas/tasks/` for dependencies
```

Replace with:
```markdown
## Inputs

You need these before compiling:

1. **User story or feature description** — what needs to be built
2. **Mission spec** — read from `.geas/spec/mission-{mission_id}.json` for mission-level context
3. **Design-brief** — read from `.geas/missions/{mission_id}/design-brief.json` for approach context and architecture decisions
4. **Architecture context** — from `.geas/memory/_project/conventions.md`
5. **Existing task contracts** — check `.geas/tasks/` for dependencies
```

- [ ] **Step 2: Commit**

```bash
git add plugin/skills/task-compiler/SKILL.md
git commit -m "feat(task-compiler): add design-brief as required input"
```

---

### Task 8: Update orchestrating/SKILL.md — Specifying section

**Files:**
- Modify: `plugin/skills/orchestrating/SKILL.md:212-215`

- [ ] **Step 1: Update Phase 1 Specifying description**

Find (around line 212-215):
```markdown
### Phase 1: Specifying
Read `references/specifying.md` and follow the procedure.
Minimum: intake (mission spec confirmation with user) + task compilation.
Full: vision, PRD, architecture, vote round, task compilation.
```

Replace with:
```markdown
### Phase 1: Specifying
Read `references/specifying.md` and follow the procedure.
All missions: intake + design-brief (with arch-authority review) + task compilation + user approvals.
Full depth adds: alternatives analysis, architecture decisions, risk assessment, vote round.
```

- [ ] **Step 3: Update Continuation Rule checkpoint description**

Find (around line 112-114):
```markdown
- **Specifying → Building transition** (present task summary, wait for user approval)

Task compilation in specifying phase: compile ALL tasks in one turn. Then present the specifying summary (see "Specifying → Building Transition" checkpoint) before entering building.
```

Replace with:
```markdown
- **Design-brief approval** (user must approve design before task compilation)
- **Task list approval** (user must approve compiled tasks before building)
- **Specifying → Building transition** (after environment setup completes)

Design-brief and task list each require user approval. Do NOT batch these — present design-brief first, get approval, then compile tasks, then present task list for approval.
```

- [ ] **Step 4: Verify**

Run: `grep -n "PRD\|vision\|stories" plugin/skills/orchestrating/SKILL.md`
Expected: no output

- [ ] **Step 5: Commit**

```bash
git add plugin/skills/orchestrating/SKILL.md
git commit -m "feat(orchestrating): update Specifying description and continuation rules"
```

---

### Task 9: Update building.md — reference cleanup

**Files:**
- Modify: `plugin/skills/orchestrating/references/building.md:6`

- [ ] **Step 1: Check for stale references**

Run: `grep -n "PRD\|stories\|Vision\|prd\|\.geas/spec/" plugin/skills/orchestrating/references/building.md`

If any matches found, update them. If no matches (expected based on current content), this task is a no-op.

- [ ] **Step 2: Commit (only if changes were made)**

```bash
git add plugin/skills/orchestrating/references/building.md
git commit -m "chore(building): clean up stale references"
```

---

### Task 10: Update DESIGN.md

**Files:**
- Modify: `docs/architecture/DESIGN.md:64,177-313`

- [ ] **Step 1: Update Specifying phase description in mermaid context**

Find (around line 64):
```markdown
    B -.- B1["Intake -> Spec -> Architecture\n-> Task Compilation"]
```

Replace with:
```markdown
    B -.- B1["Intake -> Design Brief\n-> Task Compilation"]
```

- [ ] **Step 2: Update Plugin Structure — note write-prd and write-stories**

Find (around line 215-216):
```markdown
    write-prd/               # PRD generation
    write-stories/           # Story generation
```

Replace with:
```markdown
    write-prd/               # PRD generation (standalone utility, not part of core pipeline)
    write-stories/           # Story generation (standalone utility, not part of core pipeline)
```

- [ ] **Step 3: Update .geas/ Directory Structure**

Find the `.geas/` directory structure section (around line 244). Add a `missions/` section after `state/`:

After the `state/` block (around line 254), add:
```markdown
  missions/
    {mission_id}/
      spec.json                # Mission spec (frozen at intake)
      design-brief.json        # Design brief (user-approved)
      phase-reviews/           # Per-mission phase review artifacts
```

Update the `spec/` section — find:
```markdown
  spec/
    mission-{n}.json         # Mission spec frozen at intake (immutable)
```

Replace with:
```markdown
  spec/                      # Legacy path (missions/ is the new location)
```

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/DESIGN.md
git commit -m "docs(architecture): update DESIGN.md for Specifying phase changes"
```

---

### Task 11: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update Execution Model section**

Find the "## Execution Model" section. It currently says:

```markdown
Every mission follows 4 phases: Specifying → Building → Polishing → Evolving. Scale adapts to the request — from a single feature to a full product. Always follows the same pipeline order.
```

Replace with:

```markdown
Every mission follows 4 phases: Specifying → Building → Polishing → Evolving. Scale adapts to the request — from a single feature to a full product. Always follows the same pipeline order.

Specifying produces three user-approved artifacts: mission spec (WHAT/WHY), design-brief (HOW), and task list (UNITS OF WORK). Architecture-authority reviews every design-brief. Full-depth briefs also go through a vote round.
```

- [ ] **Step 2: Update Core skills list**

Find the task-compiler description:
```markdown
- `task-compiler/` — mission spec → TaskContracts with classification, rubric, routing
```

Replace with:
```markdown
- `task-compiler/` — mission spec + design-brief → TaskContracts with classification, rubric, routing
```

- [ ] **Step 3: Update Project Structure comment**

Find:
```markdown
│   ├── 00-12, 14 .md        # 14 protocol documents
│   └── schemas/             # 29 JSON Schema (draft 2020-12)
```

Replace with:
```markdown
│   ├── 00-12, 14 .md        # 14 protocol documents
│   └── schemas/             # 30 JSON Schema (draft 2020-12)
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for Specifying phase enhancement"
```

---

### Task 12: Update README.md and README.ko.md

**Files:**
- Modify: `README.md:64`
- Modify: `README.ko.md:64`

- [ ] **Step 1: Update README.md mermaid diagram**

Find (around line 64):
```markdown
    B -.- B1["Intake -> Spec -> Architecture\n-> Task Compilation"]
```

Replace with:
```markdown
    B -.- B1["Intake -> Design Brief\n-> Task Compilation"]
```

- [ ] **Step 2: Update README.ko.md mermaid diagram**

Find (around line 64):
```markdown
    B -.- B1["Intake -> 스펙 -> 아키텍처\n-> 태스크 컴파일"]
```

Replace with:
```markdown
    B -.- B1["Intake -> 디자인 브리프\n-> 태스크 컴파일"]
```

- [ ] **Step 3: Verify both READMEs are in sync**

Run: `grep "Design Brief\|디자인 브리프" README.md README.ko.md`
Expected: one match per file, both conveying the same meaning

- [ ] **Step 4: Commit**

```bash
git add README.md README.ko.md
git commit -m "docs: update README diagrams for Specifying phase changes"
```

---

## Post-Implementation Verification

After all tasks are complete:

- [ ] **Cross-file path consistency check**

```bash
# New missions/ path should appear in specifying and task-compiler (for design-brief)
grep -rn "\.geas/missions/" plugin/skills/orchestrating/references/specifying.md plugin/skills/task-compiler/SKILL.md

# Old spec path should still work in intake, task-compiler, context-packet (NOT migrated)
grep -rn "\.geas/spec/mission" plugin/skills/intake/SKILL.md plugin/skills/task-compiler/SKILL.md
# Expected: matches in both files (spec path is intentionally preserved)

# Legacy terms should not appear in modified files
grep -rn "PRD\|stories\.md\|Vision" plugin/skills/orchestrating/references/specifying.md plugin/skills/orchestrating/SKILL.md plugin/skills/task-compiler/SKILL.md
# Expected: no output
```

- [ ] **Schema consistency check**

```bash
# Both schema copies should be identical
diff docs/protocol/schemas/design-brief.schema.json plugin/skills/orchestrating/schemas/design-brief.schema.json
```
Expected: no output (files identical)

- [ ] **Protocol-skill alignment check**

Verify manually:
1. doc 02 gate 1 criteria matches specifying.md step 7 conditions
2. doc 05 proposal_round mentions design-brief
3. doc 11 lists design-brief artifact
4. DESIGN.md directory structure includes `.geas/missions/`
