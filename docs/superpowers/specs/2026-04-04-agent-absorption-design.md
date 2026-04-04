# Agent Absorption — Remove repository-manager and process-lead

## Problem

`repository-manager` and `process-lead` are thin agents that add spawn overhead without proportional value:

- **repository-manager** spawns just to run git commit/release — pure command execution the orchestrator can do directly
- **process-lead** spawns to read evidence the orchestrator already has in context (from closure packet assembly) and fill a retrospective template — not a judgment task requiring fresh perspective

In Claude Code's single-LLM environment, spawning a fresh subagent to re-read files and fill templates is overhead without genuine perspective gain. Removing 2 agent spawns per task meaningfully reduces pipeline cost.

## Design

### Agents removed

| Agent | Current role | Absorbed by |
|-------|-------------|-------------|
| `repository-manager` | git commit at Resolve, release at Evolving | orchestration_authority (direct execution) |
| `process-lead` | retrospective at Ship, rules update at Evolving, memory promotion | orchestration_authority (direct execution) |

Agent count: 12 → 10.

### repository-manager absorption

#### Pipeline Resolve step (pipeline.md)

Current:
```
Agent(agent: "repository-manager", prompt: "Commit all changes for {task-id}...")
```

New: Orchestrator runs git commit directly:
```
Run: git add -A && git commit -m "{conventional commit message for task-id}"
Log: {"event": "task_resolved", "task_id": "...", "commit": "{hash}", "timestamp": "..."}
```

No `repository-manager.json` evidence file produced. The commit hash in the event log serves as evidence.

#### Evolving release step (evolving.md)

Current:
```
Agent(agent: "repository-manager", prompt: "Create release: version bump, changelog...")
```

New: Orchestrator runs release directly:
```
Run version bump, changelog generation, git tag, final commit.
Log: {"event": "release_created", "version": "...", "timestamp": "..."}
```

No `repository-manager-release.json` evidence file produced.

#### orchestrating/SKILL.md git rules

Current: "All git operations (commit, branch, PR) must be done by repository_manager."

New: Remove this rule. Orchestrator handles git directly. Conventional commit format is maintained by the orchestrator.

### process-lead absorption

#### Pipeline Retrospective step (pipeline.md)

Current:
```
Agent(agent: "process-lead", prompt: "Read all evidence... Write retrospective...")
```

New: Orchestrator reads evidence and writes retrospective.json directly. The retrospective content and structure remain identical — same fields (what_went_well, what_broke, what_was_surprising, rule_candidates, memory_candidates, debt_candidates, next_time_guidance).

`producer_type` in retrospective.json changes to `"orchestration_authority"`.

#### Evolving phase (evolving.md)

Rules update review, memory promotion, protocol drift detection — all currently attributed to process-lead but already orchestrated by orchestration_authority. Remove the process-lead spawn and have orchestrator do these directly.

### Schema backward compatibility

`_defs.schema.json` agentType enum: keep `repository_manager` and `process_lead` values. Existing artifacts in `.geas/` may reference them. Removing enum values would invalidate existing artifacts.

`retrospective.schema.json`: keep `process_lead` as valid producer_type. New retrospectives use `orchestration_authority`.

### Files changed

#### Delete (2 files)
- `plugin/agents/repository-manager.md`
- `plugin/agents/process-lead.md`

#### Core execution (4 files)
| File | Change |
|------|--------|
| `plugin/plugin.json` | Remove 2 agent entries from agents array |
| `plugin/skills/orchestrating/references/pipeline.md` | Rewrite Resolve (remove repo-manager spawn, orchestrator commits directly) and Retrospective (remove process-lead spawn, orchestrator writes directly) |
| `plugin/skills/orchestrating/references/evolving.md` | Remove repo-manager release spawn, remove process-lead references |
| `plugin/skills/orchestrating/SKILL.md` | Remove "all git ops through repository_manager" rule |

#### Protocol docs (4 files)
| File | Change |
|------|--------|
| `docs/protocol/01_AGENT_TYPES_AND_AUTHORITY.md` | Remove repository_manager and process_lead type definitions, update decision boundary table |
| `docs/protocol/06_SPECIALIST_EVIDENCE_MATRIX.md` | Remove repository_manager row |
| `docs/protocol/08_EVOLVING_MEMORY_LIFECYCLE.md` | Change process_lead references to orchestration_authority |
| `docs/protocol/schemas/_defs.schema.json` | Keep enum values (backward compat) |

#### Documentation (8+ files)
| File | Change |
|------|--------|
| `docs/reference/AGENTS.md` | Remove 2 agent descriptions |
| `docs/architecture/DESIGN.md` | "12 agent types" → "10 agent types", update plugin structure |
| `CLAUDE.md` | Update agent count |
| `README.md` | "12 agent types" → "10 agent types" |
| `README.ko.md` | Sync |
| `docs/ko/reference/AGENTS.md` | Sync |
| `docs/ko/protocol/01,06,08` | Sync |
| `docs/ko/architecture/DESIGN.md` | Sync |

#### Other skills referencing these agents
| File | Change |
|------|--------|
| `plugin/skills/scheduling/SKILL.md` | Line 91: "repository_manager commits, retro done" → "orchestrator commits, retro done" |
| `plugin/skills/memorizing/SKILL.md` | Change process_lead references to orchestration_authority |
| `plugin/skills/reporting/SKILL.md` | Change process_lead references if present |
| `plugin/skills/chaos-exercising/SKILL.md` | Update if referencing either agent |

## What this does NOT change

- **Pipeline step count** — Resolve and Retrospective remain as steps; only the execution method changes (direct instead of agent spawn)
- **Retrospective content** — same fields, same structure, same purpose
- **Evidence gate, closure packet, critical reviewer** — unchanged
- **Other 10 agents** — unchanged
- **Schema enum values** — preserved for backward compatibility
