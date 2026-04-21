---
name: consolidating-mission
description: Invoked by the mission dispatcher on entry to the consolidating phase; scaffolds candidates from task evidence, promotes debt/memory/gap candidates, writes memory-update and gap artifacts, and updates the shared and per-agent memory markdown via the CLI.
user-invocable: false
---

# Consolidating Mission

## Overview

Converts the mission's accumulated `memory_suggestions`, `debt_candidates`, and `gap_signals` into durable project artifacts: `debts.json` entries, `gap.json`, `memory-update.json`, and the two memory markdowns (`shared.md` + `agents/{type}.md`). The CLI owns atomic writes; this skill owns semantic decisions.

<HARD-GATE> Memory markdown replace + `memory-update set` are a pair. Writing one without the other breaks the change-log ↔ markdown link. Candidates belonging in neither scope are dropped, not recorded. Memory vs debt is an explicit classification, not both.

## When to Use

- Dispatcher signals `phase=consolidating` entry.
- Session resume into an in-progress consolidation where some artifacts exist but not all.
- Do NOT run during `building` or `polishing` — per-task signals are captured in evidence but promotion waits for this phase.
- Do NOT use at mission spec time, except to confirm memory has not drifted out from under an abandoned mission being picked back up.

## Preconditions

- `phase=consolidating` (CLI-enforced by earlier `phase-review`).
- All tasks terminal (guaranteed by the entry guard).
- `.geas/memory/shared.md` and `.geas/memory/agents/*.md` readable.
- CLI is the sole writer to `.geas/`.

## Process

1. **Scaffold candidates.** Run `geas consolidation scaffold --mission <id>`. The CLI walks every task's evidence and writes `consolidation/candidates.json` with three arrays: `debt_candidates`, `memory_suggestions`, `gap_signals`. This file is not schema-validated (support file, not protocol artifact).
2. **Classify and deduplicate memory candidates.** For each `memory_suggestions` entry decide shared vs agent-specific. Rule of thumb:
   - Project convention / invariant / failure class affecting any agent → `shared.md`.
   - Role heuristic / tool tip / domain expertise tied to one agent type → `agents/{agent_type}.md`.
   - Unsure → prefer the narrower scope.
   - Belongs in neither → drop (do not record in memory-update).

   Deduplicate by meaning against the current target markdown. Overlap with stronger evidence → `modified` (keep `memory_id`, update body, append source). Same strength, no new nuance → drop. No overlap → `added`.
3. **Register debts.** For each `debt_candidates` entry that the orchestrator promotes: `geas debt register` with the payload shape `{severity, kind, title, description, introduced_by}`. CLI assigns `debt_id`, sets `status=open`. For debts resolved by this mission, `geas debt update-status --debt <id>`.
4. **Write the gap artifact.** Collect design-authority's unresolved technical questions + risk-assessor's unaddressed risks from the gap_signals into a single payload. `geas gap set --mission <id>` writes `.geas/missions/{mid}/consolidation/gap.json`.
5. **Build the edited memory markdowns.** For each changed scope (shared + each changed agent type): read current file, apply `added` / `modified` / `removed` edits in-memory, mark newly added entries with `[DRAFT]` prefix unless the candidate came from 2+ independent tasks with strong evidence, preserve stable `memory_id` labels on headings.
6. **Write memory markdown via CLI.** For shared: `cat new-shared.md | geas memory shared-set`. For each changed agent type: `cat new-<type>.md | geas memory agent-set --agent <type>`. CLI atomically replaces; `--agent` must be a concrete type (no raw slot ids).
7. **Write the memory-update change log.** Immediately after markdown writes succeed: `geas memory-update set --mission <id>` with the `added` / `modified` / `removed` entries per scope, each carrying `memory_id`, `reason`, `evidence_refs`. Markdown + changelog must pair.
8. **Return to dispatcher.** Leave the `verdicting-mission` step to a separate dispatch; consolidation's last step here is the memory-update write, not the mission verdict.

## Red Flags

| Excuse | Reality |
|---|---|
| "Memory contradicts old entry — just overwrite silently" | Contradictions are explicit: `Replace` (added + removed linked), `Amend` (modified), or `Retain with scope clarification`. Silent overwrite is not allowed. |
| "It's a lesson AND a debt — record in both" | Memory = what the project should remember going forward. Debt = what the project owes itself (unresolved work). Classify once, route once. |
| "Write the changelog later when I have time" | Markdown + `memory-update set` are paired by this skill's contract. The CLI does not auto-sync them. |
| "Broad candidate — put it in shared even though it's one agent's quirk" | When unsure, prefer the narrower scope. Shared entries are expensive to retract. |
| "`--agent` with a slot id like `implementer` to save typing" | Concrete agent type only (e.g. `software-engineer`, `security-engineer`). CLI rejects raw slot ids. |

## Invokes

| CLI command | Purpose |
|---|---|
| `geas consolidation scaffold --mission <id>` | Collect candidates into `consolidation/candidates.json` (support file). |
| `geas debt register` | Write a new debt entry. |
| `geas debt update-status --debt <id>` | Update a debt's status (resolved / dropped). |
| `geas gap set --mission <id>` | Write mission-level gap artifact. |
| `geas memory shared-set` | Atomically replace `.geas/memory/shared.md` (stdin is full markdown). |
| `geas memory agent-set --agent <type>` | Atomically replace `.geas/memory/agents/{type}.md` (stdin is full markdown). |
| `geas memory-update set --mission <id>` | Write the semantic change log paired with the markdown writes. |

## Outputs

- `.geas/missions/{mission_id}/consolidation/candidates.json` (support; not schema-validated).
- `.geas/missions/{mission_id}/consolidation/gap.json`.
- `.geas/missions/{mission_id}/consolidation/memory-update.json`.
- `.geas/debts.json` grows / entries update.
- `.geas/memory/shared.md` replaced (only if shared scope changed).
- `.geas/memory/agents/{type}.md` replaced per changed agent type.

## Failure Handling

- **Scaffold CLI rejects with `unknown command`**: CLI.md documents the command shape but the CLI may not yet register it (known gap). Report upward as a CLI gap; fall back to reading task evidence directly and assembling candidates in working memory.
- **Classification stalls** on an unclear candidate: prefer the narrower scope; if still unclear, drop it and surface as a gap_signal instead of forcing a memory write.
- **Contradiction cannot be resolved**: escalate to `convening-deliberation` scoped to consolidation; implement the deliberation outcome, not the skill's default.
- **`memory-update set` fails after markdown write succeeded**: re-run with corrected body. Do not revert the markdown — that would leave `memory-update.json` unable to cite the real state.
- **`--agent` rejected (raw slot id)**: replace with the concrete agent type from the mission's domain profile.

## Related Skills

- **Invoked by**: mission dispatcher on `phase=consolidating` entry.
- **Invokes**: `convening-deliberation` (unresolved memory contradiction in `full_depth`).
- **Do NOT invoke**: `verdicting-mission` — the mission verdict is a separate dispatcher step after this skill returns. `closing-task` — per-task closures are complete before consolidation starts.

## Remember

- Classify every candidate: shared / agent-specific / drop / debt. One route per candidate.
- Memory markdown writes + `memory-update set` are paired by this skill, not by the CLI.
- `[DRAFT]` prefix on newly added entries unless strong multi-task evidence skips it.
- Prefer narrower scope when unsure.
- Return to dispatcher after memory-update write; do not author the mission verdict here.
