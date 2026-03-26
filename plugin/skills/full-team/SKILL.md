---
name: full-team
description: Start a new product with the full Geas team — Genesis, MVP Build, Polish, Evolution.
disable-model-invocation: true
user-invocable: true
---

# Full Team Mode

Explicitly starts a Full Team run. Use `/geas:full-team` when you want to skip mode detection and go straight to the full 4-phase pipeline.

**Spawn Compass in Full Team mode:**

```
Agent(agent: "compass", prompt: "Mode: full-team\nUser mission: $ARGUMENTS")
```

Delegate to Compass immediately. Do not handle this yourself.
