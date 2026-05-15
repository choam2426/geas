---
name: geas-cli
description: Provides the Geas runtime write adapter and status interface through the bundled `scripts/geas` CLI. Use when a Skill needs to initialize `.geas/`, read status, record Mission or Task artifacts, record User Judgment, transition state, or preserve payloads after CLI write failure. Do not use to author artifact content or decide whether Evidence is sufficient.
---

# Geas CLI

## Job

Run the bundled `scripts/geas` CLI as the single adapter for `.geas/` runtime reads and writes. Keep readable Markdown artifacts, runtime YAML data, CLI guard results, and User Judgment responsibilities separate.

## Workflow

Normal:
- Receive the caller's command purpose and prepared payload path when a write is needed.
- Run `scripts/geas status` before state-sensitive writes when current runtime state is unknown.
- Use readable `.md` artifact payloads for Mission Spec, Mission Design, Task Contract, Evidence, User Judgment, and Mission Evidence records.
- Let the CLI update runtime `.yaml` data such as Run State, Task State, Debt Ledger, and Memory through guarded commands.
- Run the needed `scripts/geas ...` command.
- Return the JSON result, written paths, state changes, and any current location fields to the caller.

Common command surface:
- `scripts/geas init`
- `scripts/geas status`
- `scripts/geas mission create`
- `scripts/geas mission spec record --from <path>`
- `scripts/geas mission design record --from <path>`
- `scripts/geas mission transition --to <specifying|building|consolidating> [--task <task-id>]`
- `scripts/geas mission evidence record --from <path>`
- `scripts/geas task contract record --task <task-id> --from <path>`
- `scripts/geas task transition --task <task-id> --to <phase>`
- `scripts/geas task evidence record --task <task-id> --kind <implementation|verification|review|challenger|task> --from <path>`
- `scripts/geas judgment record --target <task-result|mission-result> [--task <task-id>] --from <path>`
- `scripts/geas debt record --from <path>`
- `scripts/geas memory record --scope <common|role> [--role <role>] --from <path>`

Handoff:
- Return CLI success output as a record ref and state update summary.
- Return CLI failure output as a stop briefing input, including `error.code`, guard failures, current location, and preserved payload path.

User Decision:
- When the caller asks to record User Judgment, require a User-provided judgment payload path.
- If a User decision is missing, return a stop condition instead of creating judgment text.

Stop:
- Preserve the prepared payload path and CLI JSON output.
- Report unavailable script, invalid payload kind, guard failure, missing runtime, state mismatch, or write failure.

## Inputs

Required:

- caller command purpose
- current workspace path
- prepared payload path for record commands
- target Mission, Task, stage, phase, or scope flags when required by the command

Optional:

- prior `scripts/geas status` JSON
- caller stop briefing draft
- CLI stdout and stderr from a failed attempt

## Resources

| Resource | When to use | Purpose |
| --- | --- | --- |
| `scripts/geas` | every runtime read or write | execute the bundled Geas CLI adapter |

Run `scripts/geas --help` to inspect the current command surface before using a command not listed above. On Windows PowerShell, run `node scripts/geas --help` if the extensionless script cannot execute directly.

## Gotchas

- CLI success means the runtime write or status read succeeded; it does not mean the artifact content is sufficient.
- CLI failure with guard details is a stop condition input, not permission to edit `.geas/` files by hand.
- Markdown artifacts are readable payloads; runtime YAML files are state data guarded by CLI commands.
- User Judgment payloads must come from User decisions, not agent recommendations.
- Mission Evidence is recorded only after Mission result User Judgment and the required Mission closure inputs exist.
- Do not copy CLI invocation rules into every other Skill; route runtime writes through this adapter.

## Stop Conditions

- `scripts/geas` is missing or cannot execute.
- Required payload path is missing or unreadable.
- Payload frontmatter kind does not match the command.
- CLI exits non-zero or returns `ok: false`.
- CLI guard failure says runtime state is missing, mismatched, invalid, or not ready.
- Caller asks this adapter to author artifact content or decide acceptance.
- User Judgment is requested but no User decision payload exists.

## Boundary

`geas-cli` runs guarded runtime commands and reports their JSON results. It does not author Mission Spec, Mission Design, Task Contract, Evidence, User Judgment, Debt, or Memory content. It does not bypass guards or directly edit runtime files when the CLI rejects a write.
