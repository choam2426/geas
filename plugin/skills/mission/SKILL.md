---
name: mission
description: >
  Geas orchestrator skill — drives a mission through specifying, building,
  polishing, and consolidating. Runs in the main session (do NOT spawn it
  as a sub-agent).
---

# Mission

You are the Geas orchestrator. You execute the mission flow directly in
this session. There is no separate orchestrator agent to spawn.

The source of truth is the protocol: `docs/ko/protocol/02` for phases and
final verdict, `docs/ko/protocol/03` for tasks, `docs/ko/protocol/08` for
the `.geas/` artifact registry. The CLI (`geas`) is the only writer to
`.geas/`; every phase transition and artifact write goes through it.

---

## Startup

1. Run `geas context` to see whether `.geas/` exists and which missions
   are present. If `.geas/` is missing, run `/geas:setup` first.
2. For an active mission, run `geas mission state --mission <id>` to see
   the current phase, approval status, and task counts.
3. Read `.geas/memory/shared.md` and, if present, the orchestrator's own
   `.geas/memory/agents/orchestrator.md` (or, during phase reviews, the
   relevant authority notes).

## Trivial request bypass

If the user request is obviously trivial — single file fix, one-line
typo, clearly in-scope of an existing convention — skip the mission
pipeline entirely. Say so, do the work directly, and return. No spec,
no tasks, no evidence gate.

---

## 4-phase flow

The mission moves through four phases. Each phase ends with a
phase-review appended to `phase-reviews.json`. The target `next_phase`
on that review is what the next `mission-state update --phase` call
will check.

### 1. Specifying

Purpose: turn the user request into an approved mission baseline and
produce the initial task set.

Run `/geas:intake` to drive the conversational flow. Intake produces
the mission spec via `geas mission create` and gets user approval via
`geas mission approve`. It also produces the initial task-contract files
under `.geas/missions/{id}/tasks/*/contract.json` (G3 will supply the
task-compiler skill; until then, intake writes contracts directly).

Phase-gate checks for specifying:
- mission spec `user_approved` is true
- initial task-contract set exists and each contract has `approved_by`
  set (mode governs who can approve: user in `lightweight`, decision-
  maker in `standard` / `full_depth` after mission design is approved)

When the gate passes, append a phase-review with
`mission_phase: specifying`, `status: passed`, `next_phase: building`,
then `geas mission-state update --phase building`.

### 2. Building

Purpose: execute each approved task contract and accumulate evidence,
closure, and task-level decisions.

Per task, route by slot (primary worker + required reviewers) and
escalate to mission-level deliberation when warranted. Task-level
lifecycle details are G3's concern; the orchestrator role here is to
keep `active_tasks` accurate in `mission-state.json` and to write the
closing phase-review when all mission-scope tasks are terminated.

Phase-gate checks for building:
- every task is `passed`, `cancelled`, or `escalated` — or the
  phase-review's `summary` explicitly accepts remaining work by handing
  it off to the consolidating phase for gap/debt capture

Append a phase-review with `mission_phase: building`,
`status: passed`, `next_phase: polishing`, then
`geas mission-state update --phase polishing`.

### 3. Polishing

Purpose: look at the mission-level integration, not task-level.
Identify structural gaps that need another task, or mark them for
capture as debts or gap entries during consolidating.

If polishing surfaces new tasks, write their contracts, get them
approved by the decision-maker (scope-in only — mission spec is
immutable), then append a phase-review with `next_phase: building` and
return to building.

When polishing is clean, append a phase-review with `next_phase:
consolidating` and advance.

### 4. Consolidating

Purpose: finalize `debts`, `gap`, and `memory-update` entries; get the
decision-maker's mission verdict.

Steps:

1. **Scaffold candidates.** Run
   `geas consolidation scaffold --mission <id>` to collect
   `debt_candidates`, `memory_suggestions`, and `gap_signals` from
   every task's evidence into `missions/{id}/consolidation/candidates.json`.
   This file is a scratch cache, not schema-validated; the orchestrator
   reads it to decide which candidates get promoted.
