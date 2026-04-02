---
name: implementation-contract
description: Pre-implementation agreement — worker proposes concrete action plan, qa_engineer and architecture_authority approve before coding begins. Prevents wasted implementation cycles from misunderstood requirements.
---

# Implementation Contract

Worker and reviewers agree on "what done looks like" before any code is written.

## When to Use

Orchestrator invokes this skill after Tech Guide (architecture_authority) and before Implementation, for every task.

## Purpose

Eliminates the waste cycle: "worker misunderstands requirement → builds wrong thing → QA catches it → rework." The worker reads the ContextPacket (including ui_ux_designer's design and architecture_authority's tech guide), then explicitly states what they plan to do and how they'll prove it's done. qa_engineer and architecture_authority approve before implementation begins.

## Inputs

1. **TaskContract** — from `.geas/tasks/{task-id}.json`
2. **ContextPacket** — the worker's packet at `.geas/packets/{task-id}/{worker}.md`
3. **Prior evidence** — ui_ux_designer design, architecture_authority tech guide (if available)

## Process

### Step 1: Worker Drafts Contract

Spawn the assigned worker to read their ContextPacket and write a contract:

```
Agent(agent: "{worker}", prompt: "Read .geas/packets/{task-id}/{worker}.md and .geas/tasks/{task-id}.json. Before implementing, write your implementation contract to .geas/contracts/{task-id}.json with these fields:
- planned_actions: concrete steps you will take
- edge_cases: edge cases you plan to handle
- state_transitions: state changes your implementation introduces (if any)
- non_goals: what you explicitly will NOT do
- demo_steps: step-by-step procedure to verify your work is complete
Set status to 'draft'.")
```

Verify `.geas/contracts/{task-id}.json` exists.

### Step 2: qa_engineer Reviews

Spawn qa_engineer to review the contract from a QA perspective:

```
Agent(agent: "qa-engineer", prompt: "Read .geas/contracts/{task-id}.json and .geas/tasks/{task-id}.json. Review this implementation contract:
- Are demo_steps sufficient to verify all acceptance criteria?
- Are there missing edge_cases that should be handled?
- Are non_goals reasonable — anything critical being excluded?
- Would you be able to test this based on what's described?
Write your assessment. If acceptable, approve. If not, list specific concerns.")
```

### Step 3: architecture_authority Reviews

Spawn architecture_authority to review the contract from a technical perspective:

```
Agent(agent: "architecture-authority", prompt: "Read .geas/contracts/{task-id}.json, .geas/tasks/{task-id}.json, and any prior tech guide at .geas/evidence/{task-id}/architecture-authority.json. Review this implementation contract:
- Are planned_actions consistent with the tech guide?
- Are non_goals appropriate — nothing critical being excluded?
- Are there technical edge_cases the worker missed?
- Is the approach viable or heading toward a dead end?
Write your assessment. If acceptable, approve. If not, list specific concerns.")
```

### Step 4: Resolve

- **Both approve** → Update contract status to `"approved"`, set `approved_by`. Proceed to Implementation.
- **Revision requested** → Return concerns to worker. Worker updates contract and resubmits. Allow 1 revision cycle, then architecture_authority makes final call.

## Output

Write the contract to `.geas/contracts/{task-id}.json` conforming to `schemas/implementation-contract.schema.json`.

```bash
mkdir -p .geas/contracts
```

Log the event:
```
Append to .geas/ledger/events.jsonl:
{"event": "implementation_contract", "task_id": "...", "status": "approved|revision_requested", "timestamp": "..."}
```

## Rules

1. **Every implementation task gets a contract** — no skipping even for "simple" tasks
2. **Workers must be honest about non_goals** — undeclared scope is the top source of rework
3. **demo_steps must cover every acceptance criterion** — if a criterion has no demo step, the contract is incomplete
4. **One revision cycle maximum** — after that, architecture_authority decides and we move forward
5. **Contract does not replace TaskContract** — it supplements it with the worker's concrete plan
