---
name: memorizing
description: Memory maintenance — turns task-level memory_suggestions and closure retrospective fields into updates to shared.md and agents/{type}.md via `geas memory shared-set` / `agent-set`. Full-replace semantics (not patch).
---

# Memorizing

Consolidating-phase skill. Converts the current mission's memory candidates into concrete edits of `.geas/memory/shared.md` (project-wide) and `.geas/memory/agents/{agent_type}.md` (per concrete agent type). Writes happen through the CLI, which owns atomic replace; this skill owns the semantic decisions.

See protocol 06 for the canonical model. This file only describes the workflow on top of it.

## Inputs

- Per-task evidence `memory_suggestions[]` collected across the mission (from `evidence/{agent}.{slot}.json` entries).
- Closure evidence retrospective fields (`what_went_well`, `what_broke`, `what_was_surprising`, `next_time_guidance`) from each task's `orchestrator.orchestrator.json` closure entry.
- Current content of `.geas/memory/shared.md` and each `.geas/memory/agents/{agent_type}.md` already on disk.

## Outputs

- Replaced `.geas/memory/shared.md` (when shared memory changed).
- Replaced `.geas/memory/agents/{agent_type}.md` files (one write per changed agent type).
- A separate `memory-update set` call by the orchestrator that records the semantic change log (`added` / `modified` / `removed` per section with `memory_id`, `reason`, `evidence_refs`). The CLI does not auto-sync markdown with the change log — that pairing is this skill's responsibility.

## When to run

- Consolidating phase of every mission (primary).
- Also appropriate at mission spec time when picking up an abandoned mission, to confirm memory has not drifted out from under the contract.

Do not run during building or polishing; per-task memory_suggestions are captured in evidence but promotion waits for consolidating (salvage pattern #5).

---

## 1. Collect candidates

Read the mission's task evidence once. For each entry:

- Pull `memory_suggestions[]`. Each suggestion already carries the originating agent and enough context to place it.
- Pull closure retrospective text. Parse it as additional candidate input — but keep the underlying evidence reference so it can be cited in `memory-update.json`.

Build a flat candidate list with the fields: `source_task`, `source_agent`, `source_slot`, `evidence_ref`, `text`, optional `targeted_agent_type`.

## 2. Classify each candidate (shared vs. agent-specific)

For every candidate, decide whether it belongs in shared memory or in a specific agent type's memory. Salvage pattern #2 — the classification guide:

| Signal in the candidate | Target |
|---|---|
| Reusable project convention / coding standard / repo-wide rule | `shared.md` |
| Failure mode that would have tripped any agent on this project | `shared.md` |
| Architecture decision or invariant | `shared.md` |
| Role-specific heuristic (tied to what the agent type does, not the project) | `agents/{agent_type}.md` |
| Tool or workflow tip for one agent type | `agents/{agent_type}.md` |
| Domain expertise for one specialist concrete type | `agents/{agent_type}.md` |

When unsure, prefer the narrower scope — an agent memory entry is cheaper to retract than a shared rule. Candidates that belong in neither are dropped and not recorded in `memory-update.json` (protocol 06 §Memory Update).

Agent target **must be a concrete agent type** — the kebab-case name from the mission's `domain_profile` (e.g., `software-engineer`, `security-engineer`), or the slot name itself only for single-agent authority slots where slot and concrete type happen to match (e.g., `challenger`, `decision-maker`). `--agent` rejects raw slot ids (see `geas memory agent-set --help`).

## 3. Deduplicate against existing memory

Salvage pattern #4. Before adding an entry:

1. Read the current target file (`.geas/memory/shared.md` or `.geas/memory/agents/{type}.md`).
2. Compare the new candidate against existing entries by meaning (not substring).
3. If a semantically-overlapping entry already exists:
   - Stronger evidence → `modified`: rewrite the existing entry body, keep the `memory_id`, add the new source to its citation line.
   - Same strength, no new nuance → drop the candidate.
4. If no overlap exists: `added`.

## 4. Mark new entries as `[DRAFT]` until the phase review confirms them

Salvage pattern #3. Newly added entries (both scopes) start with a `[DRAFT]` prefix on the item heading. Drafts:

- Still ship in the updated `shared.md` / `agents/{type}.md` so that subsequent mission reading picks them up.
- Are explicitly listed for the phase-review reviewers to promote, modify, or drop.
- Promoted in the same consolidating phase once the reviewers sign off (salvage pattern #5) — the `[DRAFT]` prefix is removed in the final replace-write.

Single-session skip: if the candidate comes from 2+ independent tasks already and the orchestrator is confident, the entry can skip the `[DRAFT]` prefix. Record the basis in `memory-update.json`'s `reason`.

## 5. Resolve contradictions explicitly

Salvage pattern #7. When a new candidate contradicts an existing entry, pick one:

- **Replace** — the new candidate supersedes the old. Emit a `removed` row for the old `memory_id` with the reason, and an `added` row for the new one whose `reason` references the removed id.
- **Amend** — both are partially right. Emit a `modified` row combining the refined wording.
- **Retain both with scope clarification** — add scope qualifiers to both entries. Emit one `modified` row per entry.

Silent override is not allowed. If reviewers cannot decide, escalate to a deliberation (scope = the mission's consolidating phase) and implement the deliberation outcome, not the skill's default.

## 6. Build the edited markdown bodies

For each scope that has changes:

1. Read the current file once.
2. Apply add / modify / remove edits in memory.
3. Keep stable `memory_id` labels on each heading (so future passes can cite them).
4. Sort / group is up to project convention — protocol 06 does not enforce a layout.

Do not edit files whose scope had no changes. Empty changes skip the write entirely.

## 7. Write the updated markdown via CLI

For shared memory:

```bash
cat new-shared.md | geas memory shared-set
```

For each changed agent type:

```bash
cat new-software-engineer.md | geas memory agent-set --agent software-engineer
```

The CLI replaces the file atomically. `--agent` must be the concrete type; raw slot ids are rejected by the CLI.

## 8. Record the semantic change log

Immediately after the markdown writes succeed, the orchestrator calls:

```bash
cat memory-update.json | geas memory-update set \
  --mission <mission_id>
```

to record `added` / `modified` / `removed` entries per scope with `memory_id`, `reason`, `evidence_refs`. The CLI writes the JSON artifact; the pairing of markdown + change-log is this skill's contract (CLI.md §14.8).

If the `memory-update set` call fails after the markdown already changed, re-run it with a corrected body. Do not roll back the markdown edits silently — that would leave memory-update.json unable to cite the real state.

## 9. Automatic extraction triggers (retrospective flow)

Salvage pattern #6. Close a task with extra scrutiny when any of these fire, and carry the surfaced items into this skill at consolidating time:

- Same failure class observed in 2+ tasks this mission → add a shared candidate, skip `[DRAFT]` only if evidence is strong.
- Same reviewer concern raised in 2+ tasks → shared candidate.
- Self-check `confidence <= 2` for the same `task_kind` in 2+ tasks → agent-type candidate targeted at the worker's concrete agent type.
- Surprise field populated in closure retrospective → at minimum a `[DRAFT]` candidate in the relevant scope.

These are signals, not automatic writes. The orchestrator still decides before calling the CLI.

---

## What this skill does NOT do

- It does not create, modify, or delete debts. That lives in G6 (`skills/policy-managing` was removed in v2 → v3; debt maintenance is `skills/mission` consolidating phase input into `debts.json`).
- It does not emit events directly. The `memory_shared_set` and `memory_agent_set` events are appended by the CLI automatically.
- It does not manage policy overrides — there are none in v3.
