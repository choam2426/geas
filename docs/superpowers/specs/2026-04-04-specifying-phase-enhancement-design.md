# Specifying Phase Enhancement

## Problem

The Specifying phase is the weakest link in the geas pipeline. The back half (Evidence Gate, Closure Packet, Critical Reviewer, Final Verdict) is rigorous. The front half allows jumping from mission spec directly to task compilation without a user-approved design or execution plan.

Specific issues:
- **No design artifact**: The mission spec captures WHAT/WHY but not HOW. Architecture decisions exist as a conditional step that the orchestrator can skip entirely.
- **Legacy ceremony**: Vision, PRD, and Stories are remnants of an MVP-from-scratch assumption. The mission spec already covers what a PRD would, and task-compiler already converts specs into task contracts without needing stories.md as an intermediary.
- **Weak gate 1**: The specifying-to-building transition requires only "mission brief exists, scope_in defined, tasks compiled" — no user approval of the design or task breakdown.
- **No concurrent mission support**: Artifacts like `prd.md`, `stories.md`, and evidence at `.geas/evidence/specifying/` use fixed names that collide when multiple missions exist.

## Design Decisions

### D1: Delete Vision, PRD & Stories, MCP Recommendations, Stack Rules as separate steps

**Rationale**: The mission spec already captures what Vision and PRD provide. task-compiler works directly from mission spec without stories.md (specifying.md already has this fallback path). MCP and Stack Rules are absorbed into other steps (Environment Setup and architecture-authority review respectively).

**Impact**: The `write-prd` and `write-stories` skills become unused by the core pipeline. They remain available as standalone utilities but are no longer invoked during Specifying.

### D2: Introduce design-brief artifact

A new artifact that captures the HOW decisions between mission spec (WHAT/WHY) and task contracts (UNIT OF WORK).

**Production flow**:
1. Orchestrator reads mission spec + codebase, writes design-brief draft
2. Orchestrator proposes depth (lightweight/full) to user
3. architecture-authority agent is spawned to review and enrich (always, regardless of depth)
4. [Full only] Vote round with relevant specialist agents
5. Present to user for approval
6. If user rejects: take rejection reason, revise, return to step 3

**Minimum fields (all missions)**:
- `chosen_approach` — selected implementation direction and rationale
- `non_goals` — what this mission explicitly will not do
- `verification_strategy` — how completion will be verified

**Full additional fields (orchestrator proposes, user agrees)**:
- `alternatives_considered[]` — other approaches and why they were rejected
- `architecture_decisions[]` — technical decisions with rationale and constraints
- `risks[]` — identified risks with mitigation plans
- `preserve_list[]` — existing behavior/files that must not change
- `unresolved_assumptions[]` — assumptions not yet validated

**Depth selection**: Orchestrator judges based on mission spec complexity and proposes to user. No mechanical formula — the orchestrator already has codebase context to make this judgment. User confirms or overrides.

### D3: Task list user approval replaces separate execution-plan artifact

After task-compiler produces TaskContracts, the orchestrator presents the compiled task list to the user for approval. This serves the execution-plan purpose without a separate artifact that could drift from the actual tasks.

**Rationale**: A separate execution-plan artifact creates a synchronization problem — the plan says "3 tasks in this order" but task-compiler might produce 4. Using the task list itself as the plan eliminates this gap.

### D4: Environment Setup step before Building

After task list approval, the orchestrator analyzes design-brief + task contracts to identify required environment dependencies (runtimes, databases, MCP servers, package managers, etc.). These are presented to the user as a checklist. Automatable items run with user consent; manual items get clear instructions.

**Rationale**: Specialist agents fail when environment prerequisites are missing. This step prevents "Go not installed" or "PostgreSQL not running" failures during implementation.

### D5: Strengthened gate 1 (specifying to building)

New gate criteria:
- Mission spec frozen
- Design-brief approved (user confirmation)
- Tasks compiled
- Task list approved (user confirmation)
- Environment setup completed (or not applicable)

This replaces the current "mission brief exists / scope_in defined / tasks compiled" which has no user approval checkpoints.

### D6: Mission-scoped directory structure (path preparation only)

New artifacts use `.geas/missions/{mission_id}/` paths. Existing pipeline artifacts (tasks, evidence, etc.) keep their current paths in this change — full directory migration is a separate future mission.

