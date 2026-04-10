# Project Rules

## Evidence
- Write evidence via CLI: `geas evidence add --task {tid} --agent {name} --role {role} --set key=value`
- Required fields by role:
  - implementer: `summary`, `files_changed` (array of changed file paths)
  - reviewer: `summary`, `verdict` (approved/changes_requested/blocked), `concerns` (array)
  - tester: `summary`, `verdict`, `criteria_results` (array of {criterion, passed, details?})
  - authority: `summary`, `verdict`, `rationale`
- Optional for all roles: `rubric_scores` (array of {dimension, score (1-5), rationale?})
- Timestamps are auto-injected by the CLI. Never generate them manually.

## Scope
- Only modify files listed in `scope.surfaces` from the TaskContract.
- Out-of-scope changes require implementation contract amendment.
- Read the TaskContract before starting work to understand acceptance criteria and scope.

## Reviews
- Reviewers must provide concrete, actionable feedback — not vague observations.
- Use `verdict: "changes_requested"` with specific `concerns` when issues are found.
- Use `verdict: "blocked"` only for critical issues that prevent shipping.

## Knowledge Sharing
- If you discover something other agents need to know (stack rules, conventions, constraints), update this file (`.geas/rules.md`) directly. Your agent memory note is private to you — rules.md is the only cross-agent channel.

## Code
- Project: Geas governance protocol plugin\n- CLI source: src/cli/ (Node.js)\n- Dashboard: src/dashboard/ (Tauri)\n- Build CLI: cd src/cli && npm run build\n- No top-level package.json — subprojects under src/
