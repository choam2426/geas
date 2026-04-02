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
2. **Seed spec** — read from `.geas/spec/seed.json` for mission-level context
3. **Architecture context** — from `.geas/memory/_project/conventions.md`
4. **Existing task contracts** — check `.geas/tasks/` for dependencies

## Compilation Process

### Step 1: Determine Task Identity

- Generate a sequential ID: `task-001`, `task-002`, etc.
- Check `.geas/tasks/` for existing contracts to avoid ID collision
- Title should be actionable: "[Backend] User authentication API", "[Frontend] Login form"

### Step 2: Classify the Task

Determine the four classification fields based on the task nature:

**`task_kind`** — what type of work this is:

| Signal | task_kind |
|--------|-----------|
| Writing or modifying application code | `code` |
| Writing documentation, README, guides | `docs` |
| CI/CD, environment, infrastructure files | `config` |
| UI/UX wireframes, design specs | `design` |
| Security review, code audit, compliance check | `audit` |
| Version bump, changelog, deployment | `release` |

**`risk_level`** — how much damage a failure could cause:

| Signal | risk_level |
|--------|-----------|
| Isolated change, easy to revert | `low` |
| Normal feature work | `normal` |
| Touches auth, payments, shared infra, or cross-module | `high` |
| Data migration, security-critical, or breaking API change | `critical` |

**`gate_profile`** — what verification strategy applies:

| Signal | gate_profile |
|--------|-------------|
| Produces code that must build/test/lint | `code_change` |
| Produces docs, designs, or config only (no build) | `artifact_only` |
| Wrap-up task: changelog, release notes, final packaging | `closure_ready` |

**`vote_round_policy`** — when to trigger a vote round:

| Signal | vote_round_policy |
|--------|-------------------|
| Routine work, clear requirements | `never` |
| Ambiguous scope or multiple valid approaches | `auto` |
| Architecture decision, breaking change, or cross-team impact | `always` |

### Step 3: Define the Goal

Write a single sentence stating the verifiable outcome.
- Good: "Create a REST API endpoint POST /api/auth/login that accepts email+password and returns a JWT"
- Bad: "Implement authentication" (too vague to verify)

### Step 4: Define Routing

Assign a primary worker type and required reviewer types using the agentType enum.

| Task Nature | primary_worker_type | required_reviewer_types |
|-------------|-------------------|------------------------|
| Frontend UI | `frontend_engineer` | `architecture_authority`, `qa_engineer` |
| Backend API / Database | `backend_engineer` | `architecture_authority`, `qa_engineer` |
| Design spec | `ui_ux_designer` | `architecture_authority` |
| DevOps / deployment | `devops_engineer` | `architecture_authority`, `security_engineer` |
| Documentation | `technical_writer` | `architecture_authority` |
| Full-stack feature | `frontend_engineer` or `backend_engineer` (primary) | `architecture_authority`, `qa_engineer` |
| Security audit | `security_engineer` | `architecture_authority`, `qa_engineer` |

Always include at least one reviewer type. For `high` or `critical` risk_level, add `security_engineer` to required_reviewer_types if not already present.

### Step 5: Define Scope

Define the paths the task IS allowed to touch (allowlist):
- **`scope.paths`**: files and directories the worker may create or modify
  - Be specific: `src/components/auth/`, `src/api/auth/`, `tests/auth/`
  - Include test directories relevant to the task
  - Do NOT include `.geas/`, `plugin/`, or unrelated modules

Workers must not modify files outside `scope.paths`. Scope compliance is verified during code review and evidence gate.

### Step 6: Define Acceptance Criteria

Inherit from the seed spec and refine for this specific task:
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

Read build/lint/test commands from `.geas/memory/_project/conventions.md`. If the conventions file has a Build Commands section, use those exact commands.

If no conventions file exists, detect from the project's configuration files (package.json scripts, Makefile targets, pyproject.toml tool sections, etc.) and set appropriate commands.

If no commands are configured yet, set eval_commands to what the project should have based on its stack — the implementation worker will configure them.

### Step 8: Set Retry Budget

Determine the initial retry_budget from the gate_profile:

| gate_profile | initial retry_budget |
|-------------|---------------------|
| `code_change` | 3 |
| `artifact_only` | 3 |
| `closure_ready` | 2 |

Then apply risk_level adjustment:
- `high`: reduce by 1
- `critical`: reduce by 1
- Minimum value is always **1**

Examples:
- `code_change` + `normal` = 3
- `code_change` + `high` = 2
- `closure_ready` + `critical` = 1

### Step 9: Check Dependencies

Look at existing TaskContracts in `.geas/tasks/`:
- If this task needs another task's output (e.g., frontend needs backend API) → add to `dependencies`
- If this task blocks others → note for scheduling

### Step 10: Capture Base Commit

Run `git rev-parse HEAD` to get the current commit hash. Record this as `base_commit`. This anchors the task to a known repository state and is used for staleness detection during integration.

### Step 11: Generate Rubric

Assign quality rubric dimensions based on task type. Every task gets the base dimensions; UI tasks get additional ones.

**Base dimensions (all tasks):**

| Dimension | Default Threshold |
|-----------|-------------------|
| `core_interaction` | 3 |
| `feature_completeness` | 4 |
| `code_quality` | 4 |
| `regression_safety` | 4 |

**Additional dimensions (when `primary_worker_type` is `frontend_engineer` or `ui_ux_designer`, or task has UI component):**

| Dimension | Default Threshold |
|-----------|-------------------|
| `ux_clarity` | 3 |
| `visual_coherence` | 3 |

Write the rubric as an object with a `dimensions` array. The orchestration_authority or the user may adjust thresholds for specific tasks.

## Output

Write the TaskContract to `.geas/tasks/{task_id}.json` conforming to `schemas/task-contract.schema.json`.

```bash
mkdir -p .geas/tasks
```

Example output:
```json
{
  "version": "1.0",
  "artifact_type": "task_contract",
  "artifact_id": "task-contract-task-003",
  "producer_type": "orchestration_authority",
  "created_at": "2026-03-24T10:00:00Z",
  "task_id": "task-003",
  "title": "[Frontend] Login form with email/password",
  "goal": "Create a login form component that submits to POST /api/auth/login and handles success/error states",
  "task_kind": "code",
  "risk_level": "normal",
  "gate_profile": "code_change",
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
      { "name": "feature_completeness", "threshold": 4 },
      { "name": "code_quality", "threshold": 4 },
      { "name": "regression_safety", "threshold": 4 },
      { "name": "ux_clarity", "threshold": 3 },
      { "name": "visual_coherence", "threshold": 3 }
    ]
  },
  "retry_budget": 3,
  "scope": {
    "paths": ["src/components/auth/", "src/styles/auth/", "tests/components/auth/"]
  },
  "routing": {
    "primary_worker_type": "frontend_engineer",
    "required_reviewer_types": ["architecture_authority", "qa_engineer"]
  },
  "base_commit": "a1b2c3d4e5f6...",
  "status": "drafted"
}
```

After writing, log the event:
```
Append to .geas/ledger/events.jsonl:
{"event": "task_compiled", "timestamp": "...", "task_id": "task-003", "title": "[Frontend] Login form"}
```