```
.geas/spec/
    mission-{n}.json       # UNCHANGED — context-packet, evolving, polishing all reference this path

.geas/missions/{mission_id}/
    design-brief.json      # NEW — only new artifacts go here for now

.geas/tasks/               # UNCHANGED — pipeline, scheduling, building all reference this path
    {task-id}.json
```

Mission spec stays at `.geas/spec/mission-{n}.json` because context-packet, evolving, polishing, and ledger-query skills all reference this path. Moving spec requires updating those skills too — deferred to the full directory migration mission.

Specifying evidence files (formerly `.geas/evidence/specifying/`) are replaced by the design-brief artifact itself. The `arch_review` field in design-brief.json captures what was previously stored as a separate `architecture-authority.json` evidence file. No separate `.geas/evidence/specifying/` directory is produced.

### D7: architecture-authority always reviews, vote round scales with depth

architecture-authority is always spawned to review the design-brief, regardless of depth. This prevents the "conditional skip makes the front half thin" pattern that caused the original problem.

Vote round runs only for full-depth design-briefs. If the user rejects after vote, the rejection reason feeds back into revision, then a new vote round runs before re-presenting to the user.

## design-brief.schema.json

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

## New Specifying Phase Flow

```
1. Seed Check
   .geas/missions/{mission_id}/spec.json exists?
   No -> invoke /geas:intake
   completeness_checklist has false values and no override? -> ask user, re-run intake

2. Onboard Check
   .geas/memory/_project/conventions.md missing?
   Yes -> invoke /geas:onboard

3. Design Brief
   3a. Orchestrator reads mission spec + codebase
       Writes design-brief draft to .geas/missions/{mission_id}/design-brief.json
       Proposes depth (lightweight/full) to user
   3b. Spawn architecture-authority to review/enrich (always)
       arch-authority also adds stack-specific rules to .geas/rules.md when applicable
   3c. [Full only] Vote round (proposal_round)
       Voters: orchestrator selects based on design-brief content
       Minimum quorum: architecture-authority + 1 specialist (per doc 05 proposal_round rules)
   3d. Present to user for approval
       Approved -> proceed
       Rejected -> record rejection reason in rejection_history
                -> revise design-brief
                -> return to 3b (arch-authority re-reviews revised version)
                -> [Full only] new vote round
                -> present to user again

4. Compile TaskContracts
   Input: mission spec + design-brief
   For each logical unit of work, invoke /geas:task-compiler
   Output: .geas/tasks/{task-id}.json (existing path — unchanged in this change)

5. Task List User Approval
   Present compiled tasks to user:
     - task ID, title, goal
     - dependencies
     - suggested execution order
     - risk level per task
   Approved -> log {"event": "task_list_approved", "mission_id": "...", "task_count": N, "timestamp": "..."}
   Rejected -> user feedback -> adjust tasks (re-compile, split, merge, reorder) -> re-present

6. Environment Setup
   Orchestrator analyzes design-brief + task contracts
   Identifies required environment dependencies:
     - Runtimes/languages
     - External services (databases, message queues, etc.)
     - MCP servers
     - Package manager initialization
     - Other tooling
   Presents checklist to user:
     - Auto-installable items: execute with user consent
     - Manual items: provide instructions
   All items resolved -> log {"event": "environment_setup_complete", "mission_id": "...", "items": [...], "timestamp": "..."}
   No dependencies needed -> log {"event": "environment_setup_complete", "mission_id": "...", "items": [], "timestamp": "..."}

7. Close Specifying (Gate 1)
   Required conditions (ALL must be true):
     - Mission spec frozen (.geas/missions/{mission_id}/spec.json exists)
     - Design-brief approved (status: "approved" AND arch_review exists in design-brief.json)
     - Tasks compiled (at least 1 task in .geas/tasks/ for this mission)
     - Task list approved (task_list_approved event in ledger)
     - Environment setup completed (environment_setup_complete event in ledger)

   Write .geas/missions/{mission_id}/phase-reviews/specifying-to-building.json
   Update run state: { "phase": "building", "status": "in_progress" }
   Log: {"event": "phase_complete", "phase": "specifying", "timestamp": "<actual>"}

   If any condition unmet: status "blocked", list unmet criteria
   After 3 consecutive failures -> invoke /geas:decision
```

## Changes to Existing Files

### specifying.md — Full rewrite

