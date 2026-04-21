# Geas Implementation Design

This document defines the shared architecture contract that Geas implementations must follow so the Geas protocol (`docs/protocol/`, 9 docs) can run consistently across multiple agent clients such as Claude Code, Codex, and opencode. It is written for implementers building or porting Geas on top of one or more agent clients.

The meaning of protocol rules, states, and artifacts lives in the protocol documents and schemas, not here. This document covers only the parts implementations must keep aligned in order to realize that protocol the same way, plus the places where implementation-specific variation is allowed.

## 1. Overview

### What It Is

At a high level, Geas has two layers.

1. **Protocol**: the immutable contract. It defines what must happen and what shape each artifact must have. See `docs/protocol/` (9 docs) and `docs/schemas/` (14 schemas).
2. **Implementation Architecture Contract**: the shared architecture contract required for multiple agent clients to execute that protocol consistently. That is the subject of this document.

This document covers the second layer. At the top level, Geas is divided into the Protocol and the Implementation Architecture Contract. Within the implementation contract, the design is further decomposed into the six layers described in Section 3.

The Protocol is the top-level immutable contract. If the protocol changes, this document and individual implementations must be redesigned to match it, never the other way around.

### Design Goals

- **Protocol fidelity**: implementations execute the protocol's states, transitions, and artifacts exactly as defined.
- **Client neutrality**: the same protocol runs the same way across multiple agent runtimes such as Claude Code, Codex, and opencode.
- **Single write path**: all writes under `.geas/` go through one CLI, enforcing schema validation and atomic rename.
- **Observability**: artifacts alone are enough to reconstruct where a mission stands and who made which judgment.
- **Implementation-specific variation within shared invariants**: client adapters, skills, and agent rosters may vary by implementation so long as they respect the shared contract, while the protocol, runtime state, and CLI contract stay fixed.

### Key Terms

Before the main sections, here are the terms used most often. See the referenced sections for the full definitions.

- **Slot**: a protocol role position (`orchestrator`, `decision-maker`, `design-authority`, `challenger`, `implementer`, `verifier`, `risk-assessor`, `operator`, `communicator`). See Section 8.
- **Concrete agent type**: an identity from the implementation catalog that can be bound to a specialist slot. Examples: `software-engineer`, `platform-engineer`. See Section 8.
- **Skill**: a prompt plus procedure that causes an agent to execute one step of the protocol. See Section 7.
- **Main session (`main_session`)**: the client session that talks directly to the user. It plays the `orchestrator` role. See Section 8.
- **Spawn**: the act of launching another slot from the main session in a separate agent execution context. See Section 9.
- **Client adapter**: the thin layer that binds shared skills, shared agents, and the CLI to a specific agent runtime. See Section 9.

## 2. Design Principles

1. **Protocol as north star** - skills, CLI behavior, and agents change to match protocol changes; the reverse never happens. The protocol docs and schemas are the source of truth when anything conflicts.
2. **CLI-only writes** - no write under `.geas/` bypasses the CLI. This rule is the same for every runtime. The concrete enforcement mechanism and enforcement strength may vary by adapter and must be documented in the adapter docs.
3. **Evidence over declaration** - even if an agent says the work is done, the state does not transition until the evidence files exist. Transition guards read artifacts, not claims.
4. **Slot != type != runtime persona** - a slot is a role position, a specialist concrete type is an implementation-catalog identity, and the actual runtime persona is the execution mechanism beneath that. One concrete type may bind to multiple slots, and one slot may be filled by different concrete types over time.
5. **Tool-agnostic skills** - a skill body does not hard-code a language, framework, or package manager. Concrete tool choice belongs to the task contract (`verification_plan`) and project conventions.
6. **Append-only where provable** - judgment logs that may include retries or re-decisions accumulate only by append, never by replacement. Auditing depends on retaining the trace of earlier decisions.
7. **Self-describing artifacts** - every artifact includes `mission_id`, and every task-level artifact also includes `task_id`. Ownership must remain clear even if a file is detached from its path.
8. **Explicit replaceable layers** - the design declares which layers are replaceable and which are invariant so implementers do not blur the boundary. See Section 3.

