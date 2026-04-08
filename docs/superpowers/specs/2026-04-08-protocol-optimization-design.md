# Protocol Optimization Design

**Date**: 2026-04-08
**Status**: Draft
**Based on**: `docs/analysis/2026-04-08-execution-gap-analysis.md` (3 mission analysis)

## Problem Statement

The geas protocol defines a 14-step per-task pipeline producing up to 9 separate JSON artifact files per task. In practice, LLM orchestrators cannot reliably produce this volume:

- M1: 39 CLI calls, 45% artifact survival
- M2: 20 CLI calls, 81% artifact survival
- M3: 1 CLI call, 100% per-task artifact survival (but state tracking dead)

The protocol's design is sound — the execution burden is not. The goal is to reduce execution overhead while preserving all four pillars (Governance, Traceability, Verification, Evolution).

## Design Principles

1. **Keep all 14 pipeline steps** — steps are not the problem, artifact file count is
2. **Keep all 4 phases** — enforce with guards instead of prose
3. **Keep all 4 pillars** — reduce artifacts, not governance
4. **CLI-Only for all .geas/ writes** — zero exceptions
5. **CLI generates, orchestrator provides values** — CLI owns schemas, orchestrator provides key=value
6. **Two-level validation** — `record add` / `evidence add` validate structure (required fields present); `task transition` validates semantics (verdict=pass, all sections present). Structure validation catches typos early; semantic validation enforces the pipeline.
7. **Agents self-manage evidence and memory** — defined in agent.md, not per-prompt

## 1. Artifact Structure: record.json

### Before

```
tasks/task-001/
  worker-self-check.json       7 separate files
  gate-result.json             per task
  closure-packet.json
  final-verdict.json
  challenge-review.json
  integration-result.json
  retrospective.json
```

### After

```
tasks/{tid}/
  contract.json                Task contract (definition)
  packets/                     Context packets (agent briefings)
    software-engineer.md
    design-authority.md
  record.json                  Execution record (all steps accumulated)
  evidence/                    Agent deliverables
    software-engineer.json
    design-authority.json
    qa-engineer.json
```

### record.json schema

Single file, sections added incrementally as pipeline progresses:

```json
{
  "version": "1.0",
  "task_id": "task-001",

  "implementation_contract": {
    "planned_actions": ["..."],
    "edge_cases": ["..."],
    "status": "approved"
  },
  "self_check": {
    "confidence": 4,
    "known_risks": ["..."],
    "summary": "..."
  },
  "gate_result": {
    "verdict": "pass",
    "tier_results": { "tier0": "pass", "tier1": "pass", "tier2": "pass" }
  },
  "challenge_review": {
    "blocking": false,
    "concerns": ["..."]
  },
  "verdict": {
    "verdict": "pass",
    "rationale": "..."
  },
  "closure": {
    "change_summary": "...",
    "reviews": [{ "reviewer_type": "...", "status": "approved" }]
  },
  "retrospective": {
    "what_went_well": ["..."],
    "what_broke": ["..."],
    "memory_candidates": ["..."]
  }
}
```

### Edge cases

**Duplicate section add**: Adding the same section twice (e.g., gate_result after a verify-fix loop) **overwrites** the previous value. The record captures the final state, not history. History is in events.jsonl.

**Duplicate evidence**: Same agent writing evidence twice (e.g., after fix iteration) **overwrites** the previous file. Same rationale.

**Status source of truth**: `contract.json` holds the task's lifecycle status (managed by `geas task transition`). `record.json` has no status field — it only accumulates section data.

### CLI interface

```bash
# Add a section (CLI generates base structure from schema, merges --set values)
geas task record add --task task-001 --section self_check \
  --set confidence=4 \
  --set "summary=Build passed, all criteria met"

# Add a section from file (for complex data)
geas task record add --task task-001 --section gate_result \
  --file tmp-gate.json

# Read a section
geas task record get --task task-001 --section self_check

# Read entire record
geas task record get --task task-001
```

## 2. Transition Guards

Transitions are the single verification gate. Write freely, validate at transition.

### Per-task guards

