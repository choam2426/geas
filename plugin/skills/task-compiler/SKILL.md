---
name: task-compiler
description: Compile a user story into a TaskContract — a machine-readable work agreement with verifiable acceptance criteria, path boundaries, and eval commands.
---

# Task Compiler

Transforms a user story (or feature description) into a structured TaskContract that workers execute against.

## When to Use

Compass invokes this skill during:
- **Initiative Mode**: after Genesis creates issues, compile each into a TaskContract
- **Sprint Mode**: compile the single feature into a TaskContract

## Inputs

You need these before compiling:

1. **User story or feature description** — what needs to be built
2. **Seed spec** — read from `.geas/spec/seed.json` for mission-level context
3. **Architecture context** — from Forge's tech guide or `.geas/memory/_project/conventions.md`
4. **Existing task contracts** — check `.geas/tasks/` for dependencies

## Compilation Process

### Step 1: Determine Task Identity

- Generate a sequential ID: `task-001`, `task-002`, etc.
- Check `.geas/tasks/` for existing contracts to avoid ID collision
- Title should be actionable: "[Backend] User authentication API", "[Frontend] Login form"

### Step 2: Define the Goal

Write a single sentence stating the verifiable outcome.
- Good: "Create a REST API endpoint POST /api/auth/login that accepts email+password and returns a JWT"
- Bad: "Implement authentication" (too vague to verify)

### Step 3: Assign Worker and Reviewer

Based on the task nature:

| Task Type | Worker | Reviewer |
|-----------|--------|----------|
| Frontend UI | pixel | forge |
| Backend API / Database | circuit | forge |
| Design spec | palette | forge |
| DevOps/deployment | pipeline | forge |
| Documentation | scroll | forge |
| Full-stack feature | pixel or circuit (primary) | forge |

### Step 4: Set Prohibited Paths

Define paths the worker MUST NOT modify:
- **prohibited_paths**: files/directories that are off-limits
  - Always include: `.env`, `.geas/`, `plugin/`, `.agents/`, `node_modules/`
  - Add project-specific prohibitions based on task scope (e.g., payment module for an auth task)

Workers are free to create or modify any file not in prohibited_paths. Scope compliance is verified by Forge in code review, not by mechanical path matching.

### Step 5: Define Acceptance Criteria

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

### Step 6: Set Eval Commands

Detect from the project's stack (check `package.json`, `pyproject.toml`, `Cargo.toml`, etc.):

| Stack | Build | Lint | Test | Typecheck |
|-------|-------|------|------|-----------|
| Node/npm | `npm run build` | `npm run lint` | `npm test` | `npx tsc --noEmit` |
| Node/pnpm | `pnpm build` | `pnpm lint` | `pnpm test` | `pnpm tsc --noEmit` |
| Python | — | `ruff check .` | `pytest` | `mypy .` |
| Go | `go build ./...` | `golangci-lint run` | `go test ./...` | — |

If no test/lint commands are configured yet, set them to what Forge/Circuit should configure.

### Step 7: Set Retry Budget and Escalation

- Default `retry_budget`: 3
- Default `escalation_policy`: `"forge-review"`
- For critical-path tasks: consider `"nova-decision"`
- For tasks with known risk: consider lower budget (2) with `"forge-review"`

### Step 8: Check Dependencies

Look at existing TaskContracts in `.geas/tasks/`:
- If this task needs another task's output (e.g., frontend needs backend API) → add to `dependencies`
- If this task blocks others → note for scheduling

## Output

Write the TaskContract to `.geas/tasks/{id}.json` conforming to `schemas/task-contract.schema.json`.

The contract must conform to `schemas/task-contract.schema.json`. Refer to the schema for the field list.

```bash
mkdir -p .geas/tasks
```

Example output:
```json
{
  "version": "1.0",
  "id": "task-003",
  "title": "[Frontend] Login form with email/password",
  "goal": "Create a login form component that submits to POST /api/auth/login and handles success/error states",
  "assigned_worker": "pixel",
  "reviewer": "forge",
  "prohibited_paths": [".env", ".geas/", "plugin/", ".agents/", "src/components/payment/**"],
  "dependencies": ["task-002"],
  "acceptance_criteria": [
    "Login form renders with email and password fields",
    "Form validates email format before submission",
    "Successful login redirects to dashboard",
    "Failed login shows error message without exposing server details",
    "Form is accessible (labels, focus management, aria attributes)"
  ],
  "eval_commands": ["npm run build", "npm run lint", "npm test"],
  "retry_budget": 3,
  "escalation_policy": "forge-review",
  "status": "pending",
  "created_at": "2026-03-24T10:00:00Z"
}
```

After writing, log the event:
```
Append to .geas/ledger/events.jsonl:
{"event": "task_compiled", "timestamp": "...", "task_id": "task-003", "title": "[Frontend] Login form"}
```