## 3. Layer Structure

The implementation contract is decomposed into six layers. Lower layers are shared invariants; higher layers allow more implementation-specific variation.

```
┌─ Client Adapter      ── client-specific (Claude Code / Codex / opencode)
├─ Skill               ── shared: execution prompts for each protocol step
├─ Agent Roster        ── shared: slot semantics + concrete agent type catalog
├─ CLI (geas)          ── shared: write actuator for .geas/
├─ Runtime State       ── shared: .geas/ directory format
└─ Protocol + Schemas  ── immutable core
```

| Layer | Role | Variation allowed? |
|---|---|---|
| Client Adapter | Thin layer that lets each agent runtime bind skills, agents, and the CLI | Yes |
| Skill | Prompts and procedures that let agents execute protocol steps. Step responsibilities and required artifacts are fixed. | Yes |
| Agent Roster | Realizes protocol-defined slot semantics through a concrete agent type catalog and per-task binding strategy | Yes |
| CLI (`geas`) | The single write path into `.geas/`. Reads and writes Runtime State while enforcing schema validation, timestamp injection, atomic rename, and append-only rules | Shared invariant |
| Runtime State | The `.geas/` directory format. Defines which artifacts exist where and the file-level rules around them | Shared invariant |
| Protocol + Schemas | Protocol docs and JSON schemas. The source of truth for artifact structure and state rules | Highest-level invariant |

Differences in the Client Adapter, Skill, and Agent Roster layers are allowed only so long as they do not violate lower-layer contracts. For example, an implementation may add a new specialist to the roster or adjust the wording of a skill prompt, but it may not bypass the CLI contract, change the Runtime State format, or redefine artifact meaning.

## 4. Protocol + Schemas Layer

This document does not restate the protocol or schemas. Here, `Protocol` means the documents under `docs/protocol/` together with the JSON schemas under `docs/schemas/`. This section only points implementers to the canonical sources they must consult.

| Topic | Document |
|---|---|
| Design foundations, risk | [docs/protocol/00_PROTOCOL_FOUNDATIONS.md](../protocol/00_PROTOCOL_FOUNDATIONS.md) |
| Agent slots, authority | [docs/protocol/01_AGENTS_AND_AUTHORITY.md](../protocol/01_AGENTS_AND_AUTHORITY.md) |
| Mission phases, final verdict | [docs/protocol/02_MISSIONS_PHASES_AND_FINAL_VERDICT.md](../protocol/02_MISSIONS_PHASES_AND_FINAL_VERDICT.md) |
| Task lifecycle, evidence, gate, closure | [docs/protocol/03_TASK_LIFECYCLE_AND_EVIDENCE.md](../protocol/03_TASK_LIFECYCLE_AND_EVIDENCE.md) |
| Baseline, workspace, parallelism | [docs/protocol/04_BASELINE_WORKSPACE_AND_PARALLELISM.md](../protocol/04_BASELINE_WORKSPACE_AND_PARALLELISM.md) |
| Runtime state, recovery | [docs/protocol/05_RUNTIME_STATE_AND_RECOVERY.md](../protocol/05_RUNTIME_STATE_AND_RECOVERY.md) |
| Memory | [docs/protocol/06_MEMORY.md](../protocol/06_MEMORY.md) |
| Debt, gap | [docs/protocol/07_DEBT_AND_GAP.md](../protocol/07_DEBT_AND_GAP.md) |
| Artifact paths and schema registry | [docs/protocol/08_RUNTIME_ARTIFACTS_AND_SCHEMAS.md](../protocol/08_RUNTIME_ARTIFACTS_AND_SCHEMAS.md) |

The final source of truth for artifact structure is the `docs/schemas/*.schema.json` file linked by each protocol document. If this implementation contract conflicts with a protocol document or schema, the protocol document and schema win.

