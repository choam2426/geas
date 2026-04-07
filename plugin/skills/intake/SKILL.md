---
name: intake
description: Mission intake gate — collaborative exploration to freeze a mission spec. One question at a time, section-by-section approval.
---

# Intake Gate

Before any mission execution, run this gate to freeze the mission specification.

## Purpose

Missions arrive as natural language with hidden assumptions, ambiguous scope, and implicit constraints. This gate surfaces those gaps through collaborative exploration and produces an immutable mission spec file (`.geas/missions/{mission_id}/spec.json`) before the team starts building.

## Process

### Step 1: Assess Scope

Read the raw mission. Determine if it's too large for a single spec:
- If the mission describes multiple independent subsystems (e.g., "build a platform with chat, file storage, billing, and analytics"), flag this immediately
- Propose decomposition: what are the independent pieces, how do they relate, what order to build?
- Then brainstorm the first sub-project through the normal intake flow

### Step 2: Explore Requirements

Ask the user questions to surface hidden assumptions. Use the AskUserQuestion tool.

Rules:
- **One question at a time** — do not batch questions
- **Multiple choice preferred** — easier for the user than open-ended
- **Target unchecked items only** — track a mental checklist: mission, acceptance_criteria, scope_out, target_user, constraints. Only ask about items not yet addressed.
- Never ask questions whose answers are obvious from the mission text
- Stop when all checklist items are satisfied — no fixed question limit

Question categories:
1. **Domain profile**: "What type of work is this?" (software development / research / other)
2. **Scope boundary**: "You mentioned X — does that include Y?" (with options)
3. **User definition**: "Who primarily uses this?" (with persona options)
4. **Constraint surfacing**: "Any tech stack or platform preferences?" (with common options)
5. **Success criteria**: "How will you know this is done? What must work on day one?"
6. **Anti-scope**: "What should this explicitly NOT do?" (with related-but-excluded options)
7. **Risk surfacing**: "What could go wrong? Any areas of uncertainty?"
8. **Affected surfaces**: "What existing areas/files/systems will this touch?"

If the user says "just build it" at any point — respect that, set `readiness_override: true`, fill best-effort values for unchecked items, and proceed.

### Step 3: Propose Approaches

When requirements are clear enough, present 2-3 scope/approach options:
- Lead with the recommended option and explain why
- Include trade-offs for each
- Example format:
  ```
  Option A (recommended): CLI-only with SQLite — simple, fast, self-contained
  Option B: CLI + REST API — extensible but more complexity
  Option C: TUI with ratatui — richer UX but harder to test
  ```
- Let the user choose direction before finalizing the seed

### Step 4: Build Seed Section by Section

Present each seed section to the user and get explicit approval before moving on:

1. **Mission**: "Mission: '{refined mission statement}'. Does this capture your intent?"
2. **Scope IN**: "These features are IN scope: [list]. Correct?"
3. **Scope OUT**: "These are explicitly OUT of scope: [list]. Anything to add or remove?"
4. **Acceptance Criteria**: "Done when: [numbered list]. These are the success criteria. Correct?"
5. **Target User**: "Primary user: '{persona}'. Correct?"
6. **Constraints**: "Constraints: [list]. Anything else?"

As each section is approved, mark it in the completeness checklist.

### Step 5: Verify Completeness and Freeze Seed

Check the completeness checklist — all items must be true:
- `mission`: approved
- `domain_profile`: selected
- `mode`: selected (lightweight / standard / full_depth)
- `done_when`: approved (one-sentence success definition)
- `acceptance_criteria`: approved (>= 3 items)
- `scope_in`: approved (>= 1 item)
- `scope_out`: approved (>= 1 item)
- `target_user`: approved
- `constraints`: approved
- `affected_surfaces`: identified

Generate the mission ID in the format `mission-{YYYYMMDD}-{8char}` where:
- `YYYYMMDD` is the current UTC date
- `{8char}` is 8 random alphanumeric characters ([a-zA-Z0-9])