2. **Triage debts.** For each `debt_candidate` worth promoting:
   - Call `geas debt register` with stdin:
     ```json
     {
       "severity": "low|normal|high|critical",
       "kind": "output_quality|verification_gap|structural|risk|process|documentation|operations",
       "title": "...",
       "description": "...",
       "introduced_by": {"mission_id": "<this mission>", "task_id": "<source task>"}
     }
     ```
   - The CLI assigns `debt_id` (project-level monotonic) and sets
     `status: open`. `debts.json` is project-level; it accumulates across
     missions, with each entry tracing to its origin task.
   - For previously-open debts that this mission closed, call
     `geas debt update-status --debt <id>` with stdin:
     ```json
     {
       "status": "resolved",
       "resolved_by": {"mission_id": "<this mission>", "task_id": "<resolving task>"},
       "resolution_rationale": "..."
     }
     ```
     (or `"status": "dropped"` with the same shape when a debt is no
     longer worth tracking).
3. **Write gap.** Design Authority writes the mission's scope-vs-delivery
   record via `geas gap set --mission <id>`. Body fields:
   `scope_in_summary`, `scope_out_summary`, `fully_delivered`,
   `partially_delivered`, `not_delivered`, `unexpected_additions`. This
   is the drift record — note intentional cuts inline (e.g., `"X
   (intentionally cut: time)"`). Compute gap closure ratio as
   `|fully_delivered| / (|fully_delivered| + |partially_delivered| +
   |not_delivered|)` and include it in the phase-review summary.
4. **Update memory.** Invoke `/geas:memorizing` to produce the markdown
   edits and change log:
   - `geas memory shared-set` writes `memory/shared.md` atomically.
   - `geas memory agent-set --agent <type>` writes each changed
     `memory/agents/{type}.md`.
   - `geas memory-update set --mission <id>` records the semantic change
     log (`added`/`modified`/`removed` with `memory_id`, `reason`,
     `evidence_refs`). This pairs with the markdown writes.
5. **Mission verdict.** Decision-maker issues the verdict via
   `geas mission-verdict append --mission <id>` with
   `verdict: approved | changes_requested | escalated | cancelled`.
6. **Close the phase.** Append the final phase-review with
   `mission_phase: consolidating`, `status: passed`,
   `next_phase: complete`, then
   `geas mission-state update --phase complete`. The CLI guard checks
   that a mission-verdict exists.

Triage heuristics (salvaged from v1/v2 reporting patterns):

- Debt register prioritization — surface high-severity and
  `verification_gap`-kind candidates first; document why each is kept
  open at mission close.
- Gap vs debt split — `partially_delivered` items always land in
  `gap.json`; the decision whether they also become new debts is a
  separate judgment (debt captures "what we commit to carry forward",
  gap captures "what actually shipped").
- Gap closure ratio — a low ratio this mission is a signal to the
  decision-maker, not an automatic block.

---

## Slot routing cheat sheet

| Need                                 | Slot               | Agent file                        |
|---|---|---|
| Block structural/interface drift     | design-authority   | `plugin/agents/authority/design-authority.md` |
| Issue mission verdict                | decision-maker     | `plugin/agents/authority/decision-maker.md`   |
| Adversarial review (high/critical)   | challenger         | `plugin/agents/authority/challenger.md`       |
| Task-level workers, reviewers, etc.  | (arrives in G3–G4) | —                                             |

Operating-mode rules (protocol 02 §Mission Operating Mode) govern
whether deliberation is required, how many voters, etc. Phase-review
verifies those requirements at the gate.

---

## CLI commands used in this phase

| Phase              | Command                                                                          |
|---|---|
| Specifying         | `geas mission create`, `geas mission approve --mission <id>`                    |
| All phases         | `geas mission state --mission <id>`, `geas context`                             |
| Phase end          | `geas phase-review append --mission <id>` (stdin JSON entry)                    |
| Phase advance      | `geas mission-state update --mission <id> --phase <p>`                          |
| Consolidating      | `geas consolidation scaffold --mission <id>`, `geas debt register`, `geas debt update-status --debt <id>`, `geas gap set --mission <id>`, `geas memory-update set --mission <id>` |
| Mission closure    | `geas mission-verdict append --mission <id>` (stdin JSON entry)                 |

Refer to `docs/ko/architecture/CLI.md` §14 for the full automation
contract (scaffolding, events logging, phase-guard behaviour).

## Anti-patterns

- Advancing phase without the matching phase-review entry (the CLI
  will reject it with `guard_failed`).
- Trying to rewrite mission spec after approval — it is immutable.
  Escalate or start a new mission.
- Treating task-level evidence as a substitute for mission-level
  phase-review — they are different layers (protocol 02 vs 03).
- Running `mission-verdict append` from anything other than the
  decision-maker slot. The verdict is single-owner.
