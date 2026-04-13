# Geas CLI Reference

The Geas CLI is a command-line tool that performs atomic reads and writes against the `.geas/` runtime state directory. All `.geas/` file writes must go through this CLI, which automatically handles timestamp management and schema validation.

## Installation Path

```
plugin/bin/geas
```

## Global Options

| Option | Description |
|--------|-------------|
| `-V, --version` | Print version number |
| `--cwd <path>` | Set working directory path (default: current directory) |
| `--json` | Force JSON output format (default: true) |
| `-h, --help` | Show help |

## Command Overview

| Category | Command | Description |
|----------|---------|-------------|
| State | `state` | Run state (run.json) and checkpoint management |
| Mission | `mission` | Create missions, write and read specs/design briefs |
| Task | `task` | Create tasks, transition states, manage records, validate |
| Evidence | `evidence` | Create and read role-based evidence files |
| Event | `event` | Append entries to the event ledger (JSONL) |
| Lock | `lock` | Acquire, release, and list locks for concurrency control |
| Debt | `debt` | Register, resolve, and list technical debt items |
| Memory | `memory` | Manage rules file and agent memory notes |
| Context | `context` | Write context packets |
| Recovery | `recovery` | Write recovery packets |
| Phase | `phase` | Write and read phase reviews |
| Decision | `decision` | Write, read, and list decision records |
| Health | `health` | Generate and read project health checks |
| Evolution | `evolution` | Write gap assessments and rules update artifacts |
| Packet | `packet` | Create and read context packets |
| Schema | `schema` | List schema types and generate templates |

---

## state -- Run State Management

Manages the run state (`run.json`) and checkpoints.

### Subcommands

| Command | Description |
|---------|-------------|
| `init` | Create `.geas/` directory structure and initial `run.json` |
| `read` | Read current run state |
| `update` | Atomically update `run.json` fields |
| `checkpoint` | Set or clear checkpoints |
| `session-update` | Write `session-latest.md` |

### state init

Creates the `.geas/` directory structure and writes the initial `run.json`.

```
geas state init
```

**Options:** None

**Usage example:**
```bash
geas state init
```

### state read

Reads and outputs the current run state (`run.json`).

```
geas state read
```

**Options:** None

**Usage example:**
```bash
geas state read
```

### state update

Atomically updates a specific field in `run.json`.

```
geas state update --field <field> --value <value>
```

| Option | Required | Description |
|--------|----------|-------------|
| `--field <field>` | Yes | Field name to update |
| `--value <value>` | Yes | New value (JSON parsing attempted) |

**Usage example:**
```bash
geas state update --field current_phase --value specifying
```

### state checkpoint set

Sets a checkpoint in `run.json`.

```
geas state checkpoint set [options]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--step <step>` | Yes | Pipeline step name |
| `--agent <agent>` | Yes | Currently active agent |
| `--retry-count <n>` | No | Retry count (default: 0) |
| `--batch <tasks>` | No | Parallel batch task IDs (comma-separated) |

**Usage example:**
```bash
geas state checkpoint set --step implementation --agent software-engineer --retry-count 0
```

### state checkpoint clear

Removes the checkpoint from `run.json`.

```
geas state checkpoint clear
```

**Options:** None

**Usage example:**
```bash
geas state checkpoint clear
```

### state session-update

Writes the `session-latest.md` file to record the current session state.

```
geas state session-update [options]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--phase <phase>` | No | Current phase |
| `--task <task>` | No | Current task ID |
| `--step <step>` | No | Current pipeline step |
| `--summary <text>` | No | Summary text |

**Usage example:**
```bash
geas state session-update --phase building --task task-001 --step implementation --summary "Feature implementation in progress"
```

---

## mission -- Mission Management

Creates mission directories, and writes and reads specs and design briefs.

### Subcommands

| Command | Description |
|---------|-------------|
| `create` | Create mission directory and subdirectory structure |
| `write-spec` | Write mission spec (spec.json) |
| `write-brief` | Write design brief (design-brief.json) |
| `read` | Read mission artifacts |

