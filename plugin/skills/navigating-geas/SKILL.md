---
name: navigating-geas
description: Explains the Geas skill catalog, the CLI surface, and how the mission dispatcher orchestrates multi-agent work. Invoked when the user asks how skills, commands, or workflow are structured.
user-invocable: true
---

# Navigating Geas

## Overview

Geas is a governance framework for multi-agent AI work: every decision follows a governed process, every action is traceable, every output is verified against a contract, and the team evolves across sessions. This skill is a map — it explains the shape of the framework so the user can choose the right entry point. It does not perform mission work.

<HARD-GATE> Sub-skills listed here are internal tools. The user never invokes them directly. The single entry point for mission work is `/mission`; everything else is orchestrated from there.

## When to Use

- User asks what skills exist, what a skill does, or when to use one.
- User asks about the CLI surface (`geas --help`, subcommand names).
- User asks how phases, slots, or evidence flow together.
- User is orienting at the start of a project and wants a map.
- Do NOT use mid-mission to drive work — return to `/mission` instead.
- Do NOT use to execute any `.geas/` writes — this skill produces explanation only.

## Preconditions

None. Safe to call at any time; does not depend on `.geas/` existing.

## Process

1. **Identify the question type** — skill catalog, CLI, phases, slots, or orientation.
2. **Show the relevant map section** (catalog / workflow / slot model / CLI pointer) drawn from the material below. Tailor depth to the question; do not dump every section.
3. **Point the user back to the right entry point**: `/mission` for mission work, `geas --help` for CLI specifics, or a named sub-skill only when the user is auditing the catalog.
4. **Stop**. No writes, no dispatch.

### Skill catalog

User-invocable (2): `mission`, `navigating-geas`.

Mission dispatcher (1): `mission` — single entry point; bootstraps `.geas/`, inspects state, dispatches phase-appropriate sub-skills, and emits briefings.

Mission lifecycle sub-skills (8, main session, dispatched by `mission`): `specifying-mission`, `drafting-task`, `scheduling-work`, `running-gate`, `closing-task`, `reviewing-phase`, `consolidating-mission`, `verdicting-mission`.

Multi-party (1, main session, dispatched by `mission` or by `running-gate` / `reviewing-phase`): `convening-deliberation`.

Spawned-agent procedures (6, invoked inside sub-agents): `implementing-task`, `reviewing-task`, `verifying-task`, `deliberating-on-proposal`, `designing-solution`, `deciding-on-approval`.

Total: 17 skills. Only two appear in the `/` menu.

### 4-phase workflow

Every mission moves through four phases. Each phase ends with a phase-review and a CLI-enforced phase transition.

1. **Specifying** — user request becomes a frozen mission spec and an approved initial task set.
2. **Building** — each approved task runs through the task lifecycle (drafted, ready, implementing, reviewing, deciding, passed; plus terminal states blocked, escalated, cancelled).
3. **Polishing** — integration-level review across tasks; new tasks may be added before returning to building.
4. **Consolidating** — aggregate debts, gaps, and memory updates; decision-maker issues the mission verdict; mission transitions to complete.

### Slot model

Geas uses abstract protocol slots resolved to concrete agent types via domain profiles.

- **Authority slots** (4): orchestrator, decision-maker, design-authority, challenger.
- **Worker and reviewer slots** (5): implementer, verifier, risk-assessor, operator, communicator.

Agents are templates; evidence is authoritative. The same concrete agent never holds both implementer and reviewer on a single task.

### CLI-only writes

All `.geas/` modifications go through the `geas` CLI. Never edit `.geas/` files directly. Schemas and transition guards are embedded in the CLI; malformed payloads are rejected with a hint pointing at the failing field. For the full command list run `geas --help`; for a specific subcommand run `geas <command> --help`.

### Memory model

Memory is two-scoped: project-wide `.geas/memory/shared.md` and per-agent-type `.geas/memory/agents/{type}.md`. Both are updated only during the consolidating phase through `consolidating-mission`.

## Red Flags

| Excuse | Reality |
|---|---|
| "I'll invoke a sub-skill directly to skip the dispatcher" | Sub-skills are orchestrated only by `mission`. Direct invocation bypasses state inspection and briefing, producing inconsistent `.geas/` writes. |
| "This is quick — I'll edit `.geas/` by hand" | The CLI is the only writer. Direct edits desynchronize state and artifacts and cannot be repaired without a mission restart. |
| "I'll explain by reproducing the spec in full" | Navigation is pointer-level, not spec-level. Dumping schemas and workflows wholesale obscures the map rather than clarifying it. |

## Invokes

None. This skill emits explanation only.

## Outputs

No files. Conversational output directed at the user.

## Failure Handling

- If the user asks to execute work right after navigation (e.g., "now start the mission"), tell them to invoke `/mission`. Do not dispatch from here.
- If the user asks about a skill not in the catalog above, state that it is not part of the current skill set; do not fabricate.
- If the user asks for CLI detail beyond a pointer, direct them to `geas --help` or `geas <command> --help`.

## Related Skills

- **Invoked by**: user.
- **Invokes**: none.
- **Do NOT invoke**: any mission-lifecycle or spawned-agent skill. All mission work starts from `/mission`.

## Remember

- Only `mission` and `navigating-geas` are user-facing. Everything else is dispatched from `mission`.
- The 4-phase flow and the slot model are the two concepts the user needs first; every other concept is downstream.
- CLI is the sole writer to `.geas/`. Explain this constraint early when the user is new.
