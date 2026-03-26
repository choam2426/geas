# CLAUDE.md

## Project Identity

**Decision. Traceability. Verification.**

Geas brings structure to multi-agent AI development. The core value is not the number of agents — it's that every decision has a record, every action is traceable, and every output is verified against a contract.

When making any design decision, ask: **"Does this make the multi-agent process more structured, traceable, or verifiable?"**

## Architecture (4 Layers)

```
Collaboration Surface  ← replaceable (Linear, Dashboard)
Agent Teams            ← replaceable (Geas-16, Lean-4, Custom)
Contract Engine        ← core (Intake, TaskContract, Evidence Gate)
Tool Adapters          ← replaceable (Claude Code, Codex)
```

Full architecture: `docs/DESIGN.md`

## Project Structure

```
plugin/
├── plugin.json              # Claude plugin manifest
├── skills/                  # Shared skills (core + team + surface)
├── claude/agents/           # 16 Claude agent definitions
└── codex/agents/            # 16 Codex agent definitions
```

### Core skills (contract engine)
- `intake/` — Socratic requirements gathering → seed.json
- `task-compiler/` — seed → TaskContracts with acceptance criteria
- `context-packet/` — role-specific briefings (includes Linear thread)
- `evidence-gate/` — 3-tier verification (mechanical, semantic, product)
- `verify-fix-loop/` — fail → fix → re-verify with retry budget
- `vote-round/` — structured agent voting + debate on disagreement

### Team skills (execution protocols)
- `full-team-protocol/` — 4-phase execution (Genesis → MVP → Polish → Evolution)
- `sprint-protocol/` — bounded feature addition to existing project
- `debate-protocol/` — decision-only discussion, no code

### Surface skills (collaboration adapters)
- `linear-cli/` — Linear API wrapper (Python)
- `linear-protocol/` — comment format, labels, workflow states

## Key Design Principles

1. **Contract Engine is tool-agnostic** — skills in core/ should not reference Claude Code, Codex, or any specific AI tool.
2. **Agents are templates, not identity** — the 16-agent team is one configuration. The contract engine works with any agent setup.
3. **Collaboration surface is an adapter** — Linear is the current implementation. Don't hardcode Linear assumptions into core skills.
4. **Evidence over declaration** — "agent says done" is never enough. Evidence Gate must verify.
5. **Human comments are stakeholder input** — when reading Linear threads for ContextPackets, human comments have the highest priority.

## Conventions

- Skills are defined in `SKILL.md` with YAML frontmatter (`name`, `description`)
- Agents are defined in `.md` with YAML frontmatter (`name`, `model`, etc.)
- Schemas are JSON Schema draft 2020-12 in `schemas/` directories
- Runtime state goes in `.geas/` (gitignored, per-project)
- All Linear operations go through `linear-cli` skill, never direct API calls

## When editing skills or agents

- Read the existing file first — understand the current behavior before changing it
- Keep skills focused — one skill, one responsibility
- Preserve the "if Linear enabled" conditional pattern — Linear is optional
- Update both `full-team-protocol` and `sprint-protocol` when changing shared behavior
- Test changes by running the harness in `test_session/`
