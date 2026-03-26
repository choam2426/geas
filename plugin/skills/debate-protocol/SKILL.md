---
name: debate-protocol
description: Debate Mode — multi-round agent discussion with no code. Use when the user wants decision-making before implementation.
---

# Debate Mode Protocol

Pure discussion, no code written. Multi-round agent debate ending with a Nova resolution.

Use this when the request is a decision-only discussion.

Natural-language intent is enough. `debate:` is optional shorthand, not required syntax.

## File Paths

| Purpose | Path |
|---------|------|
| Checkpoint state | `.geas/memory/_project/state.json` |
| Linear config (IDs) | `.geas/memory/_project/linear-config.json` |

---

## Hard Rule

**Compass is the MODERATOR only. Compass never speaks as another agent.**

If you write `[Forge]` or `[Circuit]` or any agent name prefix in your own output, you have violated this rule. Only spawned agents write their own comments. Your role is to orchestrate, read comments, and direct the debate.

---

## Step 1 — Create the Debate Arena

- Tool: `linear-cli`
- Reuse existing `.geas/memory/_project/linear-config.json` if it exists. If not, bootstrap Linear first (discover team, create project, save config).
- Create a Linear issue: `create-issue --title "[debate] <question>" --label-ids <architecture-label-id> --team-id <UUID>`
- Save the issue identifier (e.g., MY-54).
- Update state:
  ```json
  {
    "mode": "debate",
    "current_work": {
      "issue_id": "<ID>",
      "issue_title": "[debate] <question>",
      "step": "round-1"
    }
  }
  ```

## Step 2 — Round 1: Spawn Agents for Initial Positions

- Tool: `Agent` (one call per agent)
- Spawn 3-4 relevant agents depending on the topic:
  - Architecture / tech decisions: spawn **Forge** and **Circuit**
  - UX / design decisions: spawn **Palette**
  - Product / strategy: spawn **Nova** (but ONLY as final resolver, NOT in Round 1)
- **Do NOT spawn Nova in Round 1.** Nova decides at the end.

Each agent's prompt MUST include:
```
A debate issue <ISSUE_ID> has been created: "<question>"

Your task:
1. Use linear-cli to read the issue and any existing comments
2. Post your position as a Linear comment on <ISSUE_ID>
3. Take a clear stance — do not hedge
4. Support with evidence, data, benchmarks, or experience
5. @mention any agent whose domain this overlaps with
```

## Step 3 — Read Round 1 Results

- Tool: `linear-cli` -> `list-comments --issue-id <ISSUE_ID>`
- Read every comment. Map out:
  - Who disagrees with whom?
  - What @mentions need responses?
  - What went unchallenged?
- Update state: `"step": "round-2"`

## Step 4 — Round 2: Spawn Agents to Respond

- Tool: `Agent` (one call per agent that was challenged or @mentioned)

Each agent's prompt MUST include:
```
The debate on <ISSUE_ID> continues. In Round 1:
- <Agent A> argued: <summary of their position>
- <Agent B> challenged you by saying: <specific quote/point>

Your task:
1. Use linear-cli to read ALL comments on <ISSUE_ID>
2. Post a response comment: concede (say what convinced you), counter-argue (with new evidence), or propose a hybrid
3. Be specific — reference the other agent's actual arguments
```

## Step 5 — Read Round 2 Results

- Tool: `linear-cli` -> `list-comments --issue-id <ISSUE_ID>`
- Assess: Is there substantive disagreement remaining?
- If yes and round count < 3: run another round (repeat Step 4).
- **Maximum 3 rounds total.** After 3 rounds, go to Nova regardless.

## Step 6 — Resolution: Spawn Nova

- Tool: `Agent` -> spawn **Nova**

Nova's prompt:
```
Debate issue <ISSUE_ID> needs your final decision.

Your task:
1. Use linear-cli to read ALL comments on <ISSUE_ID>
2. Post your verdict as a [Nova] comment:
   - Decision: what approach to take
   - Reasoning: which specific arguments from which agents convinced you
   - Trade-offs: what you're knowingly sacrificing
```

## Step 7 — Close Out

- Tool: `linear-cli`
- Update issue status to **Done**.
- Update `.geas/memory/_project/state.json`:
  - Add the decision to the `decisions` array.
  - Clear `current_work`.

---

## Agent Selection Guide

| Topic | Agents to Spawn (Round 1) |
|-------|--------------------------|
| Architecture / stack choice | Forge, Circuit |
| Database / data model | Forge, Circuit |
| UI framework / design system | Palette, Pixel |
| API design | Circuit, Forge |
| Product strategy / scope | Forge, Palette (Nova resolves) |
| Security approach | Shield, Forge, Circuit |
| Testing strategy | Sentinel, Forge |
| Deployment / infra | Pipeline, Forge |
| Full-stack decisions | Forge, Circuit, Palette |

## Resolution Criteria

The debate is resolved when any of these occur:
- One side concedes with reasoning: "Fair point because..."
- A hybrid is proposed and accepted by both parties
- Nova makes a final call (after max rounds or persistent disagreement)
