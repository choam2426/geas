---
name: debate
description: Run a structured multi-agent debate to make a technical or product decision before implementation.
disable-model-invocation: true
user-invocable: true
---

# Debate Mode

Explicitly starts a Debate. Use `/geas:debate` when you want a structured discussion between agents before writing any code.

**Spawn Compass in Debate mode:**

```
Agent(agent: "compass", prompt: "Mode: debate\nUser mission: $ARGUMENTS")
```

Delegate to Compass immediately. Do not handle this yourself.
