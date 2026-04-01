# CLAUDE.md

## Project Identity

**Governance. Traceability. Verification. Evolution.**

Geas brings structure to multi-agent AI development. The core value is not the number of agents — it's that every decision follows a governed process, every action is traceable, every output is verified against a contract, and the team evolves across sessions.

When making any design decision, ask: **"Does this make the multi-agent process more governed, traceable, verifiable, or capable of learning?"**

## Architecture (4 Layers)

```
Collaboration Surface  ← replaceable (Dashboard, CLI, ...)
Agent Teams            ← replaceable (Geas-12, Lean-4, Custom)
Contract Engine        ← core (invariant)
Tool Adapters          ← replaceable (Claude Code, ...)
```

Full architecture: `docs/architecture/DESIGN.md`

## Execution Model

Three top-level modes: `discovery`, `delivery`, `decision`.

- **Initiative mission** — 4-phase structure: discovery → build → polish → evolution
- **Sprint** — delivery mode pattern: bounded feature addition to existing project
- **Decision** — structured decision-making without code changes

## Task Lifecycle

7 primary states: `drafted → ready → implementing → reviewed → integrated → verified → passed`
4 auxiliary states: `blocked`, `escalated`, `cancelled`, `paused` (scheduler flag)

## Verification Flow

```
Evidence Gate (Tier 0 → Tier 1 → Tier 2)
    → Closure Packet assembly
    → Critical Reviewer Challenge (high/critical required)
    → Final Verdict (product_authority: pass / iterate / escalate)
```

Gate verdicts: `pass | fail | block | error`. `iterate` is Final Verdict only.

## Project Structure

```
plugin/
├── plugin.json              # Claude plugin manifest
├── skills/                  # Shared skills (core + team + surface)
└── agents/                  # 12 agent definitions

docs/
├── protocol/                # Operating protocol (English, canonical)
│   ├── 00-14 .md            # 15 protocol documents
│   ├── schemas/             # 19 JSON Schema (draft 2020-12)
│   └── examples/            # 15 example files
├── architecture/DESIGN.md   # Architecture overview
└── reference/               # SKILLS.md, HOOKS.md

docs/ko/                     # Korean mirror (protocol/ is canonical Korean)
```

### Core skills (contract engine)
- `intake/` — Socratic requirements gathering → seed.json
- `task-compiler/` — seed → TaskContracts with classification, rubric, routing
- `context-packet/` — role-specific briefings (Phase 4: + memory retrieval)
- `implementation-contract/` — pre-implementation agreement between worker and reviewers
- `evidence-gate/` — Tier 0/1/2 verification (pass/fail/block/error)
- `verify-fix-loop/` — fail → fix → re-verify with retry budget
- `vote-round/` — structured agent voting (proposal_round + readiness_round)

### Team skills (execution protocols)
- `initiative/` — 4-phase mission (discovery → build → polish → evolution)
- `sprint/` — delivery mode: bounded feature addition
- `debate/` — decision mode: structured decision-making, no code

## Key Design Principles

1. **Contract Engine is tool-agnostic** — core skills must not reference any specific tool.
2. **Agents are templates, not identity** — the 12-agent team is one configuration. The contract engine works with any agent setup.
3. **Collaboration surface is an adapter** — don't hardcode surface assumptions into core skills.
4. **Evidence over declaration** — "agent says done" is never enough. Evidence Gate must verify.
5. **Memory is a behavior-change mechanism** — memory must alter future actions through rules.md, context packets, gate strictness, and scheduling caution.
6. **Protocol is north star** — skills are upgraded to match the protocol, not the other way around. See `docs/protocol/13_MIGRATION_AND_IMPLEMENTATION_ROADMAP.md`.

## Agent Name Rule

Protocol docs (`docs/protocol/`, `docs/ko/protocol/`) and core skills MUST use **agent type names only** (e.g., `product_authority`, `critical_reviewer`, `process_lead`). NEVER use character names (Nova, Forge, Pixel, Circuit, Sentinel, Keeper, Shield, Critic, Scroll, Scrum, Palette, Pipeline, Compass). Character names are defined only in `plugin/agents/*.md`.

## Tool-Agnostic Rules

Core skills (`plugin/skills/`) MUST NOT hardcode specific tools, frameworks, or package managers.

**Forbidden**: package manager names, framework names, database names, test tool names, build tool names as defaults.

**Allowed**: `.geas/memory/_project/conventions.md` references, marker file detection (package.json, go.mod), multiple-alternative examples.

## Language

All files must be written in English, except `docs/ko/` and `README.ko.md`.

## Conventions

- Skills: `SKILL.md` with YAML frontmatter (`name`, `description`)
- Agents: `.md` with YAML frontmatter (`name`, `model`, etc.)
- Schemas: JSON Schema draft 2020-12 in `docs/protocol/schemas/`
- Runtime state: `.geas/` (gitignored, per-project)
- Protocol reference: `docs/protocol/` (English canonical), `docs/ko/protocol/` (Korean canonical)

## Protocol Migration (current work)

We are upgrading skills to match the v3 protocol. Migration follows 6 phases (see `docs/protocol/13_MIGRATION_AND_IMPLEMENTATION_ROADMAP.md`). Each phase depends on the previous one.

### Current phase: Phase 1 — Minimum Enforceable State

Priority gaps to close:
1. Task 7-state model in task-compiler (drafted→ready→implementing→reviewed→integrated→verified→passed)
2. Worker self-check generation (currently consumed but never produced)
3. Evidence Gate ↔ Final Verdict separation (currently merged — gate should return pass/fail/block/error only)
4. Closure Packet assembly (new step after gate pass)
5. Critical Reviewer Challenge (new step before final verdict)
6. Directory rename: `debate/` → `decision/` (with plugin.json, hooks, cross-references)

### How to work on migration

1. **Read the protocol doc first** — before touching any skill, read the relevant protocol document in `docs/protocol/`.
2. **Read the skill second** — understand what it currently does vs what the protocol requires.
3. **Change one gap at a time** — don't mix multiple gaps in one change. Commit after each.
4. **Protocol schemas are the contract** — `docs/protocol/schemas/` defines the exact artifact shapes. Skills must produce artifacts that validate against these schemas.
5. **Update both `initiative` and `sprint`** when changing shared pipeline behavior.
6. **Don't break working functionality** — migration is incremental. Old behavior should keep working until explicitly replaced.

### Protocol quick reference

| Topic | Protocol doc |
|-------|-------------|
| Design principles, 4 Pillars, terminology | `protocol/00` |
| Agent types, authority, routing | `protocol/01` |
| Modes, phases, mission model | `protocol/02` |
| Task states, transitions, self-check | `protocol/03` |
| Worktree, locks, parallelism | `protocol/04` |
| Gate, vote, closure, verdict | `protocol/05` |
| Specialist evidence matrix | `protocol/06` |
| Memory system overview | `protocol/07` |
| Memory lifecycle, promotion | `protocol/08` |
| Memory retrieval, context engine | `protocol/09` |
| Session recovery | `protocol/10` |
| Runtime artifacts, schemas | `protocol/11` |
| Enforcement, metrics | `protocol/12` |
| Migration roadmap, skill gaps | `protocol/13` |
| Evolution, debt, gap loop | `protocol/14` |

## When editing skills or agents

- Read the existing file first — understand the current behavior before changing it
- Keep skills focused — one skill, one responsibility
- Update both `initiative` and `sprint` when changing shared behavior
- Align with protocol — check `docs/protocol/` for the target behavior
- Test changes by running the harness in `test_session/`
