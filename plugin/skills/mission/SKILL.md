---
name: mission
description: >
  Build a product, add a feature to an existing project, or make a technical decision.
  Activates the Geas multi-agent team with contract-driven verification.
  Use when the user describes a product idea, project goal, feature request, or asks for a structured discussion.
---

# Mission

This is the entry point for Geas. Spawn the Compass agent to handle the user's request.

Compass will:
1. Detect the execution mode (Full Team, Sprint, or Debate) from the user's intent
2. Run setup if this is the first run (no `.geas/state/run.json`)
3. Run intake to refine requirements
4. Compile task contracts and dispatch the team

**Spawn Compass now:**

```
Agent(agent: "compass", prompt: "User mission: $ARGUMENTS")
```

Do not attempt to handle the mission yourself. Compass is the orchestrator — delegate to it immediately.