### mission create

Creates a mission directory with its full subdirectory structure. If `--id` is omitted, an ID is automatically assigned.

```
geas mission create [--id <mission-id>]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--id <mission-id>` | No | Mission identifier (auto-generated if omitted) |

**Usage example:**
```bash
geas mission create --id mission-001
```

### mission write-spec

Writes `spec.json` after schema validation. JSON data is passed via stdin.

```
geas mission write-spec --id <mission-id> [--dry-run]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--id <mission-id>` | Yes | Mission identifier |
| `--dry-run` | No | Validate only without writing files |

**Usage example:**
```bash
echo '{"title":"CLI improvements","objective":"Improve usability","success_criteria":["50% response time improvement"]}' | geas mission write-spec --id mission-001
```

### mission write-brief

Writes `design-brief.json` after schema validation. JSON data is passed via stdin.

```
geas mission write-brief --id <mission-id> [--dry-run]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--id <mission-id>` | Yes | Mission identifier |
| `--dry-run` | No | Validate only without writing files |

**Usage example:**
```bash
echo '{"approach":"Incremental refactoring","constraints":["Maintain backward compatibility"]}' | geas mission write-brief --id mission-001
```

### mission read

Reads and outputs mission artifacts (spec.json, design-brief.json, or both).

```
geas mission read --id <mission-id> [--artifact <type>]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--id <mission-id>` | Yes | Mission identifier |
| `--artifact <type>` | No | Artifact to read: `spec`, `brief` (reads both if omitted) |

**Usage example:**
```bash
geas mission read --id mission-001 --artifact spec
```

---

## task -- Task Management

Manages the full task lifecycle: creation, state transitions, execution records, and artifact validation.

### Subcommands

| Command | Description |
|---------|-------------|
| `create` | Create a task contract with schema validation |
| `transition` | Validate and apply task state transitions |
| `advance` | Automatically advance to the next state in the default chain |
| `read` | Read a task contract |
| `list` | List all tasks |
| `record add` | Add a section to the execution record (record.json) |
| `record get` | Read the execution record |
| `resolve` | Resolve a task (atomic bundle: transition + event log + lock release) |
| `harvest-memory` | Batch-extract memory suggestions from evidence |
| `check-artifacts` | Verify required artifacts exist for a pipeline step |
| `closure-assemble` | Assemble a closure packet (includes forbidden-pass pre-check) |
| `revalidate` | Check task freshness against current HEAD and classify drift |
| `retrospective-draft` | Generate structured retrospective JSON from evidence and record sections |

### task create

Creates a task contract with schema validation. JSON data is passed via stdin.

```
geas task create [--mission <mission-id>] [--dry-run]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--mission <mission-id>` | No | Mission identifier (auto-resolved from run.json) |
| `--dry-run` | No | Validate only without writing files |

**Usage example:**
```bash
echo '{"id":"task-001","title":"Implement user authentication","priority":"high","acceptance_criteria":["Issue token on successful login"]}' | geas task create
```

### task transition

Validates and applies a task state transition. Transition guards run automatically.

```
geas task transition --id <task-id> --to <status> [--mission <mission-id>]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--mission <mission-id>` | No | Mission identifier (auto-resolved from run.json) |
| `--id <task-id>` | Yes | Task identifier |
| `--to <status>` | Yes | Target state |

**Usage example:**
```bash
geas task transition --id task-001 --to ready
```

### task advance

Advances a task to the next state in the default chain. Runs guard pre-checks.

```
geas task advance --id <task-id> [--mission <mission-id>]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--mission <mission-id>` | No | Mission identifier (auto-resolved from run.json) |
| `--id <task-id>` | Yes | Task identifier |

**Usage example:**
```bash
geas task advance --id task-001
```

### task read

Reads and outputs a task contract.

```
geas task read --id <task-id> [--mission <mission-id>]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--mission <mission-id>` | No | Mission identifier (auto-resolved from run.json) |
| `--id <task-id>` | Yes | Task identifier |

**Usage example:**
```bash
geas task read --id task-001
```