| Transition | record.json required sections | evidence/ checks |
|------------|------------------------------|-----------------|
| drafted -> ready | (contract.json exists) | -- |
| ready -> implementing | implementation_contract (approved) | -- |
| implementing -> reviewed | self_check | evidence/ >= 1 file, implementer role present |
| reviewed -> integrated | gate_result (pass) | reviewer or tester role present |
| integrated -> verified | -- | -- |
| verified -> passed | verdict (pass), closure, retrospective | challenge_review (high/critical risk) |

### Phase guards

| Transition | Required |
|------------|----------|
| building -> polishing | All tasks passed |
| polishing -> evolving | Security review or debt record exists |
| evolving -> complete | gap-assessment or mission-summary exists |

Guard failure returns an error with the missing artifact name. Orchestrator writes the missing artifact, retries the transition.

## 3. CLI Role Redefinition

### Responsibility split

```
CLI writes everything in .geas/:
  - record.json sections      (geas task record add)
  - evidence files             (geas evidence add)
  - task transitions           (geas task transition)
  - state management           (geas state update/read)
  - events                     (geas event log)
  - checkpoints                (geas state checkpoint)
  - task contracts             (geas task create)
  - context packets            (geas packet create)
  - mission artifacts          (geas mission write-spec/write-brief)
  - phase reviews              (geas phase write)
  - evolution artifacts        (geas evolution gap-assessment, geas debt add)
  - agent memory               (geas memory agent-note)

Write tool writes to .geas/:
  (nothing — zero exceptions)
```

### Command changes

| Command | Action |
|---------|--------|
| `task record add/get` | **New** — record.json section management |
| `evidence add` | **New** — evidence file creation with role-based schema |
| `packet create` | **New** — context packet creation |
| `memory agent-note` | **New** — append to agent memory |
| `--file` flag | **New** — all --data commands also accept --file |
| `task verdict` | **Delete** — merged into record add --section verdict |
| `task self-check` | **Delete** — merged into record add --section self_check |
| `task closure` | **Delete** — merged into record add --section closure |
| `task contract` | **Delete** — merged into record add --section implementation_contract |
| `evidence record` | **Delete** — replaced by evidence add |

### --set pattern

CLI generates base structure from schema, --set overrides specific fields:

```bash
# Instead of constructing full JSON:
geas task record add --task task-001 --section self_check \
  --set confidence=4 \
  --set "summary=Build passed" \
  --set "known_risks[0]=FTS5 special chars"

# CLI internally:
# 1. Load self_check schema -> generate defaults
# 2. Apply --set overrides
# 3. Validate against schema
# 4. Merge into record.json
```

**--set limitations**: `--set` handles scalar values and simple array items (`[0]`, `[1]`). For complex nested structures (e.g., rubric scores array of objects, criteria_results), use `--file` instead. The boundary is clear: simple key=value use `--set`, anything with nested objects use `--file`.

**--mission auto-resolution**: Most task-level commands (`task record add`, `evidence add`, `task transition`) infer `--mission` from `run.json`'s `mission_id` field. Explicit `--mission` flag is available for multi-mission scenarios but rarely needed.

**Agent access to task_id**: Agents receive `{task_id}` and `{mission_id}` via the Agent() prompt (set by orchestrator). The `## Before Exiting` template in agent.md uses these placeholders. Agents running in worktrees should use `--cwd {project_root}` to ensure CLI resolves paths correctly.

**Packet validation**: `geas packet create` accepts markdown content. No JSON schema validation (markdown is freeform). The packet's value is in its existence (traceability) and content (briefing quality), not its structure.

## 4. Evidence System

### Role-based evidence

Agents write evidence via CLI with role-based required fields:

```bash
geas evidence add --task task-001 --agent software-engineer --role implementer \
  --set "summary=Implemented repository layer" \
  --set "files_changed[0]=src/repository.ts" \
  --set "commit=5cb8564"
```

| Role | Required fields |
|------|----------------|
| implementer | summary, files_changed |
| reviewer | summary, verdict, concerns |
| tester | summary, verdict, criteria_results |
| authority | summary, verdict, rationale |

Common required fields for all roles: `agent`, `task_id`, `role`, `summary`.

### Agent self-management

Evidence and memory rules defined in agent.md (not per-prompt):

