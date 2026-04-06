# Polishing Phase [MANDATORY — do not skip]

### Security Review (risk_specialist)
Resolve the risk_specialist slot via profiles.json.
Update run.json checkpoint: `pipeline_step` = "security_review", `agent_in_flight` = "{resolved-risk-specialist}"
```
Agent(agent: "{resolved-risk-specialist}", prompt: "Full risk review of the project. Check for security vulnerabilities, auth flows, input validation, secrets exposure, dependency vulnerabilities. Write findings with severity (CRITICAL/HIGH/MEDIUM/LOW) to .geas/missions/{mission_id}/evidence/polishing/{resolved-risk-specialist}.json")
```
Verify `.geas/missions/{mission_id}/evidence/polishing/{resolved-risk-specialist}.json` exists.

### Triage Findings
Read `.geas/missions/{mission_id}/evidence/polishing/{resolved-risk-specialist}.json`. Classify each finding by severity:
- **CRITICAL / HIGH** -> create a fix task (mini-pipeline, see Fix Critical Security Issues)
- **MEDIUM / LOW** -> add to `.geas/missions/{mission_id}/evolution/debt-register.json` as structured debt items with severity, kind, status, target_phase

If no CRITICAL/HIGH findings: skip Fix Critical Security Issues and proceed to Documentation.

### Fix Critical Security Issues
For each CRITICAL/HIGH finding, run a reduced pipeline:
1. Generate ContextPacket for the appropriate implementer (resolved via profiles.json) with risk_specialist's finding as primary context
2. Update run.json checkpoint: `pipeline_step` = "security_fix", `agent_in_flight` = "{worker}"
3. Spawn worker with worktree isolation:
   ```
   Agent(agent: "{worker}", isolation: "worktree", prompt: "Read .geas/missions/{mission_id}/packets/polishing/{worker}-fix-{N}.md. Fix the security issue. Write evidence to .geas/missions/{mission_id}/evidence/polishing/{worker}-fix-{N}.json")
   ```
4. Merge worktree branch
5. Code Review (design_authority) — verify the fix is correct and doesn't introduce regressions
6. Testing (quality_specialist) — verify the fix with `eval_commands` from conventions.md
7. If fix fails: retry once (`retry_budget: 2`). If still fails: register as HIGH debt and proceed — do not block Polishing phase indefinitely

### Documentation (communication_specialist)
Resolve the communication_specialist slot via profiles.json.
Update run.json checkpoint: `pipeline_step` = "documentation", `agent_in_flight` = "{resolved-communication-specialist}"
```
Agent(agent: "{resolved-communication-specialist}", prompt: "Read the current mission spec at .geas/missions/{mission_id}/spec.json (get mission_id from .geas/state/run.json), the design-brief at .geas/missions/{mission_id}/design-brief.json, and all evidence at .geas/missions/{mission_id}/evidence/. Write README, API docs, and user-facing documentation. Write to .geas/missions/{mission_id}/evidence/polishing/{resolved-communication-specialist}.json")
```
Verify `.geas/missions/{mission_id}/evidence/polishing/{resolved-communication-specialist}.json` exists.

### Entropy Scan
Update run.json checkpoint: `pipeline_step` = "entropy_scan", `agent_in_flight` = "{resolved-design-authority}"
Design authority reviews for dead code, AI boilerplate, convention drift, and duplication as part of the polishing review.
Results are recorded in `.geas/missions/{mission_id}/evolution/debt-register.json`.

### Close Polishing

**Phase review** — verify gate criteria for polishing -> evolving:
- All high/critical debt triaged in `.geas/missions/{mission_id}/evolution/debt-register.json` (no items with severity high/critical and status "open")
- Required reviews approved
- Shipping rationale recorded for every known risk
- Zero open CRITICAL/HIGH security issues

Write `.geas/missions/{mission_id}/evolution/gap-assessment-polishing-to-evolving.json`.
Write `.geas/missions/{mission_id}/phase-reviews/polishing-to-evolving.json` with `mission_phase: "polishing"`, `next_phase: "evolving"`.

If any gate criteria unmet: set `status: "blocked"`. List unmet criteria. After 3 consecutive failures -> invoke `/geas:vote-round`.

Log: `{"event": "phase_complete", "phase": "polishing", "timestamp": "<actual>"}`
