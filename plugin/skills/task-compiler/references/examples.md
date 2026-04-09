# Task Compiler — Annotated Examples

These examples show how the task-compiler classifies and structures TaskContracts for different scenarios.

---

## Example 1: Simple Implementation Task (Low Risk)

**User story:** "Add a health check endpoint that returns server status"

**Classification reasoning:**
- `task_kind: implementation` — writing application code (new endpoint)
- `risk_level: low` — isolated change, single file, no dependencies, easy to revert
- `gate_profile: implementation_change` — produces code that must build/test/lint
- `vote_round_policy: never` — focused change within existing patterns, no ambiguity

**Resulting TaskContract:**

```json
{
  "version": "1.0",
  "artifact_type": "task_contract",
  "artifact_id": "task-contract-task-001",
  "producer_type": "orchestration_authority",
  "task_id": "task-001",
  "title": "[Backend] Health check endpoint",
  "goal": "Create GET /api/health endpoint that returns 200 with server status, uptime, and version",
  "task_kind": "implementation",
  "risk_level": "low",
  "gate_profile": "implementation_change",
  "vote_round_policy": "never",
  "acceptance_criteria": [
    "GET /api/health returns 200 with JSON body containing status, uptime, and version fields",
    "Response time is under 100ms (no heavy computation in health check)",
    "Endpoint is accessible without authentication"
  ],
  "eval_commands": ["npm run build", "npm run lint", "npm test"],
  "rubric": {
    "dimensions": [
      { "name": "core_interaction", "threshold": 3 },
      { "name": "feature_completeness", "threshold": 4 },
      { "name": "code_quality", "threshold": 4 },
      { "name": "regression_safety", "threshold": 4 }
    ]
  },
  "retry_budget": 3,
  "scope": {
    "surfaces": ["src/routes/health.ts", "tests/routes/health.test.ts"]
  },
  "routing": {
    "primary_worker_type": "software-engineer",
    "required_reviewer_types": ["design-authority"]
  },
  "dependencies": [],
  "base_snapshot": "a1b2c3d...",
  "status": "drafted"
}
```

**Key decisions:**
- Only `design-authority` as reviewer (low risk, no security concern)
- `retry_budget: 3` — standard for `implementation_change` + `low` risk (no reduction)
- No UI dimensions in rubric — backend-only task
- Narrow scope surfaces — only the route file and its test

---

## Example 2: Complex Implementation Task (High Risk, Vote Round)

**User story:** "Add role-based access control with admin, editor, and viewer roles across all API endpoints"

**Classification reasoning:**
- `task_kind: implementation` — writing application code (auth middleware + role checks)
- `risk_level: high` — touches auth system, cross-module impact, affects all endpoints
- `gate_profile: implementation_change` — produces code that must build/test/lint
- `vote_round_policy: always` — adds new permission system (security-critical), cross-cutting decision

**Resulting TaskContract:**

```json
{
  "version": "1.0",
  "artifact_type": "task_contract",
  "artifact_id": "task-contract-task-005",
  "producer_type": "orchestration_authority",
  "task_id": "task-005",
  "title": "[Backend] Role-based access control (RBAC)",
  "goal": "Implement RBAC middleware with admin/editor/viewer roles, apply to all existing API endpoints, and add role management endpoints",
  "task_kind": "implementation",
  "risk_level": "high",
  "gate_profile": "implementation_change",
  "vote_round_policy": "always",
  "acceptance_criteria": [
    "Role middleware validates JWT role claim before allowing access",
    "Admin role has full access to all endpoints",
    "Editor role can read and write but not delete or manage users",
    "Viewer role can only read (GET requests)",
    "Unauthenticated requests return 401, insufficient role returns 403",
    "Role assignment endpoint (POST /api/users/:id/role) requires admin role",
    "Existing tests pass with updated auth context"
  ],
  "eval_commands": ["npm run build", "npm run lint", "npm test", "npm run test:integration"],
  "rubric": {
    "dimensions": [
      { "name": "core_interaction", "threshold": 3 },
      { "name": "feature_completeness", "threshold": 4 },
      { "name": "code_quality", "threshold": 4 },
      { "name": "regression_safety", "threshold": 4 }
    ]
  },
  "retry_budget": 2,
  "scope": {
    "surfaces": [
      "src/middleware/auth/",
      "src/middleware/rbac/",
      "src/routes/",
      "src/models/user.ts",
      "tests/middleware/",
      "tests/routes/"
    ]
  },
  "routing": {
    "primary_worker_type": "software-engineer",
    "required_reviewer_types": ["design-authority", "qa-engineer"]
  },
  "dependencies": ["task-002"],
  "base_snapshot": "f8e9d0c...",
  "status": "drafted"
}
```

**Key decisions:**
- `vote_round_policy: always` — adds new auth/permission system (mandatory vote per heuristic)
- `retry_budget: 2` — reduced from 3 because `high` risk (3 - 1 = 2)
- Broad scope surfaces — RBAC touches middleware and all routes
- `dependencies: ["task-002"]` — depends on the auth/JWT task completing first
- `qa-engineer` included as reviewer — high risk requires thorough testing

---

## Example 3: Classification Decision Examples

These show how the classification fields are determined for borderline cases.

### Case A: "Write API documentation for all endpoints"

| Field | Value | Reasoning |
|-------|-------|-----------|
| `task_kind` | `documentation` | Writing docs, not code |
| `risk_level` | `low` | Docs-only, no code change, easily reversible |
| `gate_profile` | `artifact_only` | No build/test needed, just completeness check |
| `vote_round_policy` | `never` | Clear requirements, no ambiguity |

### Case B: "Migrate user table to add roles column"

| Field | Value | Reasoning |
|-------|-------|-----------|
| `task_kind` | `implementation` | Schema migration + code changes |
| `risk_level` | `critical` | Data migration, potentially irreversible |
| `gate_profile` | `implementation_change` | Must build, test, and verify migration |
| `vote_round_policy` | `always` | New DB table/column + data migration = always |

### Case C: "Set up CI/CD pipeline with GitHub Actions"

| Field | Value | Reasoning |
|-------|-------|-----------|
| `task_kind` | `configuration` | Infrastructure/CI files |
| `risk_level` | `normal` | New CI config, does not touch existing code |
| `gate_profile` | `artifact_only` | Config files, no application build to verify |
| `vote_round_policy` | `auto` | Multiple valid CI approaches, but not architectural |

### Case D: "Refactor data layer to use repository pattern"

| Field | Value | Reasoning |
|-------|-------|-----------|
| `task_kind` | `implementation` | Modifying application code (structural refactor) |
| `risk_level` | `high` | Architecture change, touches >50% of source files |
| `gate_profile` | `implementation_change` | Must build/test to ensure no regressions |
| `vote_round_policy` | `always` | Architecture decision, structural reorganization |
