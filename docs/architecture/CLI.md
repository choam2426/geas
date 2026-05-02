# Geas CLI Design

This document describes the architecture of the Geas CLI (`geas`). For the higher-level structure and its relationship to the other layers, see [DESIGN.md](DESIGN.md). This document defines the internal contract and behaviors the CLI itself must guarantee.

## 1. Purpose and Scope

The CLI is the single actuator through which every write under `.geas/` must pass. Its primary consumers are shell calls issued by skills and agents. Because of that, the CLI prioritizes machine-readability and determinism over human-friendly interaction. UX conveniences such as colors, progress indicators, interactive prompts, and options like `--quiet` or `--verbose` are intentionally excluded.

The CLI has six responsibilities.

1. Validate JSON payloads against schemas and return structured hints when validation fails.
2. Read prerequisite artifacts and evaluate guards for state transitions.
3. Inject timestamps and identifiers automatically.
4. Enforce append-only invariants on log artifacts.
5. Make writes atomic using temp -> fsync -> rename.
6. Fix the `.geas/` path so the caller cannot redirect it elsewhere.

Everything outside those six responsibilities, including HTTP APIs, UI layers, automated reports, and statistical summaries, is outside the CLI's scope.

## 2. Design Assumptions

- **Machine-first interface.** Output is fixed as machine-consumable JSON rather than human-oriented formatting. Humans may call the CLI directly, but compatibility is always judged against the structured response contract.
- **Fixed paths.** `.geas/` is always resolved relative to the project root initialized by `geas setup`. The shared contract assumes the caller runs `geas` from the initialized repo or worktree root. Path override flags such as `--cwd` or `--dir` are not provided.
- **Minimal options.** Each command accepts only the arguments required for that operation. Convenience flags are excluded.
- **No internal state.** The CLI stores no state of its own. Every invocation is independent and reproducible.
- **Idempotency principle.** Repeating the same call against the same `.geas/` state produces the same result. For append commands, if the same entry is already the last item, the response is a no-op.
- **Skill and agent discipline.** The CLI does not validate an agent's intent. Invalid JSON is rejected by schema validation, but semantic questions such as "should this transition happen now?" remain the responsibility of the skill and the agent. The CLI enforces only structure and prerequisite conditions for transitions.
- **Skills are the primary guide to payload shape.** Each skill body carries the shape of the payloads it creates: the field fragments the agent must fill, placeholders, and allowed enum values. `geas schema template` is a **fallback** used only when the skill does not provide enough shape guidance or the agent is unsure. That design avoids repeated template lookups and reduces runtime context cost.

## 3. Command System

Commands are organized along two axes: **artifact** (which file they act on) and **operation** (how they act on it).

### Operation Categories

| Operation | Meaning | Targets |
|---|---|---|
| `create` | Create a top-level artifact for the first time | spec, mission-design, contract |
| `set` | Replace a top-level artifact in full | implementation-contract, gap, memory-update, mission-design |
| `update` | Update selected fields on a top-level artifact | mission-state, task-state (`status`, `active_agent`, `iterations`), task contract `approved_by` |
| `append` | Add one entry to an append-only array log | phase-reviews, mission-verdicts, gate-results, deliberations, evidence, self-check |
| `register` | Add a new entry that has its own identifier | debts |
| `run` | Execute logic and append the result (compound operation) | gate (append tier execution results into `runs`) |
| `read` | Read a file or emit a summary | schema template, context |
| `scaffold` | Create an implementation-support file (not a protocol artifact; not validated) | consolidation candidates |

### Mission-Level Commands

| Command | Operation | Target artifact |
|---|---|---|
| `geas mission create` | create | `missions/{id}/spec.json` + mission directory scaffold (Section 14.1) |
| `geas mission design-set` | set | `missions/{id}/mission-design.md` |
| `geas mission-state update` | update | `missions/{id}/mission-state.json`; phase transitions under `--phase` follow Section 14.2 |
| `geas phase-review append` | append | `missions/{id}/phase-reviews.json` |
| `geas mission-verdict append` | append | `missions/{id}/mission-verdicts.json` |
| `geas deliberation append --level mission` | append | `missions/{id}/deliberations.json` |
| `geas debt register` | register | `debts.json` (project-level) |
| `geas debt update-status` | update | `debts.json` (project-level) |
| `geas gap set` | set | `missions/{id}/consolidation/gap.json` |
| `geas memory-update set` | set | `missions/{id}/consolidation/memory-update.json` |
| `geas consolidation scaffold` | scaffold | gather candidates from all task evidence and write `consolidation/candidates.json` (Section 14.4) |

### Task-Level Commands

| Command | Operation | Target artifact |
|---|---|---|
| `geas task draft` | create | `tasks/{id}/contract.json` + task directory scaffold (Section 14.1) |
| `geas task approve` | update | `contract.approved_by` |
| `geas task transition` | update | `task-state.json` (lifecycle transition) |
| `geas task-state update` | update | `task-state.json` (`active_agent`, iterations) |
| `geas task deps add` / `geas task deps remove` | update | `contract.dependencies` (rotate dependency list mid-mission) |
| `geas task base-snapshot set` | update | `contract.base_snapshot` (rotate the shared baseline sha after upstream tasks land) |
| `geas impl-contract set` | set | `tasks/{id}/implementation-contract.json` |
| `geas self-check append` | append | `tasks/{id}/self-check.json` |
| `geas evidence append` | append | `tasks/{id}/evidence/{agent}.{slot}.json` |
| `geas gate run` | run | `tasks/{id}/gate-results.json`; includes `suggested_next_transition` in the response (Section 14.5) |
| `geas deliberation append --level task` | append | `tasks/{id}/deliberations.json` |