Visual diagrams are in [docs/DIAGRAMS.md](../DIAGRAMS.md).

## 5. CLI `geas`

The CLI is the single actuator through which every write under `.geas/` must pass. Its core job is to enforce the formal invariants of Runtime State.

That includes schema validation, timestamp and ID injection, atomic rename, append-only enforcement, and transition guards. The CLI may also provide agent-support features such as schema templates, but those are auxiliary capabilities around its primary role as the write gate.

This document covers only the CLI's responsibility and boundary within the layer model. The internal contract for command layout, input/output conventions, the write pipeline, transition-guard logic, append-only verification, and ID generation is defined in [CLI.md](CLI.md).

## 6. Runtime State `.geas/`

```
.geas/
├── events.jsonl                              # implementation support - required audit log (append-only)
├── debts.json                                # project-level ledger (cross-mission)
├── missions/
│   └── {mission_id}/
│       ├── spec.json                         # mission-spec
│       ├── mission-design.md                 # mission-design
│       ├── mission-state.json                # mission-state
│       ├── phase-reviews.json                # append (reviews[])
│       ├── deliberations.json                # append (entries[], level=mission)
│       ├── mission-verdicts.json             # append (verdicts[])
│       ├── consolidation/
│       │   ├── gap.json
│       │   ├── memory-update.json
│       │   └── candidates.json               # implementation support - aggregated task evidence (not validated)
│       └── tasks/
│           └── {task_id}/
│               ├── contract.json             # task-contract
│               ├── implementation-contract.json
│               ├── self-check.json
│               ├── task-state.json
│               ├── gate-results.json         # append (runs[])
│               ├── deliberations.json        # append (entries[], level=task)
│               └── evidence/
│                   └── {agent}.{slot}.json   # append (entries[]) - one file per (agent, slot) pair
└── memory/
    ├── shared.md
    └── agents/
        └── {agent_type}.md
```

`.geas/` has two layers. **Protocol artifacts** are the spec, contract, state, and log files governed by schemas; they are part of the contract and are validated by `geas validate`. **Implementation support files** live alongside them under `.geas/`, but are not part of the protocol contract and are not schema-validated. `geas validate` checks only protocol artifacts. In the tree above, every file without a special note is a protocol artifact.

The current implementation support files are these two:

- `events.jsonl`: an audit log appended by the CLI when it performs **automated commands with side effects** such as bulk phase transitions, consolidation scaffolding, debt carry-forward, or deliberation guards that touch multiple artifacts. Simple single-artifact writes are already traceable from the artifact's `created_at` and `updated_at`, so they do not produce separate events. `events.jsonl` is not a protocol artifact, but the implementation must maintain it. Each line is an independent JSON object (`kind`, `actor`, `triggered_by`, `prior_event`, `created_at`, and so on). If an implementation records runtime-boundary events, entries such as `SessionStart` and `SessionEnd` may be appended here as well. The owner of the logged shapes and rules is `CLI.md` Section 14.7.
- `consolidation/candidates.json`: a **convenience aggregation** produced by `geas consolidation scaffold` (`CLI.md` Section 14.4), which collects `debt_candidates`, `memory_suggestions`, and `gap_signals` from all task evidence in the current mission. It is not the single authoritative input to promotion. The source signals still live in each task's evidence, closure, and deliberation artifacts. The Orchestrator may use this file as a starting point, but when judgment matters it must return to the source artifacts before promoting information into project `debts.json`, mission `gap.json`, or mission `memory-update.json`. It can also go stale: if task evidence changes after scaffolding runs, `candidates.json` does not update itself. The Orchestrator must rerun the scaffold immediately before promotion if it needs a fresh aggregate.

### File Owner Matrix

In this table, Writer means the slot or agent that owns the judgment and content of the artifact. The actual `geas` call may be proxied through the Orchestrator because of runtime limits, but the artifact's semantic owner does not change. `candidates.json` and `events.jsonl` are implementation support files, not protocol artifacts, so they are excluded from this matrix.

