---
name: context-packet
description: Generate a role-specific ContextPacket for a worker — compressed briefing with focused, relevant context only.
---

# Context Packet Generator

Creates a focused, role-specific briefing for a worker. Workers read their packet instead of replaying full project history.

## When to Use

Compass invokes this skill before dispatching any worker for a task.

## Inputs

1. **TaskContract** — read from `.geas/tasks/{task-id}.json`
2. **Prior evidence** — check `.geas/evidence/{task-id}/` for upstream worker output
3. **Decision records** — check `.geas/decisions/` for relevant decisions
4. **Seed spec** — `.geas/spec/seed.json` for mission context

## Generation Process

### Step 1: Read the TaskContract

Load the contract to understand:
- Goal, acceptance criteria, eval commands
- Prohibited paths
- Dependencies and their status

### Step 2: Identify the Target Worker's Needs

Different workers need different context:

#### Designer (Palette)
- Mission context and target user (from seed)
- User requirements for this specific feature
- Existing UI patterns in the codebase (if Sprint mode)
- Design constraints (responsive? dark mode? accessibility level?)
- What NOT to redesign

#### Implementer (Pixel / Circuit)
- Design spec from Palette (from prior evidence)
- Technical approach from Forge (from prior evidence)
- Prohibited paths — what to leave alone
- Eval commands — how to verify their work
- Known risks or edge cases

#### Reviewer (Forge)
- Files changed (from implementer evidence)
- Architecture decisions relevant to this area
- Acceptance criteria to review against
- Known anti-patterns to watch for

#### Tester (Sentinel)
- Acceptance criteria — what to test
- Eval commands — mechanical verification
- Expected behavior for each criterion
- Edge cases to probe
- UI flows to exercise (if frontend)

#### Product Reviewer (Nova)
- Feature goal (from contract)
- All evidence bundles for this task
- Acceptance criteria and their status
- Mission alignment check (from seed)

#### Other Specialists
- **Shield**: files changed, auth/input handling code paths, OWASP concerns
- **Scroll**: feature description, API endpoints, configuration options

### Step 3: Extract Relevant Context

From prior evidence (`.geas/evidence/{task-id}/`):
- Read each upstream worker's evidence bundle
- Extract the `summary` and `files_changed` fields
- For design evidence: extract the full design spec
- For tech guide evidence: extract the approach and constraints

From decision records (`.geas/decisions/`):
- Read any decisions relevant to this task's domain
- Include the decision rationale and outcome
- Human-confirmed decisions have the highest priority

From tech debt (`.geas/debt.json`, if it exists):
- Read open debt items
- Include items relevant to the current task's domain

### Step 4: Write the Packet

Write to `.geas/packets/{task-id}/{worker-name}.md`

```bash
mkdir -p .geas/packets/{task-id}
```

## Packet Format

Write the packet as a markdown file with this structure:

```markdown
# Context Packet: {worker-name} for {task-title}

## Your Task
{goal from TaskContract}

## Summary
{1-3 sentence summary of what's needed and why}

## Design Context
{Palette's design spec excerpt, if available}

## Technical Approach
{Forge's technical guidance excerpt, if available}

## Boundaries
**Prohibited paths:** {list}

## Acceptance Criteria
{numbered list from TaskContract}

## Eval Commands
{list of commands to run for verification}

## Known Risks
{risks identified during planning}

## Prior Work
{summaries from upstream evidence bundles}

## Known Tech Debt
{Open debt items relevant to this task. Workers should be aware but fix only if the task explicitly addresses them.}

## Reference
- Seed: .geas/spec/seed.json
- Contract: .geas/tasks/{task-id}.json
```

Omit sections that have no content (e.g., no design context for a backend task before Palette has worked).

## Rules

1. **Include only what the worker needs** — do not dump the entire project context
2. **Be specific** — "Implement POST /api/auth/login" beats "implement the auth endpoint"
3. **Preserve decisions** — if Forge decided on a specific pattern, include it exactly
4. **Flag conflicts** — if prior evidence contradicts the contract, note it explicitly
5. **Keep it under 200 lines** — if longer, you're including too much
