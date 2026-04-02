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

Every mission follows 4 phases: Specifying → Building → Polishing → Evolving. Scale adapts to the request — from a single feature to a full product. Always follows the same pipeline order.

Decision is a utility skill (`decision/`) for structured decision-making without code changes. It is not a separate mode.

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
│   ├── 00-12, 14 .md        # 14 protocol documents
│   ├── schemas/             # 21 JSON Schema (draft 2020-12)
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
- `memorizing/` — memory lifecycle: candidate extraction, promotion, review, application logging

### Execution pipeline
- `orchestrating/` — Geas orchestrator: startup, recovery, 4-phase mission (Specifying → Building → Polishing → Evolving)
  - `references/discovery.md` — Specifying phase procedure
  - `references/pipeline.md` — Per-task 14-step pipeline
  - `references/build.md` — Building phase management
  - `references/polish.md` — Polishing phase procedure
  - `references/evolution.md` — Evolving phase procedure
- `scheduling/` — parallel task scheduling: batch construction, lock checks, safe conditions
- `decision/` — structured decision-making utility skill, no code

### Operational tooling
- `conformance-checking/` — 18-scenario enforcement verification suite
- `chaos-exercising/` — 5 failure scenario testing with inline scripts
- `policy-managing/` — rules.md override management
- `reporting/` — debt/gap dashboard + 8 health signals from doc 12

## Key Design Principles

1. **Contract Engine is tool-agnostic** — core skills must not reference any specific tool.
2. **Agents are templates, not identity** — the 12-agent team is one configuration. The contract engine works with any agent setup.
3. **Collaboration surface is an adapter** — don't hardcode surface assumptions into core skills.
4. **Evidence over declaration** — "agent says done" is never enough. Evidence Gate must verify.
5. **Memory is a behavior-change mechanism** — memory must alter future actions through rules.md, context packets, gate strictness, and scheduling caution.
6. **Protocol is north star** — skills are upgraded to match the protocol, not the other way around.

## Agent Name Rule

Protocol docs (`docs/protocol/`, `docs/ko/protocol/`), core skills, and agent file names all use **agent type names** (e.g., `product-authority`, `architecture-authority`, `critical-reviewer`). Character names (Nova, Forge, Pixel, Circuit, Sentinel, Keeper, Shield, Critic, Scroll, Scrum, Palette, Pipeline) appear only inside agent file content as personality/identity, never as file names or references.

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

We are upgrading skills to match the v3 protocol. Migration follows 6 phases. Each phase depends on the previous one.

### Completed phases

- **Phase 1 (Minimum Enforceable State)**: 7-state task model, worker self-check, gate/verdict separation, closure packet, critical reviewer, debate→decision rename
- **Phase 2 (Baseline, Stale, Parallelism)**: revalidation-record/lock-manifest schemas, staleness detection, lock lifecycle, safe parallel conditions, compass→orchestrating + parallel-dispatch→scheduling renames
- **Phase 3 (Evolution Core)**: structured retrospective (after Resolve, Ship only), rules-update workflow, debt-register.json, gap-assessment.json, phase-review wiring, Evolving exit gate, Sprint Wrap-Up
- **Phase 4 (Memory Core)**: memorizing skill (9-state lifecycle, 6-stage promotion), memory retrieval scoring in context-packet, application logging, memory-index, memory hooks
- **Phase 5 (Recovery and Context Engine)**: recovery-packet schema, extended run-state, recovery decision table, session-latest.md + task-focus maintenance, two-phase checkpoint hooks, enhanced restore-context.sh with L0 anti-forgetting
- **Phase 6 (Refinement)**: conformance-checking (18 scenarios), chaos-exercising (5 failure scenarios), policy-managing, reporting (health signals), memory review cadence hook

### Migration complete

All 6 phases of the v3 protocol migration are implemented. Skills are aligned with the protocol.
### Working with skills

1. **Read the protocol doc first** — before touching any skill, read the relevant protocol document in `docs/protocol/`.
2. **Read the skill second** — understand what it currently does vs what the protocol requires.
3. **Protocol schemas are the contract** — `docs/protocol/schemas/` defines the exact artifact shapes. Skills must produce artifacts that validate against these schemas.
4. **Update `orchestrating/references/`** when changing pipeline behavior.
5. **Run `/geas:conformance-checking`** after significant changes to verify enforcement mechanisms still work.

### Protocol quick reference

| Topic | Protocol doc |
|-------|-------------|
| Design principles, 4 Pillars, terminology | `protocol/00` |
| Agent types, authority, routing | `protocol/01` |
| Mission phases, mission model | `protocol/02` |
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
| Evolution, debt, gap loop | `protocol/14` |

## When editing skills or agents

- Read the existing file first — understand the current behavior before changing it
- Keep skills focused — one skill, one responsibility
- Update `orchestrating/references/` when changing pipeline behavior
- Align with protocol — check `docs/protocol/` for the target behavior
- Test changes by running the protocol in `test_session/`
