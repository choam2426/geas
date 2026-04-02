---
name: context-packet
description: Generate a role-specific ContextPacket for a worker — compressed briefing with focused, relevant context only.
---

# Context Packet Generator

Creates a focused, role-specific briefing for a worker. Workers read their packet instead of replaying full project history.

## When to Use

Orchestrator invokes this skill before dispatching any worker for a task.

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

#### Designer (ui_ux_designer)
- Mission context and target user (from seed)
- User requirements for this specific feature
- Existing UI patterns in the codebase (if delivery mode)
- Design constraints (responsive? dark mode? accessibility level?)
- What NOT to redesign

#### Implementer (frontend_engineer / backend_engineer)
- Design spec from ui_ux_designer (from prior evidence)
- Technical approach from architecture_authority (from prior evidence)
- Prohibited paths — what to leave alone
- Eval commands — how to verify their work
- Known risks or edge cases

#### Reviewer (architecture_authority)
- Files changed (from implementer evidence)
- Architecture decisions relevant to this area
- Acceptance criteria to review against
- Known anti-patterns to watch for
- **Implementation contract** — read `.geas/contracts/{task-id}.json` to verify the implementation matches the agreed plan
- **Worker's `self_check`** — `known_risks` and `possible_stubs` to focus review attention
- **Rubric dimension**: `code_quality` score and threshold (from TaskContract `rubric`)

#### Tester (qa_engineer)
- Acceptance criteria — what to test
- Eval commands — mechanical verification
- Expected behavior for each criterion
- Edge cases to probe
- UI flows to exercise (if frontend)
- **Worker's `self_check`** — `untested_paths`, `known_risks`, and `what_i_would_test_next` from the worker's EvidenceBundle (prioritize testing these areas)
- **Implementation contract** — read `.geas/contracts/{task-id}.json` for `demo_steps` and `edge_cases` the worker committed to handling
- **QA tools available** — based on project stack (see QA Tools section below)
- **Rubric dimensions** — which dimensions qa_engineer must score and their thresholds (from TaskContract `rubric`)

#### Final Verdict Authority (product_authority)
- Feature goal (from contract)
- All evidence bundles for this task
- Acceptance criteria and their status
- Mission alignment check (from seed)

#### DevOps (devops_engineer)
- Build/deploy configuration from conventions.md
- Target deployment environment and constraints (from seed)
- CI/CD requirements from TaskContract
- Existing deployment configuration (if delivery mode)
- Environment variable setup requirements
- Eval commands for build/deploy verification

#### Other Specialists
- **security_engineer**: files changed, auth/input handling code paths, OWASP concerns
- **technical_writer**: feature description, API endpoints, configuration options

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

From tech debt (`.geas/state/debt-register.json`, if it exists):
- Read open debt items
- Include items relevant to the current task's domain

### Memory Retrieval

After extracting task context, retrieve applicable memories:

1. Read `.geas/state/memory-index.json`. If it doesn't exist or has no entries, skip memory retrieval.
2. Filter entries by state: only include `provisional`, `stable`, `canonical`. Skip `candidate`, `decayed`, `archived`, `rejected`, `superseded`, `under_review`.
3. For each eligible entry, read the full memory file from `.geas/memory/entries/{memory-id}.json` and compute retrieval score:

   ```
   score = scope_match(0.25) + path_overlap(0.20) + role_match(0.15)
         + freshness(0.15) + confidence(0.10) + reuse_success(0.10)
         - contradiction_penalty(max 0.15)
   ```

   Where:
   - **scope_match** (0-0.25): task scope=1.0, mission=0.75, project=0.5, agent=0.5 (if role matches), global=0.25. Multiply by 0.25.
   - **path_overlap** (0-0.20): proportion of memory's tags that match the task's `scope.paths`. Multiply by 0.20.
   - **role_match** (0-0.15): 1.0 if memory type is relevant to the target agent's role (e.g., security_pattern for security_engineer). Multiply by 0.15.
   - **freshness** (0-0.15): 1.0 if created within last 5 tasks, linearly decaying to 0.0 at 20+ tasks. Multiply by 0.15.
   - **confidence** (0-0.10): directly from `signals.confidence`. Multiply by 0.10.
   - **reuse_success** (0-0.10): `successful_reuses / max(reuse_count, 1)`. Multiply by 0.10.
   - **contradiction_penalty** (0-0.15): `contradiction_count * 0.05`, capped at 0.15.
   - **Bonus**: +0.10 for `risk_pattern` type when task `risk_level` is `high` or `critical`.