### task list

Lists the ID, title, and status of all tasks in a mission.

```
geas task list [--mission <mission-id>]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--mission <mission-id>` | No | Mission identifier (auto-resolved from run.json) |

**Usage example:**
```bash
geas task list
```

### task record add

Adds or overwrites a section in the execution record (`record.json`). JSON data is passed via stdin or `--set`.

```
geas task record add --task <task-id> --section <name> [options]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--mission <mission-id>` | No | Mission identifier (auto-resolved from run.json) |
| `--task <task-id>` | Yes | Task identifier |
| `--section <name>` | Yes | Section name: `implementation_contract`, `self_check`, `gate_result`, `challenge_review`, `verdict`, `closure`, `retrospective` |
| `--set <key=value>` | No | Set individual fields (repeatable) |
| `--dry-run` | No | Validate only without writing files |

**Usage example:**
```bash
geas task record add --task task-001 --section self_check \
  --set "summary=Unit tests verified passing" \
  --set "verdict=pass"
```

### task record get

Reads the execution record (`record.json`) in full or a specific section.

```
geas task record get --task <task-id> [--section <name>] [--mission <mission-id>]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--mission <mission-id>` | No | Mission identifier (auto-resolved from run.json) |
| `--task <task-id>` | Yes | Task identifier |
| `--section <name>` | No | Section name (reads full record if omitted) |

**Usage example:**
```bash
geas task record get --task task-001 --section gate_result
```

### task resolve

Resolves a task. Atomically performs state transition, event logging, and lock release.

```
geas task resolve --id <task-id> --verdict <verdict> [--mission <mission-id>]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--mission <mission-id>` | No | Mission identifier (auto-resolved from run.json) |
| `--id <task-id>` | Yes | Task identifier |
| `--verdict <verdict>` | Yes | Resolution verdict: `pass`, `cancel`, `escalate` |

**Usage example:**
```bash
geas task resolve --id task-001 --verdict pass
```

### task harvest-memory

Batch-extracts `memory_suggestions` from task evidence and writes them as agent memory notes.

```
geas task harvest-memory --id <task-id> [--mission <mission-id>]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--id <task-id>` | Yes | Task identifier |
| `--mission <mission-id>` | No | Mission identifier (auto-resolved from run.json) |

**Usage example:**
```bash
geas task harvest-memory --id task-001
```

### task check-artifacts

Verifies that the required artifacts for a pipeline step exist and are valid.

```
geas task check-artifacts --id <task-id> --step <step> [--mission <mission-id>]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--mission <mission-id>` | No | Mission identifier (auto-resolved from run.json) |
| `--id <task-id>` | Yes | Task identifier |
| `--step <step>` | Yes | Pipeline step: `implementation_contract`, `implementation`, `self_check`, `specialist_review`, `testing`, `gate_result`, `closure`, `challenge_review`, `verdict`, `retrospective` |

**Usage example:**
```bash
geas task check-artifacts --id task-001 --step gate_result
```

### task closure-assemble

Assembles a closure packet. Runs a forbidden-pass pre-check and blocks if requirements are not met.

```
geas task closure-assemble --id <task-id> [--write] [--mission <mission-id>]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--mission <mission-id>` | No | Mission identifier (auto-resolved from run.json) |
| `--id <task-id>` | Yes | Task identifier |
| `--write` | No | Write result directly to `record.json` instead of stdout |

**Usage example:**
```bash
geas task closure-assemble --id task-001 --write
```

### task revalidate

Checks task freshness against the current Git HEAD and classifies any drift.

```
geas task revalidate --id <task-id> [--mission <mission-id>]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--mission <mission-id>` | No | Mission identifier (auto-resolved from run.json) |
| `--id <task-id>` | Yes | Task identifier |

**Usage example:**
```bash
geas task revalidate --id task-001
```

### task retrospective-draft

Generates structured retrospective JSON from evidence files and record sections.

```
geas task retrospective-draft --id <task-id> [--mission <mission-id>]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--mission <mission-id>` | No | Mission identifier (auto-resolved from run.json) |
| `--id <task-id>` | Yes | Task identifier |

