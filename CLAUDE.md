# CLAUDE.md

## Project Identity

**Contract-driven execution. Evidence-based verification. Cross-session learning.**

Geas is a governance protocol that makes AI agents work as a professional team. Evidence proves completion, authority grants approval, and lessons persist across sessions. The core value is not the number of agents — it's how they coordinate, verify, and learn.

When making any design decision, ask: **"Does this make the multi-agent process more governed, traceable, verifiable, or capable of learning?"**

## Execution Model

Every mission follows 4 phases: Specifying → Building → Polishing → Consolidating. After consolidating, mission phase transitions to terminal state `complete`. Scale adapts to the request — from a single feature to a full product. Always follows the same pipeline order.

Specifying produces three user-approved artifacts: mission spec (WHAT), mission design (HOW), and initial task contract set (UNITS OF WORK). Orchestrator captures user intent into mission spec; Design Authority writes mission design and task decomposition; Decision Maker approves each. In `full_depth` operating mode, a mission-level deliberation with Challenger participation is required before mission design approval.

## Task Lifecycle

6 primary states: `drafted → ready → implementing → reviewed → verified → passed`
3 auxiliary states: `blocked`, `escalated`, `cancelled`

## Verification Flow

**Task-level closure**:
```
Evidence Gate (Tier 0 → Tier 1 → Tier 2)
    → Task Closure Decision (Orchestrator reads evidence and records `closure` evidence)
```

**Mission-level verdict**:
```
Phase gates (each phase) → Mission Final Verdict (Decision Maker at consolidating)
```

Gate verdicts: `pass | fail | block | error`.
Closure verdicts: `approved | changes_requested | escalated | cancelled`.
Mission verdicts: `approved | changes_requested | escalated`.

## Project Structure

```
plugin/
├── plugin.json              # Claude plugin manifest
├── bin/
│   └── geas                 # Pre-built CLI bundle (single file)
├── skills/                  # 13 skills (12 core + 1 utility)
├── agents/
│   ├── authority/           # 3 spawnable authority agents
│   ├── software/            # 5 software domain specialists
│   └── research/            # 6 research domain specialists
└── hooks/
    ├── hooks.json           # 10 lifecycle hooks
    └── scripts/

src/
├── cli/                     # CLI source (development only)
└── dashboard/               # Tauri desktop dashboard source

docs/
├── protocol/                # English canonical (11 docs, pending sync to new structure)
├── schemas/                 # 19 JSON Schema (draft 2020-12, self-contained, no external $ref)
├── architecture/DESIGN.md
└── reference/               # AGENTS.md, SKILLS.md, HOOKS.md, DASHBOARD.md

docs/ko/                     # Korean canonical (protocol reorganized to 9 docs: 00–08)
```

## Design Principles

1. **Contract Engine is tool-agnostic** — core skills must not reference any specific tool, framework, or package manager.
2. **Agents are templates, not identity** — the 14-agent team is one configuration. The contract engine works with any agent setup.
3. **Collaboration surface is an adapter** — don't hardcode surface assumptions into core skills.
4. **Evidence over declaration** — "agent says done" is never enough. Evidence Gate must verify.
5. **Memory is a behavior-change mechanism** — memory must alter future actions through shared memory and agent memory notes.
6. **Protocol is north star** — skills are upgraded to match the protocol, not the other way around.

## Rules

**Agent names** — hyphens everywhere: file names, YAML `name` field, schema enums, skill/protocol prose. The YAML `name` field is the canonical routing identifier. Character names appear only inside agent file content.

**Runtime accessibility** — Skills run inside a plugin runtime. Agents can ONLY access: the user's project directory, the skill's own directory, and other plugin skills. Agents CANNOT access `docs/` at runtime. When writing skills: use CLI for all `.geas/` writes, inline protocol requirements in skill text, define evidence/memory rules in agent.md.

**CLI-only `.geas/` writes** — All `.geas/` runtime state files must be written through the `geas` CLI (`plugin/bin/geas`; source at `src/cli/`). The CLI auto-manages timestamps and enforces schema validation. Zero exceptions for writes. Reading `.geas/` files via Read tool is allowed.

Key CLI commands:
- `geas task record add --section {name}` — add section to record.json
- `geas evidence add --role {role}` — create role-based evidence file
- `geas task transition --to {state}` — transition with guard validation
- `geas event log` — append to events.jsonl
- `geas memory agent-note --agent {name}` — update agent memory
- `geas schema list` — list all available schema types
- `geas schema template <type> [--role <role>]` — generate a fill-in JSON template for any schema type

**Schema templates** — Before constructing JSON for any CLI command, use `geas schema template <type>` to get the exact required fields. For evidence, use `--role` to get role-specific fields (e.g., `geas schema template evidence --role reviewer`). Envelope fields (`version`, `artifact_type`, `producer_type`, `artifact_id`) are auto-injected by the CLI — agents do not need to include them.

**Validation error hints** — When a CLI command fails schema validation, the error response includes a `hints` field with the correct field names, allowed enum values, and required/optional field information. Use these hints to fix the JSON and retry.

**Language** — All files in English, except `docs/ko/` and `README.ko.md`.

## Conventions

- Skills: `SKILL.md` with YAML frontmatter (`name`, `description`). All skills must be direct children of `plugin/skills/` (flat structure).
- Agents: `.md` with YAML frontmatter (`name`, `model`, etc.)
- Schemas: JSON Schema draft 2020-12 in `docs/schemas/`, self-contained (no `$ref` to other schema files)
- Runtime state: `.geas/` (gitignored, per-project)
- Protocol: `docs/protocol/` (English canonical), `docs/ko/protocol/` (Korean canonical)
- Versioning: `plugin/plugin.json` is the single source of truth. `.claude-plugin/marketplace.json` must NOT contain a `version` field (breaks `/plugin update`). Only `description` must stay in sync.

## When editing skills or agents

1. **Read the protocol doc first** — before touching any skill, read the relevant protocol document in `docs/protocol/`.
2. **Read the skill second** — understand what it currently does vs what the protocol requires.
3. **Protocol schemas are the contract** — `docs/schemas/` defines the exact artifact shapes.
4. **Keep skills focused** — one skill, one responsibility.
5. **Update `mission/references/`** when changing pipeline behavior.
6. **Test changes** by running a fresh integration test in a separate project directory.

### Protocol quick reference

Korean protocol is the current canonical structure (9 docs, 00–08). English protocol at `docs/protocol/` still follows the older layout and is pending sync.

| Topic | Korean | English (pending sync) |
|-------|--------|-----------------------|
| Foundations, design axes, risks | `ko/protocol/00` | `protocol/00` |
| Agents, authority, slots | `ko/protocol/01` | `protocol/01` |
| Missions, phases, final verdict | `ko/protocol/02` | `protocol/02`, `protocol/05` (partial) |
| Task lifecycle, evidence, gate, closure | `ko/protocol/03` | `protocol/03`, `protocol/05` (partial) |
| Baseline, workspace, parallelism | `ko/protocol/04` | `protocol/04` |
| Runtime state, recovery | `ko/protocol/05` | `protocol/06` |
| Memory | `ko/protocol/06` | `protocol/07` |
| Debt and gap | `ko/protocol/07` | `protocol/08` |
| Runtime artifacts, schemas, paths | `ko/protocol/08` | `protocol/09` |
