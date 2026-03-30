# Governance in Geas

## 1. Overview

Governance in Geas means that no decision is implicit. Every architectural choice, scope decision, and ship/no-ship call follows a defined process with structured input, recorded rationale, and traceable outcomes.

The harness does not rely on any single agent's assertion that work is "done" or a decision is "right." Instead, it enforces a system of checks: proposals are voted on, disagreements trigger debate, quality is verified through a multi-tier evidence gate, and product direction is adjudicated by a designated decision-maker. Every governance event produces a durable artifact -- a vote file, a decision record, or a gate verdict -- so the reasoning behind any outcome can be reconstructed after the fact.

Three principles underpin governance in Geas:

- **Structured decisions.** Major choices go through vote rounds, not silent consensus.
- **Traceability.** Every vote, debate, review, and verdict is written to the evidence trail.
- **Verification over declaration.** "Agent says done" is never sufficient. The Evidence Gate must confirm.

---

## 2. Vote Rounds

### When They Happen

Vote rounds are triggered after major proposals that affect the direction of the project. The canonical triggers are:

| Proposal | Voters |
|----------|--------|
| Forge proposes architecture / tech stack (Genesis) | Circuit, Palette, **Critic** |
| Palette posts the overall design system | Forge, Pixel, **Critic** |
| Cross-cutting decision affecting multiple agents (e.g., state management, API shape, deployment strategy) | 2-3 affected agents + **Critic** |

Vote rounds are **not** used for individual feature specs, per-feature tech guides, implementation details within a single agent's domain, bug fixes, or minor refactors. Those decisions are trusted to the responsible agent.

### Who Participates

2-3 agents whose domain is affected by the proposal, plus Critic. The proposer is never a voter. Critic is **mandatory** in every vote round -- if Critic does not participate, the vote is invalid.

### Critic's Special Role

Critic is not just another voter. Even when agreeing with a proposal, Critic must identify risks, blind spots, and trade-offs. A vote round where Critic simply says "looks good" has failed its purpose. Critic's job is to stress-test the proposal so the team proceeds with eyes open, not with false confidence.

### Resolution Rules

- **Unanimous agree** -- proceed immediately. No further discussion.
- **Any disagree** -- triggers a structured debate (see Section 3).

### Evidence

Each voter writes their vote to a file:

```
.geas/evidence/genesis/vote-circuit.json
.geas/evidence/genesis/vote-palette.json
.geas/evidence/genesis/vote-critic.json
```

These files contain the agent's vote (agree/disagree), rationale, and any concerns. They persist as part of the project's decision trail.

---

## 3. Debate Protocol

### When Triggered

Debate occurs in three situations:

1. **Vote disagreement.** Any thumbs-down vote in a vote round automatically triggers debate.
2. **Explicit invocation.** The user or Compass can invoke the debate skill directly for any decision that needs structured discussion.
3. **Complex decisions.** Technical or product decisions with multiple viable options benefit from formal debate even without prior disagreement.

### Structure

The debate skill produces a **DecisionRecord**, not code. Its flow:

1. **Frame the question.** The decision is formulated as a clear choice with 2-3 concrete options, confirmed with the user.
2. **Spawn debaters.** Agents argue for and against each option from their domain perspective:
   - Forge argues the technical merits of each option.
   - Critic challenges assumptions and argues against the leading option.
   - Circuit evaluates from a backend/scalability perspective.
   - Palette evaluates from a UX/frontend perspective.
3. **Proposer responds.** If the debate was triggered by a vote disagreement, the original proposer responds to the dissenting argument -- counter-arguing with evidence, conceding the point, or proposing a modified approach.
4. **Rounds continue** until one side concedes, a hybrid is proposed and accepted, or 3 rounds pass without resolution.
5. **Tiebreaker.** If no resolution after 3 rounds, Nova is spawned as the final arbiter. Nova reads all arguments and posts a binding decision with reasoning and accepted trade-offs.

### Output

Every debate produces a DecisionRecord written to `.geas/decisions/{dec-id}.json`. The record captures the context, options considered, final decision, reasoning, and trade-offs. See Section 6 for the full format.

### What Counts as Resolution

| Resolution Type | Example |
|----------------|---------|
| One side concedes with reasoning | "Fair point -- the latency cost is real, I withdraw my objection." |
| A hybrid is proposed and accepted | "If we combine your API shape with my caching approach, we get both benefits." |
| Nova makes a final call | After 3 unresolved rounds, Nova decides with explicit reasoning. |

---

## 4. Critic's Role

Critic is the harness's institutional skeptic. The role exists to prevent groupthink and ensure decisions are stress-tested before execution.

### Mandatory Participation