**Usage example:**
```bash
geas task retrospective-draft --id task-001
```

---

## evidence -- Evidence Management

Creates and reads role-based evidence files. Supports distinct evidence structures for each role (implementer, reviewer, tester, authority).

### Subcommands

| Command | Description |
|---------|-------------|
| `add` | Create or overwrite a role-based evidence file |
| `read` | Read task evidence |

### evidence add

Creates or overwrites a role-based evidence file. JSON data is passed via stdin or `--set`.

```
geas evidence add [options]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--mission <mid>` | No | Mission identifier (auto-resolved from run.json) |
| `--task <tid>` | Conditional | Task identifier (required when `--phase` is not used) |
| `--phase <phase>` | Conditional | Phase name for mission-level evidence (`polishing`, `evolving`) |
| `--agent <name>` | Yes | Agent name (used as filename) |
| `--role <role>` | Yes | Agent role: `implementer`, `reviewer`, `tester`, `authority` |
| `--set <key=value>` | No | Set individual fields (repeatable) |
| `--dry-run` | No | Validate only without writing files |

**Usage example:**
```bash
geas evidence add --task task-001 --agent software-engineer --role implementer \
  --set "summary=Completed user authentication module" \
  --set "files_changed=[\"src/auth.ts\",\"src/auth.test.ts\"]"
```

### evidence read

Reads evidence files for a task. Can retrieve a specific agent's evidence or all evidence.

```
geas evidence read --task <tid> [--agent <name>] [--mission <mid>]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--mission <mid>` | No | Mission identifier (auto-resolved from run.json) |
| `--task <tid>` | Yes | Task identifier |
| `--agent <name>` | No | Agent name (lists all if omitted) |

**Usage example:**
```bash
geas evidence read --task task-001 --agent software-engineer
```

---

## event -- Event Management

Appends events to the event ledger (`events.jsonl`).

### Subcommands

| Command | Description |
|---------|-------------|
| `log` | Append an entry to the event ledger |

### event log

Appends an event to `events.jsonl`.

```
geas event log [options]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--type <type>` | Yes | Event type (e.g., `step_complete`, `task_start`) |
| `--task <id>` | No | Related task ID |
| `--agent <agent>` | No | Agent that generated the event |
| `--data <json>` | No | Additional data (JSON string) |
| `--message <text>` | No | Human-readable message |
| `--update-checkpoint` | No | Also update `run.json` checkpoint (`step_complete` only) |

**Usage example:**
```bash
geas event log --type step_complete --task task-001 --agent software-engineer \
  --message "Implementation step completed" --update-checkpoint
```

---

## lock -- Lock Management

Acquires, releases, and lists locks for concurrency control. Prevents multiple tasks from conflicting on the same resource.

### Subcommands

| Command | Description |
|---------|-------------|
| `acquire` | Acquire a lock for a task |
| `release` | Release all locks held by a task |
| `list` | List active locks |
| `cleanup` | Remove orphaned locks from invalid sessions |

### lock acquire

Acquires a lock for a task.

```
geas lock acquire --task <id> --type <type> --targets <targets> --session <id>
```

| Option | Required | Description |
|--------|----------|-------------|
| `--task <id>` | Yes | Task ID requesting the lock |
| `--type <type>` | Yes | Lock type: `path`, `interface`, `resource`, `integration` |
| `--targets <targets>` | Yes | Lock targets (comma-separated) |
| `--session <id>` | Yes | Session ID |

**Usage example:**
```bash
geas lock acquire --task task-001 --type path --targets "src/auth.ts,src/auth.test.ts" --session session-abc123
```

### lock release

Releases all locks held by a task.

```
geas lock release --task <id>
```

| Option | Required | Description |
|--------|----------|-------------|
| `--task <id>` | Yes | Task ID whose locks to release |

**Usage example:**
```bash
geas lock release --task task-001
```

### lock list

Lists active locks. Can filter by task ID or lock type.

