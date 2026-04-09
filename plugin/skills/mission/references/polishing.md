# Polishing Phase [MANDATORY — do not skip]

### Security Review (risk_specialist)
Resolve the risk_specialist slot via profiles.json.
Update checkpoint: `Bash("geas state checkpoint set --step security_review --agent {resolved-risk-specialist}")`
```
Agent(agent: "{resolved-risk-specialist}", prompt: "Full risk review of the project. Check for security vulnerabilities, auth flows, input validation, secrets exposure, dependency vulnerabilities. Write findings with severity (CRITICAL/HIGH/MEDIUM/LOW) as evidence. Run: geas evidence add --task polishing --agent {resolved-risk-specialist} --role reviewer --set summary='<security review summary>' --set verdict='<approved or changes_requested>' --set concerns='[\"finding1\",\"finding2\"]'")
```
Verify `.geas/missions/{mission_id}/tasks/polishing/evidence/{resolved-risk-specialist}.json` exists.

### Triage Findings
Read `.geas/missions/{mission_id}/tasks/polishing/evidence/{resolved-risk-specialist}.json`. Classify each finding by severity:
- **CRITICAL / HIGH** -> create a fix task (mini-pipeline, see Fix Critical Security Issues)
- **MEDIUM / LOW** -> add to the debt register via CLI:
     ```bash
     Bash("geas debt add --mission {mission_id} --title '<finding>' --severity normal --kind risk --task polishing --owner risk_specialist")
     ```

If no CRITICAL/HIGH findings: skip Fix Critical Security Issues and proceed to Documentation.

### Fix Critical Security Issues
For each CRITICAL/HIGH finding, run a reduced pipeline:
1. Generate ContextPacket for the appropriate implementer (resolved via profiles.json) with risk_specialist's finding as primary context
2. Update checkpoint: `Bash("geas state checkpoint set --step security_fix --agent {worker}")`
3. Resolve `project_root` — the absolute path of the main session working directory (see mission/SKILL.md "Worktree state access rule"). Spawn worker with worktree isolation:
   ```
   Agent(agent: "{worker}", isolation: "worktree", prompt: "IMPORTANT: You are running in a worktree. The .geas/ directory is NOT available via relative paths. Use the absolute paths below for ALL .geas/ access. Read {project_root}/.geas/missions/{mission_id}/tasks/polishing/packets/{worker}-fix-{N}.md. Fix the security issue. Write your evidence by running: geas evidence add --task polishing --agent {worker}-fix-{N} --role implementer --set summary='<fix summary>' --set files_changed='[\"file1\"]'")
   ```
4. Merge worktree branch
5. Specialist Review (design-authority) — verify the fix is correct and doesn't introduce regressions
6. Testing (quality-specialist) — verify the fix with `eval_commands` from rules.md
7. If fix fails: retry once (`retry_budget: 2`). If still fails: register as HIGH debt and proceed — do not block Polishing phase indefinitely

### Documentation (communication_specialist)
Resolve the communication_specialist slot via profiles.json.
Update checkpoint: `Bash("geas state checkpoint set --step documentation --agent {resolved-communication-specialist}")`
```
Agent(agent: "{resolved-communication-specialist}", prompt: "Read the current mission spec at .geas/missions/{mission_id}/spec.json (get mission_id from .geas/state/run.json), the design-brief at .geas/missions/{mission_id}/design-brief.json, and all task evidence. Write README, API docs, and user-facing documentation. Write your documentation evidence. Run: geas evidence add --task polishing --agent {resolved-communication-specialist} --role implementer --set summary='<documentation summary>' --set files_changed='[\"README.md\"]'")
```
Verify `.geas/missions/{mission_id}/tasks/polishing/evidence/{resolved-communication-specialist}.json` exists.

### Entropy Scan
Update checkpoint: `Bash("geas state checkpoint set --step entropy_scan --agent {resolved-design-authority}")`
Design authority reviews for dead code, AI boilerplate, convention drift, and duplication as part of the polishing review.
Results are recorded in `.geas/missions/{mission_id}/evolution/debt-register.json`.

### Close Polishing

**Phase review** — verify gate criteria for polishing -> evolving:
- All high/critical debt triaged in `.geas/missions/{mission_id}/evolution/debt-register.json` (no items with severity high/critical and status "open")
- Required reviews approved
- Shipping rationale recorded for every known risk
- Zero open CRITICAL/HIGH security issues

Write the gap assessment via CLI:
```bash
Bash("geas evolution gap-assessment --mission {mission_id} --phase polishing --data '<gap_assessment_json>'")
```
Write the phase review via CLI:
```bash
Bash("geas phase write --mission {mission_id} --data '<phase_review_json>'")
```
where phase review has `mission_phase: "polishing"`, `next_phase: "evolving"`.

If any gate criteria unmet: set `status: "blocked"`. List unmet criteria. After 3 consecutive failures -> invoke `/geas:vote-round`.

Log: `Bash("geas event log --type phase_complete --data '{\"phase\":\"polishing\"}'")` 
