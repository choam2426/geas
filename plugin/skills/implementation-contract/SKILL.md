---
name: implementation-contract
description: Pre-implementation agreement — worker proposes concrete action plan, quality-specialist and design-authority approve before implementation begins. Prevents wasted implementation cycles from misunderstood requirements.
---

# Implementation Contract

Worker and reviewers agree on "what done looks like" before any code is written.

## When to Use

Orchestrator invokes this skill after Design Guide (design-authority) and before Implementation, for every task.

## Purpose

Eliminates the waste cycle: "worker misunderstands requirement → builds wrong thing → quality verification catches it → rework." The worker reads the ContextPacket (including communication_specialist's design and design-authority's design guide), then explicitly states what they plan to do and how they'll prove it's done. quality-specialist and design-authority approve before implementation begins.

## Inputs

1. **TaskContract** — from `.geas/missions/{mission_id}/tasks/{task-id}/contract.json`
2. **ContextPacket** — the worker's packet at `.geas/missions/{mission_id}/tasks/{task-id}/packets/{worker}.md`
3. **Prior evidence** — communication_specialist design, design-authority design guide (if available)

## Process

### Step 1: Worker Drafts Contract

Spawn the assigned worker to read their ContextPacket and write a contract:

```
Agent(agent: "{worker}", prompt: "Read .geas/missions/{mission_id}/tasks/{task-id}/packets/{worker}.md and .geas/missions/{mission_id}/tasks/{task-id}/contract.json. Before implementing, write your implementation contract via CLI. Run: geas task record add --task {task-id} --section implementation_contract --set planned_actions=... (or use --file with a JSON file). Required fields:
- planned_actions: concrete steps you will take
- edge_cases: edge cases you plan to handle
- state_transitions: state changes your implementation introduces (if any)
- non_goals: what you explicitly will NOT do
- demo_steps: step-by-step procedure to verify your work is complete
Set status to 'draft'.")
```

Verify that `record.json` now contains the `implementation_contract` section.

### Step 2: quality-specialist Reviews

Spawn quality-specialist to review the contract from a quality verification perspective:

```
Agent(agent: "quality-specialist", prompt: "Read the implementation_contract section from .geas/missions/{mission_id}/tasks/{task-id}/record.json and .geas/missions/{mission_id}/tasks/{task-id}/contract.json. Review this implementation contract:
- Are demo_steps sufficient to verify all acceptance criteria?
- Are there missing edge_cases that should be handled?
- Are non_goals reasonable — anything critical being excluded?
- Would you be able to test this based on what's described?
Write your assessment. If acceptable, approve. If not, list specific concerns.")
```

### Step 3: design-authority Reviews

Spawn design-authority to review the contract from a technical perspective:

```
Agent(agent: "design-authority", prompt: "Read the implementation_contract section from .geas/missions/{mission_id}/tasks/{task-id}/record.json, .geas/missions/{mission_id}/tasks/{task-id}/contract.json, and any prior design guide at .geas/missions/{mission_id}/tasks/{task-id}/evidence/design-authority.json. Review this implementation contract:
- Are planned_actions consistent with the design guide?
- Are non_goals appropriate — nothing critical being excluded?
- Are there technical edge_cases the worker missed?
- Is the approach viable or heading toward a dead end?
Write your assessment. If acceptable, approve. If not, list specific concerns.")
```

### Step 4: Resolve

- **Both approve** → Update contract status to `"approved"`, set `approved_by`. Proceed to Implementation.
- **Revision requested** → Return concerns to worker. Worker updates contract and resubmits. Allow 1 revision cycle, then design-authority makes final call.

## Output

Write the contract to record.json via CLI:
```bash
Bash("geas task record add --task {task-id} --section implementation_contract --file <contract_json_file>")
```
The CLI enforces schema validation and auto-manages timestamps.

Log the event via CLI:
```bash
Bash("geas event log --type implementation_contract --task {task-id} --data '{\"status\":\"approved|revision_requested\"}'")
```

## Rules

1. **Every implementation task gets a contract** — no skipping even for "simple" tasks
2. **Workers must be honest about non_goals** — undeclared scope is the top source of rework
3. **demo_steps must cover every acceptance criterion** — if a criterion has no demo step, the contract is incomplete
4. **One revision cycle maximum** — after that, design-authority decides and we move forward
5. **Contract does not replace TaskContract** — it supplements it with the worker's concrete plan
