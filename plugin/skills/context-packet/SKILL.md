---
name: context-packet
description: Generate a role-specific ContextPacket for a worker — compressed briefing with focused, relevant context only.
---

# Context Packet Generator

Creates a focused, role-specific briefing for a worker. Workers read their packet instead of replaying full project history.

## When to Use

Orchestrator invokes this skill before dispatching any worker for a task.

## Inputs

1. **TaskContract** — read from `.geas/missions/{mission_id}/tasks/{task-id}.json`
2. **Prior evidence** — check `.geas/missions/{mission_id}/evidence/{task-id}/` for upstream worker output
3. **Decision records** — check `.geas/missions/{mission_id}/decisions/` for relevant decisions
4. **Mission spec** — `.geas/missions/{mission_id}/spec.json` for mission context

## Generation Process

### Step 1: Read the TaskContract

Load the contract to understand:
- Goal, acceptance criteria, eval commands
- Prohibited paths
- Dependencies and their status

### Step 2: Identify the Target Worker's Needs

Different workers need different context:

#### Designer (communication_specialist)
- Mission context and target user (from seed)
- User requirements for this specific feature
- Existing UI patterns in the codebase (if existing project)
- Design constraints (responsive? dark mode? accessibility level?)
- What NOT to redesign

#### Implementer
- Design spec from communication_specialist (from prior evidence, if applicable)
- Technical approach from design_authority (from prior evidence)
- Prohibited paths — what to leave alone
- Eval commands — how to verify their work
- Known risks or edge cases
- **Project conventions** — when assembling a packet for any implementer, include `.geas/memory/_project/conventions.md` if it exists

#### Reviewer (design_authority)
- Files changed (from implementer evidence)
- Architecture decisions relevant to this area
- Acceptance criteria to review against
- Known anti-patterns to watch for
- **Implementation contract** — read `.geas/missions/{mission_id}/contracts/{task-id}.json` to verify the implementation matches the agreed plan
- **Worker's `self_check`** — `known_risks` and `possible_stubs` to focus review attention
- **Rubric dimension**: `code_quality` score and threshold (from TaskContract `rubric`)

#### Tester (quality_specialist)
- Acceptance criteria — what to test
- Eval commands — mechanical verification
- Expected behavior for each criterion
- Edge cases to probe
- UI flows to exercise (if frontend)
- **Worker's `self_check`** — `untested_paths`, `known_risks`, and `what_i_would_test_next` from the worker's EvidenceBundle (prioritize testing these areas)
- **Implementation contract** — read `.geas/missions/{mission_id}/contracts/{task-id}.json` for `demo_steps` and `edge_cases` the worker committed to handling
- **Verification tools available** — based on project stack (see Verification Tools section below)
- **Rubric dimensions** — which dimensions quality_specialist must score and their thresholds (from TaskContract `rubric`)

#### Final Verdict Authority (product_authority)
- Feature goal (from contract)
- All evidence bundles for this task
- Acceptance criteria and their status
- Mission alignment check (from seed)

#### Operations (operations_specialist)
- Build/deploy configuration from conventions.md
- Target deployment environment and constraints (from seed)
- CI/CD requirements from TaskContract
- Existing deployment configuration (if existing project)
- Environment variable setup requirements
- Eval commands for build/deploy verification

#### Other Specialists
- **risk_specialist**: files changed, auth/input handling code paths, OWASP concerns
- **communication_specialist**: feature description, API endpoints, configuration options

### Step 3: Extract Relevant Context

From prior evidence (`.geas/missions/{mission_id}/evidence/{task-id}/`):
- Read each upstream worker's evidence bundle
- Extract the `summary` and `files_changed` fields
- For design evidence: extract the full design spec
- For design guide evidence: extract the approach and constraints

From decision records (`.geas/missions/{mission_id}/decisions/`):
- Read any decisions relevant to this task's domain
- Include the decision rationale and outcome
- Human-confirmed decisions have the highest priority

From tech debt (`.geas/missions/{mission_id}/evolution/debt-register.json`, if it exists):
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

   Where (see protocol/09 for canonical definitions):
   - **scope_match** (0-0.25): Cross-reference memory scope × task context using the scope match matrix (protocol/09 §Scope Match Calculation). Example: memory scope=`task` (same task) × task context=`task` → 1.0; memory scope=`mission` × task context=`task` → 0.7. Multiply by 0.25.
   - **path_overlap** (0-0.20): `|memory_paths ∩ task_paths| / |task_paths|` (0.0 if task_paths is empty). Memory paths are extracted from `evidence_refs[]` — if an evidence_ref points to a task, use that task's `scope.paths`. Multiply by 0.20.
   - **role_match** (0-0.15): 1.0 if memory type is relevant to the target agent's role (e.g., security_pattern for risk_specialist); 0.0 otherwise. Multiply by 0.15.
   - **freshness** (0-0.15): `max(0.0, 1.0 - (days_since_last_confirmed / 180))`. `last_confirmed_at` = `created_at` of the most recent `effect = "positive"` entry in memory-application-log for this memory_id; if none, use the memory-entry's own `created_at`. Multiply by 0.15.
   - **confidence** (0-0.10): directly from `signals.confidence`. Multiply by 0.10.
   - **reuse_success** (0-0.10): `successful_reuses / (successful_reuses + failed_reuses)` (0.5 if no application history). Multiply by 0.10.
   - **contradiction_penalty** (0-0.15): `min(contradiction_count * 0.05, 0.15)`.
   - **Bonus**: +0.10 for `risk_pattern` type when task `risk_level` is `high` or `critical`.

