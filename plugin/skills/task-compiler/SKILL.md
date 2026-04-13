---
name: task-compiler
description: Compile a user story into a TaskContract — a machine-readable work agreement with verifiable acceptance criteria, scope boundaries, and eval commands.
---

# Task Compiler

Transforms a user story (or feature description) into a structured TaskContract that workers execute against.

## When to Use

Invoked during:
- **4-phase mission**: after Specifying creates issues, compile each into a TaskContract
- **Lightweight mission**: compile the single feature into a TaskContract

## Inputs

You need these before compiling:

1. **User story or feature description** — what needs to be built
2. **Mission spec** — read from `.geas/missions/{mission_id}/spec.json` for mission-level context
3. **Design-brief** — read from `.geas/missions/{mission_id}/design-brief.json` for approach context and architecture decisions
4. **Architecture context** — from `.geas/rules.md`
5. **Existing task contracts** — check `.geas/missions/{mission_id}/tasks/` for dependencies

## Compilation Process

### Step 1: Determine Task Identity

- Generate a sequential ID: `task-001`, `task-002`, etc.
- Check `.geas/missions/{mission_id}/tasks/` for existing contracts to avoid ID collision
- Title should be actionable: "[Backend] User authentication API", "[Frontend] Login form"

### Step 2: Classify the Task

Determine the four classification fields based on the task nature:

**`task_kind`** — what type of work this is:

| Signal | task_kind |
|--------|-----------|
| Writing or modifying application code | `implementation` |
| Writing documentation, README, guides | `documentation` |
| CI/CD, environment, infrastructure files | `configuration` |
| UI/UX wireframes, design specs | `design` |
| Security review, code audit, compliance check | `review` |
| Research, data gathering, feasibility study | `analysis` |
| Version bump, changelog, deployment | `delivery` |

**`risk_level`** — how much damage a failure could cause:

| Signal | risk_level |
|--------|-----------|
| Isolated change, easy to revert | `low` |
| Normal feature work | `normal` |
| Touches auth, payments, shared infra, or cross-module | `high` |
| Data migration, security-critical, or breaking API change | `critical` |

#### Risk Signals

- `low`: Isolated change, single file, no dependencies, easily reversible
- `normal`: Multi-file change within existing architecture
- `high`: Architecture change, schema migration, public API change, or refactoring that touches >50% of source files
- `critical`: Data migration, security-sensitive, or irreversible change

**`gate_profile`** — what verification strategy applies:

| Signal | gate_profile |
|--------|-------------|
| Produces implementation that must build/test/lint | `implementation_change` |
| Produces docs, designs, or config only (no build) | `artifact_only` |
| Wrap-up task: changelog, release notes, final packaging | `closure_ready` |

**`vote_round_policy`** — when to trigger a vote round:

| Signal | vote_round_policy |
|--------|-------------------|
| Routine work, clear requirements | `never` |
| Ambiguous scope or multiple valid approaches | `auto` |
| Architecture decision, breaking change, or cross-team impact | `always` |

#### Decision Tree

1. Does the task involve architecture decisions (new patterns, stack changes, structural reorganization)? → `always`
2. Does the task touch 3+ files with cross-cutting changes? → `auto`
3. Is it a focused change within existing patterns? → `never`

When in doubt, prefer `auto` over `never`.

### Step 3: Define the Goal

Write a single sentence stating the verifiable outcome.
- Good: "Create a REST API endpoint POST /api/auth/login that accepts email+password and returns a JWT"
- Bad: "Implement authentication" (too vague to verify)

### Step 4: Define Routing

Assign a primary worker type and required reviewer types using the agentType enum.

| Task Nature | primary_worker_type | required_reviewer_types |
|-------------|-------------------|------------------------|
| Frontend UI | `software-engineer` | `design-authority`, `qa-engineer` |
| Backend API / Database | `software-engineer` | `design-authority`, `qa-engineer` |
| Design spec | `technical-writer` | `design-authority` |
| DevOps / deployment | `platform-engineer` | `design-authority`, `security-engineer` |
| Documentation | `technical-writer` | `design-authority` |
| Full-stack feature | `software-engineer` (primary) | `design-authority`, `qa-engineer` |
| Security audit | `security-engineer` | `design-authority`, `qa-engineer` |

Always include at least one reviewer type. For `high` or `critical` risk_level, add `security-engineer` to required_reviewer_types if not already present.

### Step 5: Define Scope

Define the paths the task IS allowed to touch (allowlist):
- **`scope.surfaces`**: files and directories the worker may create or modify
  - Be specific: `src/components/auth/`, `src/api/auth/`, `tests/auth/`
  - Include test directories relevant to the task
  - Do NOT include `.geas/`, `plugin/`, or unrelated modules

