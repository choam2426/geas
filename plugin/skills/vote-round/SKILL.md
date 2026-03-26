---
name: vote-round
description: Vote Round protocol — solicit structured votes from agents after major proposals. Triggers debate if disagreement found.
---

# Vote Round Protocol

After a major proposal (architecture, design system, cross-cutting decision), run a Vote Round to actively solicit agreement or disagreement before proceeding.

---

## When to Trigger a Vote Round

| Proposal | Voters |
|----------|--------|
| Forge proposes architecture / tech stack (Genesis) | Circuit, Palette |
| Palette posts the overall design system (not per-feature specs) | Forge, Pixel |
| Cross-cutting decision affecting multiple agents (e.g., state management, API shape, deployment strategy) | 2-3 agents whose domain is affected |

## What NOT to Vote On

- Individual feature design specs (too granular)
- Per-feature tech guides from Forge
- Implementation details within a single agent's domain
- Bug fixes or minor refactors

Trust the agents on these. Keep moving.

---

## How to Run a Vote Round

### Step 1 — Identify Voters
- Select 2-3 agents whose domain is affected by the proposal.
- Never include the proposer as a voter.

### Step 2 — Spawn Voters
- Use the `Agent` tool to spawn each voter with this prompt:

```
A proposal has been posted on <ISSUE_ID> by <PROPOSER>:
"<brief summary of the proposal>"

Read the full comment using linear-cli, then post a VOTE comment:
- thumbs up Agree: <one sentence why you support this>
- thumbs down Disagree: <what's wrong> + <your alternative> + <trade-off>

Pick ONE. Be honest — don't agree just to be fast.
```

### Step 3 — Read Votes
- Use `linear-cli` to read all vote comments on the issue.
- Tally: count thumbs up and thumbs down votes.

---

## If All Thumbs Up

Proceed to the next step immediately. No further discussion needed.

---

## If Any Thumbs Down — Debate Round

When any voter disagrees, enter a structured debate:

### Round 1 — Proposer Responds
- Re-spawn the **original proposer** with the disagree argument:
  ```
  <Voter> disagrees with your proposal on <ISSUE_ID> because: <reason>.
  Read their comment on <ISSUE_ID> and respond:
  - Counter-argue with evidence, or
  - Concede the point, or
  - Propose a modified approach that addresses their concern
  ```

### Round 2+ — Continue Until Resolution
- After the proposer responds, re-spawn the dissenting voter to either:
  - Accept the response (concede)
  - Counter-argue with new evidence
  - Propose a hybrid
- Continue rounds until resolution.

### Maximum 3 Rounds
- If after 3 rounds no resolution is reached, spawn **Nova** as tiebreaker.
- Nova reads ALL comments and posts a final decision with:
  - Which approach to take
  - Which arguments convinced the decision
  - What trade-offs are being accepted

---

## What Counts as Resolution

The vote round is resolved when any of these occur:

| Resolution | Example |
|------------|---------|
| One side concedes with reasoning | "Fair point because the latency cost is real..." |
| A hybrid is proposed and accepted | "If we combine your API shape with my caching approach..." |
| Nova makes a final call | After 3 unresolved rounds |

---

## Output

After resolution, Compass posts a summary comment on the issue:
```
[Compass] Vote resolved:
- Proposal: <what was proposed>
- Result: <Approved / Modified / Overruled>
- Key concern: <if any thumbs down, what was the issue>
- Resolution: <what was decided and why>
```

Then proceed with the decided approach.
