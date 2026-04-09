# Building Phase

## Parallel Execution

Before starting the first task, and after each task or batch resolves:
- Scan `.geas/missions/{mission_id}/tasks/` for eligible tasks (status `"ready"`, all `depends_on` are `"passed"`).
- If 2+ eligible: you MUST invoke `/geas:scheduling`. Do NOT run them sequentially when parallel execution is possible.
- If 0-1 eligible: run the single task through `references/pipeline.md`.

For each task, read `references/pipeline.md` and execute the full per-task pipeline.

## Close Building

**Phase review** — verify gate criteria for building -> polishing:
- All MVP-critical tasks passed
- No blocking_conflict active
- 0 critical debt in `.geas/missions/{mission_id}/evolution/debt-register.json`
- 0 unmitigated high debt (status must not be "open" for high severity)

**Write gap-assessment BEFORE phase review** — the phase guard requires `gap-assessment-building.json` to exist.

Write gap assessment and phase review via CLI:
```bash
Bash("geas debt list --mission {mission_id}")  # Read debt state for gap assessment
Bash("geas evolution gap-assessment --mission {mission_id} --phase building --data '<gap_assessment_json>'")
```
Write the phase review via CLI with schema validation:
```bash
Bash("geas phase write --mission {mission_id} --data '<phase_review_json>'")
```
where phase review has `mission_phase: "building"`, `next_phase: "polishing"`.

If any gate criteria unmet: set `status: "blocked"`. List unmet criteria. After 3 consecutive failures -> invoke `/geas:vote-round`.

### State Cleanup

Before transitioning to polishing, clean up run state:
```bash
Bash("geas state checkpoint clear")
Bash("geas state update --field current_task_id --value null")
```

Log: `Bash("geas event log --type phase_complete --data '{\"phase\":\"building\"}'")` 