```
geas lock list [--task <id>] [--type <type>]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--task <id>` | No | Filter by task ID |
| `--type <type>` | No | Filter by lock type |

**Usage example:**
```bash
geas lock list --type path
```

### lock cleanup

Removes orphaned locks from sessions that no longer exist.

```
geas lock cleanup --session <id>
```

| Option | Required | Description |
|--------|----------|-------------|
| `--session <id>` | Yes | Currently valid session ID |

**Usage example:**
```bash
geas lock cleanup --session session-abc123
```

---

## debt -- Technical Debt Management

Registers, resolves, and lists technical debt items. Supports automatic ID assignment and duplicate detection.

### Subcommands

| Command | Description |
|---------|-------------|
| `add` | Add a debt item (auto-ID, duplicate detection) |
| `resolve` | Mark a debt item as resolved |
| `list` | List debt items (with filters) |

### debt add

Adds an item to the debt register. IDs are auto-generated and duplicate detection is applied.

```
geas debt add --mission <mid> --title <title> --severity <severity> --kind <kind> [options]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--mission <mid>` | Yes | Mission identifier |
| `--title <title>` | Yes | Debt item title |
| `--severity <severity>` | Yes | Severity: `low`, `normal`, `high`, `critical` |
| `--kind <kind>` | Yes | Kind: `output_quality`, `verification_gap`, `structural`, `risk`, `process`, `documentation`, `operations` |
| `--task <tid>` | No | Task that generated the debt |
| `--owner <owner>` | No | Responsible agent type |
| `--description <desc>` | No | Detailed description (default: empty string) |

**Usage example:**
```bash
geas debt add --mission mission-001 --title "Insufficient auth error handling" \
  --severity high --kind output_quality --task task-001 \
  --description "Missing proper error message on token expiration"
```

### debt resolve

Marks a debt item as resolved and updates the rollup.

```
geas debt resolve --mission <mid> --id <debt-id>
```

| Option | Required | Description |
|--------|----------|-------------|
| `--mission <mid>` | Yes | Mission identifier |
| `--id <debt-id>` | Yes | Debt item ID (e.g., `DEBT-001`) |

**Usage example:**
```bash
geas debt resolve --mission mission-001 --id DEBT-001
```

### debt list

Lists debt items. Can filter by status or severity.

```
geas debt list --mission <mid> [--status <status>] [--severity <severity>]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--mission <mid>` | Yes | Mission identifier |
| `--status <status>` | No | Status filter: `open`, `resolved`, `accepted`, `scheduled`, `dropped` |
| `--severity <severity>` | No | Severity filter: `low`, `normal`, `high`, `critical` |

**Usage example:**
```bash
geas debt list --mission mission-001 --status open --severity high
```

---

## memory -- Memory Management

Manages the rules file (`rules.md`) and per-agent memory notes. This is the core mechanism for persisting learning across sessions.

### Subcommands

| Command | Description |
|---------|-------------|
| `init-rules` | Create initial `rules.md` |
| `agent-note` | Add a note to an agent's memory file |
| `read` | Read agent memory notes or `rules.md` |

### memory init-rules

Creates `.geas/rules.md` with initial agent rules content.

```
geas memory init-rules [--code-section <text>]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--code-section <text>` | No | Content to add to the Code section |

**Usage example:**
```bash
geas memory init-rules --code-section "TypeScript strict mode required"
```

### memory agent-note

Adds a note to an agent's memory file (`memory/agents/{agent}.md`).

```
geas memory agent-note --agent <name> --add <text>
```

| Option | Required | Description |
|--------|----------|-------------|
| `--agent <name>` | Yes | Agent type name (e.g., `software-engineer`) |
| `--add <text>` | Yes | Note text to add |

**Usage example:**
```bash
geas memory agent-note --agent software-engineer --add "This project uses Zod schema validation as standard"
```

### memory read

Reads an agent's memory notes or `rules.md`.

```
geas memory read [--agent <name>]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--agent <name>` | No | Agent name (reads `rules.md` if omitted) |

