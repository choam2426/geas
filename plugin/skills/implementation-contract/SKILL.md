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
Agent(agent: "{worker}", prompt: "Read .geas/missions/{mission_id}/tasks/{task-id}/packets/{worker}.md and .geas/missions/{mission_id}/tasks/{task-id}/contract.json. Before implementing, write your implementation contract via CLI. Run: geas task record add --task {task-id} --section implementation_contract --set planned_actions=... (or pipe a JSON body via stdin: `geas task record add --task {task-id} --section implementation_contract <<'EOF'\n<contract_json>\nEOF`, or redirect from a file: `< path/to/contract.json`). Required fields:
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
Agent(agent: "quality-specialist", prompt: "Read the implementation_contract section from .geas/missions/{mission_id}/tasks/{task-id}/record.json and .geas/missions/{mission_id}/tasks/{task-id}/contract.json. Review this implementation contract per your Review Protocols.
Write your assessment. If acceptable, approve. If not, list specific concerns.")
```

### Step 3: design-authority Reviews

Spawn design-authority to review the contract from a technical perspective:

```
Agent(agent: "design-authority", prompt: "Read the implementation_contract section from .geas/missions/{mission_id}/tasks/{task-id}/record.json, .geas/missions/{mission_id}/tasks/{task-id}/contract.json, and any prior design guide at .geas/missions/{mission_id}/tasks/{task-id}/evidence/design-authority.json. Review this implementation contract per your Review Protocols.
Write your assessment. If acceptable, approve. If not, list specific concerns.")
```

### Step 4: Resolve

- **Both approve** → Update contract status to `"approved"`, set `approved_by`. Proceed to Implementation.
- **Revision requested** → Return concerns to worker. Worker updates contract and resubmits. Allow 1 revision cycle, then design-authority makes final call.

## Output

Write the contract to record.json via CLI:
```bash
Bash("geas task record add --task {task-id} --section implementation_contract < <contract_json_file>")
```
The CLI enforces schema validation and auto-manages timestamps.

Log the event via CLI:
```bash
Bash("geas event log --type implementation_contract --task {task-id} --data '{\"status\":\"approved|revision_requested\"}'")
```

## Amendment Flow

After the implementation contract is approved and implementation begins, circumstances may require changes to the approved contract. This is the **amendment flow** — it handles material changes without restarting the full contract process.

### When to Amend

A material change triggers the amendment flow when ANY of these occur during implementation:
1. Paths outside `scope.surfaces` are changed
2. Acceptance criteria are added or modified
3. `risk_level` increases
4. A new external dependency is introduced
5. A `non_goals` item enters scope

### Amendment Process

**Step 1: Worker Identifies Change**

The worker detects a material change and stops implementation until the amendment is approved.

**Step 2: Worker Drafts Amendment**

The worker records the amendment to the `implementation_contract` section's `amendments` array:
```bash
Bash("geas task record add --task {task-id} --section implementation_contract --set amendments='[{\"rationale\":\"why the change is needed\",\"changed_fields\":[\"field1\",\"field2\"],\"scope_delta\":\"what expanded or narrowed\",\"approved_by\":\"design-authority\"}]'")
```

**Step 3: Design-Authority Re-Approves**

Spawn design-authority to review the amendment. Amendments are scope/design decisions, so DA is the appropriate reviewer:

```
Agent(agent: "design-authority", prompt: "Read the implementation_contract section (including amendments) from .geas/missions/{mission_id}/tasks/{task-id}/record.json and .geas/missions/{mission_id}/tasks/{task-id}/contract.json. Review the latest amendment: evaluate the rationale, assess scope delta impact, and verify changed_fields are justified. Approve or request revision.")
```

**Step 4: Resume Implementation**

After DA approval, the worker resumes. All subsequent ContextPackets must reflect the amended contract.

### Amendment Rules

- Amendments are only valid during the `"implementing"` state
- Each amendment appends to the `amendments` array (does not overwrite prior entries)
- Material changes after approval require amendment before continuing implementation
- When in doubt, flag for DA review rather than self-adjudicating materiality

## Rules

1. **Every implementation task gets a contract** — no skipping even for "simple" tasks
2. **Workers must be honest about non_goals** — undeclared scope is the top source of rework
3. **demo_steps must cover every acceptance criterion** — if a criterion has no demo step, the contract is incomplete
4. **One revision cycle maximum** — after that, design-authority decides and we move forward
5. **Contract does not replace TaskContract** — it supplements it with the worker's concrete plan
6. **Material changes after approval require amendment** — unrecorded contract drift is non-conformant