| File | Writer | When written |
|---|---|---|
| `spec.json` | `orchestrator` | specifying |
| `mission-design.md` | `design-authority` | specifying |
| `mission-state.json` | `orchestrator` | when phase or active tasks change |
| `phase-reviews.json` | `orchestrator` | after each phase-gate judgment |
| `deliberations.json` (mission) | `orchestrator` | after each deliberation completes |
| `mission-verdicts.json` | `decision-maker` | consolidating |
| `debts.json` (project-level) | `orchestrator` | each mission's consolidating - register new debts and update the status of debts touched in the mission |
| `gap.json` | `design-authority` | consolidating |
| `memory-update.json` | `orchestrator` | consolidating |
| `contract.json` | `design-authority` | when a drafted task is created |
| `implementation-contract.json` | `implementer` | when entering implementing |
| `self-check.json` | `implementer` | after implementation finishes |
| `task-state.json` | `orchestrator` | on lifecycle transitions and active-agent changes |
| `gate-results.json` | `orchestrator` | after each gate run |
| `deliberations.json` (task) | `orchestrator` | after each deliberation completes |
| `evidence/{agent}.{slot}.json` | that agent | when it submits its own evidence (if one agent fills multiple slots, the files are still split per slot) |

`contract.approved_by` is a field inside the task contract, not a separate file. The Orchestrator sets it by calling `geas task approve --by user|decision-maker`. A `user` approval is written by the Orchestrator after confirming it through direct conversation with the user. A `decision-maker` approval is written by the Orchestrator after relaying the spawned Decision Maker's judgment. In either case, the actual CLI call is made by the Orchestrator.

`mission-verdicts.json` is different. A spawned Decision Maker subagent reads the mission artifacts and then directly calls `geas mission-verdict append`. In runtimes that do not allow subagents to call tools, this degrades to a proxy model: the Decision Maker returns its judgment to the Orchestrator, and the Orchestrator performs the CLI call on its behalf. In both models, the semantic author is still the Decision Maker.

### Append-Only Invariants

These logs never allow prior items to be overwritten or deleted. Retries and re-decisions are appended as new items.

- `phase-reviews.reviews`
- `mission-verdicts.verdicts`
- `gate-results.runs`
- `deliberations.entries`
- `evidence/{agent}.{slot}.entries`

The CLI enforces this rule. Only append is allowed. This is the foundation of auditability.

### Drift Principle

If a state file (`mission-state.json`, `task-state.json`) disagrees with the actual artifacts, always trust the artifacts. State files are indexes, not authority claims. The detailed recovery procedure follows [docs/protocol/05_RUNTIME_STATE_AND_RECOVERY.md](../protocol/05_RUNTIME_STATE_AND_RECOVERY.md).

## 7. Skill

A skill is the agent-facing execution interface for a step in the protocol. It does not contain the full shared contract. It exposes only the procedures, branches, required outputs, and input fragments the agent needs for execution. Full schema text, CLI internals, and runtime enforcement remain the responsibility of the Protocol + Schemas layer and the CLI layer.

So what stays fixed in the Skill layer is not runtime-specific wording or transport, but rather what each step must leave behind and how it relates to the CLI. If a skill changes, the reason should normally be a protocol change or an execution-contract adjustment, not a mere difference in how one runtime phrases things.

### 7.1 What Stays Fixed Across Implementations

- the core skill set and the protocol step each skill owns
- the `main_session` versus `spawned` execution model and the main slot involved
- prerequisite artifacts, required outputs, and the representative CLI calls they use
- the input fragments the agent must fill in and the retry flow on failure
- the execution rule that all `.geas/` writes go through the CLI only

### 7.2 What Skills Do Not Need to Know

- the full raw JSON schemas
- internal CLI algorithms such as append-only verification, transition guards, or ID/timestamp injection
- implementation details of root discovery, atomic writes, or validation internals
- runtime-specific hook, middleware, or callback mechanisms

These details may still be fixed in the shared contract, but they belong to the Protocol + Schemas, CLI, and Client Adapter layers, not to the Skill layer.

