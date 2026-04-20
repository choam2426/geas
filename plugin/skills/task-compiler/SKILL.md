---
name: task-compiler
description: Compile a mission slice into a v3 task contract and create it through the CLI. Produces contract.json plus a drafted task-state.json ready for approval.
---

# Task Compiler

Transform a slice of mission scope into a task contract that routes to a concrete implementer and enumerates reviewer slots, surfaces, dependencies, and the baseline snapshot the work starts from.

## When to Use

- **specifying phase** — after the mission spec is approved, compile each planned task before entering building.
- **mid-mission, within current scope** — decision-maker may approve compiled contracts while building is in flight. User approval is required for tasks outside the current mission scope.

## Inputs

- **Mission spec** — `.geas/missions/{mission_id}/spec.json` (mode, scope, acceptance criteria, risks).
- **Mission design** — `.geas/missions/{mission_id}/mission-design.md` when present; holds architecture decisions the spec referenced.
- **Shared memory** — `.geas/memory/shared.md` for project conventions that constrain surfaces or routing.
- **Existing task contracts** — `.geas/missions/{mission_id}/tasks/*/contract.json` to discover dependency ids and avoid scope collisions.

## Compilation Steps

### 1. Assign a task id

The CLI auto-generates `task-NNN` (mission-local max+1). You may pass `task_id` explicitly; the CLI validates the pattern and rejects collisions with an existing contract.

### 2. Write `title` and `goal`

- `title` — short human label, one line. Mention the surface family: "[schema] rev-range consolidation format", "[docs/KO] rewrite 03 evidence section".
- `goal` — single sentence stating the outcome. The test: a reviewer who reads the goal can decide whether any candidate change satisfies it.

Goal phrasing: name the observable change, not the activity. "Build a lockless batch scheduler that rejects overlapping surfaces" is a goal. "Improve scheduling" is not.

### 3. Classify `risk_level`

One of `low`, `normal`, `high`, `critical`. Use the failure-cost test — how hard is recovery if this task ships wrong?

| Signal | risk_level |
|---|---|
| Reversible with a single edit | `low` |
| Ordinary feature or doc change | `normal` |
| Touches a contract other tasks depend on (schema, public API, shared surface) | `high` |
| Data migration, authority boundary, or mission-level commitment | `critical` |

`critical` tasks run solo — the scheduling skill never batches them with peers.

### 4. List `acceptance_criteria`

An array of observable, yes/no criteria. At least one item. Each criterion names the dimension it evaluates (correctness, scope boundary, regression safety, etc.) — reviewers need the dimension to write useful evidence.

### 5. Write `verification_plan`

Prose (markdown permitted) describing how this task will be verified. Both automated and manual checks belong here. Do not encode them as an executable command list — v3 verification lives in the gate skill and reviewer evidence, not in a per-task command vector.

Examples of useful prose:
- "Run the full `node --test` suite under `src/cli/`. Expect 27 prior tests green plus the new g3-task file."
- "Inspect the resulting `contract.json` against `docs/schemas/task-contract.schema.json` — no additional properties."

### 6. Declare `surfaces`

An allowlist of reviewer-readable surface strings: filenames, directory roots, documents, or named environments that the task may touch. Scheduling uses the allowlist to detect overlap with other in-flight tasks; only one task may hold implementer on any given surface at a time.

Be specific:
- `src/cli/src/commands/task.ts`
- `plugin/skills/task-compiler/SKILL.md`
- `docs/schemas/task-contract.schema.json`

Avoid broad roots like `src/` or `docs/` unless the task genuinely rewrites the tree.

### 7. Fill `routing`

- `primary_worker_type` — concrete implementer agent type, kebab-case (e.g. `software-engineer`, `platform-engineer`). Must be a real agent file under `plugin/agents/<family>/`. The primary worker occupies the implementer slot for this task.
- `required_reviewers` — array from the four review-producing slots:
  - `challenger` — adversarial review. Mandatory when `risk_level` >= `high`.
  - `risk-assessor` — security / safety review.
  - `operator` — deployment, runtime, ops review.
  - `communicator` — docs, user-facing language, comms.

Verifier is implicit for every task and does not appear here. Concrete reviewer agent types are resolved by the orchestrator at dispatch time.

### 8. Capture `base_snapshot`

Record the baseline the task starts from. Format is implementation-specific; a git commit sha is the common case:

```bash
git rev-parse HEAD
```

Protocol 04 requires baseline snapshots on every task so the scheduling skill can detect staleness before a batch starts.

### 9. Declare `dependencies`

Array of task ids that must reach `passed` before this task may leave `ready`. Empty array when there are no dependencies. The CLI enforces this on `task transition --to implementing`.

### 10. Set `supersedes`

`null` for ordinary new tasks. Set to a previously `cancelled` task id when this contract replaces that one (protocol 03 cancellation rules).

### 11. Leave `approved_by` null

Drafted contracts have `approved_by: null`. Approval is a separate step — `geas task approve` flips it to `user` (default) or `decision-maker` (for mid-mission additions within the current scope) and advances the task-state from `drafted` to `ready`.

## Writing the contract

```bash
geas task draft --mission {mission_id} <<'EOF'
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
EOF
```

The CLI injects `mission_id`, `task_id`, `created_at`, `updated_at`, defaults `approved_by` to `null`, validates the payload against `task-contract.schema.json`, and writes both `contract.json` and a drafted `task-state.json`.

## Approval

```bash
geas task approve --mission {mission_id} --task {task_id} --by user
```

`--by user` is the default. Use `--by decision-maker` for mid-mission tasks that stay inside the current mission scope. Approve moves `task-state.status` from `drafted` to `ready` and sets `contract.approved_by`.

## Dependencies added after draft

```bash
geas task deps add --mission {mission_id} --task {task_id} --deps task-002,task-003
```

The CLI merges the new ids, deduplicates, validates, and writes. Removing dependencies is out of scope for G3 (open the issue in the nonblocking queue if you need it).

## Output contract

The successful `task draft` envelope includes:

- `path` — absolute forward-slash path to `contract.json`
- `ids.mission_id`, `ids.task_id`
- `contract` — the validated, CLI-injected contract body
- `state` — the drafted task-state

## Boundaries

- Do not write `task-state.json` directly. The task-state is CLI-managed; skills invoke `task approve` and `task transition` instead of editing the file.
- Do not produce eval command arrays. Verification lives in `verification_plan` prose plus the gate skill.
- Do not set `status` in the contract payload — status is a runtime state field on `task-state.json`, not a contract field.
- Do not invoke this skill for tasks that belong to a mission outside the current scope — route the user to `intake` first to expand the mission spec, then decide whether to draft a new task here or open a fresh mission.