### Memory Commands

| Command | Operation | Target artifact |
|---|---|---|
| `geas memory shared-set` | set | `.geas/memory/shared.md` (payload via `--file` or stdin is full Markdown; atomic replace) |
| `geas memory agent-set --agent <type>` | set | `.geas/memory/agents/{type}.md` (payload via `--file` or stdin is full Markdown; atomic replace) |

### Utility Commands

| Command | Behavior |
|---|---|
| `geas schema list` | Return JSON listing available schemas |
| `geas schema template <type>` | Return a JSON skeleton for the required fields of that schema |
| `geas schema validate --type <t>` | Validate a JSON payload (from `--file` or stdin) against the named schema |
| `geas context` | Return context JSON describing current mission / task state for agent bootstrapping |
| `geas state get` | Return structured JSON for the active mission's phase and each task's state |
| `geas setup` | Initialize `.geas/` at the project root |
| `geas event log --kind <k> --payload <json>` | Append a line to `events.jsonl` |

## 4. Input Contract

### Payload Delivery

Most write-path commands accept their payload through a layered trio. The first form that resolves wins; the others remain as fallbacks.

- **Inline flags** (preferred for the common case). Each scalar field of the payload is exposed as a `--<field>` long flag. Repeatable scalar fields use `--<field> <value>` multiple times (Commander's variadic form). The eleven core write commands listed in the dispatch tables above support inline-flag invocation end-to-end so a single shell call can construct the artifact without staging a file. Free-body fields (`goal`, `verification_plan`, `summary`, `rationale`, `body`, …) are exposed both as `--<field> <text>` (acceptable for one-line prose) and as `--<field>-from-file <path>` (preferred for multi-line prose, markdown, or any content that includes apostrophes, backticks, or non-ASCII characters that the shell would otherwise have to escape).
- **`--file <path>`** (full payload from file). When the caller already has a full JSON payload staged on disk, `--file` reads that path verbatim as UTF-8 text. The shell never parses the content, so apostrophes, non-ASCII prose, newlines, and backticks inside the payload cannot corrupt it. Direct writes under `.geas/` are blocked by the hook, so callers should stage the payload outside `.geas/` (for example `/tmp/` or a project-local scratch file). When `--file` is provided, inline scalar flags on the same call are ignored — `--file` wins.
- **stdin**. When neither inline flags nor `--file` are provided, the CLI reads the full payload from stdin. Safe when the content is produced by a reliable pipe (`cat file | geas cmd`). Avoid bash heredoc with prose body — embedded quotes, apostrophes, or non-ASCII text routinely break shell parsing before the bytes reach the CLI.

Exactly one channel must resolve. If a write-path command receives no inline flags, no `--file`, and no stdin payload, the call fails with `invalid_argument` (exit code `1`). JSON-payload commands parse the resolved content as UTF-8 JSON; parse failures use the same error code. Text-payload commands (`mission design-set`, `memory shared-set`, `memory agent-set`) write the content verbatim after BOM strip and trailing-newline normalization.

This contract goes no further than "receive UTF-8 content via inline flags, `--file`, or stdin." How a shell or runtime prepares that content is the caller's concern. Section 4.4 shows invocation patterns verified by the reference implementation.

### Global Flags

Three orthogonal flags compose with every command and may appear at any subcommand depth. They are resolved leaf-first so the most-specific occurrence wins.

| Flag | Effect |
|---|---|
| `--json` | Force a single-line `{ok, data}` / `{ok:false, error}` envelope on stdout. Without this flag the command emits the default scalar shape described in Section 5. |
| `--verbose` | Include extra context in scalar output (extra fields, longer hints). Composes with default mode; in `--json` mode it is a no-op because the envelope already carries every field. |
| `--debug` | Pair with `--json` to pretty-indent the envelope. Pair with default mode to surface diagnostic detail (stack hints, internal step labels) on stderr. |

### Identifier Flags

Only explicit long flags are used, never positional arguments.

- `--mission <mission_id>` - mission identifier. If omitted, the CLI infers the currently active mission from mission state; if none is active, the call fails.
- `--task <task_id>` - task identifier. Required for task-level commands.
- `--agent <agent>` - required for `evidence append`. This is the concrete agent type. Authority slots use the slot name itself (for example `decision-maker`), while specialists use the domain profile's concrete type (for example `software-engineer`, `security-engineer`).
- `--slot <slot>` - required for `evidence append`. This is the protocol slot the agent is acting in for this entry. Together with `--agent`, it determines the evidence path `evidence/{agent}.{slot}.json`.
- `--level mission|task` - required for `deliberation append`.

### Argument Rules

- All options use long form only (`--foo`). Short forms are not supported.
- Boolean flags are determined purely by presence (`--flag`). Forms such as `--flag=true` or `--flag=false` are not accepted.
- The CLI performs first-pass validation of argument shape (ID patterns, enum values, file existence). The schema performs second-pass validation on the payload.

### Reference Usage (bash and zsh)

The contract stops at the points above. This subsection shows invocation patterns verified by the reference implementation. Adapters for fish, PowerShell, cmd, or other environments may use any equivalent way of staging content in a file or producing a clean pipe.

**Preferred: inline flags (single-call write)**

For the eleven core write commands (`mission create/approve`, `task draft/approve/transition`, `evidence append`, `self-check append`, `gate run`, `debt register`, `memory shared-set`, `deliberation append`) every scalar field is reachable via `--<field>` so the artifact can be authored in one shell call without a staging file.

```bash
geas task draft \
  --title "Wire envelope export removal" \
  --goal "Drop legacy emit/err/ok/EXIT_CODES exports from envelope.ts" \
  --risk-level critical \
  --verification-plan "binary fixture asserts the four exports are undefined" \
  --surface src/cli/src/lib/envelope.ts \
  --surface src/cli/test/envelope-no-legacy-exports.test.js \
  --dependency task-004 \
  --acceptance-criterion "env.emit, env.err, env.ok, env.EXIT_CODES are undefined" \
  --base-snapshot 64a74fb073ec88de04ce0118c11e412ab40edbda
```

Free-body prose fields (`goal`, `verification_plan`, `summary`, `rationale`, `body`, …) are still safer to stage when they contain apostrophes, backticks, non-ASCII text, or run beyond a couple of lines:

```bash
printf '%s' "$verification_plan" > /tmp/vp.md
geas task draft \
  --title "..." --goal "short outcome line" --risk-level high \
  --verification-plan-from-file /tmp/vp.md \
  --surface ... --acceptance-criterion ...
```

**Acceptable: stage to a file, pass `--file` (full JSON)**

When the caller already has a fully-formed JSON payload (for example because an upstream tool produced it), `--file` is the safest channel because no payload bytes traverse the shell parser.

```bash
# Stage the payload to any path outside .geas/
#   (agents: create the file outside .geas/; humans: use an editor, heredoc, or redirection)
cat > /tmp/mission-design.md <<'DONE'
# Mission Design

Any markdown body — apostrophes, Korean prose, `backticks`, $dollar signs,
"double quotes", 'single quotes' — all safe here because the shell never
re-parses the file contents.
DONE

geas mission design-set --mission mission-20260419-abcd1234 --file /tmp/mission-design.md
```

For JSON payloads, the same shape works:

```bash
printf '%s' "$body_json" > /tmp/evidence-entry.json
geas evidence append --mission M --task T --agent software-engineer --slot implementer --file /tmp/evidence-entry.json
```

**Acceptable: pipe from file via stdin**

Equivalent to `--file` for reliability. Useful when integrating with tools that already produce a stream.

```bash
cat /tmp/mission-design.md   | geas mission design-set --mission M
cat /tmp/evidence-entry.json | geas evidence append --mission M --task T --agent A --slot S
```

**Acceptable for short, shell-safe literals**

Only for payloads that contain no single quotes, apostrophes, dollar signs, or backticks:

```bash
echo '{"name": "Mission X"}' | geas mission create
```

**Avoid: heredoc with prose body**

```bash
# FRAGILE — a single apostrophe, backtick, or non-ASCII character inside the
# body routinely breaks shell parsing before the bytes reach the CLI.
geas evidence append --mission M --task T --agent A --slot S <<'EOF'
{ "summary": "... natural prose with quotes and 'apostrophes' ..." }
EOF
```

The quoted delimiter (`<<'EOF'`) disables `$` expansion and backtick evaluation, but that only protects against a subset of failure modes. For any payload with prose content, non-ASCII text, or more than a few lines, use `--file` or pipe-from-file instead.

## 5. Output Contract

### Output Modes

Every command's stdout / stderr shape is a function of the global flags resolved at parse time.

| Mode | Success path | Error path |
|---|---|---|
| default (no flag) | One short scalar line on stdout: `<command>: <key facts>` (per-command formatter). When no formatter is registered the success envelope falls back to JSON on stdout. | `error: <message>` on stderr; if the error carries a hint, an additional `hint: <next action>` line on stderr. stdout is empty. |
| `--json` | Single-line `{ok:true, data:{...}}` envelope on stdout. | Single-line `{ok:false, error:{code, message, hint?}}` envelope on stdout. |
| `--json --debug` | Pretty-indented JSON envelope on stdout. | Pretty-indented JSON envelope on stdout (same shape; multi-line). |

Skills and agents that consume the JSON envelope should pass `--json` explicitly. The default scalar mode targets human-facing readers (and the user-facing briefing layer in `plugins/geas/skills/mission/references/briefing-templates.md`); programmatic consumers should never assume the default shape because it is allowed to drift toward terser phrasing as commands evolve.

### Success Response (--json mode)

```json
{
  "ok": true,
  "data": {
    "path": ".geas/missions/mission-20260419-abcd1234/spec.json",
    "ids": {
      "mission_id": "mission-20260419-abcd1234"
    },
    "written": {
      "bytes": 4213,
      "fields_injected": ["created_at", "updated_at"]
    }
  }
}
```

Fields inside `data`:

- `path` - the primary file touched by this invocation.
- `ids` - the identifiers created or finalized by this invocation.
- `written` - auxiliary information such as which fields the CLI injected, useful when an agent wants to confirm what was written.

Append commands include new identifiers such as `entry_id` or `gate_run_id` in `ids`.

### Error Response (--json mode)

```json
{
  "ok": false,
  "error": {
    "code": "schema_validation_failed",
    "message": "mission-spec.schema.json: required field 'name' missing",
    "hint": "add the missing field to the payload and retry"
  }
}
```

Every error envelope carries `code`, `message`, and an optional `hint` (singular string). Schema-validation failures additionally surface a structured hint object on stderr in default mode (Section 6.7) so the agent can act on the precise validation defect without re-running with `--json`.

Error codes are descriptive tags chosen by each command. Common values:

| code | Meaning |
|---|---|
| `schema_validation_failed` | The payload JSON did not satisfy the schema |
| `guard_failed` | A transition guard or other prerequisite condition was not met |
| `append_only_violation` | A caller attempted to change an append-only log in some way other than append |
| `path_collision` | The primary artifact for a `create` command already exists (supporting directories and empty wrappers from Section 14.1 are excluded and treated as quiet no-ops) |
| `missing_artifact` | A referenced artifact does not exist |
| `invalid_argument` | The CLI arguments themselves were malformed |
| `io_error` | A filesystem error occurred |
| `internal_error` | Any other failure; treated as a bug |

### Exit Codes (Error Categories)

Every error attaches to one of five routing categories. The category determines the process exit code; the descriptive `code` tag is independent.

| Category | Exit code | Typical codes |
|---|---|---|
| `validation` | 2 | `schema_validation_failed`, `invalid_argument` (payload shape) |
| `guard` | 3 | `guard_failed`, `append_only_violation`, `path_collision` |
| `missing_artifact` | 4 | `missing_artifact`, `task_not_found`, `mission_not_found` |
| `io` | 5 | `io_error` (filesystem failure) |
| `internal` | 1 | `internal_error`, unknown / unrouted |

Exit code `0` is reserved for success. Skills and agents should primarily branch on the JSON `ok` field; exit codes exist for shell-level failure detection and CI gates that need a single integer signal.

## 6. Write Pipeline

Every write command passes through the following six stages in order. If any stage fails, later stages do not run and `.geas/` is left untouched.

```
1. parse            load payload from --file or stdin
2. schema validate  validate it with the artifact schema
3. guard check      read prerequisite artifacts and evaluate conditions when needed
4. inject           auto-fill timestamps and IDs
5. append-only check (append commands only) verify array invariants
6. atomic write     temp -> fsync -> rename
```

### 6.1 Parse

Load the payload per the rules in Section 4.3. If `--file <path>` is provided, read that file as UTF-8; otherwise read from stdin. If neither channel supplies content for a command that requires a payload, return `invalid_argument` (exit code `1`). JSON parse failures on JSON-payload commands are handled the same way.

### 6.2 Schema Validate

Validate with the JSON schema associated with the artifact using `ajv`. On failure, return the hints structure described in Section 6.7.

### 6.3 Guard Check

When a command requires state transition or reference integrity, the CLI reads prerequisite artifacts and evaluates the required conditions. Examples:

- `task transition --to ready`: `contract.approved_by != null`. Tasks added mid-mission and still in scope may move directly to `ready` as soon as that condition is satisfied. The initial task set is moved to `ready` by the specifying -> building bulk transition in Section 14.2, so the system does not call `task transition --to ready` individually for those tasks.
- `task transition --to implementing`: every dependency task must already be `passed`
- `task transition --to deciding`: the latest run in `gate-results.runs` must have verdict `pass`
- `task transition --to passed`: the task must contain an Orchestrator closure entry whose verdict is `approved`

If a guard fails, the CLI returns `guard_failed`.

### 6.4 Inject

The CLI automatically fills these values:

- top-level `created_at` (for `create` only)
- top-level `updated_at` (for every write)
- `created_at` on each appended entry
- `entry_id` (monotonic per evidence file), `gate_run_id` (monotonic per gate-results). Deliberation entries do not have stable IDs; order is determined by array position.
- validation and path binding for `mission_id` and `task_id` on first creation

If an agent includes any of those fields in the payload, the CLI overwrites them. That is the only way to preserve a single source of truth for timestamps and IDs.

### 6.5 Append-Only Check

See Section 9 for details. This stage runs only for commands that target append-only logs.

### 6.6 Atomic Write

```
1. temp_path = .geas/tmp/{target-basename}.{pid}.{rand}
2. fd = open(temp_path, O_WRONLY | O_CREAT | O_EXCL, 0600)
3. write(fd, content)
4. fsync(fd)
5. close(fd)
6. rename(temp_path, target_path)
```

The temp directory `.geas/tmp/` is created on demand during root detection if it does not already exist. The rename is atomic within the same volume, using POSIX `rename(2)` or `MoveFileExW(MOVEFILE_REPLACE_EXISTING)` on Windows. In a crash, the worst case is a leftover temp file while the target remains in its prior state.

### 6.7 Hints

When schema validation fails, the CLI interprets `ajv`'s error list and returns a structure agents can act on immediately.

```json
{
  "missing_required": ["name", "acceptance_criteria"],
  "invalid_enum": [
    {"path": "/mode", "allowed": ["lightweight", "standard", "full_depth"], "got": "quick"}
  ],
  "wrong_pattern": [
    {"path": "/id", "pattern": "^mission-[0-9]{8}-[a-zA-Z0-9]{8}$", "got": "mission-1"}
  ],
  "additional_not_allowed": ["extra_field"]
}
```

Each array key is always present, even when empty, so the agent never has to branch on missing keys.

## 7. Schema Validation

### Schema Loading

The CLI bundle embeds all 14 schemas from `docs/schemas/`. They are not read from runtime files. The build step validates and embeds them into the binary so schema drift is avoided.

### Validation Timing

- immediately before writing any artifact (Section 6.2)
- on demand via `geas schema validate --type <t>` for a single payload
- when generating `schema template`, which returns a skeleton containing only the required fields for that schema (Section 12)

### Validation Strictness

- `additionalProperties: false` applies to every top-level object, so unknown fields are rejected immediately
- conditional requirements expressed through `allOf` or `if/then` are enforced automatically by `ajv`
- pattern matching is strict for all identifiers, including `mission_id`, `task_id`, `debt_id`, and `gate_run_id`

## 8. Transition Guard

Transition guards answer only one question: "is this transition formally allowed?" They do not judge whether the transition is the right choice at that moment. That semantic judgment belongs to skills and agents.

### Preconditions by Transition

These match the task-lifecycle transition table in protocol doc 03. The CLI reads and checks the following artifacts for each transition:

| Transition | Artifacts read | Validation condition |
|---|---|---|
| `drafted -> ready` | `contract.json` | `approved_by != null` |
| `ready -> implementing` | each dependency's `task-state.json` | all have `status == passed` |
| `implementing -> reviewing` | `self-check.json` | `self-check` exists and validates against the self-check schema. Reviewer evidence is not required at this transition — it is enforced by gate Tier 0 inside the `reviewing` state |
| `reviewing -> deciding` | `gate-results.runs` | the latest run verdict is `pass` |
| `deciding -> passed` | `evidence/orchestrator.orchestrator.json` | the latest entry has `evidence_kind=closure` and `verdict=approved` |
| `* -> blocked` | - | always allowed (reason is recorded in closure or state) |
| `blocked -> ready/implementing/reviewing` | - | always allowed (Orchestrator judgment) |
| `* -> escalated` | - | always allowed |
| `escalated -> passed` | `evidence/orchestrator.orchestrator.json` | latest closure entry verdict is `approved` |
| `escalated -> ready/implementing/reviewing` | `evidence/orchestrator.orchestrator.json` | latest closure entry verdict is `changes_requested` |
| `* -> cancelled` | - | always allowed |

Phase transitions through `mission-state update --phase` follow the same rule: the last entry in `phase-reviews.reviews` must have `status=passed`, and its `next_phase` must match the target.

### Guard Algorithm

```
1. read the current mission or task state
2. check whether the (current, target) pair exists in the transition table
3. read the prerequisite artifacts for that pair
4. evaluate the conditions
5. if they pass, continue through the remaining write stages in Section 6;
   otherwise return guard_failed with hints
```

Guard-failure hints are structured around what is missing or mismatched:

```json
{
  "reason": "closure_verdict_not_approved",
  "expected": { "evidence_kind": "closure", "verdict": "approved" },
  "got": { "evidence_kind": "closure", "verdict": "changes_requested" },
  "artifact": ".geas/missions/{mid}/tasks/{tid}/evidence/orchestrator.orchestrator.json"
}
```

## 9. Append-Only Enforcement

### Applies To

- `phase-reviews.reviews`
- `mission-verdicts.verdicts`
- `gate-results.runs`
- `deliberations.entries`
- `evidence.entries`

### Input Shape

For append commands, the payload contains **one entry object only**. The caller does not send the full wrapper (`{entries: [...]}` or the file's top-level object). The CLI is responsible for loading the file, appending the entry, injecting timestamps, and writing the result.

```bash
# Preferred: stage the entry body, pass --file
printf '%s' "$entry_json" > /tmp/entry.json
geas evidence append --task task-001 --agent software-engineer --slot implementer --file /tmp/entry.json
```

### Validation Algorithm

When an append command runs:

```
1. load the existing file; if it does not exist, initialize an empty wrapper
   with top-level metadata and entries=[]
2. validate the payload (from --file or stdin) against the entry schema
3. inject CLI-managed fields into the new entry
   (entry_id = max(existing) + 1, created_at = current UTC time)
4. append the new entry to the existing array
5. refresh the file-level updated_at
6. atomic write (temp -> fsync -> rename)
```

If the caller includes CLI-managed fields such as `entry_id` or `created_at`, the CLI ignores them and overwrites them with its own values. That prevents ID collisions and forgery.

Append commands add only one entry per invocation. Batch appends are not supported by the input shape itself. If the caller needs multiple entries, it must call the CLI repeatedly, which ensures the `created_at` values follow the real call order.

### Exception

`debts.entries` is not append-only. `debt register` adds a new entry, but `debt update-status` mutates `status`, `resolved_by`, and `resolution_rationale` on an existing one. Debts are mutable because they represent the current cross-mission debt ledger. The CLI rejects any debt mutation outside those two commands.

## 10. ID Generation

These identifiers are created automatically by the CLI:

| id | Pattern | Generation rule |
|---|---|---|
| `mission_id` | `^mission-[0-9]{8}-[a-zA-Z0-9]{8}$` | `mission create` uses the local project date in `YYYYMMDD` plus an 8-character base62 random suffix |
| `task_id` | `^task-[0-9]{3}$` | `task draft` scans the current mission's `tasks/` directory and picks `max + 1` |
| `debt_id` | `^debt-[0-9]{3}$` | `debt register` scans `debts.entries` at project level and picks `max + 1` |
| `gate_run_id` | `^gate-[0-9]+$` | `gate run` scans the task's `gate-results.runs` and picks `max + 1` |
| `entry_id` (evidence) | integer >= 1 | `evidence append` scans the `(agent, slot)` evidence file and picks `max + 1` |

Even if the agent includes IDs in the payload, the CLI ignores them and generates its own values. That closes off ID collisions and ID forgery at the source.

## 11. Timestamp Injection

The CLI injects UTC timestamps as RFC 3339 / ISO 8601 `date-time` strings.

| Field | Injection timing |
|---|---|
| top-level `created_at` | once, during `create`, first `append`, or first `register` |
| top-level `updated_at` | refreshed on every write |
| appended entry `created_at` | when that entry is added to its array |

If the payload already contains timestamps supplied by an agent, the CLI overwrites them. If an agent needs project-local time interpretation, it can read the stored UTC value and convert it itself.

## 12. Template Generation

Templates are a **fallback tool**. If the skill body already provides the payload shape, there is no need to call them. Use a template only when the skill does not define the shape clearly enough or the agent is unsure.

### Invocation

```
geas schema template <type> --op <operation> [--kind <k>]
```

- `<type>`: schema name (`evidence`, `task-contract`, `mission-spec`, and so on)
- `--op`: operation being performed (`create`, `set`, `append`, `update`, `register`, `run`). The same schema may expose different "agent-filled" fields depending on the operation.
- `--kind`: branch selector for schemas that use `allOf` or similar branching, such as `evidence --kind review|verification|closure`

### Response Format: Three-Way Split

```json
{
  "you_must_fill": {
    "evidence_kind": "review",
    "summary": "<REQUIRED: one-sentence summary>",
    "verdict": "<enum: approved | changes_requested | blocked>",
    "concerns": [],
    "rationale": "<REQUIRED: markdown allowed>",
    "scope_examined": "<REQUIRED: markdown allowed>",
    "methods_used": ["<REQUIRED: at least 1>"],
    "scope_excluded": [],
    "artifacts": [],
    "memory_suggestions": [],
    "debt_candidates": [],
    "gap_signals": [],
    "revision_ref": null
  },
  "cli_auto_fills": [
    "entry_id",
    "created_at"
  ],
  "from_flags_or_path": [
    { "field": "mission_id", "source": "project root" },
    { "field": "task_id", "source": "--task flag" },
    { "field": "agent", "source": "--agent flag" },
    { "field": "slot", "source": "--slot flag" }
  ]
}
```

- `you_must_fill`: the exact JSON the agent must submit as the payload (via `--file` or stdin; see Section 4.3). Placeholders use the form `<REQUIRED: ...>`. The agent must replace those placeholders with real values.
- `cli_auto_fills`: fields the CLI injects automatically. If the agent includes them anyway, they are overwritten.
- `from_flags_or_path`: fields inferred from CLI flags or project path. The agent does not include them in the JSON payload.

### Generation Rules

- `you_must_fill` contains only required schema fields that are **not** auto-filled by the CLI and **not** inferred from flags or path
- placeholders are generated as follows:
  - `string` with `minLength >= 1`: `"<REQUIRED: short explanation>"`
  - `enum`: `"<enum: value1 | value2>"`
  - `array` with `minItems >= 1`: `["<REQUIRED: at least N>"]`
  - `array` with `minItems = 0`: `[]`
  - `number`: `0`
  - `boolean`: `false`
  - nullable fields: `null`
- if the schema uses `allOf` or another branching form, only the required fields for the selected `--kind` branch are included

### Minimizing Repeat Calls

In a persistent-main runtime, the agent should remember and reuse a template response once it has it. In a turn-scoped runtime, template calls are usually unnecessary if the skill body already describes the payload shape.

Submitting the `you_must_fill` object unchanged will often fail schema validation because the placeholders are not valid data. The agent must replace them with real content before sending the payload.

## 13. Path Rules and Immutable Boundaries

### Paths

Every `.geas/` path is resolved relative to the project root initialized by `geas setup`. The shared contract assumes the caller runs `geas` from that root.

- calling the CLI from outside the initialized project root fails with `missing_artifact` or `invalid_argument`
- automatic walk-up for subdirectory invocation, worktree detection, or canonical-path resolution is not part of the shared contract
- an implementation may add Git worktree detection or internal path resolution, but the documentation must not depend on that behavior
- the CLI does not accept overrides such as `--cwd` or `--project-root`

### What the CLI Must Never Do

- mutate or delete items in append-only logs
- preserve caller-supplied values for `created_at`, `updated_at`, `entry_id`, `gate_run_id`, `mission_id`, `task_id`, or `debt_id` (all are overwritten)
- write files outside `.geas/`
- delete the whole `.geas/` tree without explicit user confirmation (`setup` fails if the tree already exists, and no `geas reset` command is provided)
- expose schema files through paths other than the `schema` commands
- report a failed write as a partial success

If a CLI change violates any of these rules, that is not just a bug. It is a protocol violation.

## 14. Automated Behaviors

Atomic single-file writes are the default, but within the limits below the CLI also performs **extended side-effect automation**. Each automation exists to reduce repeated Orchestrator calls while preserving three constraints: (a) semantic judgment stays outside the CLI, (b) all side effects are recorded in `events.jsonl`, and (c) failures are reported clearly with no partial state.

### 14.1 Automatic Scaffold Creation

`mission create` and `task draft` perform directory scaffolding beyond the primary artifact write.

**`mission create` side effects**

- write `.geas/missions/{mission_id}/spec.json` (primary artifact)
- initialize `.geas/missions/{mission_id}/mission-state.json` with `phase: specifying` and `active_tasks: []`
- initialize empty wrappers: `phase-reviews.json` (`reviews: []`), `deliberations.json` (`level: mission`, `entries: []`), `mission-verdicts.json` (`verdicts: []`)
- create directories: `tasks/`, `consolidation/`

**`task draft` side effects**

- write `.geas/missions/{mission_id}/tasks/{task_id}/contract.json`
- initialize `task-state.json` with `active_agent: null` and `verify_fix_iterations: 0`
- create `evidence/` and initialize `deliberations.json` with `level: task`, `entries: []`

**Idempotency boundary**

Scaffold idempotency applies **only to supporting elements other than the primary artifact**.

- **Primary artifacts** (`spec.json`, `contract.json`): if they already exist, return `path_collision`. They are never overwritten.
- **Supporting elements** (empty wrapper files such as `phase-reviews.json`, `deliberations.json`, `mission-verdicts.json`, and subdirectories such as `tasks/`, `consolidation/`, `evidence/`): if they already exist, treat that as a silent no-op and preserve the existing content.

That separation makes scaffold retries safe while still treating recreation of a primary artifact with the same ID as an explicit failure. Empty wrappers pass validation because empty arrays are allowed.

### 14.2 Reinforced Phase Transitions

`geas mission-state update --phase <phase>` performs extra validation and transition logic depending on the target phase.

**`--phase building`**

- before updating `mission-state.phase`, inspect each drafted task's `approved_by`
- attempt to bulk-transition every drafted task with `approved_by != null` into `ready`
- return per-task results in the response:

```json
{
  "ok": true,
  "path": ".geas/missions/{mid}/mission-state.json",
  "bulk_transitions": {
    "success": ["task-001", "task-002"],
    "skipped": [{"task_id": "task-003", "reason": "approved_by is null"}],
    "failed": [{"task_id": "task-004", "reason": "dependency not passed"}]
  }
}
```

- each task transition is its own atomic write; if any one fails, `mission-state` is left untouched and the CLI returns `guard_failed`

**`--phase consolidating`**

- validate that every task has status `passed`, `cancelled`, or `escalated`
- if any task is still unresolved, return `guard_failed` with `unresolved_tasks: [...]`

**Other phase transitions**

- update the phase and guard that the latest `phase-reviews` entry has the matching `next_phase`

### 14.3 Deliberation Append Validation

`geas deliberation append --level mission|task [--task <id>]` validates the following when appending:

- the number of voters satisfies the schema minimum (`votes.minItems: 2`)
- the `result` field is consistent with the submitted votes: any `escalate` vote yields `escalate`; otherwise majority `agree` yields `agree`; majority `disagree` yields `disagree`; any other split yields `inconclusive`
- violations return `guard_failed` with details about missing voters or result mismatch

For a full-depth mission during specifying, the required three-voter deliberation including the Challenger is **not** enforced when the deliberation is appended. That requirement is checked later by the phase review guard when the specifying phase closes, as defined in protocol doc 02. At append time, the CLI checks only schema fit and the consistency rules above.

The Orchestrator may freely increase the voter count beyond the schema minimum. If the issue is important enough to need a wider perspective, additional specialists can participate without any special CLI validation.

Deliberation entries are appended only once the result is final. An "open deliberation" is not recorded in the file; it is tracked only in the Orchestrator or agent context. That model keeps the append-only contract intact.

### 14.4 Consolidation Scaffold

`geas consolidation scaffold`:

- scans every task evidence file in the current mission
- gathers `debt_candidates`, `memory_suggestions`, and `gap_signals`
- writes `.geas/missions/{mid}/consolidation/candidates.json`, overwriting any prior version:

```json
{
  "mission_id": "...",
  "collected_at": "...",
  "debt_candidates": [{"source_task": "task-001", "source_entry": 3, "...": "..."}],
  "memory_suggestions": [],
  "gap_signals": []
}
```

- `candidates.json` is a support file, not a protocol artifact, and is not schema-validated
- the Orchestrator reads `candidates.json` and separately writes `debts.json`, `gap.json`, and `memory-update.json` through `register` and `set` commands; there is no automatic promotion from candidates into official artifacts

### 14.5 Gate Result Hint

`geas gate run` includes a `suggested_next_transition` field in its response:

```json
{
  "ok": true,
  "path": ".geas/missions/{mid}/tasks/{tid}/gate-results.json",
  "ids": { "gate_run_id": "gate-2" },
  "suggested_next_transition": {
    "verdict": "pass",
    "target_state": "deciding",
    "command": "geas task transition --task task-001 --to deciding"
  }
}
```

- target mapping by verdict:
  - `pass` -> `deciding`
  - `block` -> `blocked`
  - `fail` -> `null` (the Orchestrator chooses the rewind target)
  - `error` -> `null` (the cause must be resolved and the gate rerun)
- the CLI never performs the transition automatically; the Orchestrator decides whether to follow the hint and then issues a separate `task transition`

### 14.6 Enforced Events Logging

Every command that performs automation also appends an event to `events.jsonl`. The event shape is:

```json
{
  "event_id": "evt-<seq>",
  "kind": "<enum>",
  "actor": "cli:auto" | "orchestrator" | "user" | "decision-maker",
  "triggered_by": {"type": "command", "ref": "geas mission-state update --phase building"},
  "prior_event": "evt-<seq>",
  "payload": { "...": "..." },
  "created_at": "<ISO 8601 UTC>"
}
```

- **`actor` namespace**: this field carries both slot identifiers such as `orchestrator` and `decision-maker`, and non-slot actors such as `user` and `cli:auto`. The colon in `cli:auto` is an implementation namespace prefix and is an allowed exception to slot ID naming because `events.jsonl` is an implementation-support log rather than a protocol artifact.
- events with **`actor: "cli:auto"`** must be chained to a prior user or Orchestrator intent through `prior_event`
- **artifact references are one-way (events -> artifact)**: side-effecting events put affected artifact paths and identifiers in `payload`, for example `{ "artifact": "tasks/task-001/evidence/software-engineer.implementer.json", "entry_id": 3 }`. Protocol artifacts do not contain back-references to event IDs, because their schemas are closed with `additionalProperties: false` and `events.jsonl` is deliberately kept separate from the protocol contract. If you need to know which events touched an artifact, grep `events.jsonl` by path.
- **rollback** is also append-only: when an automated transition is reversed, the system appends a new event such as `kind: "transition_reversed"` with `invalidates: evt-<seq>` rather than mutating or deleting the old one
- event logging is **best-effort**. The primary artifact write is atomic and authoritative; the `events.jsonl` append runs after it, and a failure there (disk full, transient permission error) is swallowed so that the primary write is not rolled back. The command still reports `ok`. Consumers that treat `events.jsonl` as a transaction log must account for this — it is telemetry, not the source of truth. The protocol artifact on disk is.

### 14.7 Memory Markdown Writes

`geas memory shared-set` and `geas memory agent-set --agent <type>` replace the entire target file with the Markdown body received via `--file` or stdin (see Section 4.3) using an atomic temp -> fsync -> rename write. There is no schema validation because `.geas/memory/*.md` is free-form Markdown and not part of schema validation. These are not append operations, so the caller must read the existing file first, modify it, and resubmit the full contents.

These commands write only the Markdown files and do not touch `memory-update.json`. Semantic audit data such as reasons and evidence references for added, modified, or removed items must be written separately by the Orchestrator through `memory-update set` during consolidating. Skills are responsible for calling the two writes together when needed. The CLI does not auto-synchronize Markdown content with the memory update log, which is consistent with the Section 2 assumption that the CLI owns formal writes, not semantic judgment.

### 14.8 What Stays Manual

The following actions always require an explicit Orchestrator call. The CLI does not automate them:

- `task transition --to blocked/cancelled/escalated` - a reason must be stated explicitly
- `task transition --to ready/implementing/reviewing` when returning from `blocked` - the restore point requires judgment
- choosing the rewind target after a `changes_requested` closure
- the `deciding` transition after `gate run` (Section 14.5 provides a hint only)
- lifecycle transitions after `evidence append`, including closure; evidence writes and state transitions remain separate operations
- `mission-verdict append`, which is reserved for Decision Maker judgment
- `debt update-status`, whose status change is semantic, not mechanical
- promotion from `consolidation/candidates.json` into official `debts.json`, `gap.json`, and `memory-update.json`

That separation preserves the rule from Section 2: the CLI owns formal structure and deterministic aggregation, while judgment remains with the Orchestrator and agents.

## 15. Skill-Layer Conventions

The CLI is one half of the agent UX surface. The other half is the skill layer (`plugins/geas/skills/`), which the dispatcher reads to drive each phase. The conventions below live in the skill layer but exist to interact cleanly with the CLI guarantees in Sections 1-14; they are mentioned here so a CLI-centric reader knows where to look when a skill body references them.

### 15.1 Inline-Flag-First Invocation

Every SKILL.md that triggers a write-path command names the inline-flag form first and reserves `--file <path>` / stdin only for free-body fields where prose-staging is genuinely safer (apostrophes, multi-line markdown, non-ASCII text). Concrete inline-flag forms for the eleven core commands are documented inside each SKILL.md and exercised by the integration scenario fixture (`src/cli/test/integration-scenario.test.js`).

### 15.2 IN-8 Drafting Preflight

`plugins/geas/skills/drafting-task/SKILL.md` and `plugins/geas/skills/specifying-mission/SKILL.md` carry a preflight ritual that the drafter must run before approving a task contract:

- enumerate the test fixtures that the task's production-code surfaces will break, and include them in `contract.surfaces` (or call out that a downstream task will own them via `contract.dependencies`)
- check that no `cancelled` or `escalated` task is left dangling in any other task's `contract.dependencies` — if so, run `geas task deps remove --task <id> --dep <cancelled-id>` before the new approval

The preflight catches a class of drafting flaws that previously surfaced only at gate time (mission-20260427-xIPG1sDY task-006 closure registered the AC↔surfaces preflight as a follow-up debt).

### 15.3 Mission Dispatch Table

`plugins/geas/skills/mission/SKILL.md` carries the dispatch table the orchestrator reads to route the mission state machine. The rows that interact with this CLI document:

- `implementing → reviewing` — orchestrator transitions the task after the implementer's self-check lands; reviewers and the verifier are dispatched in the new state.
- reviewer/verifier dispatch — for each `routing.required_reviewers` slot the orchestrator spawns a concrete agent in the `reviewing-task` skill; the verifier is dispatched in parallel via `verifying-task`. The CLI does not manage the dispatch — it only provides the artifacts (`evidence/{agent}.{slot}.json`) the spawned agents append to.

### 15.4 User-Facing Briefing Vocabulary

Four user-facing briefings (`current-status`, `task-completion`, `phase-transition`, `mission-verdict`) are emitted as Korean narrative prose, not field-colon JSON dumps. The vocabulary they may use is enumerated as a jargon allowlist in `plugins/geas/skills/mission/references/briefing-templates.md`; CLI-emitted text that flows into a briefing should respect the allowlist (core protocol terms `phase`, `gate`, `task`, `mission`, `evidence`, `verdict` are allowed; deeper jargon like `tier`, `verify-fix`, `rewind` is not). The CLI's default scalar output mode (Section 5) is the surface that feeds this layer.
