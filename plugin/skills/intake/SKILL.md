---
name: intake
description: Mission intake gate — surfaces hidden assumptions via Socratic questioning, freezes a seed spec before execution begins. Prevents garbage-in-garbage-out.
---

# Intake Gate

Before any execution mode (Full Team, Sprint), run this gate to freeze the mission specification.

**Skip this skill entirely for Debate mode** — the debate question itself is the specification.

## Purpose

Missions arrive as natural language with hidden assumptions, ambiguous scope, and implicit constraints.
This gate surfaces those gaps and produces an immutable `seed.json` before the team starts building.

## Process

### Step 1: Analyze the Mission and Score Readiness

Read the raw mission string. Score each dimension 0-20:

| Dimension | 0-5 (Critical gap) | 6-10 (Vague) | 11-15 (Partial) | 16-20 (Clear) |
|-----------|---------------------|--------------|-----------------|----------------|
| **Clarity** | No discernible goal | Goal implied but ambiguous | Goal stated, some ambiguity | Specific, unambiguous goal |
| **Scope** | No boundaries mentioned | Implied boundaries only | Some in/out stated | Clear in/out with rationale |
| **Users** | No user mentioned | "Users" without specifics | User type identified | Persona with context |
| **Constraints** | None mentioned | Implied (e.g., "simple") | Some explicit constraints | Technical + business constraints |
| **Acceptance** | No success criteria | Vague ("should work") | Some measurable criteria | 3+ verifiable criteria |

Calculate `readiness_score` = sum of all 5 dimensions (0-100).

Record `readiness_breakdown` with per-dimension scores.

Determine next action based on score:
- **Score >= 80**: Mission is clear → proceed directly to Step 3
- **Score 40-79**: Gaps exist → ask targeted Socratic questions (Step 2) focusing on dimensions scoring <= 10
- **Score < 40**: Mission is too vague → ask 3-5 deep questions (Step 2) covering all low dimensions

### Step 2: Socratic Questioning (if ambiguity is Medium or High)

Ask the user questions that surface hidden assumptions. Use the AskUserQuestion tool.

Question categories:
1. **Scope boundary**: "You mentioned X — does that include Y, or is Y out of scope?"
2. **User definition**: "Who is the primary user? What's their technical level?"
3. **Constraint surfacing**: "Any preferences on tech stack, hosting, or budget?"
4. **Success criteria**: "How will you know this is done? What must work on day one?"
5. **Anti-scope**: "What should this explicitly NOT do, even if it seems related?"

Rules:
- Ask maximum 5 questions per round, minimum 2
- Only ask one round for Sprint mode (feature-level clarity is enough)
- Never ask questions whose answers are obvious from the mission
- If the user says "just build it" — respect that, but still produce a seed with explicit ambiguity_notes

After receiving answers, **re-score** all 5 dimensions. Update `readiness_score`.
- If score now meets the threshold for the target execution mode → proceed to Step 3
- If score still below threshold → ask one more focused round (maximum 2 Socratic rounds total)
- If the user says "just build it" after re-scoring → proceed to Step 3 regardless, but set `readiness_override: true` in the seed

### Step 3: Produce Seed Spec

Write `.geas/spec/seed.json` following the schema at `schemas/seed.schema.json`.

Before writing, ensure `.geas/spec/` directory exists. Create it if needed:
```bash
mkdir -p .geas/spec
```

**Go/No-go gate**:
- acceptance_criteria must have >= 3 items
- scope_out must have >= 1 item
- If these minimums can't be met even after questioning, note them in ambiguity_notes and proceed with a warning

Include in seed.json:
- `readiness_score`: the final calculated score (0-100)
- `readiness_breakdown`: per-dimension scores (`{ clarity, scope, users, constraints, acceptance }`)
- If user overrode the threshold: set `readiness_override: true`

### Step 4: Confirm with User

Show the user the seed summary in this format:

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
Readiness Score: <score>/100 (Clarity: <n>, Scope: <n>, Users: <n>, Constraints: <n>, Acceptance: <n>)
```

Ask: "Does this capture your intent? Any changes before we start?"

If the user confirms → seed is frozen. Proceed to execution mode.
If the user changes something → update seed.json and re-confirm.

## Sprint Mode Variant

For Sprint mode (adding a feature to an existing project):

1. Skip deep Socratic questioning
2. Focus on:
   - What exactly does this feature do?
   - What existing code does it touch?
   - What should NOT change?
3. Produce a lighter seed with emphasis on:
   - `scope_in`: the specific feature
   - `scope_out`: existing functionality that must remain unchanged
   - `constraints`: existing tech stack, patterns, conventions

## Output

- **File**: `.geas/spec/seed.json`
- **Format**: JSON conforming to `schemas/seed.schema.json`
- **Immutability**: Once confirmed, the seed should not be modified during execution. If scope must change, trigger `/pivot-protocol` instead.
