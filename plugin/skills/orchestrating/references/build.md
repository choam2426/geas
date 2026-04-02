# Build Phase

## Parallel Execution

Before starting the first task, and after each task or batch resolves:
- Scan `.geas/tasks/` for eligible tasks (status `"ready"`, all `depends_on` are `"passed"`).
- If 2+ eligible: invoke `/geas:scheduling`.
- If 0-1 eligible: run the single task through `references/pipeline.md`.

For each task, read `references/pipeline.md` and execute the full per-task pipeline.

## Close Build

**Phase review** — verify gate criteria for build -> polish:
- All MVP-critical tasks passed
- No blocking_conflict active
- 0 critical debt in `.geas/state/debt-register.json`
- 0 unmitigated high debt (status must not be "open" for high severity)

Write `.geas/state/gap-assessment.json` if not yet produced for this transition (same procedure as Evolution 4.1 but scoped to build phase).
Write `.geas/state/phase-review.json` with `mission_phase: "build"`, `next_phase: "polish"`.

If any gate criteria unmet: set `status: "blocked"`. List unmet criteria. After 3 consecutive failures -> enter decision mode.

Log: `{"event": "phase_complete", "phase": "build", "timestamp": "<actual>"}`