**Usage example:**
```bash
geas memory read --agent software-engineer
```

---

## context -- Context Packets

Writes context packet files.

### Subcommands

| Command | Description |
|---------|-------------|
| `write` | Write a context packet file |

### context write

Writes a context packet file.

```
geas context write --mission <mid> --task <tid> --agent <name> --data <content>
```

| Option | Required | Description |
|--------|----------|-------------|
| `--mission <mid>` | Yes | Mission ID |
| `--task <tid>` | Yes | Task ID |
| `--agent <name>` | Yes | Agent type name (used as filename) |
| `--data <content>` | Yes | Packet content (string or JSON) |

**Usage example:**
```bash
geas context write --mission mission-001 --task task-001 --agent software-engineer \
  --data "Implementation note: API responses must use JSON format"
```

---

## recovery -- Recovery Management

Writes recovery packets for session recovery.

### Subcommands

| Command | Description |
|---------|-------------|
| `write` | Write a recovery packet |

### recovery write

Writes a recovery packet. JSON data is passed via stdin.

```
geas recovery write [--dry-run]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--dry-run` | No | Validate only without writing files |

**Usage example:**
```bash
echo '{"session_id":"session-001","reason":"Recovery after abnormal termination"}' | geas recovery write
```

---

## phase -- Phase Reviews

Writes and reads phase reviews.

### Subcommands

| Command | Description |
|---------|-------------|
| `write` | Write a phase review |
| `read-latest` | Read the latest review for a specific phase |

### phase write

Writes a phase review. JSON data is passed via stdin.

```
geas phase write --mission <mid> [--dry-run]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--mission <mid>` | Yes | Mission ID |
| `--dry-run` | No | Validate only without writing files |

**Usage example:**
```bash
echo '{"phase":"building","verdict":"pass","summary":"All tasks completed"}' | geas phase write --mission mission-001
```

### phase read-latest

Reads the most recent review for a specific phase.

```
geas phase read-latest --mission <mid> --phase <phase>
```

| Option | Required | Description |
|--------|----------|-------------|
| `--mission <mid>` | Yes | Mission ID |
| `--phase <phase>` | Yes | Phase name |

**Usage example:**
```bash
geas phase read-latest --mission mission-001 --phase building
```

---

## decision -- Decision Records

Writes, reads, and lists decision records.

### Subcommands

| Command | Description |
|---------|-------------|
| `write` | Write a decision record |
| `read` | Read a decision record |
| `list` | List all decision records for a mission |

### decision write

Writes a decision record. JSON data is passed via stdin.

```
geas decision write --mission <mid> [--dry-run]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--mission <mid>` | Yes | Mission identifier |
| `--dry-run` | No | Validate only without writing files |

**Usage example:**
```bash
echo '{"id":"DEC-001","title":"Authentication method selection","decision":"Adopt JWT token approach","rationale":"Scalability and stateless maintenance"}' | geas decision write --mission mission-001
```

### decision read

Reads a decision record by ID.

```
geas decision read --mission <mid> --id <dec-id>
```

| Option | Required | Description |
|--------|----------|-------------|
| `--mission <mid>` | Yes | Mission identifier |
| `--id <dec-id>` | Yes | Decision record ID |

**Usage example:**
```bash
geas decision read --mission mission-001 --id DEC-001
```

### decision list

Lists all decision records for a mission.

```
geas decision list --mission <mid>
```

| Option | Required | Description |
|--------|----------|-------------|
| `--mission <mid>` | Yes | Mission identifier |

**Usage example:**
```bash
geas decision list --mission mission-001
```

---

## health -- Health Check

Diagnoses project health and generates/reads `health-check.json`.

### Subcommands

| Command | Description |
|---------|-------------|
| `generate` | Generate `health-check.json` from current state |
| `read` | Read current `health-check.json` |

### health generate

Analyzes the current project state and generates `health-check.json`.

```
geas health generate
```

**Options:** None

**Usage example:**
```bash
geas health generate
```

### health read

Reads and outputs the current `health-check.json`.

```
geas health read
```

