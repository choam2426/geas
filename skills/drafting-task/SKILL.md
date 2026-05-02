---
name: drafting-task
description: Invoked by a spawned design-authority when a task contract needs authoring — initial task set during specifying, mid-mission scope expansion within the approved spec, or replacement for a cancelled task. Produces a drafted task contract; approval is handled by the orchestrating skill.
user-invocable: false
---

# Drafting Task

## Overview

Transforms a slice of mission scope into a task contract routed to a concrete implementer, with reviewer slots, surfaces, dependencies, and a baseline snapshot. Writes go through `geas task draft` and `geas task approve`. Does not itself decide when a new task is needed — the dispatcher does.

<HARD-GATE> The `surfaces` allowlist is the concurrency contract. Two tasks that overlap on even one surface cannot run concurrently. Be specific — no broad roots like `src/` unless the task genuinely rewrites the tree.

## When to Use

- Specifying phase: initial task set authoring (in design-authority's spawned context, under specifying-mission's orchestration).
- Building/polishing phase: dispatcher requests a new task in the current mission scope.
- Replacement: previous task was cancelled and a successor is needed (`supersedes` link).
- Do NOT use for work outside the current mission scope — surface to the user; that is a new mission, not a new task.
- Do NOT use to edit an existing contract — contracts are immutable on approval. Cancel + draft replacement.

## Preconditions