Example: `mission-20260407-x7Kq9mPv`

The concrete generation method (shell command, language library, etc.) is determined by the runtime environment — do not hardcode a specific tool. Verify uniqueness by checking that `.geas/missions/{generated_id}/` does not already exist.

Create the mission directory structure:
```bash
mkdir -p .geas/missions/{mission_id}/tasks .geas/missions/{mission_id}/evidence .geas/missions/{mission_id}/contracts .geas/missions/{mission_id}/packets .geas/missions/{mission_id}/decisions/pending .geas/missions/{mission_id}/evolution .geas/missions/{mission_id}/phase-reviews
```

Write `.geas/missions/{mission_id}/spec.json` following the schema at `schemas/mission-spec.schema.json`. Include:
- `"version": "1.0"`, `"artifact_type": "mission_spec"`, `"artifact_id": "mission-{YYYYMMDD}-{8char}"`
- `"producer_type": "orchestration_authority"`, `"mission_id": "mission-{YYYYMMDD}-{8char}"`
- `"created_at"` (actual UTC timestamp)

Always include the `source` field:
- `"full_intake"` — complete Socratic exploration with user
- `"quick_intake"` — user skipped detailed intake
- `"existing_project"` — auto-generated for existing project onboarding

Show the user a detailed mission briefing:
```
═══════════════════════════════════════════════════
  MISSION SPEC — {mission_id}
═══════════════════════════════════════════════════

  Mission:        <refined mission statement>
  Done when:      <one-sentence success definition>
  Domain:         <domain_profile>
  Mode:           <lightweight | standard | full_depth>
  Target user:    <who>

─── SCOPE ─────────────────────────────────────────

  IN:
    • <feature/capability 1>
    • <feature/capability 2>
    • ...

  OUT:
    • <explicitly excluded 1>
    • <explicitly excluded 2>
    • ...

─── ACCEPTANCE CRITERIA ───────────────────────────

    1. <observable, falsifiable criterion>
    2. <observable, falsifiable criterion>
    3. <observable, falsifiable criterion>
    ...

─── CONSTRAINTS ───────────────────────────────────

    • <technical or business constraint>
    • ...

─── AFFECTED SURFACES ─────────────────────────────

    • <area/path/system expected to be touched>
    • ...

─── RISK NOTES ────────────────────────────────────

    • <initial risk observation>
    • ...
    (none identified = "No significant risks identified at intake")

─── ASSUMPTIONS ───────────────────────────────────

    • <confirmed assumption>
    • ...

─── AMBIGUITIES ───────────────────────────────────

    • <deferred ambiguity + rationale>
    • ...
    (none = "All ambiguities resolved during intake")

═══════════════════════════════════════════════════
```

Ask: "Does this capture your intent? Any changes before we start?"
If confirmed → seed is frozen. Proceed to execution.
If changes → update and re-confirm.

## Lightweight Variant

For lightweight missions (adding a feature to an existing project):
1. Skip Step 3 (approach proposals) — the approach is constrained by existing codebase
2. Step 2 limited to 1-2 questions focused on:
   - What exactly does this feature do?
   - What existing code does it touch?
   - What should NOT change?
3. Produce a lighter seed with emphasis on scope_in (the specific feature), scope_out (existing functionality that must not change), and constraints (existing tech stack)

## Output

- **Every mission** produces `.geas/missions/{mission_id}/spec.json` — both new and existing projects.
- **New product**: full intake → `.geas/missions/{mission_id}/spec.json` with `source: "full_intake"`
- **Existing project (first geas usage)**: minimal intake → `.geas/missions/{mission_id}/spec.json` with `source: "existing_project"`
- **Existing project (subsequent missions)**: lightweight intake → `.geas/missions/{mission_id}/spec.json` with `source: "quick_intake"` or `"full_intake"`
- **Format**: JSON conforming to `schemas/mission-spec.schema.json`
- **Immutability**: Once confirmed, the mission spec should not be modified during execution. If scope must change, trigger a vote round for scope change instead.
