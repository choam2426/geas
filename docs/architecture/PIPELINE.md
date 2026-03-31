# Pipeline Reference

Exact step-by-step execution flow for every mode in the Geas contract engine.

---

## Table of Contents

1. [Initiative Pipeline](#initiative-pipeline)
   - [Phase 1: Discovery](#phase-1-discovery)
   - [Phase 2: MVP Build](#phase-2-mvp-build)
   - [Phase 3: Polish](#phase-3-polish)
   - [Phase 4: Evolution](#phase-4-evolution)
2. [Sprint Pipeline](#sprint-pipeline)
3. [Debate (Utility Skill)](#debate-utility-skill)
4. [Checkpoint and Recovery](#checkpoint-and-recovery)
5. [Skip Conditions](#skip-conditions)
6. [Escalation Paths](#escalation-paths)
7. [Event Logging](#event-logging)

---

## Initiative Pipeline

Invoked via `/geas:initiative`. Runs four sequential phases: Discovery, MVP Build, Polish, Evolution. The contract engine governs every step — no agent self-reports completion without evidence.

---

### Phase 1: Discovery

Produces all planning artifacts before a single line of code is written.

#### 1.1 Seed Check

- Read `.geas/spec/seed.json` (written by `/geas:intake`).
- If `completeness_checklist` has any `false` values and no override flag is set: prompt the user and re-run `/geas:intake`.
- If the file is missing entirely: invoke `/geas:intake` before continuing.

#### 1.2 Vision (Nova)

```
Agent(agent: "nova", ...)
Output: .geas/evidence/discovery/nova.json
```

Nova reads `seed.json` and delivers vision statement, MVP scope, and user value proposition. Verify the output file exists before proceeding.

#### 1.3 PRD and User Stories (Nova)

```
Agent(agent: "nova", ...)
Outputs: .geas/spec/prd.md
         .geas/spec/stories.md
```

Nova reads `seed.json` and `nova.json`, creates a PRD using the `write-prd` skill, then breaks it into user stories using the `write-stories` skill. Both files must exist before proceeding.

#### 1.4 Architecture (Forge)

```
Agent(agent: "forge", ...)
Output: .geas/memory/_project/conventions.md
        .geas/evidence/discovery/forge.json
```

Forge reads `seed.json`, `nova.json`, and `prd.md`. Proposes architecture and tech stack. Writes project conventions and architecture evidence. After verification, write `DecisionRecord` to `.geas/decisions/dec-001.json`.

#### 1.5 Vote Round

Three agents vote in parallel on Forge's architecture:

```
Agent(agent: "circuit", ...) → .geas/evidence/discovery/vote-circuit.json
Agent(agent: "palette", ...) → .geas/evidence/discovery/vote-palette.json
Agent(agent: "critic",  ...) → .geas/evidence/discovery/vote-critic.json
```

Critic MUST participate in every vote round — the Critic is instructed to play devil's advocate and identify risks even when broadly in agreement.

- All agree → proceed to 1.6.
- Any disagree → run `/geas:debate`, then re-vote.

#### 1.6 Compile TaskContracts

- Use `.geas/spec/stories.md` as input. For each user story, invoke `/geas:task-compiler`.
- Every TaskContract MUST include a `rubric` array.

Default rubric dimensions:

| Dimension | Evaluator | Threshold |
|---|---|---|
| `core_interaction` | sentinel | 3 |
| `feature_completeness` | sentinel | 4 |
| `code_quality` | forge | 4 |
| `regression_safety` | sentinel | 4 |

Add for tasks with a UI component:

| Dimension | Evaluator | Threshold |
|---|---|---|
| `ux_clarity` | sentinel | 3 |
| `visual_coherence` | sentinel | 3 |

Log each compiled contract:
```json
{"event": "task_compiled", "task_id": "...", "timestamp": "<actual>"}
```

#### 1.7 MCP Server Recommendations

Analyze the tech stack from Forge's architecture decision and recommend MCP servers by category:

| Stack category | MCP category | Reason |
|---|---|---|
| Relational database | Database query MCP | Workers can inspect schemas and run read-only queries |
| Document database | Database query MCP | Workers can explore collections |
| Web frontend | Web standards MCP | Workers can reference specification docs |
| Has deploy target | Performance audit MCP | Sentinel can audit performance and accessibility |
| Git-hosted | Git platform MCP | Keeper can manage PRs and issues |

Present recommendations with install commands from the MCP registry. If the user connects, record in `.geas/config.json` under `connected_mcp`.

#### 1.8 Close Discovery

- Update run state: `{ "phase": "mvp", "status": "in_progress" }`
- Log: `{"event": "phase_complete", "phase": "discovery", "timestamp": "<actual>"}`

---

### Phase 2: MVP Build

Every TaskContract in `.geas/tasks/` runs the full pipeline, ordered by dependencies. Code Review and Testing are mandatory for every task.

#### 2.0 Start Task

1. Read the TaskContract. Verify all declared dependencies have status `"passed"`.
2. Set task status to `"in_progress"`.
3. Log `task_started` event.
4. **Write `remaining_steps` to `.geas/state/run.json`** — the full step list for this task:

```json
"remaining_steps": ["design", "tech_guide", "implementation_contract", "implementation", "code_review", "testing", "evidence_gate", "critic_review", "nova_review", "retrospective", "resolve"]
```

Remove steps that will be skipped (e.g., remove `"design"` for tasks with no user-facing interface). After each step completes, pop it from the front of the array and update `run.json`.

5. **Rubric check**: If the TaskContract is missing a `rubric` field, insert the default rubric before proceeding (see dimensions table in 1.6).

#### 2.1 Design (Palette) [DEFAULT — skip conditions in Section 5]

Runs when the task has any user-facing interface (pages, forms, dashboards).

```
Update run.json: pipeline_step = "design", agent_in_flight = "palette"
Agent(agent: "palette", prompt: "Read .geas/packets/{task-id}/palette.md. Write design spec to .geas/evidence/{task-id}/palette.json")
```

Verify `.geas/evidence/{task-id}/palette.json` exists.

#### 2.2 Tech Guide (Forge) [DEFAULT — skip conditions in Section 5]

```
Update run.json: pipeline_step = "tech_guide", agent_in_flight = "forge"
Agent(agent: "forge", prompt: "Read .geas/packets/{task-id}/forge.md. Write tech guide to .geas/evidence/{task-id}/forge.json")
```

Verify `.geas/evidence/{task-id}/forge.json` exists.

#### 2.3 Implementation Contract [MANDATORY]

Invoke `/geas:implementation-contract`. The worker proposes a concrete action plan; Sentinel and Forge must both approve before any code is written.

```
Update run.json: pipeline_step = "implementation_contract", agent_in_flight = "{worker}"
```

The skill runs three steps internally:
1. **Worker drafts contract** — writes `planned_actions`, `edge_cases`, `state_transitions`, `non_goals`, `demo_steps` to `.geas/contracts/{task-id}.json` with `status: "draft"`.
2. **Sentinel reviews** — checks that `demo_steps` cover all acceptance criteria, flags missing edge cases.
3. **Forge reviews** — checks that `planned_actions` are consistent with the tech guide and technically viable.

Resolution:
- Both approve → contract status set to `"approved"`, set `approved_by`. Proceed to 2.4.
- Revision requested → worker updates and resubmits. One revision cycle allowed, then Forge makes the final call.

Verify `.geas/contracts/{task-id}.json` exists with `status: "approved"` before continuing.

Log event:
```json
{"event": "implementation_contract", "task_id": "...", "status": "approved|revision_requested", "timestamp": "..."}
```

#### 2.4 Implementation [MANDATORY — worktree isolated]

```
Update run.json: pipeline_step = "implementation", agent_in_flight = "{worker}"
Agent(agent: "{worker}", isolation: "worktree", prompt: "Read .geas/packets/{task-id}/{worker}.md. Implement the feature. Write evidence to .geas/evidence/{task-id}/{worker}.json")
```

Verify evidence exists. Merge the worktree branch before proceeding.

#### 2.5 Code Review (Forge) [MANDATORY]

```
Update TaskContract status to "in_review".
Update run.json: pipeline_step = "code_review", agent_in_flight = "forge"
Agent(agent: "forge", prompt: "Read .geas/packets/{task-id}/forge-review.md. Review implementation. Write to .geas/evidence/{task-id}/forge-review.json")
```

Verify `.geas/evidence/{task-id}/forge-review.json` exists.

#### 2.6 Testing (Sentinel) [MANDATORY]

```
Update TaskContract status to "testing".
Update run.json: pipeline_step = "testing", agent_in_flight = "sentinel"
Agent(agent: "sentinel", prompt: "Read .geas/packets/{task-id}/sentinel.md. Test the feature. Write QA results to .geas/evidence/{task-id}/sentinel.json")
```

Verify `.geas/evidence/{task-id}/sentinel.json` exists.

#### 2.7 Evidence Gate

Run the `/geas:evidence-gate` skill. See [Evidence Gate](#evidence-gate) for the full three-tier protocol.

- Run `eval_commands` from the TaskContract.
- Check all acceptance criteria against collected evidence.
- Score rubric dimensions.
- Log detailed result with tier breakdown.

If gate fails → invoke `/geas:verify-fix-loop`. Spawn the worker agent to fix. After fix, re-run the gate.

#### 2.8 Critic Pre-ship Review [MANDATORY]

```
Update run.json: pipeline_step = "critic_review", agent_in_flight = "critic"
Agent(agent: "critic", prompt: "Read all evidence at .geas/evidence/{task-id}/. Challenge: is this truly ready to ship? Identify risks, missing edge cases, or technical debt. Write to .geas/evidence/{task-id}/critic-review.json")
```

Verify `.geas/evidence/{task-id}/critic-review.json` exists.

#### 2.9 Nova Product Review [MANDATORY]

```
Update run.json: pipeline_step = "nova_review", agent_in_flight = "nova"
Agent(agent: "nova", prompt: "Read all evidence at .geas/evidence/{task-id}/ including critic-review.json. Verdict: Ship, Iterate, or Cut. Write to .geas/evidence/{task-id}/nova-verdict.json")
```

#### 2.10 Ship Gate

Before marking any task as `"passed"`, verify all four mandatory evidence files exist by reading each one:

| File | Source step |
|---|---|
| `.geas/evidence/{task-id}/forge-review.json` | 2.5 Code Review |
| `.geas/evidence/{task-id}/sentinel.json` | 2.6 Testing |
| `.geas/evidence/{task-id}/critic-review.json` | 2.8 Critic Pre-ship Review |
| `.geas/evidence/{task-id}/nova-verdict.json` | 2.9 Nova Product Review |

If any file is missing: go back and execute the missing step. Do NOT proceed without all four.

#### Retrospective (Scrum) [MANDATORY]

```
Update run.json: pipeline_step = "retrospective", agent_in_flight = "scrum"
Agent(agent: "scrum", prompt: "Read all evidence at .geas/evidence/{task-id}/. Run retrospective: update rules.md with new conventions, write lessons to .geas/memory/retro/{task-id}.json")
```

Verify `.geas/memory/retro/{task-id}.json` exists.

#### 2.11 Resolve

Based on Nova's verdict from step 2.9:

| Verdict | Action |
|---|---|
| **Ship** | Read `.geas/tasks/{task-id}.json`, set `"status": "passed"`, write it back. Spawn Keeper for commit (see below). |
| **Iterate** | Deduct retry_budget. Repopulate remaining_steps with full pipeline (same skip conditions). Include Nova's feedback in all ContextPackets. Resume from first non-skipped step. See Evidence Gate "On Iterate" section. |
| **Cut** | Set task status to `"failed"`. Write a DecisionRecord to `.geas/decisions/{dec-id}.json`. |

Keeper commit (Ship only):
```
Update run.json: pipeline_step = "resolve", agent_in_flight = "keeper"
Agent(agent: "keeper", prompt: "Commit all changes for {task-id} with conventional commit format. Write to .geas/evidence/{task-id}/keeper.json")
```

Log: `{"event": "task_resolved", "task_id": "...", "verdict": "ship|iterate|cut", "timestamp": "<actual>"}`

#### Close Phase 2

After all TaskContracts are resolved:

```json
{"event": "phase_complete", "phase": "mvp", "timestamp": "<actual>"}
```

---

### Phase 3: Polish

MANDATORY — do not skip.

```
Agent(agent: "shield", prompt: "Security review of the project. Write to .geas/evidence/polish/shield.json")
```

Verify `.geas/evidence/polish/shield.json` exists.

```
Agent(agent: "scroll", prompt: "Write README and docs. Write to .geas/evidence/polish/scroll.json")
```

Verify `.geas/evidence/polish/scroll.json` exists.

Fix any issues found by Shield or Scroll. Log phase complete:

```json
{"event": "phase_complete", "phase": "polish", "timestamp": "<actual>"}
```

---

### Phase 4: Evolution

MANDATORY — do not skip.

Assess remaining work within the seed's `scope_in`. Reject features listed in `scope_out`. Spawn agents as needed for improvements within scope.

**Nova final briefing (MANDATORY):**
```
Agent(agent: "nova", prompt: "Final product review. Read all evidence. Deliver strategic summary and recommendations. Write to .geas/evidence/evolution/nova-final.json")
```

**Keeper release management:**
```
Agent(agent: "keeper", prompt: "Create release: version bump, changelog, final commit. Write to .geas/evidence/evolution/keeper-release.json")
```

Invoke `/geas:run-summary` to generate the session audit trail.

Close out:
```json
{"event": "phase_complete", "phase": "complete", "timestamp": "<actual>"}
```

---

## Sprint Pipeline

Invoked via `/geas:sprint`. Adds a bounded feature to an existing project. Skips Discovery. One feature, one pipeline.

### Pre-conditions

**seed.json behavior:**

| Situation | Action |
|---|---|
| `.geas/spec/seed.json` exists | Read-only. Load mission and constraints. Sprint NEVER modifies it. |
| `.geas/spec/seed.json` does not exist | Intake creates a minimal one. |

**Convention detection:**

| Situation | Action |
|---|---|
| `.geas/memory/_project/conventions.md` exists | Skip onboarding. Read conventions and proceed. |
| `.geas/memory/_project/conventions.md` missing | Spawn Forge for onboarding (see [Onboarding](#onboarding) below). |

### Onboarding (first Sprint only)

Triggered when Compass detects no `.geas/state/run.json`. Forge runs alone — no parallel agents.

Steps:

1. **Structure Scan** — detect stack from marker files (`package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `requirements.txt`). Identify framework, build system, test framework, package manager.
2. **Architecture Mapping** — find entry points, routing patterns, database connections, key modules, external services.
3. **Convention Detection** — read linter config, naming patterns, import style, type checking settings.
4. **Adaptive Depth** — adjust scan depth by project size:

| Size | File count | Scan strategy |
|---|---|---|
| Small | ~50 files | Full scan — read all source files |
| Medium | 50-500 files | Focused scan — `src/` + config + entry points + key modules |
| Large | 500+ files | Targeted scan — only directories relevant to the Sprint feature |

5. **Output** — write `.geas/memory/_project/conventions.md` and `.geas/memory/_project/state.json`.

After the second Sprint onward, conventions.md already exists — skip onboarding entirely.

### Sprint Steps

#### Step 1: Compile TaskContract

Invoke `/geas:task-compiler` for the feature. TaskContract MUST include a `rubric` array (same dimensions as Initiative 1.6).

Write `remaining_steps` to checkpoint:
```json
"remaining_steps": ["design", "tech_guide", "implementation_contract", "implementation", "code_review", "testing", "evidence_gate", "critic_review", "nova_review", "retrospective", "resolve"]
```

Remove steps that will be skipped before writing. After each step completes, pop from the front and update `run.json`.

Rubric check: if `rubric` is missing from the TaskContract, insert the default.

#### Step 2: Design (Palette) [DEFAULT — skip conditions in Section 5]

```
Update run.json: pipeline_step = "design", agent_in_flight = "palette"
Agent(agent: "palette", ...) → .geas/evidence/{task-id}/palette.json
```

#### Step 3: Tech Guide (Forge) [DEFAULT — skip conditions in Section 5]

```
Update run.json: pipeline_step = "tech_guide", agent_in_flight = "forge"
Agent(agent: "forge", ...) → .geas/evidence/{task-id}/forge.json
```

#### Step 4: Implementation Contract [MANDATORY]

Invoke `/geas:implementation-contract`. Same three-step process as Initiative 2.3. Verify `.geas/contracts/{task-id}.json` with `status: "approved"`.

#### Step 5: Implementation [MANDATORY — worktree isolated]

```
Update run.json: pipeline_step = "implementation", agent_in_flight = "{worker}"
Agent(agent: "{worker}", isolation: "worktree", ...) → .geas/evidence/{task-id}/{worker}.json
```

Verify evidence. Merge worktree.

#### Step 6: Code Review (Forge) [MANDATORY]

```
Update run.json: pipeline_step = "code_review", agent_in_flight = "forge"
Agent(agent: "forge", ...) → .geas/evidence/{task-id}/forge-review.json
```

#### Step 7: Testing (Sentinel) [MANDATORY]

```
Update run.json: pipeline_step = "testing", agent_in_flight = "sentinel"
Agent(agent: "sentinel", ...) → .geas/evidence/{task-id}/sentinel.json
```

#### Step 8: Evidence Gate

Run `eval_commands`, check acceptance criteria, score rubric. If fail → invoke `/geas:verify-fix-loop`. Spawn the worker agent to fix. Re-run gate after fix.

#### Step 8.5: Critic Pre-ship Review [MANDATORY]

```
Update run.json: pipeline_step = "critic_review", agent_in_flight = "critic"
Agent(agent: "critic", ...) → .geas/evidence/{task-id}/critic-review.json
```

Verify file exists.

#### Step 9: Nova Product Review [MANDATORY]

```
Update run.json: pipeline_step = "nova_review", agent_in_flight = "nova"
Agent(agent: "nova", ...) → .geas/evidence/{task-id}/nova-verdict.json
```

Verdict: Ship / Iterate / Cut.

#### Ship Gate

Same four-file verification as Initiative 2.10. If any file is missing: execute the missing step first.

#### Retrospective (Scrum) [MANDATORY]

```
Update run.json: pipeline_step = "retrospective", agent_in_flight = "scrum"
Agent(agent: "scrum", ...) → .geas/memory/retro/{task-id}.json
```

#### Step 10: Resolve

| Verdict | Action |
|---|---|
| Ship | Set task `"status": "passed"`. Spawn Keeper for commit. |
| Iterate | Deduct retry_budget. Repopulate remaining_steps with full pipeline (same skip conditions). Include Nova's feedback in all ContextPackets. Resume from first non-skipped step. |
| Cut | Set `"status": "failed"`. Write DecisionRecord. |

#### Step 11: Run Summary

Invoke `/geas:run-summary` to generate session audit trail.

---

## Debate (Utility Skill)

Debate is a utility skill, not an execution mode. It can be invoked standalone via `/geas:debate` or internally during Initiative/Sprint when a structured decision is needed (e.g., after vote round disagreement).

Invoked via `/geas:debate`. No code is produced. Output is a `DecisionRecord`.

### Step 1: Frame the Question

Formulate the user's question as a clear decision with 2-3 concrete options. Confirm framing with the user before spawning agents.

### Step 2: Spawn Debaters

All four agents run in parallel:

```
Agent(agent: "forge",   prompt: "Argue FOR option A. Technical rationale, pros, cons, risks.")
Agent(agent: "critic",  prompt: "Argue AGAINST option A / FOR option B. Challenge assumptions.")
Agent(agent: "circuit", prompt: "Evaluate both from backend/scalability perspective.")
Agent(agent: "palette", prompt: "Evaluate both from UX/frontend perspective.")
```

### Step 3: Synthesize

Present a summary to the user: arguments from each agent, trade-offs, and each agent's recommendation.

### Step 4: Decision

Ask the user for the final call. Write `DecisionRecord` to `.geas/decisions/{dec-id}.json`.

---

## Evidence Gate

Invoked via `/geas:evidence-gate` after each implementation step (and explicitly at steps 2.7 / Step 8).

### Inputs

1. `EvidenceBundle` — `.geas/evidence/{task-id}/{worker-name}.json`
2. `TaskContract` — `.geas/tasks/{task-id}.json`
3. Gate level — which tiers to run

### Tier Selection

| Situation | Tiers to run |
|---|---|
| Implementation task (code change) | Tier 1 + Tier 2 |
| Design spec (no code) | Tier 2 only |
| Feature completion (ready for release) | Tier 1 + Tier 2 + Tier 3 |
| Code review (Forge reviewing) | Tier 2 only |
| QA testing (Sentinel) | Tier 1 + Tier 2 |
| Security review (Shield) | Tier 2 only |
| Phase completion | Tier 1 + Tier 2 + Tier 3 |

### Tier 1: Mechanical Gate

1. Read `eval_commands` from the TaskContract.
2. Execute each command. Record: `pass` (exit 0), `fail` (non-zero, capture output), `skip` (not applicable).
3. Stop on first failure — no point running semantic checks if the build fails.
4. If no commands exist, record as `"skip"`. Having commands but not running them is a gate violation.

If the EvidenceBundle contains `verify_results`, compare against a fresh run. Trust the fresh run.

### Tier 2: Semantic Gate

**Part A — Acceptance Criteria:**
For each criterion in `acceptance_criteria`:
1. Read worker evidence (summary, files_changed, criteria_results).
2. If worker provided `criteria_results`, verify their self-assessment; otherwise infer from evidence.
3. Record `{ "criterion": "...", "met": true/false, "evidence": "..." }`.

All criteria must be met before scoring rubric.

**Part B — Rubric Scoring:**
1. Read `rubric` array from TaskContract.
2. Read evaluator evidence: Forge's evidence → `code_quality` score; Sentinel's evidence → all other dimensions.
3. Compare each `rubric_scores` entry against its `threshold`.

Threshold adjustment rules:
- If worker's `self_check.confidence` ≤ 2: add +1 to every threshold (stricter review).
- If worker's `self_check.possible_stubs` is non-empty: verify stubs are resolved. Any confirmed stub → `feature_completeness` capped at 2.

All rubric dimensions must meet threshold for Tier 2 to pass. `blocking_dimensions` lists exactly which dimensions failed.

### Tier 3: Product Gate

Spawn Nova with: task goal, all evidence bundles, Tier 2 criteria results, and mission context from seed.

Nova's verdict: **Ship** / **Iterate** / **Cut**.

Only run Tier 3 for: feature completion, phase completion, or pivot decisions.

### Gate Output

```json
{
  "task_id": "task-003",
  "verdict": "pass | fail | iterate",
  "tiers": {
    "mechanical": { "status": "pass", "results": {} },
    "semantic": { "status": "pass", "criteria_met": 5, "criteria_total": 5, "rubric_pass": true, "rubric_scores": [], "blocking_dimensions": [] },
    "product": { "status": "ship", "nova_notes": "..." }
  },
  "failures": [],
  "timestamp": "..."
}
```

Log to `.geas/ledger/events.jsonl`:
```json
{
  "event": "gate_result",
  "task_id": "task-001",
  "result": "pass",
  "tiers": { ... },
  "timestamp": "<actual ISO 8601>"
}
```

### Verify-Fix Loop (gate failure)

Invoked via `/geas:verify-fix-loop` when the gate fails.

**Entry point:**
1. Read TaskContract for `retry_budget` (default: 3) and `escalation_policy`.
2. Read failed EvidenceBundle from `.geas/evidence/{task-id}/sentinel.json`.
3. Read gate verdict — which tier failed and why.

**Per iteration:**

| Sub-step | Action |
|---|---|
| A: Identify fixer | Frontend bugs → Pixel. Backend bugs → Circuit. Both → spawn both with clear ownership. |
| B: Spawn fixer | `isolation: "worktree"`. ContextPacket includes failures, unmet criteria, `blocking_dimensions`, and files_changed. |
| C: Re-run gate | Invoke `/evidence-gate`. Runs Tier 1 + Tier 2. |
| D: Evaluate | Pass → exit loop, proceed to Nova (Tier 3). Fail → next iteration or escalation. |

Merge worktree branch after fixer completes, before re-running gate.

**After budget exhausted** — follow `escalation_policy` (see [Escalation Paths](#escalation-paths)).

---

## Checkpoint and Recovery

### remaining_steps Array Behavior

`remaining_steps` in `.geas/state/run.json` is the authoritative record of what is left to do for the current task.

- Written at task start (2.0 / Sprint Step 1) with the full step list.
- Steps that will be skipped are removed from the array before writing.
- After each step completes successfully: pop from the **front** of the array and write the updated array back to `run.json`.
- If the session is interrupted mid-step, the step at `remaining_steps[0]` is the step to resume.

### run.json Checkpoint Fields

Each step updates these fields in `.geas/state/run.json` before spawning the agent:

```json
{
  "current_task_id": "{task-id}",
  "pipeline_step": "{step_name}",
  "agent_in_flight": "{agent_name}",
  "remaining_steps": [...]
}
```

### Session Resume Protocol

When Compass starts and detects an existing `run.json` with `status: "in_progress"`:

1. Read `run.json` to find `current_task_id`, `pipeline_step`, and `remaining_steps`.
2. Check whether evidence for the interrupted step already exists.
   - Evidence exists → the step completed before the session ended. Pop the step from `remaining_steps` and continue from the next step.
   - Evidence missing → re-execute the step from the beginning.
3. Before resuming any downstream step, verify mandatory evidence files from prior steps exist (apply the Ship Gate check for any task near completion).

The `restore-context` hook loads `run.json` at session start and surfaces the resume point to the user before proceeding.

---

## Skip Conditions

### Design (Palette) — step 2.1 / Sprint step 2

| Condition | Run Design? |
|---|---|
| Task has pages, forms, or dashboards | YES — always run |
| Task is backend-only (API, CI, Docker, DB migration) | NO — skip |
| Task is a pure library or utility module | NO — skip |

Design runs by default. Skip only when the task has **no** user-facing interface.

### Tech Guide (Forge) — step 2.2 / Sprint step 3

Tech Guide skips only when **ALL** of the following are true simultaneously:

| Condition | Must be true to skip |
|---|---|
| Task follows an existing pattern in `conventions.md` | Yes |
| No new external libraries or services required | Yes |
| Single module scope (no cross-boundary changes) | Yes |
| No data model or schema changes | Yes |

Tech Guide runs when **ANY** of the following is true:

| Trigger | Spawn Tech Guide? |
|---|---|
| New external library or service integration | YES |
| Architecture pattern change | YES |
| Cross-module dependencies | YES |
| New data model or schema changes | YES |

---

## Escalation Paths

Escalation is triggered when the verify-fix-loop exhausts its retry budget (`retry_budget` in the TaskContract, default: 3).

| `escalation_policy` value | Who acts | What happens |
|---|---|---|
| `"forge-review"` (default) | Forge | Architectural review. If Forge finds a fixable root cause → apply fix, one more test run. If approach is broken → escalate to Nova. |
| `"nova-decision"` | Nova | Strategic decision: scope cut, feature drop, alternative approach, or push through. |
| `"pivot"` | Compass | Invoke `/pivot-protocol` with full context. |

For all escalation paths:
1. Update TaskContract status to `"escalated"`.
2. Write a `DecisionRecord` to `.geas/decisions/{dec-id}.json`.
3. Log escalation event to `.geas/ledger/events.jsonl`.

The `forge-review` → Nova path:

```
Gate fails N times
  → Forge reviews (forge-escalation.json)
      → Fixable? → one more fix + re-gate
      → Broken? → Nova decides
          → scope cut / feature drop / alternative / push
  → DecisionRecord written
  → status: "escalated"
```

---

## Event Logging

All events append to `.geas/ledger/events.jsonl` (newline-delimited JSON). Timestamps must be actual ISO 8601 values from `date -u`, never placeholder strings.

### Standard step_complete Event

Logged after each step completes and is removed from `remaining_steps`.

```json
{"event": "step_complete", "task_id": "{task-id}", "step": "{step_name}", "agent": "{agent_name}", "timestamp": "<actual>"}
```

Steps that use `step_complete`: `design`, `tech_guide`, `implementation`, `code_review`, `testing`, `critic_review`, `nova_review`, `retrospective`.

### Events with Own Formats (no step_complete duplication)

| Step | Event name | When logged |
|---|---|---|
| Implementation Contract | `implementation_contract` | After approval or revision request |
| Evidence Gate | `gate_result` | After gate completes (pass or fail) |
| Resolve | `task_resolved` | After Ship/Iterate/Cut decision |

### Phase and Lifecycle Events

| Event | When logged |
|---|---|
| `task_compiled` | After each TaskContract is compiled (Discovery 1.6) |
| `task_started` | At start of each task (step 2.0) |
| `phase_complete` | At the end of each phase (Discovery, MVP, Polish, Evolution) |
| Escalation event | When retry budget is exhausted and escalation_policy is invoked |

### gate_result Event Structure

```json
{
  "event": "gate_result",
  "task_id": "task-001",
  "result": "pass|fail",
  "tiers": {
    "mechanical": { "status": "pass|fail|skip", "commands_run": ["..."] },
    "semantic": { "status": "pass|fail", "criteria_met": 5, "criteria_total": 5, "rubric_pass": true, "rubric_scores": [], "blocking_dimensions": [] },
    "product": { "status": "ship|iterate|cut", "nova_notes": "..." }
  },
  "timestamp": "<actual ISO 8601>"
}
```
