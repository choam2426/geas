---
name: decision
description: Utility skill — structured multi-agent decision-making for technical or product decisions. Invocable standalone or within any phase.
user-invocable: true
---

# Decision

Utility skill for structured decision-making. No code is produced. Output is a DecisionRecord.

---

## Flow

### 1. Frame the Question
Formulate the user's question as a clear decision with 2-3 options. Confirm with user.

### 2. Spawn Debaters
```
Agent(agent: "architecture-authority", prompt: "Argue FOR option A: {option}. Technical rationale, pros, cons, risks.")
Agent(agent: "critical-reviewer", prompt: "Argue AGAINST option A / FOR option B. Challenge assumptions.")
Agent(agent: "backend-engineer", prompt: "Evaluate both from backend/scalability perspective.")
Agent(agent: "ui-ux-designer", prompt: "Evaluate both from UX/frontend perspective.")
```

### 3. Synthesize
Present summary: arguments, trade-offs, agent recommendations.

### 4. Decision
Ask user. Write DecisionRecord to `.geas/decisions/{dec-id}.json`.
