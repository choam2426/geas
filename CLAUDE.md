# CLAUDE.md

## Project Identity

**Governance. Traceability. Verification. Evolution.**

Geas brings structure to multi-agent AI work. The core value is not the number of agents — it's that every decision follows a governed process, every action is traceable, every output is verified against a contract, and the team evolves across sessions.

When making any design decision, ask: **"Does this make the multi-agent process more governed, traceable, verifiable, or capable of learning?"**

## Architecture (4 Layers)

```
Collaboration Surface  ← replaceable (Dashboard, CLI, ...)
Agent Teams            ← replaceable (14-agent, Lean-4, Custom)
Contract Engine        ← core (invariant)
Tool Adapters          ← replaceable (Claude Code, ...)
```

Full architecture: `docs/architecture/DESIGN.md`

## Execution Model

Every mission follows 4 phases: Specifying → Building → Polishing → Evolving. Scale adapts to the request — from a single feature to a full product. Always follows the same pipeline order.

Specifying produces three user-approved artifacts: mission spec (WHAT/WHY), design-brief (HOW), and task list (UNITS OF WORK). Design-authority reviews every design-brief. Full-depth briefs also go through a vote round.

## Task Lifecycle

7 primary states: `drafted → ready → implementing → reviewed → integrated → verified → passed`
3 auxiliary states: `blocked`, `escalated`, `cancelled`

## Verification Flow

```
Evidence Gate (Tier 0 → Tier 1 → Tier 2)
    → Closure Packet assembly
    → Challenger Review (high/critical required)
    → Final Verdict (product-authority: pass / iterate / escalate)
```

Gate verdicts: `pass | fail | block | error`. `iterate` is Final Verdict only.

## Project Structure

```
plugin/
├── plugin.json              # Claude plugin manifest
├── bin/
│   └── geas                 # Pre-built CLI bundle (single file)
├── skills/                  # 13 skills (12 core + 1 utility)
│   ├── mission/             # Geas orchestrator
│   ├── intake/              # Requirements gathering
│   └── ...                  # (12 core contract engine + 1 utility skill)
└── agents/
    ├── authority/           # 3 spawnable authority agents
    ├── software/            # 5 software domain specialists
    └── research/            # 6 research domain specialists

src/
└── cli/                     # CLI source (development only)

docs/
├── protocol/                # Operating protocol (English, canonical)
│   ├── 00-11 .md             # 12 protocol documents
│   ├── schemas/             # 16 JSON Schema (draft 2020-12)
│   └── examples/            # 7 example files
├── architecture/DESIGN.md   # Architecture overview
└── reference/               # AGENTS.md, SKILLS.md, HOOKS.md

docs/ko/                     # Korean mirror (protocol/ is canonical Korean)
```

### Core skills (contract engine)
- `mission/` — Geas orchestrator: startup, recovery, 4-phase mission, slot resolution via domain profiles
- `intake/` — Socratic requirements gathering → mission spec with domain_profile selection
- `task-compiler/` — mission spec + design-brief → TaskContracts with classification, rubric, routing
- `implementation-contract/` — pre-implementation agreement between worker and reviewers
- `evidence-gate/` — Tier 0/1/2 verification (pass/fail/block/error)
- `verify-fix-loop/` — fail → fix → re-verify with retry budget
- `vote-round/` — structured agent voting, decisions, and pivot handling
- `memorizing/` — memory lifecycle: 2-state (draft/active), entries + agent notes
- `scheduling/` — parallel task scheduling: batch construction, lock checks, safe conditions
- `setup/` — project initialization, codebase discovery, rules.md creation
- `policy-managing/` — rules.md override management
- `reporting/` — health signals, status briefing, debt/gap dashboard

### Utility skills
- `help/` — explains geas usage, available commands, workflows, and multi-agent process

### Mission references
- `mission/references/specifying.md` — Specifying phase procedure
- `mission/references/pipeline.md` — Per-task 14-step pipeline
- `mission/references/building.md` — Building phase management
- `mission/references/polishing.md` — Polishing phase procedure
- `mission/references/evolving.md` — Evolving phase procedure

## Key Design Principles

1. **Contract Engine is tool-agnostic** — core skills must not reference any specific tool.
2. **Agents are templates, not identity** — the 14-agent team is one configuration. The contract engine works with any agent setup.
3. **Collaboration surface is an adapter** — don't hardcode surface assumptions into core skills.
4. **Evidence over declaration** — "agent says done" is never enough. Evidence Gate must verify.
5. **Memory is a behavior-change mechanism** — memory must alter future actions through rules.md and agent memory notes.
6. **Protocol is north star** — skills are upgraded to match the protocol, not the other way around.

## Agent Name Rule

Agent type names use **hyphens consistently** across all contexts:

- **File names**: `product-authority.md`, `software-engineer.md`
- **YAML frontmatter `name` field**: `product-authority`, `software-engineer`
- **JSON schema enum values**: `product-authority`
- **Skill text and protocol prose**: `product-authority`, `software-engineer`
- **The canonical identifier for routing** is the YAML `name` field (hyphens)

Character names appear only inside agent file content as personality/identity, never as file names or references.

## Runtime Accessibility Rule

Skills run inside a plugin runtime. At execution time, agents can ONLY access:
- Files in the user's project directory (`.geas/`, source code, etc.)
- The skill's own directory (SKILL.md, references/)
- Other plugin skills (via `/geas:<name>` invocation)

