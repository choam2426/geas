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
4 auxiliary states: `blocked`, `escalated`, `cancelled`, `paused` (scheduler flag)

## Verification Flow

```
Evidence Gate (Tier 0 → Tier 1 → Tier 2)
    → Closure Packet assembly
    → Challenger Review (high/critical required)
    → Final Verdict (product_authority: pass / iterate / escalate)
```

Gate verdicts: `pass | fail | block | error`. `iterate` is Final Verdict only.

## Project Structure

```
plugin/
├── plugin.json              # Claude plugin manifest
├── skills/                  # 15 skills (13 core + 2 utility)
│   ├── mission/             # Geas orchestrator
│   ├── intake/              # Requirements gathering
│   ├── ...                  # (13 core contract engine skills)
│   ├── write-prd/           # SW utility
│   └── write-stories/       # SW utility
└── agents/
    ├── authority/           # 3 spawnable authority agents
    ├── software/            # 5 software domain specialists
    └── research/            # 6 research domain specialists

docs/
├── protocol/                # Operating protocol (English, canonical)
│   ├── 00-13 .md             # 14 protocol documents
│   ├── schemas/             # 30 JSON Schema (draft 2020-12)
│   └── examples/            # 16 example files
├── architecture/DESIGN.md   # Architecture overview
└── reference/               # SKILLS.md, HOOKS.md

docs/ko/                     # Korean mirror (protocol/ is canonical Korean)
```

### Core skills (contract engine)
- `mission/` — Geas orchestrator: startup, recovery, 4-phase mission, slot resolution via domain profiles
- `intake/` — Socratic requirements gathering → mission spec with domain_profile selection
- `task-compiler/` — mission spec + design-brief → TaskContracts with classification, rubric, routing
- `context-packet/` — role-specific briefings with memory retrieval, conventions injection
- `implementation-contract/` — pre-implementation agreement between worker and reviewers
- `evidence-gate/` — Tier 0/1/2 verification (pass/fail/block/error)
- `verify-fix-loop/` — fail → fix → re-verify with retry budget
- `vote-round/` — structured agent voting, decisions, and pivot handling
- `memorizing/` — memory lifecycle: candidate extraction, promotion, review, application logging
- `scheduling/` — parallel task scheduling: batch construction, lock checks, safe conditions
- `setup/` — project initialization, codebase discovery, conventions detection
- `policy-managing/` — rules.md override management
- `reporting/` — health signals, status briefing, session summary, debt/gap dashboard

### Mission references
- `mission/references/specifying.md` — Specifying phase procedure
- `mission/references/pipeline.md` — Per-task 14-step pipeline
- `mission/references/building.md` — Building phase management
- `mission/references/polishing.md` — Polishing phase procedure
- `mission/references/evolving.md` — Evolving phase procedure

### Utility skills (domain-specific)
- `write-prd/` — PRD generation
- `write-stories/` — user story generation

## Key Design Principles

1. **Contract Engine is tool-agnostic** — core skills must not reference any specific tool.
2. **Agents are templates, not identity** — the 14-agent team is one configuration. The contract engine works with any agent setup.
3. **Collaboration surface is an adapter** — don't hardcode surface assumptions into core skills.
4. **Evidence over declaration** — "agent says done" is never enough. Evidence Gate must verify.
5. **Memory is a behavior-change mechanism** — memory must alter future actions through rules.md, context packets, gate strictness, and scheduling caution.
6. **Protocol is north star** — skills are upgraded to match the protocol, not the other way around.

## Agent Name Rule

Protocol docs (`docs/protocol/`, `docs/ko/protocol/`), core skills, and agent file names all use **agent type names** (e.g., `product-authority`, `design-authority`, `challenger`, `software-engineer`, `platform-engineer`). Character names appear only inside agent file content as personality/identity, never as file names or references.

## Runtime Accessibility Rule

