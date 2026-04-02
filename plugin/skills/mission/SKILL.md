---
name: mission
description: >
  Build a product, add a feature, or make a technical decision.
  Activates the Geas multi-agent team with contract-driven verification.
  Always follows 4 phases: Discovery → Build → Polish → Evolution, scaled to the request.
---

# Mission

Invoke `/geas:orchestrating` to start the Geas orchestrator.

The orchestrating skill handles setup, intake, and the 4-phase execution pipeline (Discovery → Build → Polish → Evolution). For decision-only requests (no code), it routes to `/geas:decision`.

**Do NOT spawn an orchestrator agent. Orchestrating is a skill, not an agent.**
