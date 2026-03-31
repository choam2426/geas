---
name: intake
description: Mission intake gate — collaborative exploration to freeze a seed spec. One question at a time, section-by-section approval.
---

# Intake Gate

Before any execution mode (Initiative, Sprint), run this gate to freeze the mission specification.
Skip this skill entirely for Debate mode.

## Purpose

Missions arrive as natural language with hidden assumptions, ambiguous scope, and implicit constraints. This gate surfaces those gaps through collaborative exploration and produces an immutable `seed.json` before the team starts building.

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
1. **Scope boundary**: "You mentioned X — does that include Y?" (with options)
2. **User definition**: "Who primarily uses this?" (with persona options)
3. **Constraint surfacing**: "Any tech stack or platform preferences?" (with common options)
4. **Success criteria**: "How will you know this is done? What must work on day one?"
5. **Anti-scope**: "What should this explicitly NOT do?" (with related-but-excluded options)

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
- `acceptance_criteria`: approved (>= 3 items)
- `scope_out`: approved (>= 1 item)
- `target_user`: approved
- `constraints`: approved

Ensure `.geas/spec/` directory exists:
```bash
mkdir -p .geas/spec
```

Write `.geas/spec/seed.json` following the schema at `schemas/seed.schema.json`. Include `"version": "1.0"` and `"created_at"` (actual UTC timestamp) in the seed.

Show the user a final summary:
```
Mission: <refined mission>
Target User: <who>
Scope IN: <bulleted list>
Scope OUT: <bulleted list>
Acceptance Criteria:
  1. <criterion>
  2. <criterion>
  3. <criterion>
Constraints: <if any>
Assumptions: <if any>
```

Ask: "Does this capture your intent? Any changes before we start?"
If confirmed → seed is frozen. Proceed to execution mode.
If changes → update and re-confirm.

## Sprint Mode Variant

For Sprint mode (adding a feature to an existing project):
1. Skip Step 3 (approach proposals) — the approach is constrained by existing codebase
2. Step 2 limited to 1-2 questions focused on:
   - What exactly does this feature do?
   - What existing code does it touch?
   - What should NOT change?
3. Produce a lighter seed with emphasis on scope_in (the specific feature), scope_out (existing functionality that must not change), and constraints (existing tech stack)

## Output

- **Initiative mode**: `.geas/spec/seed.json`
- **Sprint mode**:
  - If `.geas/spec/seed.json` already exists: do NOT modify it. Skip seed creation — the feature scope goes directly into the TaskContract via task-compiler (goal, acceptance_criteria, scope_out).
  - If `.geas/spec/seed.json` does NOT exist (first time using geas): create a minimal seed.json with project identity (mission, target_user, constraints detected from onboard). Include `"source": "sprint"` to indicate this was auto-generated, not from a full Initiative intake. Feature scope still goes into TaskContract.
- **Format**: JSON conforming to `schemas/seed.schema.json`
- **Immutability**: Once confirmed, the seed should not be modified during execution. If scope must change, trigger `/geas:pivot-protocol` instead.