- **Every vote round.** Critic must vote and must present risks or blind spots, even when the overall vote is "agree."
- **Every pre-ship review.** Before Nova delivers a ship/iterate/cut verdict on any task, Critic reviews all evidence and challenges readiness. This review is written to `.geas/evidence/{task-id}/critic-review.json`.

### What Critic Does

- Identifies the biggest technical risk in a proposed architecture.
- Questions whether a feature is solving a real problem or is a nice-to-have disguised as a must-have.
- Challenges plan estimates -- which task will take 3x longer than expected?
- Points out missing dependencies, untested assumptions, and over-engineering.
- Asks "what happens if we're wrong?" before the team commits to a direction.

### Critique Format

Critic's output follows a structured format:

```
[Critic] Challenge -- <what is being questioned>

Risk: <what could go wrong>
Evidence: <why, with data/analogies/precedent>
Alternative: <what could be done instead>
Trade-off: <what would be lost with the alternative>

Verdict: Disagree -- needs reconsideration
         OR Caution -- proceed but watch for X
         OR Grudging Agree -- concerns noted but not blocking
```

### Rules of Engagement

- Always provide alternatives. Criticism without alternatives is not useful.
- Be specific. "This auth flow has no rate limiting and will be brute-forced in hours" beats "this feels wrong."
- Pick battles. Challenge 2-3 things deeply rather than 10 things shallowly.
- Concede gracefully when concerns are addressed.
- The goal is better decisions, not being right.

---

## 5. Nova's Product Judgment

Nova is the final authority on product direction. While Compass orchestrates process and Forge owns technical architecture, Nova owns the question: "Should we ship this?"

### Verdicts

Nova issues one of three verdicts per task:

- **Ship.** The feature meets acceptance criteria, delivers user value, and is ready for release.
- **Iterate.** The feature partially meets criteria. Nova provides specific feedback on what must improve. The task is re-dispatched with Nova's feedback as new context. This counts against the retry budget.
- **Cut.** The feature is fundamentally misaligned with the mission, or the cost of fixing it exceeds its value. The task status moves to `"failed"` and a DecisionRecord is written.

### When Nova Is Invoked

1. **Per-task product review.** After every task passes the Evidence Gate (Tiers 1-2) and Critic's pre-ship review, Nova reviews all evidence and delivers a verdict. This is step 2.8 of the MVP Build phase and is mandatory.
2. **Escalation decisions.** When a task exhausts its retry budget and the escalation policy calls for `"nova-decision"`, Nova receives full context and decides: scope cut, feature drop, alternative approach, or push through.
3. **Debate tiebreaker.** After 3 unresolved debate rounds, Nova reads all arguments and makes the final call.
4. **Final briefing (Evolution).** At the end of the project, Nova delivers a strategic summary reviewing all shipped features, assessing overall product quality, and making recommendations.

### What Nova Considers

- **User value.** Does this feature solve a real problem for the target user?
- **Acceptance criteria.** Are all contract criteria met, as verified by the Evidence Gate?
- **Quality signals.** Code review (Forge), QA results (Sentinel), security review (Shield).
- **Risk assessment.** Critic's pre-ship review -- what are the known risks and are they acceptable?
- **Mission alignment.** Does this feature serve the core value proposition defined in Genesis?

### Finality

Nova's word is final on product direction. Other agents can disagree and present evidence, but once Nova renders a verdict, the team executes it. This prevents endless deliberation. If new information surfaces later, Nova can be re-invoked with updated context.

---

## 6. DecisionRecord Format

Every significant governance event -- escalations, pivots, debate resolutions, major scope changes -- produces a DecisionRecord. These records form the institutional memory of the project.

### Structure

```json
{
  "version": "1.0",
  "id": "dec-003",
  "title": "Escalation: Auth flow failed 3 fix attempts",
  "context": "Evidence gate failed repeatedly. Tier 1 passed but Tier 2 failed on criterion 'OAuth token refresh handles expired tokens gracefully'.",
  "options": [
    "Rewrite the token refresh logic from scratch",
    "Switch to a well-tested OAuth library",
    "Drop OAuth support and use API keys only"
  ],
  "decision": "Switch to a well-tested OAuth library",
  "reasoning": "The custom implementation has failed 3 times on edge cases. A battle-tested library eliminates this class of bugs. The integration cost is ~1 task.",
  "trade_offs": "Adds a dependency. Less control over token storage strategy. Library may not support all planned OAuth providers.",
  "decided_by": "nova",
  "participants": ["sentinel", "circuit", "forge"],
  "related_task_id": "task-007",
  "created_at": "2026-03-25T14:30:00Z"
}
```

### Fields

