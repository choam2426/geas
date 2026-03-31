# CLAUDE.md

## Project Identity

**Governance. Traceability. Verification. Evolution.**

Geas brings structure to multi-agent AI development. The core value is not the number of agents — it's that every decision follows a governed process, every action is traceable, every output is verified against a contract, and the team evolves across sessions.

When making any design decision, ask: **"Does this make the multi-agent process more governed, traceable, verifiable, or capable of learning?"**

## Architecture (4 Layers)

```
Collaboration Surface  ← replaceable (Dashboard, ...)
Agent Teams            ← replaceable (Geas-12, Lean-4, Custom)
Contract Engine        ← core (Intake, TaskContract, Evidence Gate)
Tool Adapters          ← replaceable (Claude Code, ...)
```

Full architecture: `docs/DESIGN.md`

## Project Structure

```
plugin/
├── plugin.json              # Claude plugin manifest
├── skills/                  # Shared skills (core + team + surface)
└── agents/                  # 12 agent definitions
```

### Core skills (contract engine)
- `intake/` — Socratic requirements gathering → seed.json
- `task-compiler/` — seed → TaskContracts with acceptance criteria and rubric
- `context-packet/` — role-specific briefings
- `implementation-contract/` — pre-implementation agreement between worker and reviewers
- `evidence-gate/` — 3-tier verification (mechanical, semantic+rubric, product)
- `verify-fix-loop/` — fail → fix → re-verify with retry budget
- `vote-round/` — structured agent voting + debate on disagreement

### Team skills (execution protocols)
- `initiative/` — 4-phase execution (Genesis → MVP → Polish → Evolution)
- `sprint/` — bounded feature addition to existing project
- `debate/` — decision-only discussion, no code

## Key Design Principles

1. **Contract Engine is tool-agnostic** — skills in core/ should not reference any specific AI tool.
2. **Agents are templates, not identity** — the 12-agent team is one configuration. The contract engine works with any agent setup.
3. **Collaboration surface is an adapter** — don't hardcode surface assumptions into core skills.
4. **Evidence over declaration** — "agent says done" is never enough. Evidence Gate must verify.
5. **Human comments are stakeholder input** — when reading collaboration threads for ContextPackets, human comments have the highest priority.

## Tool-Agnostic Rules

Core skills (`plugin/skills/`) MUST NOT hardcode specific tools, frameworks, or package managers. This includes:
- Package managers (npm, pnpm, yarn, bun)
- Frameworks (Next.js, React, Express, Django, etc.)
- Databases (PostgreSQL, MongoDB, etc.)
- Test tools (Playwright, Jest, pytest, etc.)
- Build tools (webpack, vite, etc.)

**Allowed**:
- Referencing `.geas/memory/_project/conventions.md` for project-specific commands
- Marker file names for stack detection (package.json, go.mod — these are detection targets, not prescriptions)
- Tool names in "e.g." lists that show multiple alternatives

Agent definitions may reference MCP tools by category ("browser automation MCP") but not by product name as the only option.

## Language

All files must be written in English, except `README.ko.md`. This includes skills, agents, hooks, docs, and comments in code.

## Conventions

- Skills are defined in `SKILL.md` with YAML frontmatter (`name`, `description`)
- Agents are defined in `.md` with YAML frontmatter (`name`, `model`, etc.)
- Schemas are JSON Schema draft 2020-12 in `schemas/` directories
- Runtime state goes in `.geas/` (gitignored, per-project)

## When editing skills or agents

- Read the existing file first — understand the current behavior before changing it
- Keep skills focused — one skill, one responsibility
- Update both `initiative` and `sprint` when changing shared behavior
- Test changes by running the harness in `test_session/`
