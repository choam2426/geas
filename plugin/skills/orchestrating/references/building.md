# Building Phase

## Parallel Execution

Before starting the first task, and after each task or batch resolves:
- Scan `.geas/tasks/` for eligible tasks (status `"ready"`, all `depends_on` are `"passed"`).
- If 2+ eligible: invoke `/geas:scheduling`.
- If 0-1 eligible: run the single task through `references/pipeline.md`.

For each task, read `references/pipeline.md` and execute the full per-task pipeline.

## Close Building

**Phase review** — verify gate criteria for building -> polishing:
- All MVP-critical tasks passed
- No blocking_conflict active
- 0 critical debt in `.geas/evolution/debt-register.json`
- 0 unmitigated high debt (status must not be "open" for high severity)

Write `.geas/evolution/gap-assessment-building-to-polishing.json` (same procedure as Evolving 4.1 but scoped to building phase).
Write `.geas/evolution/phase-review-building-to-polishing.json` with `mission_phase: "building"`, `next_phase: "polishing"`.

If any gate criteria unmet: set `status: "blocked"`. List unmet criteria. After 3 consecutive failures -> invoke `/geas:decision`.

Log: `{"event": "phase_complete", "phase": "building", "timestamp": "<actual>"}`