```markdown
<!-- agents/software/software-engineer.md -->

## Before Exiting

1. Write evidence:
   geas evidence add --task {task_id} --role implementer \
     --set "summary=..." --set "files_changed=..."

2. Update your memory (if you learned something reusable):
   geas memory agent-note --agent software-engineer \
     --add "lesson learned from this task"
```

Orchestrator's Agent() prompt focuses on task content only — no evidence/memory boilerplate.

## 5. Event Consolidation

### Before

```
ledger/costs.jsonl       <- agent-telemetry.sh hook (agent spawn/stop)
state/events.jsonl       <- geas event log CLI (pipeline events)
```

### After

```
state/events.jsonl       <- geas event log (single event source)

Deleted:
  agent-telemetry.sh hook
  ledger/costs.jsonl
  ledger/ directory
```

## 6. Memory System Simplification

### Before (protocol v3)

```
9-state lifecycle: raw -> candidate -> scored -> promoted -> entry ->
                   applied -> reviewed -> superseded -> archived
6 schemas, 3 protocol docs, 7 directories

Actual usage: conventions.md only (everything else empty across 3 projects)
```

### After

```
Two files. No lifecycle states. No schemas. No index.
```

### Structure

```
memory/
  agents/
    software-engineer.md    <- geas memory agent-note (per-agent)
    design-authority.md

rules.md                    <- conventions + rules + role-specific rules (unified)
```

### rules.md (all project knowledge)

```markdown
## Project Conventions
- TypeScript strict, ES2022, NodeNext
- React 19 + Vite

## Learned Rules
- FTS5 MATCH requires try-catch for malformed queries
- Category moves must check full subtree depth

## Role-Specific Rules
### reviewer
- Always include rubric_scores in evidence
```

### Agent memory (per-role notes)

```markdown
<!-- memory/agents/design-authority.md -->
# Design Authority Memory

- Review must include rubric_scores (task-001 finding)
- FTS5 index scope: title+description only, not code (mission-AQeKIOxC)
```

### Deleted

```
memory/_project/            <- absorbed into rules.md
memory/entries/              <- absorbed into rules.md
memory/candidates/
memory/incidents/
memory/logs/
memory/retro/
memory/memory-index.json    <- no longer needed
```

## 7. Skill Simplification

### Schema removal

```
Before:
  skills/*/schemas/          ~40 schema copies across 15 skills
  Agent() prompts            inline field lists, JSON examples

After:
  skills/*/schemas/          deleted (CLI is single schema source)
  Agent() prompts            task content only (evidence/memory in agent.md)
```

### Skill text pattern

```markdown
# Before (pipeline.md self-check step)
Worker writes a self-check to:
`.geas/missions/{mission_id}/tasks/{task_id}/worker-self-check.json`
Required fields: confidence (1-5), known_risks (array),
untested_paths (array), summary (string)...
[20 lines of JSON example]

# After
Worker self-check:
geas task record add --task {task_id} --section self_check \
  --set confidence={1-5} \
  --set "summary={worker's assessment}" \
  --set "known_risks={from worker output}"
```

### Skill deletions

| Skill | Reason |
|-------|--------|
| write-prd | Unused stub — never referenced in plugin |
| write-stories | Unused stub — never referenced in plugin |
| context-packet | Absorbed into mission skill — packet creation is now a CLI command (`geas packet create`) with orchestrator composing content inline |

### Hook deletions

| Hook | Reason |
|------|--------|
| agent-telemetry.sh | Non-core telemetry, events.jsonl consolidation |
| memory-promotion-gate.sh | 9-state model removed, 2-state has no promotion gates |
| memory-superseded-warning.sh | Superseded/decayed/archived states removed in 2-state model |

### Context-packet skill absorption

The context-packet skill's responsibilities are split:
- **Packet file creation**: `geas packet create --task {tid} --agent {name} --file content.md`
- **Content composition** (memory retrieval, conventions injection, role-specific briefing): Moved to mission skill's pipeline.md as orchestrator inline logic. The orchestrator reads task contract, rules.md, and agent memory, then composes the packet content before calling `geas packet create`.

### Remaining: 12 skills, 9 hooks

## 8. Directory Structure

### Final .geas/ layout

