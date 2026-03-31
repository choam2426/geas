# Debate Mode Guide

## When to Use

Debate is for **structured decision-making without code**. Use it when you need agents to discuss and decide on:

- Architecture choices
- Technology selection
- Design direction
- Strategic pivots
- Trade-off analysis
- Process decisions

Debate produces a **DecisionRecord** — no implementation, just reasoning and consensus.

## How It Works

**1. Frame the Question**
- Describe the decision you need to make
- Identify 2–3 clear options
- Provide context (existing codebase, constraints, why this matters)

**2. Spawn Debaters**
The system spawns agents to argue positions:
- **Forge** — argues FOR one option with technical rationale
- **Critic** — argues AGAINST and challenges assumptions
- **Circuit** — evaluates both from backend/scalability perspective
- **Palette** — evaluates both from UX/frontend perspective

**3. Synthesize**
Arguments are summarized. Trade-offs are acknowledged. Recommendations are noted.

**4. Decide**
You make the final call (or the system does, based on strongest evidence). A **DecisionRecord** is written to `.geas/decisions/` with the decision, rationale, and who participated.

## Output

Each debate produces a **DecisionRecord** containing:

- **The decision** — which option was chosen and why
- **Options considered** — pros, cons, and risks for each
- **Trade-offs** — what you're gaining and losing
- **Participants** — which agents argued which positions
- **Evidence** — specific technical points cited by each agent

## Tips

- **Frame clearly** — the better your question, the better the debate
- **Provide context** — existing code, constraints, and time pressure all matter
- **Trust the structure** — Critic's job is to challenge weak arguments
- **Keep it focused** — 2–3 options is ideal; more creates noise
- **Use results** — the DecisionRecord is traceable evidence for your choice
