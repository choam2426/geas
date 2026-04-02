# Polish Phase [MANDATORY — do not skip]

### Security Review (security-engineer)
Update run.json checkpoint: `pipeline_step` = "security_review", `agent_in_flight` = "security-engineer"
```
Agent(agent: "security-engineer", prompt: "Full security review of the project. Check OWASP top 10, auth flows, input validation, secrets exposure, dependency vulnerabilities. Write findings with severity (CRITICAL/HIGH/MEDIUM/LOW) to .geas/evidence/polish/security-engineer.json")
```
Verify `.geas/evidence/polish/security-engineer.json` exists.

### Triage Findings
Read `.geas/evidence/polish/security-engineer.json`. Classify each finding by severity:
- **CRITICAL / HIGH** -> create a fix task (mini-pipeline, see Fix Critical Security Issues)
- **MEDIUM / LOW** -> add to `.geas/state/debt-register.json` as structured debt items with severity, kind, status, target_phase

If no CRITICAL/HIGH findings: skip Fix Critical Security Issues and proceed to Documentation.

### Fix Critical Security Issues
For each CRITICAL/HIGH finding, run a reduced pipeline:
1. Generate ContextPacket for the appropriate worker (frontend-engineer for frontend, backend-engineer for backend) with security_engineer's finding as primary context
2. Update run.json checkpoint: `pipeline_step` = "security_fix", `agent_in_flight` = "{worker}"
3. Spawn worker with worktree isolation:
   ```
   Agent(agent: "{worker}", isolation: "worktree", prompt: "Read .geas/packets/polish/{worker}-fix-{N}.md. Fix the security issue. Write evidence to .geas/evidence/polish/{worker}-fix-{N}.json")
   ```
4. Merge worktree branch
5. Code Review (architecture_authority) — verify the fix is correct and doesn't introduce regressions
6. Testing (qa_engineer) — verify the fix with `eval_commands` from conventions.md
7. If fix fails: retry once (`retry_budget: 2`). If still fails: register as HIGH debt and proceed — do not block Polish phase indefinitely

### Documentation (technical-writer)
Update run.json checkpoint: `pipeline_step` = "documentation", `agent_in_flight` = "technical-writer"
```
Agent(agent: "technical-writer", prompt: "Read .geas/spec/seed.json, .geas/spec/prd.md, and all evidence at .geas/evidence/. Write README, API docs, and user-facing documentation. Write to .geas/evidence/polish/technical-writer.json")
```
Verify `.geas/evidence/polish/technical-writer.json` exists.

### Entropy Scan
Update run.json checkpoint: `pipeline_step` = "cleanup", `agent_in_flight` = "architecture-authority"
Invoke `/geas:cleanup` — architecture_authority scans for dead code, AI boilerplate, convention drift, and duplication.
Results are recorded in `.geas/state/debt-register.json`.

### Close Polish

**Phase review** — verify gate criteria for polish -> evolution:
- All high/critical debt triaged in `.geas/state/debt-register.json` (no items with severity high/critical and status "open")
- Required reviews approved
- Shipping rationale recorded for every known risk
- Zero open CRITICAL/HIGH security issues

Write `.geas/state/gap-assessment.json` if not yet produced for this transition.
Write `.geas/state/phase-review.json` with `mission_phase: "polish"`, `next_phase: "evolution"`.

If any gate criteria unmet: set `status: "blocked"`. List unmet criteria. After 3 consecutive failures -> enter decision mode.

Log: `{"event": "phase_complete", "phase": "polish", "timestamp": "<actual>"}`