### 7.3 Shared Source Format

In the shared repo, the canonical source for each core skill lives at `skills/{name}/SKILL.md`. If supporting explanation is needed, it can live under `references/`; if executable code is needed, it can live under `scripts/`. This is less a protocol contract than a shared source format that lets multiple adapters reuse the same skill content.

```
skills/
├── mission/
│   ├── SKILL.md
│   └── references/
│       ├── spec-interview.md
│       ├── design-review-prompts.md
│       └── task-breakdown-patterns.md
├── task-draft/
│   └── SKILL.md
├── task-implement/
│   ├── SKILL.md
│   └── references/
│       └── risk-level-patterns.md
├── task-review/
│   ├── SKILL.md
│   └── references/
│       └── review-rubrics.md
├── task-verify/
│   └── SKILL.md
├── gate-run/
│   ├── SKILL.md
│   └── references/
│       └── tier-procedures.md
├── task-close/
│   └── SKILL.md
├── deliberation/
│   └── SKILL.md
├── phase-review/
│   └── SKILL.md
├── mission-consolidate/
│   └── SKILL.md
├── mission-verdict/
│   └── SKILL.md
└── resume/
    └── SKILL.md
```

Rules for this shared source format:

- `SKILL.md` is required.
- `references/` is a progressive-disclosure mechanism that keeps the main body short. `SKILL.md` remains the single entry point to the supporting material, and deep chains of nested links should be avoided.
- All paths use forward slashes. Do not use Windows path notation.
- If the body becomes too long, move procedures or patterns into `references/`.
- If executable code is needed, a `scripts/` directory may be added.

### 7.4 Minimum `SKILL.md` Structure

`SKILL.md` consists of YAML frontmatter plus a Markdown body. The frontmatter exists so adapters can convert the shared source into runtime-specific formats using a stable minimum set of metadata.

Required frontmatter fields:

```yaml
---
name: mission                     # required; 64 chars max; lowercase letters, digits, and hyphens only
description: >                    # required; third person; 1024 chars max
  Runs the specifying phase - captures the mission spec, mission design,
  and initial task contract set with user approvals. Triggers at mission
  start before any building work.
---
```

- `name` is the stable identifier. Keep one naming convention across the entire skill set.
- `description` summarizes what the skill does and when it is used. Adapters may reuse it as help or registration metadata in their runtime.

The single source of truth for a skill's execution actor (`main_session` vs `spawned`) and its slot is the Skill Contract table below. Because that mapping is a protocol-defined invariant, it is not duplicated inside individual skill files.

The body should include only the information an agent needs to execute the step. At minimum, it should make the following visible:

```markdown
# Purpose
One paragraph explaining which protocol step this skill owns.

# Prerequisites
- artifacts that must already exist before invocation
- required task or mission state

# Procedure
Write this as a checklist. Include the CLI commands to call and the branching conditions.

Progress:
- [ ] 1. ...
- [ ] 2. ...

# CLI Commands Used
The list of `geas ...` commands used by this skill.

# Outputs
Files created or updated under `.geas/` after execution.

# Failure Handling
- schema validation failure -> read hints and retry
- guard failure -> identify the missing prerequisite
- other exceptional cases
```

Do not duplicate CLI internals, the full raw schemas, or runtime-specific interception mechanisms here. A skill is an execution interface for agents, not the full implementation manual.

### 7.5 Core Skill Contract

The skill layer consists of 17 skills. The only user entry point is `mission`; the rest are sub-skills that the dispatcher invokes when conditions require.

#### User-invocable (2)

| skill | `execution` | slot | Purpose |
|---|---|---|---|
| `mission` | `main_session` | `orchestrator` | Mission dispatcher — bootstrap, state check, dispatch of phase sub-skills, briefing |
| `navigating-geas` | `main_session` | `orchestrator` | Skill catalog, CLI, and workflow guide |

#### Mission lifecycle sub-skills (8, main_session)