**Options:** None

**Usage example:**
```bash
geas health read
```

---

## evolution -- Evolution Phase Artifacts

Writes gap assessments and rules update artifacts for the Evolving phase.

### Subcommands

| Command | Description |
|---------|-------------|
| `gap-assessment` | Write a gap assessment for a mission phase |
| `rules-update` | Write a rules update artifact |

### evolution gap-assessment

Writes a gap assessment for a mission phase. JSON data is passed via stdin.

```
geas evolution gap-assessment --mission <mid> --phase <phase> [--dry-run]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--mission <mid>` | Yes | Mission identifier |
| `--phase <phase>` | Yes | Mission phase (e.g., `building`, `polishing`, `evolving`) |
| `--dry-run` | No | Validate only without writing files |

**Usage example:**
```bash
echo '{"gaps":[{"area":"Test coverage","severity":"high","description":"Missing integration tests"}]}' | geas evolution gap-assessment --mission mission-001 --phase building
```

### evolution rules-update

Writes a rules update artifact for a mission. JSON data is passed via stdin.

```
geas evolution rules-update --mission <mid> [--dry-run]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--mission <mid>` | Yes | Mission identifier |
| `--dry-run` | No | Validate only without writing files |

**Usage example:**
```bash
echo '{"rules_added":["Integration tests required"],"rules_removed":[]}' | geas evolution rules-update --mission mission-001
```

---

## packet -- Context Packet Management

Creates and reads context packet markdown files.

### Subcommands

| Command | Description |
|---------|-------------|
| `create` | Create a context packet markdown file |
| `read` | Read a context packet |

### packet create

Creates a context packet markdown file. Content can be provided inline or read from a file.

```
geas packet create --task <tid> --agent <name> [options]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--mission <mid>` | No | Mission identifier (auto-resolved from run.json) |
| `--task <tid>` | Yes | Task identifier |
| `--agent <name>` | Yes | Agent name (used as filename) |
| `--content <text>` | Conditional | Markdown content (inline) |
| `--file <path>` | Conditional | Read content from a markdown file path |

**Usage example:**
```bash
geas packet create --task task-001 --agent software-engineer \
  --content "## Implementation Context\n\nAuth module uses JWT-based implementation."
```

### packet read

Reads and outputs a context packet.

```
geas packet read --task <tid> --agent <name> [--mission <mid>]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--mission <mid>` | No | Mission identifier (auto-resolved from run.json) |
| `--task <tid>` | Yes | Task identifier |
| `--agent <name>` | Yes | Agent name |

**Usage example:**
```bash
geas packet read --task task-001 --agent software-engineer
```

---

## schema -- Schema Utilities

Lists available schema types and generates JSON templates.

### Subcommands

| Command | Description |
|---------|-------------|
| `list` | List all available schema types |
| `template` | Generate a fill-in JSON template for a schema type |
| `sections` | List valid record section names |

### schema list

Lists all available schema types.

```
geas schema list
```

**Options:** None

**Usage example:**
```bash
geas schema list
```

### schema template

Generates a fill-in JSON template for a schema type. For evidence schemas, use `--role` to get role-specific fields.

```
geas schema template <type> [options]
```

| Option | Required | Description |
|--------|----------|-------------|
| `<type>` | Yes | Schema type (positional argument) |
| `--role <role>` | No | Role variant (evidence schema only) |
| `--strip-envelope` | No | Remove envelope fields auto-injected by CLI (default: true) |
| `--no-strip-envelope` | No | Keep auto-injected envelope fields |
| `--section <name>` | No | Extract record section sub-schema |
| `--pretty` | No | Pretty-print JSON output (default: false) |

**Usage example:**
```bash
# Generate task contract template
geas schema template task-contract --pretty

# Generate implementer role evidence template
geas schema template evidence --role implementer --pretty

# Generate record self_check section template
geas schema template record --section self_check --pretty
```

### schema sections

Lists valid record section names.

```
geas schema sections
```

**Options:** None

**Usage example:**
```bash
geas schema sections
```
