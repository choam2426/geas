---
name: vote-round
description: Parallel agent voting on a proposal — agree/disagree with rationale. challenger always participates. Disagreement triggers decision.
---

# Vote Round

Structured parallel voting on a major proposal. Multiple agents evaluate independently and vote. Disagreement triggers a structured decision before proceeding.

---

## When to Use

Orchestrator invokes this after a major proposal that affects project direction:

| Proposal | Voters |
|----------|--------|
| Architecture / tech stack (Specifying) | implementer, communication_specialist, challenger |
| Overall design system | design-authority, implementer, challenger |
| Cross-cutting decision (state management, API shape, deployment) | Affected agents + challenger |

**challenger MUST participate in every vote round.** The challenger is instructed to play devil's advocate and identify risks even when broadly in agreement.

Vote rounds also handle structured decisions (previously decision skill) and pivot decisions (previously pivot-protocol).

## What NOT to Vote On

- Individual feature design specs (too granular)
- Per-feature design guides
- Implementation details within a single agent's domain
- Bug fixes or minor refactors

Trust the agents on these. Keep moving.

---

## Process

### Step 1: Identify Voters

orchestration_authority selects 2-4 voters based on the proposal's domain. challenger is always included.

### Step 2: Spawn Voters in Parallel

All voters run simultaneously. Each reads the proposal and writes a vote file:

```
Agent(agent: "{voter}", prompt: "Read the proposal at {proposal_path}. Vote agree or disagree with rationale. If you agree, still note any concerns or risks. Write to {output_path}")
```

Each vote file must contain:
- **vote**: `agree` or `disagree`
- **severity**: (required if vote is `disagree`) `minor` or `major`
  - `minor`: concrete amendment proposed, compatible with the proposal's direction
  - `major`: fundamental objection, proposal replacement or full decision needed
- **rationale**: why
- **concerns**: risks or blind spots identified (even if voting agree)
- **alternative**: if disagreeing, a concrete alternative with trade-offs

### Step 3: Collect and Evaluate

After all voters return, read each vote file.

- **All agree** → proceed to the next pipeline step.
- **Any disagree with severity: minor** → `approved_with_amendments`:
  1. Incorporate each minor voter's alternative as an amendment to the proposal.
  2. Write a DecisionRecord with `status: "approved_with_amendments"` listing all amendments.
  3. Mark the dissenting voter's stance as `disagree_resolved`.
  4. Proceed without decision.
- **Any disagree with severity: major** → `decision_triggered`:
  1. Orchestrator facilitates structured decision resolution based on the vote results, using the proposal and all vote files as context.
  2. After decision resolution, re-vote (one re-vote maximum).
  3. If still no consensus after re-vote, orchestration_authority synthesizes a decision and the user decides.

### Step 4: Log Result

**[MANDATORY]** Log vote result via CLI:
```bash
Bash("geas event log --type vote_round --data '{\"proposal\":\"...\",\"voters\":[...],\"result\":\"unanimous|approved_with_amendments|decision_triggered\"}'")
```

---

## Output

Vote evidence files at the location specified by the caller (e.g., `.geas/missions/{mission_id}/evidence/specifying/vote-{agent}.json` for Specifying votes).

---

## Rules

1. **challenger always participates** — no exceptions, even if the proposal seems obvious
2. **Voters are independent** — they do not see each other's votes before voting
3. **Disagreement is not failure** — minor disagreements become amendments, major disagreements trigger structured decision. Both produce better decisions than ignoring dissent.
4. **One re-vote maximum** — after decision, one more vote round. If still no consensus, orchestration_authority synthesizes and the user decides.