| skill | slot | When the dispatcher invokes it | Primary CLI |
|---|---|---|---|
| `specifying-mission` | `orchestrator` | Entering specifying phase with mission spec not yet approved | `mission create`, `mission approve`, `mission design-set` |
| `drafting-task` | `orchestrator` (may consult `design-authority`) | Drafting the initial task set or an additional mid-mission task | `task draft`, `task approve`, `task deps add` |
| `scheduling-work` | `orchestrator` | Approved task exists and is ready to dispatch | `task transition --to implementing` |
| `running-gate` | `orchestrator` | All required reviewer and verifier evidence has arrived | `gate run`, `task transition` |
| `closing-task` | `orchestrator` | Immediately after gate pass | `evidence append --kind closure`, `task transition --to passed` |
| `reviewing-phase` | `orchestrator` | All tasks in the phase scope are closed | `phase-review append`, `mission-state update --phase` |
| `consolidating-mission` | `orchestrator` (spawns `design-authority` for gap) | Entering consolidating phase | `debt register`, `gap set`, `memory-update set`, `memory shared-set`, `memory agent-set` |
| `verdicting-mission` | `orchestrator` (spawns `decision-maker`) | All phases closed | `mission-verdict append` |

#### Multi-party (1, main_session)

| skill | slot | When the dispatcher invokes it | Primary CLI |
|---|---|---|---|
| `convening-deliberation` | `orchestrator` (spawns voters) | Reviewer verdict conflict, structural disagreement, or phase rollback in `mode == full_depth` | `deliberation append` |

#### Spawned agent procedures (6, spawned)

| skill | slot | When it is spawned | Primary CLI |
|---|---|---|---|
| `implementing-task` | `implementer` | An approved task is dispatched | `self-check set`, `evidence append --slot implementer` |
| `reviewing-task` | `challenger` / `risk-assessor` / `operator` / `communicator` | Implementation evidence and self-check have been submitted | `evidence append --slot <reviewer>` |
| `verifying-task` | `verifier` | Reviewer concurrence has been reached | `evidence append --slot verifier` |
| `deliberating-on-proposal` | the invoked voter slot | Convened by `convening-deliberation` | (no direct writes — returns a vote) |
| `designing-solution` | `design-authority` | Drafting mission design, reviewing task structure, analyzing a gap | `mission design-set`, `evidence append --slot design-authority`, `gap set` |
| `deciding-on-approval` | `decision-maker` | Mission spec approval, task approval, phase-review, mission-verdict | `evidence append --slot decision-maker`, `task approve`, `phase-review append`, `mission-verdict append` |

The step responsibility and artifact relationships across all 17 skills are fixed parts of the shared contract. Sub-skills are never invoked outside the `mission` dispatcher (`user-invocable: false` in sub-skill frontmatter), and manual user invocation or Claude auto-trigger is restricted to what does not break the single-dispatcher rule. Skill naming and sentence style may vary across adapters, but the step ownership and artifact relationships this table captures do not.

### 7.6 Skill Conventions

- **Tool-agnostic**: a skill body does not assume a particular language, framework, or package manager. Tool choice is determined by the task contract's `verification_plan` and project conventions.
- **CLI instructions only**: every `.geas/` write is expressed as a CLI command. Direct-write instructions like "save this JSON to that path" are forbidden.
- **Expose only agent-facing input fragments**: a skill shows the field fragments the agent actually has to fill in, not the entire artifact schema. Fields injected automatically by the CLI and the full schema structure remain the responsibility of other layers. Only when the skill cannot give the agent a confident input shape should it fall back to `geas schema template`.
- **Feedback loop**: on CLI failure, read the response `hints` and retry. Quality-critical paths such as gate failures or schema validation failures are intentionally designed as run -> read hint -> fix -> retry loops.
- **Preserve step contracts**: wording and examples may change, but prerequisites, required outputs, CLI relationships, and branch meanings must stay intact.
- **Progressive disclosure**: move detailed patterns and examples into `references/`, keeping only the minimum execution procedure in the main body.
- **Explain why, not only what**: write the reason behind a rule. When the agent must generalize beyond the exact text of the skill, the "why" becomes its basis for judgment.

