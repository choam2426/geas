---
name: context-packet
description: Generate a role-specific ContextPacket for a worker — compressed briefing that replaces 'read ALL comments' with focused, relevant context only.
---

# Context Packet Generator

Creates a focused, role-specific briefing for a worker. Workers read their packet instead of replaying entire Linear threads.

## When to Use

Compass invokes this skill before dispatching any worker for a task.

## Inputs

1. **TaskContract** — read from `.geas/tasks/{task-id}.json`
2. **Prior evidence** — check `.geas/evidence/{task-id}/` for upstream worker output
3. **Linear thread** (when Linear enabled and `linear_issue_id` exists in TaskContract) — agent comments, human feedback, and decisions
4. **Seed spec** — `.geas/spec/seed.json` for mission context

## Generation Process

### Step 1: Read the TaskContract

Load the contract to understand:
- Goal, acceptance criteria, eval commands
- Allowed/prohibited paths
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
- Allowed paths — where to write code
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

From Linear (when `linear_enabled` and `linear_issue_id` exists in TaskContract):
- **MUST** run: `list-comments --issue-id {linear_issue_id}`
- Include ALL comments — both agent comments (`[AgentName]` prefixed) and human comments
- Human comments are especially important: they represent direct stakeholder feedback that must be respected
- Format each comment as: `[Author] content (timestamp)`
- If the issue has no comments yet, note "No prior comments" and proceed

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
**Allowed paths:** {list}
**Prohibited paths:** {list}

## Acceptance Criteria
{numbered list from TaskContract}

## Eval Commands
{list of commands to run for verification}

## Known Risks
{risks identified during planning}

## Prior Work
{summaries from upstream evidence bundles}

## Linear Thread
{Previous comments on this issue, including human feedback. Omit if Linear disabled or no comments.}

- [Palette] Design spec: mobile-first layout with... (2026-03-25T01:00)
- [Human] Use bar charts instead of pie charts for vote results (2026-03-25T01:05)
- [Forge] Agreed. CSS-only bar chart approach. (2026-03-25T01:10)

## Reference
- Linear: {issue url, if available}
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