4. Sort by score descending. Apply role-specific budget:
   - `orchestration_authority`: top 5-8 entries
   - specialist agents (`frontend_engineer`, `backend_engineer`, `qa_engineer`, etc.): top 3-5 entries
   - `product_authority`: top 3 entries

5. Write `.geas/packets/{task-id}/memory-packet.json` conforming to `docs/protocol/schemas/memory-packet.schema.json`:
   ```json
   {
     "meta": {
       "version": "1.0",
       "artifact_type": "memory_packet",
       "artifact_id": "mp-{task-id}-{agent-type}",
       "producer_type": "orchestration_authority",
       "created_at": "<ISO 8601>"
     },
     "packet_id": "mp-{task-id}-{agent-type}",
     "target_agent_type": "<agent type>",
     "target_task_id": "{task-id}",
     "pinned_items": ["<L0 invariants — mode, phase, focus task, rules.md entries>"],
     "applicable_memory_ids": ["mem-xxx", "mem-yyy"],
     "caution_items": ["<memories with confidence < 0.5 or contradiction_count > 0>"],
     "suppressed_memory_ids": ["<memories excluded due to low score or budget>"],
     "assembly_reason": "Generated for {agent-type} working on {task-id}"
   }
   ```

6. Inject into the context packet markdown. Add an `## Applicable Memory` section to the agent's packet:

   ```markdown
   ## Applicable Memory

   The following lessons from previous tasks may be relevant:

   - **[mem-xxx] {title}** (confidence: 0.7, stable): {summary}
   - **[mem-yyy] {title}** (confidence: 0.5, provisional): {summary}

   ⚠️ Caution items (lower confidence):
   - **[mem-zzz] {title}** (confidence: 0.4): {summary} — treat as suggestion, not rule
   ```

### Packet Staleness Triggers

Regenerate the memory packet when any of these occur:
- base_commit changes (revalidation)
- Reviewer set changes
- Integration result received
- Gate fails
- Task rewinds
- rules.md updated
- Focus task changes
- Any memory entry transitions to `under_review` or `superseded`

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
{ui_ux_designer's design spec excerpt, if available}

## Technical Approach
{architecture_authority's technical guidance excerpt, if available}

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

## Applicable Memory
{Injected from memory retrieval — see Step 3. Omit if no memories scored above threshold.}

## Reference
- Seed: .geas/spec/seed.json
- Contract: .geas/tasks/{task-id}.json
```

Omit sections that have no content (e.g., no design context for a backend task before ui_ux_designer has worked).

## QA Tools Section (qa_engineer packets only)

When generating a qa_engineer packet, include a `## QA Tools Available` section listing available MCP tools and commands from `.geas/memory/_project/conventions.md`:

```markdown
## QA Tools Available
- **API**: HTTP request tools for direct endpoint testing
- **Database**: Database query MCP (if available)
- **Browser**: Browser automation MCP (if connected) for E2E, screenshots, visual regression
- **Performance**: Performance audit MCP (if connected) for accessibility and performance
- **Dev server**: {{dev command from conventions.md}} — start before state verification
```

Only include tools that are actually connected or available for the project. Do not assume any specific MCP is present.

## Rubric Section (qa_engineer and architecture_authority review packets)

Include a `## Rubric Scoring` section listing the dimensions the evaluator must score:

```markdown
## Rubric Scoring
You MUST include `rubric_scores` in your EvidenceBundle for these dimensions:
| Dimension | Threshold | Your role |
|-----------|-----------|-----------|
| core_interaction | 3 | Score 1-5 with rationale |
| feature_completeness | 4 | Score 1-5 with rationale |
```

## Rules

1. **Include only what the worker needs** — do not dump the entire project context
2. **Be specific** — "Implement POST /api/auth/login" beats "implement the auth endpoint"
3. **Preserve decisions** — if architecture_authority decided on a specific pattern, include it exactly
4. **Flag conflicts** — if prior evidence contradicts the contract, note it explicitly
5. **Keep it under 200 lines** — if longer, you're including too much