### 7.7 Utility Skills

Skills added purely for project convenience are allowed alongside the core set. They keep the same frontmatter and directory conventions, but unlike the core skills, they are not protocol-mandated and may be added or removed per client.

- `/setup` - initialize `.geas/` for the project (`main_session`, `orchestrator`)
- `/help` - explain how to discover skills and commands (`main_session`, `orchestrator`)

Utility skills must not replace the step responsibility of any core skill. If they are added, their execution actor and slot mapping should be documented so they cannot be mistaken for core skills.

## 8. Agent Roster

The Agent Roster is the layer that realizes the protocol's fixed slot semantics and authority boundaries using the current implementation's concrete agent type catalog and per-task binding strategy. The meaning of slots and authority boundaries is owned by [docs/protocol/01_AGENTS_AND_AUTHORITY.md](../protocol/01_AGENTS_AND_AUTHORITY.md). This section covers only how those fixed slots are exposed as agent definitions and how tasks bind them.

### Slot-to-Agent Mapping

The protocol defines nine slots. The Agent Roster provides fixed agent definitions for authority slots and a concrete agent type catalog for specialist slots. Which concrete type is bound to which specialist slot for a given task is determined jointly by the task contract's `routing` and the adapter.

| slot | Role | Activation model | Domain variation |
|---|---|---|---|
| `orchestrator` | mission control, task transitions, closure evidence, user dialogue | main session (no agent file) | none |
| `decision-maker` | mission final verdict, approval of in-scope mid-mission tasks, review of mission design and the initial task set in standard mode | `spawned` | none |
| `design-authority` | mission design, task decomposition, gap authoring | `spawned` | none |
| `challenger` | counterarguments, deliberation participation | `spawned` | none |
| `implementer` | implementation, self-check, implementation evidence | `spawned` | domain-specific |
| `verifier` | independent verification | `spawned` | domain-specific |
| `risk-assessor` | risk review | `spawned` | domain-specific |
| `operator` | operational review | `spawned` | domain-specific |
| `communicator` | documentation and communication review | `spawned` | domain-specific |

The Orchestrator does not exist as an agent file. The main session that talks directly with the user fills the `orchestrator` role. Main-session skills such as mission entry, gate run, task close, and phase review execute inside that session. Other slots are activated as needed using the chosen authority agent or specialist concrete type.

Among the authority slots, the three non-Orchestrator roles (`decision-maker`, `design-authority`, `challenger`) use slot-fixed agent definitions independent of domain. The five specialist slots use the implementation's concrete agent type catalog, and task-specific routing decides which concrete type is bound to which slot.

### Agent File Layout

```
agents/
├── authority/
│   ├── decision-maker.md
│   ├── design-authority.md
│   └── challenger.md
└── specialist/
    ├── software/
    │   ├── software-engineer.md
    │   ├── platform-engineer.md
    │   ├── qa-engineer.md
    │   ├── security-engineer.md
    │   └── technical-writer.md
    └── research/
        ├── research-engineer.md
        ├── evaluator.md
        ├── research-operator.md
        └── research-writer.md
```

### Agent File Format (Portable Core)

The actual runtime format of agent files differs by client. In the shared repo, they use the following portable core, and each client adapter rewraps that into its own runtime-specific format. Here, authority files are the shared source for slot-fixed agent definitions, and specialist files are the shared source for concrete agent type definitions.

```yaml
---
name: decision-maker        # required; slot name for authority agents, concrete type name for specialists
description: >              # required; third person; explains when this agent is used
  Issues mission final verdicts, approves mid-mission scope-inside tasks,
  and pre-approves mission design in standard mode.
---

# Role body
The system prompt body for this agent: slot responsibilities, authority
boundaries, default stance, and the posture it should take when running
its skills.
```