Skills run inside a plugin runtime. At execution time, agents can ONLY access:
- Files in the user's project directory (`.geas/`, source code, etc.)
- The skill's own directory (SKILL.md, schemas/, references/)
- Other plugin skills (via `/geas:<name>` invocation)

Agents CANNOT access `docs/protocol/`, `docs/architecture/`, or any file outside `plugin/` at runtime. When writing skills:
- **DO NOT** reference `docs/protocol/schemas/` — use local `schemas/` in the skill directory
- **DO NOT** reference `docs/protocol/*.md` — inline the protocol requirements in the skill text
- **DO** put schemas each skill needs in that skill's `schemas/` directory
- **DO** inline required artifact fields in Agent() prompts (spawned agents can't read schema files)

The `docs/protocol/schemas/` directory is the canonical reference for developers and validation tools. Skill-local `schemas/` copies are the operational copies for runtime use.

## .geas/ CLI-Only Manipulation Rule

All `.geas/` runtime state files (JSON, JSONL, markdown) must be read and written through the `geas` CLI tool (`plugin/cli/`), not through direct Read/Write/Edit tool calls. The CLI auto-manages timestamps (`created_at`, `updated_at`, `timestamp`) and enforces schema validation.

**Exceptions**:
- Sub-agents spawned with `isolation: "worktree"` or without CLI access may use Read/Write tools directly. The PostToolUse hook handles timestamp injection for these cases.
- Reading `.geas/` files for context (e.g., checking if a file exists, reading state for decisions) is allowed via Read tool.

## Tool-Agnostic Rules

Core skills (`plugin/skills/`) MUST NOT hardcode specific tools, frameworks, or package managers.

**Forbidden**: package manager names, framework names, database names, test tool names, build tool names as defaults.

**Allowed**: `.geas/memory/_project/conventions.md` references, marker file detection (package.json, go.mod), multiple-alternative examples.

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

v3 protocol migration (6 phases) is complete. Domain-agnostic restructure is in progress.

### v3 migration (complete)

- **Phase 1**: 7-state task model, worker self-check, gate/verdict separation, closure packet, challenger review, debate→decision rename
- **Phase 2**: revalidation-record/lock-manifest schemas, staleness detection, lock lifecycle, safe parallel conditions, compass→mission + parallel-dispatch→scheduling renames
- **Phase 3**: structured retrospective, rules-update workflow, debt-register.json, gap-assessment.json, phase-review wiring, Evolving exit gate
- **Phase 4**: memorizing skill (9-state lifecycle, 6-stage promotion), memory retrieval scoring in context-packet, application logging, memory-index, memory hooks
- **Phase 5**: recovery-packet schema, extended run-state, recovery decision table, session-latest.md + task-focus maintenance, two-phase checkpoint hooks
- **Phase 6**: conformance-checking, chaos-exercising, policy-managing, reporting (health signals), memory review cadence hook

### Domain-agnostic restructure (complete)

Plugin restructured: agents split into authority/ (3) + software/ (5) + research/ (6), skills consolidated to 15 (flat structure). Slot-based agent routing via domain profiles replaces hardcoded agent references. orchestrating renamed to mission. Hooks cleaned up (19 → 16). All docs updated.

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
| Task states, transitions, self-check | `protocol/03` |
| Workspace, locks, parallelism | `protocol/04` |
| Gate, vote, closure, verdict | `protocol/05` |
| Specialist evidence matrix | `protocol/06` |
| Memory system overview | `protocol/07` |
| Memory lifecycle, promotion | `protocol/08` |
| Memory retrieval, context engine | `protocol/09` |
| Session recovery | `protocol/10` |
| Runtime artifacts, schemas | `protocol/11` |
| Enforcement, metrics | `protocol/12` |
| Evolution, debt, gap loop | `protocol/13` |

## When editing skills or agents

- Read the existing file first — understand the current behavior before changing it
- Keep skills focused — one skill, one responsibility
- Update `mission/references/` when changing pipeline behavior
- Align with protocol — check `docs/protocol/` for the target behavior
- Test changes by running a fresh integration test in a separate project directory
