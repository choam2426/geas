---
name: deliberating-on-proposal
description: Invoked by a spawned voter during a deliberation. The voter reads the proposal and supporting artifacts, forms an independent judgment, and returns one vote (agree, disagree, or escalate) with rationale and dissent notes. Does not circulate votes across voters.
user-invocable: false
---

# Deliberating on Proposal

## Overview

You have been summoned as a voter in a Geas deliberation. Read the proposal and the supporting artifacts, form your own judgment from the stance of your assigned slot, and return a single vote with rationale. The convening skill collects all voters' returns and writes the deliberation entry; you never write to `.geas/` here.

<HARD-GATE> Voters are independent. You do not see other voters' votes before returning yours. Your rationale must be non-empty and cite the artifacts you read. Agreement with dissenting concerns is still agreement — record concerns honestly even when voting `agree`.

## When to Use

- A parent skill (`convening-deliberation`) has dispatched you as a voter for a task-level or mission-level deliberation.
- You were handed: the proposal text, a list of supporting artifact paths, and the slot you are voting as.
- Do NOT invoke this skill from any other context — voters are only summoned by a convening round.
- Do NOT try to recruit additional voters; that is the convening skill's job.

## Preconditions

- A proposal text is provided.
- Supporting artifact paths are provided and exist under `.geas/`.
- Your slot identity is stated (challenger / risk-assessor / operator / communicator / design-authority / decision-maker / etc.).
- Mission mode is `full_depth` (enforced by the CLI on the convening side, but you can stop and return `escalate` with a note if called in the wrong mode).

## Process

1. **Read the proposal.** Understand exactly what is being decided. If ambiguous, that is itself input to your rationale.
2. **Read every supporting artifact.**
   - Task contract, implementation evidence, prior review entries, phase-review, and any prior deliberation on the same topic.
   - Use the read-only CLI surfaces where helpful: `geas mission state`, `geas evidence list`, `geas event query`.
3. **Form your judgment from your slot's stance.** Your system prompt defines the lens (challenger = adversarial, risk-assessor = failure modes, operator = operability, design-authority = structural, decision-maker = mission-level acceptance, etc.).
4. **Pick one vote**:
   - `agree` — the proposal should become the path forward as stated.
   - `disagree` — the proposal should not proceed in its current form.
   - `escalate` — the decision belongs above deliberation (mission verdict, user call, or a different slot's sole judgment).
5. **Write rationale.** One or more sentences stating why, citing the artifact paths you read. Keep it plain; do not hedge.
6. **Note dissent or concerns even when agreeing.** If you vote `agree` but see caveats, state them in the rationale. The convening skill preserves dissent as part of the audit trail.
7. **Return the vote to the convening skill.** Hand back three fields: `voter` (your slot id), `vote` (`agree` / `disagree` / `escalate`), and `rationale` (one or more sentences citing the artifacts you read). The convening skill collects every voter's return and writes the single deliberation entry via `geas deliberation append`. Do not call `geas deliberation append` yourself, and do not attempt to write to `.geas/` from the voter context.

## Red Flags

| Excuse | Reality |
|---|---|
| "I'll abstain since I'm uncertain" | Abstention is not a vote. If the proposal is genuinely undecidable from your slot's lens, return `escalate` with a rationale that names what extra input is needed. |
| "I'll say agree to keep the deliberation moving" | Deliberation only helps when votes are honest. Reluctant `agree` with hidden disagreement corrupts the record. Say `disagree` or `escalate` if that is your real judgment. |
| "I'll peek at another voter's rationale before writing mine" | Voters are independent by construction. Cross-checking votes mid-round destroys the independence the result depends on. |
| "I'll skip reading the supporting artifacts — the proposal is clear" | The proposal only frames the question. Rationale is judged by whether it cites the artifacts that informed it. |
| "I'll leave rationale short — the vote speaks for itself" | CLI rejects entries with empty rationale. Short is fine; absent is not. |

## Invokes

No CLI writes from this skill. The convening skill writes `geas deliberation append` after collecting every voter's return.

Read-only CLI helpers allowed while forming the vote:
| CLI command | Purpose |
|---|---|
| `geas mission state --mission <id>` | Confirm current phase / approval flags. |
| `geas evidence list --mission <id> --task <id>` | Pull evidence history for the task under deliberation. |
| `geas event query --mission <id>` | Trace the sequence of actions that led to the proposal. |

## Outputs

- A single vote object returned to the convening skill. No `.geas/` writes.

## Failure Handling

- **Supporting artifact missing**: stop; return `escalate` with rationale naming the missing artifact. Do not invent substitutes.
- **Proposal text is ambiguous**: return `disagree` or `escalate` with a rationale that identifies the ambiguity. Do not guess what was meant.
- **Wrong-mode detection** (mission is not `full_depth`): return `escalate` with a note; the convening skill will halt before writing.
- **Your slot is both implementer and reviewer on the same task**: refuse the vote and return `escalate` with that note. The convening skill should have caught this and picked a different agent.

## Related Skills

- **Invoked by**: `convening-deliberation` (one spawn per voter slot, in parallel).
- **Invokes**: none. Read-only CLI helpers only.
- **Do NOT invoke**: `reviewing-task` — that is evidence writing, not voting. `deciding-on-approval` — decision-maker's role inside a deliberation is as a voter, not an adjudicator.

## Remember

- One vote, honest rationale, cite artifacts.
- Independence: no peeking at other voters.
- Dissent is captured even when you vote `agree`.
- Escalate beats a coerced agreement when the decision is above your lens.
- You never write to `.geas/` here; the convening skill aggregates and writes.
