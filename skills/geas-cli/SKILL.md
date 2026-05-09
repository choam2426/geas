---
name: geas-cli
description: "Reference and bundled script for invoking the Geas CLI. Use when a Geas procedure needs to write .geas/ runtime artifacts through the CLI."
---

# Geas CLI

Reference for invoking the `geas` CLI. The CLI is the only writer for `.geas/` runtime artifacts.

Full command surface: see `docs/cli.md`. Artifact schemas: see `docs/runtime.md`.

## Bundled script

The bundled executable lives at `scripts/geas` inside this skill. From the repository root, use `node skills/geas-cli/scripts/geas <command>` unless the client exposes the script as `geas` on PATH.

In the examples below, `geas` means that bundled executable.

## Calling pattern

1. Build the YAML payload as a temp file (e.g. `task-001-contract.yaml`).
2. Invoke `geas <command> --from <path>`.
3. Read the JSON result on stdout. `ok: true` means the artifact and any state pointer were updated atomically. `ok: false` means runtime is unchanged; act on `error.code` and `error.guards`.

`--from -` reads payload from stdin.

## Output shape

Success:

```json
{
  "ok": true,
  "command": "task contract record",
  "current": { "mission_id": "...", "stage": "building", "task_id": "task-001", "phase": "implementing" },
  "writes": [ { "path": "...", "type": "created" } ],
  "state_changes": [ { "pointer": "task[task-001].phase", "from": "", "to": "unstarted" } ]
}
```

Failure:

```json
{
  "ok": false,
  "command": "...",
  "current": { ... },
  "writes": [],
  "error": { "code": "guard_failed", "guards": [ { "code": "stage_not_specifying" } ] }
}
```

## Mission start flow

```
geas init                                      # once per project
geas mission create
geas mission spec record --from spec.yaml
geas mission design record --from design.yaml
```

## Task execution flow

```
geas task contract record --task task-001 --from contract.yaml
geas mission transition --to building --task task-001
geas task transition --to implementing --task task-001
geas task evidence record --task task-001 --kind implementation --from impl.yaml
geas task evidence record --task task-001 --kind verification --from verify.yaml
geas task evidence record --task task-001 --kind review --from review.yaml
# (optional) geas task evidence record --task task-001 --kind challenger --from chall.yaml
geas judgment record --target task-result --task task-001 --from judgment.yaml
geas task evidence record --task task-001 --kind task --from task-evidence.yaml
```

The `task evidence record` calls automatically advance `task-state.yaml.phase`. See `docs/cli.md`'s phase table.

## Mission close flow

```
geas mission transition --to consolidating
geas judgment record --target mission-result --from mission-judgment.yaml
geas memory record --scope common --from memory-item.yaml          # repeat per item
geas memory record --scope role --role reviewer --from memory-item.yaml
geas mission evidence record --from mission-evidence.yaml
```

## Frequent guard failures

| code | meaning | fix |
|---|---|---|
| `task_contract_missing` | tried to enter `building` for a task without a recorded Task Contract | run `geas task contract record --task <tid> --from contract.yaml` first |
| `phase_not_awaiting_user_judgment` | tried to record `task` evidence or `task-result` judgment outside the awaiting state | record verification + review evidence first; for `task` evidence ensure judgment is also `accepted`/`accepted_with_limits` |
| `judgment_not_revise` | tried to re-enter `implementing`/`verifying`/`reviewing`/`challenging` from `awaiting_user_judgment` without a `revise` decision | record a new judgment with `decision: revise` first |
| `dependency_cycle` | mission design has a cycle in `task_breakdown.depends_on` | rewrite the design so dependencies form a DAG |
| `mission_judgment_not_accepted` | tried to record memory or mission evidence before the mission-result judgment was accepted | record `judgment record --target mission-result` with decision `accepted` or `accepted_with_limits` |

## Payload examples

### Mission Spec (`mission-spec.yaml`)

```yaml
name: ""
goal: ""
background: ""
completion_criteria: []
included_scope: []
excluded_scope: []
acceptance_criteria: []
constraints: []
assumptions: []
risks: []
```

Empty values mean "no content"; all keys must be present.

### Task Contract (`task-contract.yaml`)

```yaml
description: ""
mission_relation: ""
depends_on: []
scope_in: []
scope_out: []
deliverables: []
acceptance_criteria: []
verification_checks: []
review_focus: []
risks: []
```

### Implementation Evidence

```yaml
summary: ""
changed_outputs: []
affected_scope: []
decisions: []
contract_deltas: []
self_checks: []
limits: []
reflection_candidates: []
```

### User Judgment

```yaml
decision: accepted        # accepted | accepted_with_limits | revise | deferred | stopped
accepted_unverified_scope: []
accepted_remaining_risks: []
requested_actions: []
```

### Memory item

```yaml
guideline: ""
applies_when: []
source_refs: []           # paths relative to .geas/missions/<mid>/, e.g. tasks/task-001/task-evidence.yaml
```

## Notes

- The CLI is the only producer of identifiers, file numbers, and storage paths. Do not invent file names yourself.
- The CLI never makes acceptance decisions. Record the user's decision via `judgment record` and let the CLI advance the state pointers.
- For the full transition tables (`mission stage` and `task phase`), read `docs/cli.md`.
