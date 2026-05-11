---
name: geas-cli
description: "Reference and bundled script for invoking the Geas CLI. Use when a Geas procedure needs to write .geas/ runtime artifacts through the CLI."
---

# Geas CLI

Reference for invoking the `geas` CLI. The CLI is the only writer for `.geas/` runtime artifacts.

This skill is self-contained. It describes where the bundled CLI lives, how to invoke it, how to read its JSON output, and what responsibility boundary the CLI keeps.

## Bundled script

The bundled executable lives at `scripts/geas` beside this `SKILL.md`. Resolve the script relative to this skill directory and invoke it as `node <path-to-geas-cli-skill>/scripts/geas <command>`.

In the examples below, `geas ...` names the CLI surface. When executing a command, use the bundled script invocation above.

## Calling pattern

1. Build the YAML payload as a temp file (e.g. `task-001-contract.yaml`).
2. Invoke `node <path-to-geas-cli-skill>/scripts/geas <command> --from <path>`.
3. Read the JSON result on stdout. `ok: true` means the artifact and any state pointer were updated atomically. `ok: false` means runtime is unchanged; act on `error.code` and `error.guards`.

`--from -` reads payload from stdin.

## Command surface

```
geas init

geas mission create
geas mission spec record --from <path|->
geas mission design record --from <path|->
geas mission transition --to <specifying|building|consolidating> [--task <task-id>]
geas mission evidence record --from <path|->

geas task contract record --task <task-id> --from <path|->
geas task transition --task <task-id> --to <unstarted|implementing|verifying|reviewing|challenging|awaiting_user_judgment>
geas task evidence record --task <task-id> --kind <implementation|verification|review|challenger|task> --from <path|->

geas judgment record --target task-result --task <task-id> --from <path|->
geas judgment record --target mission-result --from <path|->

geas memory record --scope common --from <path|->
geas memory record --scope role --role <role> --from <path|->
```

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

## Responsibility boundary

- Use the CLI as the only producer of `.geas/` identifiers, file numbers, storage paths, and guarded state pointer changes.
- Treat payload content and workflow decisions as the caller's responsibility.
- Treat User acceptance decisions as User decisions. The CLI records User Judgment payloads; it does not make acceptance decisions.
- Treat completion as outside the CLI. The CLI records artifacts and transitions; it does not declare work complete.