Replace the entire content with the flow described above. Remove all references to Vision, PRD & Stories, MCP Recommendations, and Stack Rules as separate steps.

### task-compiler/SKILL.md — Input change

Current input section references `stories.md` as optional input. Change to:
- Remove all `stories.md` references
- Mission spec path unchanged: `.geas/spec/mission-{mission_id}.json`
- Add `design-brief` as input: "Read from `.geas/missions/{mission_id}/design-brief.json` for approach context and architecture decisions"
- Output path unchanged: `.geas/tasks/{task-id}.json` (path migration is a separate future mission)

### intake/SKILL.md — Minor cleanup

- Mission spec output path stays at `.geas/spec/mission-{n}.json` (context-packet, evolving, polishing reference this path)
- Clean up legacy seed.json backward-compatibility language

### orchestrating/SKILL.md — Specifying section update

Line 214-215 currently reads:
```
Minimum: intake (mission spec confirmation with user) + task compilation.
Full: vision, PRD, architecture, vote round, task compilation.
```

Change to:
```
All missions: intake + design-brief (with arch-authority review) + task compilation + user approvals.
Full depth adds: alternatives analysis, architecture decisions, risk assessment, vote round.
```

### building.md — Minor reference cleanup

Line 6 references `.geas/tasks/` — keep as-is (path migration is a separate mission). No PRD/stories references found.

## Protocol Document Changes

### doc 01 (Agent Types and Authority)

product_authority line 30: "Direction and priority judgment during the specifying phase" — this remains accurate. product_authority no longer produces Vision/PRD during Specifying, but the protocol doc doesn't mention those specific artifacts. No change needed.

### doc 02 (Missions and Runtime)

Lines 34-38 gate 1 definition. Update from:
```
gate 1: mission brief + scope_in + initial tasks exist
```
To:
```
gate 1: mission frozen + design-brief approved + tasks compiled + task list approved + environment setup completed
```

Lines 50-62 Specifying deliverables. Update from:
```
Required deliverables:
- mission brief
- scope_in
- decision records
- initial tasks
- conventions / project memory seed
```
To:
```
Required deliverables:
- mission spec (frozen)
- design-brief (user-approved, architecture-authority reviewed)
- decision records (from design-brief architecture_decisions, when applicable)
- initial tasks (user-approved)
- conventions / project memory seed
- environment setup (when applicable)
```

### doc 05 (Gate, Vote, and Final Verdict)

Line 136 mentions "Cross-cutting proposals during the specifying phase" for proposal_round. Add clarification:
- design-brief vote rounds in the specifying phase use `proposal_round` (agree/disagree)
- This vote round is mandatory for full-depth design-briefs and skipped for lightweight

### doc 11 (Runtime Artifacts and Schemas)

Add design-brief to the artifact tables:

Under "Session & Orchestration Artifacts" or a new "Specifying Artifacts" section:
```
| design-brief.json | design-brief.schema.json | .geas/missions/{mission_id}/design-brief.json | orchestration_authority |
```

Update `.geas/` directory structure (Section 9 of DESIGN.md) to reflect mission-scoped paths for new artifacts.

## Documentation Changes

### CLAUDE.md

- Update "Execution Model" to mention design-brief
- Update "Core skills" descriptions for intake and task-compiler
- Remove any PRD/Stories references
- Add design-brief to the artifact flow description

### README.md

Update the Specifying phase description in the mermaid diagram:
```
B -.- B1["Intake -> Design Brief\n-> Task Compilation"]
```

### README.ko.md

Sync with README.md changes.

### DESIGN.md (docs/architecture/)

- Section 8 Plugin Structure: note that write-prd and write-stories are standalone utilities, no longer part of the core pipeline
- Section 9 .geas/ Directory Structure: add `.geas/missions/` section showing the new structure

## What This Does NOT Change

- **Per-task pipeline** (pipeline.md): 14 steps unchanged
- **Scheduling** (scheduling/SKILL.md): batch construction unchanged
- **Evidence Gate, Closure Packet, Critical Reviewer, Final Verdict**: unchanged
- **Memory system**: unchanged
- **Existing `.geas/tasks/`, `.geas/evidence/` paths**: unchanged (migration is a separate future mission)
- **write-prd and write-stories skills**: remain as standalone utilities, just no longer invoked by Specifying
- **Building, Polishing, Evolving phases**: unchanged except building.md reference cleanup