4. Sort by score descending. Apply role-specific budget:
   - `orchestration_authority`: top 5-8 entries
   - specialist agents (implementer, quality_specialist, etc.): top 3-5 entries
   - `product_authority`: top 3 entries

5. Write the memory packet via CLI (the CLI handles directory creation and format detection):
   ```bash
   Bash("geas context write --mission {mission_id} --task {task-id} --agent memory-packet --data '<memory_packet_json>'")
   ```
   The memory packet must conform to `schemas/memory-packet.schema.json`:
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
     "pinned_items": ["<L0 invariants — phase, focus task, rules.md entries>"],
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

Write the context packet via CLI (the CLI creates directories automatically and detects format from content):
```bash
Bash("geas context write --mission {mission_id} --task {task-id} --agent {worker-name} --data '<packet_markdown>'")
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
{communication_specialist's design spec excerpt, if available}

## Technical Approach
{design_authority's technical guidance excerpt, if available}

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

**Agent Memory:** Before assembling the general applicable memory, check if `.geas/memory/agents/{agent_type}.md` exists for the target agent. If it does, include its contents at the top of the Applicable Memory section. This file is included unconditionally (not scored by the retrieval heuristic) as it contains Orchestrator-curated, role-specific guidance. Agent memory files are typically small and SHOULD be preserved even under context budget pressure.

{Injected from memory retrieval — see Step 3. Omit if no memories scored above threshold.}

## Reference
- Mission spec: .geas/missions/{mission_id}/spec.json
- Contract: .geas/missions/{mission_id}/tasks/{task-id}.json
```

Omit sections that have no content (e.g., no design context for a task before the communication_specialist has worked).

## Verification Tools Section (quality_specialist packets only)

When generating a quality_specialist packet, include a `## Verification Tools Available` section listing available MCP tools and commands from `.geas/memory/_project/conventions.md`:

```markdown
## Verification Tools Available
- **API**: HTTP request tools for direct endpoint testing
- **Database**: Database query MCP (if available)
- **Browser**: Browser automation MCP (if connected) for E2E, screenshots, visual regression
- **Performance**: Performance audit MCP (if connected) for accessibility and performance
- **Dev server**: {{dev command from conventions.md}} — start before state verification
```

Only include tools that are actually connected or available for the project. Do not assume any specific MCP is present.

## Rubric Section (quality_specialist and design_authority review packets)

Include a `## Rubric Scoring` section listing the dimensions the evaluator must score:

```markdown
## Rubric Scoring
You MUST include `rubric_scores` in your EvidenceBundle for these dimensions:
| Dimension | Threshold | Your role |
|-----------|-----------|-----------|
| core_interaction | 3 | Score 1-5 with rationale |
| feature_completeness | 4 | Score 1-5 with rationale |
```

## Worktree-Isolated Agents

When generating a context packet for a worktree-isolated agent (any agent spawned with `isolation: "worktree"`), add a **Runtime State Access** section at the top of the packet, immediately after the `## Your Task` section:

```markdown
## Runtime State Access

You are running in a git worktree. The `.geas/` directory is NOT present in your working directory — it is only in the main project root and is excluded via `.gitignore`.

All `.geas/` paths in this packet use absolute paths so you can read and write them directly. When you need to access any `.geas/` file not listed in this packet, use the same absolute prefix: `{project_root}/.geas/`
```

The orchestrator resolves `{project_root}` to the actual absolute path of the main session working directory before writing the packet. The packet must contain the resolved absolute path, not the `{project_root}` placeholder.

All `.geas/` paths referenced elsewhere in the packet (evidence write paths, contract read paths, reference paths) must also use the resolved absolute `{project_root}/.geas/` prefix when the target agent is worktree-isolated.

Non-worktree agents do not receive this section. Their packets continue to use relative `.geas/` paths.

## Rules

1. **Include only what the worker needs** — do not dump the entire project context
2. **Be specific** — "Implement POST /api/auth/login" beats "implement the auth endpoint"
3. **Preserve decisions** — if design_authority decided on a specific pattern, include it exactly
4. **Flag conflicts** — if prior evidence contradicts the contract, note it explicitly
5. **Keep it under 200 lines** — if longer, you're including too much