| Field | Description |
|-------|-------------|
| `id` | Unique identifier (e.g., `dec-001`, `dec-002`) |
| `title` | One-line summary of the decision |
| `context` | What situation prompted this decision |
| `options` | The alternatives that were considered |
| `decision` | Which option was chosen |
| `reasoning` | Why this option was chosen over others |
| `trade_offs` | What is being sacrificed or accepted as risk |
| `decided_by` | Which agent (or human) made the final call |
| `participants` | All agents involved in the decision process |
| `related_task_id` | The task that triggered this decision, if any |
| `created_at` | ISO 8601 timestamp |

### Storage

DecisionRecords are written to `.geas/decisions/{dec-id}.json` and conform to `schemas/decision-record.schema.json`. They are also logged as events in `.geas/ledger/events.jsonl`.

---

## 7. Escalation Paths

When a task fails its Evidence Gate, Geas does not silently retry or silently drop. It follows a bounded, traceable escalation path.

### Level 1: Verify-Fix Loop

When the Evidence Gate fails, the system enters a fix loop:

1. The appropriate fixer is identified -- Pixel for frontend bugs, Circuit for backend bugs, or both.
2. The fixer receives a ContextPacket with the specific failures, original acceptance criteria, and files changed.
3. After the fix, the Evidence Gate re-runs Tiers 1 and 2.
4. If the gate passes, the task proceeds to Nova's product review (Tier 3).
5. If the gate fails again, the loop repeats up to the task's `retry_budget` (default: 3).

Each iteration is tracked in `.geas/state/run.json`. Every fix attempt produces its own evidence file (e.g., `.geas/evidence/{task-id}/circuit-fix-2.json`).

### Level 2: Escalation Policy

When the retry budget is exhausted, the system follows the task's `escalation_policy`:

#### `"forge-review"` (default)

Forge is spawned for architectural root-cause analysis. Forge reads the TaskContract and all evidence, then determines whether the failure stems from a fundamental design issue or a fixable implementation bug. If Forge identifies a fixable root cause, one more fix attempt is granted. If Forge determines the approach is broken, the escalation moves to Nova.

#### `"nova-decision"`

Nova receives full context -- TaskContract, all evidence bundles, all gate verdicts -- and makes a strategic call:
- **Scope cut.** Reduce the task's requirements to something achievable.
- **Feature drop.** Remove the feature entirely.
- **Alternative approach.** Pivot to a different implementation strategy.
- **Push through.** Grant additional retry budget if the team is close.

#### `"pivot"`

The full pivot protocol is invoked. This is reserved for situations where the failure indicates a fundamental problem with the project direction, not just a single task.

### Every Escalation Produces a DecisionRecord

No escalation is silent. Every time the system moves from Level 1 to Level 2, a DecisionRecord is written to `.geas/decisions/` capturing the context, options considered, decision made, and reasoning. This ensures that even failures are traceable.

### Visual Summary

```
Evidence Gate PASS?
  YES --> Critic pre-ship review --> Nova product review
  NO  --> Fix (Pixel/Circuit) --> Re-gate
          PASS? --> Critic --> Nova review
          NO    --> Fix --> Re-gate (iteration 2)
                    ...up to retry_budget...
                    Budget exhausted?
                    --> escalation_policy:
                       forge-review --> Forge root-cause analysis
                       nova-decision --> Nova strategic call
                       pivot --> Full pivot protocol
                    --> DecisionRecord written
```

---

## 8. Human Intervention

Geas is designed for human-in-the-loop operation, not human-out-of-loop. The governance system assumes a human stakeholder is present and has ultimate authority.

### Human Feedback Has Highest Priority

When building ContextPackets, human feedback is treated as the highest-priority input. A human directive overrides any agent's prior analysis or recommendation. If a human says "this approach is wrong," the system treats that as stronger signal than any agent's assessment.

### ContextPackets Include Human Feedback

Every ContextPacket generated for an agent includes relevant human feedback. Agents do not operate in isolation from human input -- they receive it as part of their standard briefing.

### Humans Can Override Any Agent Decision

The governance mechanisms described in this document -- vote rounds, debates, Nova's verdicts, escalation policies -- are all subordinate to human judgment. A human can:

- Override a Nova verdict (ship something Nova wanted to cut, or cut something Nova approved).
- Resolve a debate directly without waiting for agent rounds.
- Bypass the retry budget and grant additional attempts.
- Change task priorities, acceptance criteria, or scope at any time.
- Veto an architectural decision that passed a vote round.

### The System Supports, Not Replaces, Human Judgment

Agent governance exists to reduce the cognitive load on human stakeholders, not to exclude them. The structured process means that when a human does intervene, they have access to:

- The full decision trail (DecisionRecords).
- Every agent's reasoning (vote files, evidence bundles).
- Clear escalation points where human input is most valuable.
- Structured summaries (Nova briefings, Compass vote summaries) rather than raw conversation logs.

The goal is that a human can step in at any point, understand what happened and why, and make an informed decision -- without having to read every agent interaction from scratch.