- Active mission exists and `mission-state.json` is readable.
- Mission spec is approved; mission design exists (the contract's decisions flow from the design).
- For `building` phase scope-in: the task's goal fits within `spec.scope.in`.
- CLI is the sole writer to `.geas/`.

## Process

1. **Read the frame.** Load `spec.json`, `mission-design.md`, `.geas/memory/shared.md`, and existing contracts under `tasks/*/contract.json` to discover dependency ids and avoid scope collisions.
2. **Write title + goal.** `title` one-line human label mentioning the surface family. `goal` one sentence naming the observable change, not the activity. A reviewer reading only the goal should be able to decide whether a candidate change satisfies it.
3. **Classify `risk_level`.** Use the failure-cost test: reversible single-edit → `low`; ordinary feature/doc → `normal`; touches a contract other tasks depend on → `high`; data migration / authority boundary / mission-level commitment → `critical`. Critical tasks run solo at scheduling time.
4. **List `acceptance_criteria`.** ≥1 observable yes/no item; each names the dimension (correctness, scope boundary, regression safety) so reviewers can write useful evidence.
5. **Write `verification_plan`.** Prose (markdown allowed). Both automated and manual checks go here; do not emit an executable command vector — verification is prose + gate.
6. **Declare `surfaces`.** Named files, directories, documents, environments. One task per surface at a time.
7. **Fill `routing`.** `primary_worker_type` = concrete implementer agent type (kebab-case). `required_reviewers` picked from `challenger | risk-assessor | operator | communicator`. Verifier is implicit.

    **Default specialist set.** Recommended starting reviewers: `risk-assessor + operator + communicator`. These three cover the safety/quality, deployability/recoverability, and user-facing-deliverable axes that almost every task touches. Drop one only when the task contract genuinely cannot affect that axis (for example, a pure-internals refactor with no operational surface may omit `operator`); the omission must be defensible against the surfaces and goal.

    **Challenger inclusion (falsifiable rule).** Add `challenger` to `required_reviewers` if and only if AT LEAST ONE of the following holds:

    | Condition | Evaluable from |
    |---|---|
    | (a) `risk_level >= high` (i.e. `high` or `critical`) | the contract's `risk_level` field |
    | (b) the task affects a protocol surface — JSON Schema, mission/task lifecycle, or dispatcher interface | the contract's `surfaces` field |
    | (c) the user has explicitly asked for challenger on this task | mission spec / intake notes / decision-maker direction |

    None of (a)/(b)/(c) holds → do NOT include challenger. Auto-attaching challenger to every task dilutes dissent into a rubber stamp and pollutes the real challenge signal. A reviewer reading the contract should be able to answer yes/no to "should challenger be here?" purely from `risk_level`, `surfaces`, and the intake record.

    **Mission `mode` does NOT change task-level `required_reviewers`** — `full_depth` changes judgment depth via mission-level deliberation (see `convening-deliberation`), not by adding reviewers to every task. Picking reviewers based on mode instead of the task's actual risk and surfaces produces rubber-stamp reviews and pollutes the real dissent signal.
8. **Capture `base_snapshot`.** Typically `git rev-parse HEAD`; any stable baseline id works.
9. **Set `dependencies` and `supersedes`.** `dependencies` lists task ids that must reach `passed` before this leaves `ready`. `supersedes` is non-null only when replacing a cancelled task.
10. **Submit draft.** Run `geas task draft`. The CLI assigns `task_id` and writes `contract.json` + a drafted `task-state.json`. Do not approve yet.
11. **Render the task card with dep preflight result.** Before requesting approval, run the dep-status preflight (folded from former Step 14) and output a structured card. The card covers every field approval will lock in, plus a `Dependencies` line showing each dep's `task-state.status`. For the first task in an initial task set, prepend a compact decomposition-table header above the card so the user audits slicing at the set level; subsequent tasks omit the table.

    ```
    [Decomposition table — first task of initial set only]
    | id      | title       | risk    | surfaces (summary)  | deps    |
    |---------|-------------|---------|---------------------|---------|
    | task-01 | ...         | ...     | ...                 | —       |

    Task {id} — {title}
    Goal: {one-line observable change}
    Risk: {level}              Implementer: {primary_worker_type}
    Surfaces: {list}
    Reviewers: verifier (implicit){, other slots from required_reviewers}
    Acceptance criteria:
      1. ...
      2. ...
    Verification plan: {one- to three-line summary; reference the full text if long}
    Dependencies: {task-id (status), ...} or "none"
    Base snapshot: {sha}
    ```

12. **Ask for approval (single round, options branched on preflight).** Issue one structured-prompt round with header `Task {id}`. Options branch on the preflight result rendered in Step 11:
    - **All deps OK**: `approve | revise | cancel`. On `revise`, follow up with a section-picker (`content (goal, criteria, verification) | routing (reviewers, risk) | surfaces | dependencies`). Free-text escape on every round.
    - **Any dep `cancelled` / `escalated` / `void`**: `repoint-deps | redraft-task | cancel-this-task`. The user's explicit decision drives the next move — never auto-substitute the dependency, never silently approve over a terminated dep.

    For initial task set authoring, the free-text escape on the first task's card may carry set-level adjustments (`redecompose set`, `drop task-XX`, `reorder`). Approval round runs in main-session (orchestrator-side); a spawned design-authority hands the drafted contract back before the approval round begins.

13. **Handle revise.** A drafted contract is not yet immutable, but the CLI enforces immutability at `approve`. Treat the current draft as abandoned, call `geas task draft` again with the corrected payload, and re-render the card. Loop until the user returns `approve` at Step 12. Approve only after every surfaced concern is resolved.

14. **Approve.** Run `geas task approve --mission <id> --task <id> --by user` (or `--by decision-maker` for mid-mission in-scope additions). Per the preflight folded into Step 11, this call must not fire while any dependency is in a non-passing terminal state. The orchestrating skill (`specifying-mission` for the initial set, the dispatcher for mid-mission) issues this call from main-session; the spawned design-authority does not.

`geas task draft` accepts inline flags (preferred for short payloads) or a full JSON payload via `--file`. For the exact field list, run `geas schema template task-contract --op draft`. The CLI injects `mission_id`, `task_id`, `created_at`, `updated_at`; defaults `approved_by=null`; writes `contract.json` and a drafted `task-state.json`.

Inline form:

```bash
geas task draft --mission <id> \
    --title "Short human-readable label" \
    --goal "Concrete observable outcome" \
    --risk-level normal \
    --acceptance-criterion "criterion 1" --acceptance-criterion "criterion 2" \
    --verification-plan "one-paragraph verification procedure" \
    --surface "src/foo.ts" --surface "test/foo.test.js" \
    --primary-worker-type software-engineer \
    --reviewer risk-assessor --reviewer operator --reviewer communicator \
    --base-snapshot "<git sha or equivalent>"
# Add `--reviewer challenger` ONLY when one of (a) risk_level >= high,
# (b) task affects a protocol surface, or (c) explicit user request holds.
```

Use `--goal-from-file <path>` and `--verification-plan-from-file <path>` (stage the prose in .geas/tmp/ using the current client's file-write mechanism) for prose-heavy free-body fields.
The full-payload `--file <path>` form remains as a back-compat alias for callers who already author the full JSON; never use a bash heredoc for the body. See `mission/SKILL.md` § Tmp file lifecycle for staging location and cleanup.

## Red Flags

| Excuse | Reality |
|---|---|
| "Just list `src/` — the exact files will become clear during work" | `surfaces` is the concurrency contract. Broad roots block every other task; be specific. |
| "Risk is high but challenger isn't needed this time" | Challenger is mandatory at `risk_level >= high`. No exceptions. |
| "Just attach challenger to every task by default — better safe than sorry" | Challenger inclusion is conditional. Auto-attaching to all tasks dilutes dissent into a rubber stamp. Include challenger only when (a) `risk_level >= high`, (b) the task affects a protocol surface, or (c) the user explicitly asked. Otherwise leave challenger off the task and let the default specialist set carry the review. |
| "Mission is `full_depth` so every task gets challenger" | Mode affects mission-level deliberation, not task-level reviewers. Task reviewers are chosen from `risk_level` and surface impact, independent of mode. Blanket challenger assignment dilutes real dissent into rubber stamps. |
| "Goal is `improve scheduling`" | That is an activity, not an observable outcome. Rewrite as an observable end-state a reviewer can grade. |
| "Contract is wrong — let me edit `contract.json` to fix it" | Contracts are immutable on approval. Cancel the task and draft a replacement with `supersedes`. |
| "Drop `verification_plan` — the gate will figure it out" | Tier 1 runs the plan; without it the gate returns `error`. |
| "Just show the user title and goal — the rest is in the file if they care" | Approval locks the contract. Surfaces, routing, acceptance_criteria, verification_plan, risk_level, and dependencies are all part of the commitment. Hiding them behind a summary turns approval into rubber-stamping and is exactly how misrouted reviewers and oversized surface allowlists slip past review. |

## Invokes

| CLI command | Purpose |
|---|---|
| `geas task draft --mission <id>` | Write the initial contract + drafted task-state. |
| `geas task approve --mission <id> --task <id> --by user\|decision-maker` | Flip `approved_by` and move task-state from `drafted` to `ready`. |
| `geas task deps add --mission <id> --task <id> --deps <csv>` | Add dependencies after draft (additive only; removal is cancel + supersedes). |

## Outputs

- `.geas/missions/{mission_id}/tasks/{task_id}/contract.json` created.
- `.geas/missions/{mission_id}/tasks/{task_id}/task-state.json` initialized (`drafted` → `ready` on approve).
- The task's evidence directory and task-level `deliberations.json` scaffolded by the CLI.

## Failure Handling

- **Schema rejection** on draft: read hints (`missing_required`, `invalid_enum`, `wrong_pattern`). Fix the specific field; retry. Do not bypass.
- **`path_collision`** on task_id: the CLI assigns the id, so this means a prior draft for that id already exists. Audit the tasks/ directory; do not overwrite.
- **Approve guard failure**: spec not approved or `approved_by` invalid value. Resolve the precondition (finish `specifying-mission`) before retrying.
- **Ambiguous scope placement**: if the new task might be out of scope, halt and return to dispatcher with a scope question for the user — do not stretch `spec.scope.in` by writing the task.
- **Dependencies overstated after draft**: the CLI does not support removing dependencies. Cancel the task and draft a successor with `supersedes`.

## Related Skills

- **Invoked by**: a spawned `design-authority`. Approval (`--by user` or `--by decision-maker`) is issued in main-session by the orchestrating skill (`specifying-mission` for the initial set, the dispatcher for mid-mission), not by this skill's spawned context.
- **Invokes**: none.
- **Do NOT invoke**: `scheduling-work` — drafting does not schedule; the dispatcher picks the next action after approval. `running-gate` — gates live in the reviewing state, not the draft stage.

## Remember

- Goal names an observable change, not an activity.
- Surfaces are an allowlist — name specific files, not broad roots.
- Default reviewer set is `risk-assessor + operator + communicator`; verifier is implicit. Drop one only when the task's surfaces and goal genuinely cannot affect that axis.
- Challenger is included only when one of (a) `risk_level >= high`, (b) the task affects a protocol surface (JSON Schema, lifecycle, dispatcher interface), or (c) the user explicitly requested challenger. Do NOT auto-attach challenger to every task.
- Mission `mode` does not change task-level `required_reviewers`. `full_depth` drives depth through mission-level deliberation, not by attaching challenger to every task.
- Contract is immutable after approve; replace via `supersedes` if wrong.
- Approval is a single round per task: card + dep preflight + options branched on preflight outcome (per Step 12). Render the full card (every locked field), not a title-plus-goal summary.
- Tasks outside `spec.scope.in` are not drafted here — route back to the dispatcher.