```
.geas/
  state/
    run.json                          <- geas state update/read
    events.jsonl                      <- geas event log
  
  rules.md                            <- geas rules update
  
  recovery/                           <- session recovery packets

  memory/
    agents/
      {agent-name}.md                 <- geas memory agent-note

  missions/{mid}/
    spec.json                         <- geas mission write-spec
    design-brief.json                 <- geas mission write-brief
    
    decisions/
      vote-round-{topic}.json         <- geas decision write
    
    phase-reviews/
      {phase}.json                    <- geas phase write
    
    evolution/
      gap-assessment.json             <- geas evolution gap-assessment
      debt-register.json              <- geas debt add
      rules-update.json               <- geas rules update
    
    tasks/{tid}/
      contract.json                   <- geas task create
      packets/
        {agent-name}.md               <- geas packet create
      record.json                     <- geas task record add
      evidence/
        {agent-name}.json             <- geas evidence add
```

### Deleted from current structure

```
Directories:
  ledger/                     <- events.jsonl consolidated to state/
  summaries/                  <- replaced by run.json + record.json
  state/task-focus/           <- replaced by run.json checkpoint + record.json
  missions/{mid}/contracts/   <- absorbed into record.json implementation_contract
  missions/{mid}/packets/     <- moved to tasks/{tid}/packets/
  memory/_project/            <- absorbed into rules.md
  memory/candidates/
  memory/incidents/
  memory/logs/
  memory/retro/
  memory/agents/ (json)       <- replaced by .md format

Files (per task):
  worker-self-check.json   \
  gate-result.json          |
  closure-packet.json       |-- all merged into record.json
  final-verdict.json        |
  challenge-review.json     |
  integration-result.json   |
  retrospective.json       /

Skills:
  write-prd/
  write-stories/
  context-packet/
  skills/*/schemas/ (all)

Hooks:
  agent-telemetry.sh
  memory-promotion-gate.sh
  memory-superseded-warning.sh
```

## 9. CLI Command Reference

| Command | Target | Action |
|---------|--------|--------|
| `geas state update` | run.json | Update state fields |
| `geas state read` | run.json | Read current state |
| `geas state checkpoint set/clear` | run.json | Manage checkpoints |
| `geas event log` | events.jsonl | Append event |
| `geas mission create` | missions/{mid}/ | Create mission directory |
| `geas mission write-spec` | spec.json | Write mission spec |
| `geas mission write-brief` | design-brief.json | Write design brief |
| `geas task create` | tasks/{tid}/contract.json | Create task contract |
| `geas task transition` | contract.json status | Transition with guards |
| `geas task record add` | record.json | Add section to record |
| `geas task record get` | record.json | Read record/section |
| `geas evidence add` | evidence/{agent}.json | Add role-based evidence |
| `geas packet create` | packets/{agent}.md | Create context packet |
| `geas phase write` | phase-reviews/{phase}.json | Write phase review |
| `geas evolution gap-assessment` | evolution/gap-assessment.json | Write gap assessment |
| `geas debt add` | evolution/debt-register.json | Add debt item |
| `geas rules update` | rules.md, evolution/rules-update.json | Update rules |
| `geas decision write` | decisions/vote-round-{topic}.json | Write vote round |
| `geas memory agent-note` | memory/agents/{agent}.md | Append agent memory |
| `geas lock acquire/release` | state/locks.json | Workspace locks (unchanged) |
| `geas context read` | (stdout) | Read context for recovery (unchanged) |
| `geas recovery create/read` | recovery/ | Session recovery packets (unchanged) |
| `geas health generate` | (stdout) | Generate health report |

## 10. Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| Artifact files per task | 9 | 1 (record.json) + evidence/ |
| CLI commands per task | ~15 | ~8 |
| Skill schema copies | ~40 | 0 |
| .geas/ Write tool exceptions | Many | 0 |
| Phase skip possibility | High (no enforcement) | Impossible (guards) |
| Memory system states | 9 | 0 (no lifecycle) |
| Memory schemas | 6 | 0 (markdown only) |
| Memory directories | 7 | 1 (agents/) |
| Total skills | 15 | 12 |
| Total hooks | 12 | 9 |
| Pipeline steps | 14 | 14 (unchanged) |
| Mission phases | 4 | 4 (unchanged) |
| Core pillars | 4 | 4 (unchanged) |
