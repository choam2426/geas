---
name: vote-round
description: Structured review protocol — Forge proposes, Critic challenges, Compass synthesizes, user confirms. Produces a DecisionRecord.
---

# Structured Review Protocol

After a major proposal (architecture, design system, cross-cutting decision), run a structured review to surface concerns and reach a confirmed decision before proceeding.

---

## When to Trigger a Review

| Proposal | Critic |
|----------|--------|
| Forge proposes architecture / tech stack (Discovery) | Circuit or Palette (whoever's domain is most affected) |
| Palette posts the overall design system (not per-feature specs) | Forge or Pixel |
| Cross-cutting decision affecting multiple agents (e.g., state management, API shape, deployment strategy) | The agent whose domain is most affected |

## What NOT to Review

- Individual feature design specs (too granular)
- Per-feature tech guides from Forge
- Implementation details within a single agent's domain
- Bug fixes or minor refactors

Trust the agents on these. Keep moving.

---

## How to Run a Structured Review

### Step 1 -- Forge Proposes

The proposer writes a structured proposal:

```
Proposal: <title>
By: <proposer agent>

## What
<What is being proposed, in 2-3 sentences>

## Why
<Rationale — what problem does this solve?>

## Trade-offs
<Known trade-offs and why they are acceptable>

## Alternatives Considered
<What else was considered and why it was rejected>
```

The proposal is saved to `.geas/decisions/pending/{proposal-id}.md`.

### Step 2 -- Critic Challenges

Compass spawns the designated Critic agent to review the proposal. The Critic must:

1. Read the proposal from `.geas/decisions/pending/{proposal-id}.md`
2. Evaluate against their domain expertise
3. Write a structured challenge:

```
Challenge: <proposal-id>
By: <critic agent>

## Assessment
<agree | challenge>

## Concerns
<specific technical or design concerns, if any>

## Alternative
<if challenging: a concrete alternative with trade-offs>

## Recommendation
<proceed as-is | modify with specifics | replace with alternative>
```

The challenge is appended to the same proposal file.

**The Critic must participate.** Skipping the Critic step is not allowed — even if the proposal seems obvious, a second perspective catches blind spots.

### Step 3 -- Compass Synthesizes

Compass reads both the proposal and the challenge, then presents a summary to the user:

```
[Compass] Decision needed: <proposal title>

Proposal by <proposer>:
  <1-2 sentence summary>

Critic (<critic agent>) says:
  <1-2 sentence summary of challenge/agreement>

Options:
  1. Accept proposal as-is
  2. Accept with modifications: <specific modifications from critic>
  3. Accept critic's alternative: <alternative summary>
  4. Reject — need more information

Recommendation: <Compass's recommendation based on project context>
```

### Step 4 -- User Confirms

The user selects an option or provides a modified decision. If the user does not respond (e.g., autonomous mode), Compass proceeds with their recommendation after noting the auto-decision.

---

## Output: DecisionRecord

After resolution, create a DecisionRecord:

```bash
mkdir -p .geas/decisions
```

Write to `.geas/decisions/{dec-id}.json` conforming to `schemas/decision-record.schema.json`:

```json
{
  "id": "dec-<NNN>",
  "proposal": "<what was proposed>",
  "proposer": "<agent>",
  "critic": "<agent>",
  "result": "accepted | modified | alternative | rejected",
  "summary": "<what was decided and why>",
  "key_concern": "<critic's main concern, if any>",
  "confirmed_by": "user | compass-auto",
  "timestamp": "<ISO 8601>"
}
```

Clean up the pending file:

```bash
rm .geas/decisions/pending/{proposal-id}.md
```

Then proceed with the decided approach.

---

## Resolution Criteria

The review is resolved when:

| Resolution | Example |
|------------|---------|
| User accepts the proposal | "Go with option 1" |
| User accepts with modifications | "Option 2, but with the alternative database" |
| User picks the alternative | "The critic's approach is better" |
| Compass auto-decides (autonomous mode) | Compass picks the strongest option and notes it |
