---
name: drafting-task
description: Invoked by the mission dispatcher when a task contract needs authoring — either as part of the initial task set during specifying, or mid-mission for scope expansion within the approved spec, or as a replacement for a cancelled task; produces a drafted task contract and moves the task to ready once approved.
user-invocable: false
---

# Drafting Task

## Overview

Transforms a slice of mission scope into a task contract routed to a concrete implementer, with reviewer slots, surfaces, dependencies, and a baseline snapshot. Writes go through `geas task draft` and `geas task approve`. Does not itself decide when a new task is needed — the dispatcher does.

<HARD-GATE> The `surfaces` allowlist is the concurrency contract. Two tasks that overlap on even one surface cannot run concurrently. Be specific — no broad roots like `src/` unless the task genuinely rewrites the tree.

## When to Use

- Specifying phase: initial task set authoring (called by `specifying-mission`).
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
7. **Fill `routing`.** `primary_worker_type` = concrete implementer agent type (kebab-case). `required_reviewers` picked from `challenger | risk-assessor | operator | communicator`. Challenger mandatory when `risk_level >= high`. Verifier is implicit. **Mission `mode` does NOT change task-level `required_reviewers`** — `full_depth` changes judgment depth via mission-level deliberation (see `convening-deliberation`), not by adding reviewers to every task. Picking reviewers based on mode instead of the task's actual risk and surfaces produces rubber-stamp reviews and pollutes the real dissent signal.
8. **Capture `base_snapshot`.** Typically `git rev-parse HEAD`; any stable baseline id works.
9. **Set `dependencies` and `supersedes`.** `dependencies` lists task ids that must reach `passed` before this leaves `ready`. `supersedes` is non-null only when replacing a cancelled task.
10. **Submit draft + approval.** Run `geas task draft`. On response, show the user (or route to decision-maker for mid-mission in-scope). On confirmation, run `geas task approve --by user` (or `--by decision-maker`).

CLI payload shape (task draft):

```json
{
  "title": "...",
  "goal": "...",
  "risk_level": "normal",
  "acceptance_criteria": ["..."],
  "verification_plan": "...",
  "surfaces": ["..."],
  "routing": {
    "primary_worker_type": "software-engineer",
    "required_reviewers": ["challenger"]
  },
  "base_snapshot": "<git sha or equivalent>",
  "dependencies": [],
  "supersedes": null
}
```

The CLI injects `mission_id`, `task_id`, `created_at`, `updated_at`; defaults `approved_by=null`; writes `contract.json` and a drafted `task-state.json`.

## Red Flags

| Excuse | Reality |
|---|---|
| "Just list `src/` — the exact files will become clear during work" | `surfaces` is the concurrency contract. Broad roots block every other task; be specific. |
| "Risk is high but challenger isn't needed this time" | Challenger is mandatory at `risk_level >= high`. No exceptions. |
| "Mission is `full_depth` so every task gets challenger" | Mode affects mission-level deliberation, not task-level reviewers. Task reviewers are chosen from `risk_level` and surface impact, independent of mode. Blanket challenger assignment dilutes real dissent into rubber stamps. |
| "Goal is `improve scheduling`" | That is an activity, not an observable outcome. Rewrite as an observable end-state a reviewer can grade. |
| "Contract is wrong — let me edit `contract.json` to fix it" | Contracts are immutable on approval. Cancel the task and draft a replacement with `supersedes`. |
| "Drop `verification_plan` — the gate will figure it out" | Tier 1 runs the plan; without it the gate returns `error`. |

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

- **Invoked by**: mission dispatcher for initial task set during specifying, for scope expansion mid-mission, or for cancelled-task replacement. Also called by `specifying-mission` during initial task set authoring.
- **Invokes**: none.
- **Do NOT invoke**: `scheduling-work` — drafting does not schedule; the dispatcher picks the next action after approval. `running-gate` — gates live in the reviewed state, not the draft stage.

## Remember

- Goal names an observable change, not an activity.
- Surfaces are an allowlist — name specific files, not broad roots.
- Challenger is mandatory at `risk_level >= high`; verifier is implicit.
- Mission `mode` does not change task-level `required_reviewers`. `full_depth` drives depth through mission-level deliberation, not by attaching challenger to every task.
- Contract is immutable after approve; replace via `supersedes` if wrong.
- Tasks outside `spec.scope.in` are not drafted here — route back to the dispatcher.