Workers must not modify files outside `scope.surfaces`. Scope compliance is verified during code review and evidence gate.

### Step 6: Define Acceptance Criteria

Inherit from the mission spec and refine for this specific task:
- Each criterion must be verifiable (yes/no answer)
- Minimum 3 criteria per task
- Include functional, edge case, and integration criteria

Example:
```json
[
  "POST /api/auth/login returns 200 with valid JWT for correct credentials",
  "POST /api/auth/login returns 401 for incorrect password",
  "JWT contains user ID and email in payload",
  "Password is never logged or returned in responses"
]
```

### Step 7: Set Eval Commands

Read build/lint/test commands from `.geas/rules.md`. If rules.md has a Build Commands or Code section, use those exact commands.

If rules.md has no build commands, detect from the project's configuration files (package.json scripts, Makefile targets, pyproject.toml tool sections, etc.) and set appropriate commands.

If no commands are configured yet, set eval_commands to what the project should have based on its stack — the implementation worker will configure them.

### Step 8: Set Retry Budget

Determine the initial retry_budget from the gate_profile:

| gate_profile | initial retry_budget |
|-------------|---------------------|
| `implementation_change` | 3 |
| `artifact_only` | 3 |
| `closure_ready` | 2 |

Then apply risk_level adjustment:
- `high`: reduce by 1
- `critical`: reduce by 1
- Minimum value is always **1**

Examples:
- `implementation_change` + `normal` = 3
- `implementation_change` + `high` = 2
- `closure_ready` + `critical` = 1

### Step 9: Check Dependencies

Look at existing TaskContracts in `.geas/missions/{mission_id}/tasks/`:
- If this task needs another task's output (e.g., frontend needs backend API) → add to `dependencies`
- If this task blocks others → note for scheduling

### Step 10: Capture Base Snapshot

Run `git rev-parse HEAD` to get the current commit hash. Record this as `base_snapshot`. This anchors the task to a known repository state and is used for staleness detection during integration.

### Step 11: Generate Rubric

Assign quality rubric dimensions based on task type. Every task gets the base dimensions; UI tasks get additional ones.

**Base dimensions (all tasks):**

| Dimension | Default Threshold |
|-----------|-------------------|
| `core_interaction` | 3 |
| `output_completeness` | 4 |
| `output_quality` | 4 |
| `regression_safety` | 4 |

**Additional dimensions (when `primary_worker_type` is `implementer` with UI focus or `communication_specialist`, or task has UI component):**

| Dimension | Default Threshold |
|-----------|-------------------|
| `ux_clarity` | 3 |
| `visual_coherence` | 3 |

Write the rubric as an object with a `dimensions` array. The orchestration-authority or the user may adjust thresholds for specific tasks.

## Output

Write the TaskContract via CLI (the CLI creates the tasks directory automatically and enforces schema validation):
```bash
Bash("geas task create --mission {mission_id} <<'EOF'\n<task_contract_json>\nEOF")
```

Envelope fields (`version`, `artifact_type`, `artifact_id`, `producer_type`, `created_at`) are auto-injected by the CLI — agents only need to provide the content fields below. Run `geas schema template task-contract` for the full template.

Example output (content fields only — envelope is auto-injected):
```json
{
  "task_id": "task-003",
  "title": "[Frontend] Login form with email/password",
  "goal": "Create a login form component that submits to POST /api/auth/login and handles success/error states",
  "task_kind": "implementation",
  "risk_level": "normal",
  "gate_profile": "implementation_change",
  "vote_round_policy": "never",
  "acceptance_criteria": [
    "Login form renders with email and password fields",
    "Form validates email format before submission",
    "Successful login redirects to dashboard",
    "Failed login shows error message without exposing server details",
    "Form is accessible (labels, focus management, aria attributes)"
  ],
  "eval_commands": ["{build command from conventions}", "{lint command}", "{test command}"],
  "rubric": {
    "dimensions": [
      { "name": "core_interaction", "threshold": 3 },
      { "name": "output_completeness", "threshold": 4 },
      { "name": "output_quality", "threshold": 4 },
      { "name": "regression_safety", "threshold": 4 },
      { "name": "ux_clarity", "threshold": 3 },
      { "name": "visual_coherence", "threshold": 3 }
    ]
  },
  "retry_budget": 3,
  "scope": {
    "surfaces": ["src/components/auth/", "src/styles/auth/", "tests/components/auth/"]
  },
  "routing": {
    "primary_worker_type": "software-engineer",
    "required_reviewer_types": ["design-authority", "qa-engineer"]
  },
  "base_snapshot": "a1b2c3d4e5f6...",
  "status": "drafted"
}
```

After writing, log the event via CLI:
```bash
Bash("geas event log --type task_compiled --task task-003 --data '{\"title\":\"[Frontend] Login form\"}'")
```
