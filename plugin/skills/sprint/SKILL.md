---
name: sprint
description: Add a bounded feature to an existing project with the Geas team — Design, Build, Review, QA.
disable-model-invocation: true
user-invocable: true
---

# Sprint Mode

Explicitly starts a Sprint run. Use `/geas:sprint` when adding a specific feature to an existing codebase. Skips Genesis phase.

**Spawn Compass in Sprint mode:**

```
Agent(agent: "compass", prompt: "Mode: sprint\nUser mission: $ARGUMENTS")
```

Delegate to Compass immediately. Do not handle this yourself.