Agents CANNOT access `docs/protocol/`, `docs/architecture/`, or any file outside `plugin/` at runtime. When writing skills:
- **DO NOT** reference `docs/protocol/schemas/` — the CLI is the single schema source
- **DO NOT** reference `docs/protocol/*.md` — inline the protocol requirements in the skill text
- **DO** use CLI commands for all .geas/ writes — CLI generates structure from schemas
- **DO** define evidence/memory rules in agent.md, not in Agent() prompts

The `docs/protocol/schemas/` directory is the canonical reference for developers and validation tools. The CLI (`plugin/bin/geas`, pre-built bundle; source at `src/cli/`) is the operational schema enforcement layer.

## .geas/ CLI-Only Manipulation Rule

All `.geas/` runtime state files (JSON, JSONL, markdown) must be read and written through the `geas` CLI tool (`plugin/bin/geas`; source at `src/cli/`), not through direct Read/Write/Edit tool calls. The CLI auto-manages timestamps and enforces schema validation. **Zero exceptions for writes.**

Key CLI commands:
- `geas task record add --section {name}` — add section to record.json (execution record)
- `geas evidence add --role {role}` — create role-based evidence file
- `geas task transition --to {state}` — transition with guard validation
- `geas event log` — append to events.jsonl
- `geas memory agent-note --agent {name}` — update agent memory

Reading `.geas/` files for context (e.g., checking state for decisions) is allowed via Read tool.

## Tool-Agnostic Rules

Core skills (`plugin/skills/`) MUST NOT hardcode specific tools, frameworks, or package managers.

**Forbidden**: package manager names, framework names, database names, test tool names, build tool names as defaults.

**Allowed**: `.geas/rules.md` references, marker file detection (package.json, go.mod), multiple-alternative examples.

## Language

All files must be written in English, except `docs/ko/` and `README.ko.md`.

## Conventions

- Skills: `SKILL.md` with YAML frontmatter (`name`, `description`). **All skills must be direct children of `plugin/skills/`** (flat structure). Claude Code plugin discovers skills one level deep only — nested subdirectories (e.g., `skills/core/mission/`) are not discovered. Core vs utility distinction is conceptual (documented), not physical (directory).
- Agents: `.md` with YAML frontmatter (`name`, `model`, etc.)
- Schemas: JSON Schema draft 2020-12 in `docs/protocol/schemas/`
- Runtime state: `.geas/` (gitignored, per-project)
- Protocol reference: `docs/protocol/` (English canonical), `docs/ko/protocol/` (Korean canonical)
- Versioning: `plugin/plugin.json` and `.claude-plugin/marketplace.json` must always have the same `version` and `description`. Update both when bumping version.

## Protocol Migration

v3 → v4 migration is in progress. v3 and domain-agnostic restructure are complete.

### v4 optimization (in progress)

- record.json: per-task artifacts consolidated from 9 files to 1 (sections accumulated via CLI)
- Role-based evidence: `evidence/{agent}.json` with implementer/reviewer/tester/authority roles
- Memory simplified: 9-state → 2-state (draft/active), 6 schemas → 1, 7 directories → 2
- Protocol docs: 14 → 12 (memory docs 08+09 merged into 07)
- Transition guards: 6 per-task + 3 phase guards (mechanical enforcement)
- CLI-only writes: zero exceptions, CLI generates artifact structure from schemas
- Agent self-management: evidence + memory rules in agent.md, not per-prompt
- Deleted: context-packet skill, write-prd, write-stories, agent-telemetry.sh, memory-promotion-gate.sh, memory-superseded-warning.sh
- Unified: conventions.md + rules.md → rules.md, costs.jsonl + events.jsonl → events.jsonl

### v3 migration (complete)

6 phases delivered: 7-state task model, gate/verdict separation, structured retrospective, 9-state memory lifecycle, recovery protocol, conformance checking.

### Domain-agnostic restructure (complete)

Agents split into authority/ (3) + software/ (5) + research/ (6), skills consolidated to flat structure. Slot-based agent routing via domain profiles.

### Working with skills

1. **Read the protocol doc first** — before touching any skill, read the relevant protocol document in `docs/protocol/`.
2. **Read the skill second** — understand what it currently does vs what the protocol requires.
3. **Protocol schemas are the contract** — `docs/protocol/schemas/` defines the exact artifact shapes. Skills must produce artifacts that validate against these schemas.
4. **Update `mission/references/`** when changing pipeline behavior.
5. **Run conformance checks** after significant changes to verify enforcement mechanisms still work.

### Protocol quick reference

| Topic | Protocol doc |
|-------|-------------|
| Design principles, 4 Pillars, terminology | `protocol/00` |
| Agent types, authority, routing | `protocol/01` |
| Mission phases, mission model | `protocol/02` |
| Task states, transitions, record.json | `protocol/03` |
| Workspace, locks, parallelism | `protocol/04` |
| Gate, vote, closure, verdict | `protocol/05` |
| Specialist evidence matrix | `protocol/06` |
| Memory system (lifecycle + retrieval) | `protocol/07` |
| Session recovery | `protocol/08` |
| Runtime artifacts, schemas, directory structure | `protocol/09` |
| Enforcement, transition guards, metrics | `protocol/10` |
| Evolution, debt, gap loop | `protocol/11` |

## When editing skills or agents

- Read the existing file first — understand the current behavior before changing it
- Keep skills focused — one skill, one responsibility
- Update `mission/references/` when changing pipeline behavior
- Align with protocol — check `docs/protocol/` for the target behavior
- Test changes by running a fresh integration test in a separate project directory