Only `name` and `description` are required. The body is free-form Markdown. For authority agent definitions, the slot is determined by the file path (`agents/authority/{slot}.md`). For specialist definitions, the domain and concrete type are determined by the file path (`agents/specialist/{domain}/{type}.md`), while the slot they bind to is decided at runtime by the task contract's `routing` and the adapter. Cross-references between agent files and runtime tool declarations such as `allowed_tools` are added during adapter-specific rewrapping.

### Domain Profiles

Domain profiles are an optional concept an implementation may use to organize its specialist concrete agent type catalog. Current protocol artifacts and schemas do not make this a required field in the mission spec. So one implementation may use explicit profiles, while another may skip them entirely and choose concrete types directly from the full catalog at task-routing time.

If an implementation does use explicit domain profiles, the profile acts as a selection strategy for which specialist concrete agent types should be preferred by default in that mission. Even then, the skills, CLI, and protocol still behave the same. Only the default candidate set of available specialist concrete types changes.

### Agent != Identity

One concrete agent type may bind to different specialist slots depending on the task. For example, `platform-engineer` may work as the `implementer` on one task and as the `operator` on another. But the protocol always reads slot semantics first. Which concrete type filled the slot is reconstructed from the task contract's `routing`, the `evidence/{agent}.{slot}.json` path, and the `agent` and `slot` fields inside the artifact. When independence matters, such as `implementer` followed by `verifier`, the adapter must either enforce separate contexts or at minimum make the role separation visible in a way that remains auditable.

## 9. Client Adapter

The client adapter is the projection layer that makes shared skills, shared agents, and the CLI executable in a specific agent runtime. It does not reinterpret the meaning of the shared contract. Its job is to carry that contract through the runtime's own session model, agent model, and command transport.

From the perspective of this design document, the adapter has five minimum responsibilities:

- keep the main session in the `orchestrator` role
- expose the shared skill source and shared agent source in the runtime's own format
- bind authority slots and specialist concrete types according to the task contract's `routing`
- map `spawned` execution onto separate runtime contexts or an equivalent mechanism
- make the `geas` CLI and `.geas/` reads available inside the runtime

Different runtimes may vary in session persistence, subagent mechanics, automatic interception points, and source transport format. Those differences may change execution strategy and enforcement strength, but they must never change protocol semantics or artifact meaning.

In particular, automatic enforcement points such as blocking direct `.geas/` writes, restoring context, recording session boundaries, or detecting external edits may be stronger in some runtimes than in others. Some runtimes can block violations before they happen; others rely more on agent discipline and post-hoc checks.

## 10. Extension Points

- **Extend the specialist catalog** - an implementation may add new specialist concrete agent types, new combinations of types, or new task-specific binding strategies. In implementations using the shared source layout, these usually live under `agents/specialist/`.
- **Add a new client adapter** - an implementation may add an adapter for another agent runtime. The key requirement is to satisfy the minimum responsibilities in Section 9, not to copy another implementation's session model or transport.
- **Add new utility skills** - implementations may freely add project-convenience skills beyond the core set. Their names, registration model, and exposure format are implementation-specific, so long as they do not replace mandatory protocol-step skills.
- **Add dashboards or observability tools** - read-only tools that consume `.geas/` artifacts are always allowed. Their storage location and observation model are implementation-specific. If they need to write, they do so through the CLI.

## 11. Disallowed Changes

- **Bypassing the protocol** - omitting or short-circuiting the states, transitions, or artifacts defined by the protocol.
- **Bypassing the CLI for writes** - letting agents modify `.geas/` files directly with edit or write tools.
- **Mutating append-only logs** - changing or deleting past review, verdict, run, or entry objects. Corrections are appended as new items instead.
- **Forging slot identity** - allowing an agent to submit evidence under a slot name that is not the one it actually held.
- **Redefining core skill meaning** - client-specific names or invocation patterns may differ, but the per-step responsibilities and output relationships must remain protocol-aligned.

Client-specific mappings, current implementation status, and migration procedures live under `docs/reference/`. This document describes the target implementation structure independently of those materials.
