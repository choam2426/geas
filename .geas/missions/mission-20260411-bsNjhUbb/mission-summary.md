# Mission Summary — stdin 단일 입력 리팩터

**Mission ID:** mission-20260411-bsNjhUbb
**Date:** 2026-04-11
**Verdict:** PASS — ship

## Outcome

The geas CLI's JSON input path is now unified on stdin. The 10 write
subcommands — `mission write-spec`/`write-brief`, `task create`/`record add`,
`evidence add`, `decision write`, `phase write`, `recovery write`,
`evolution gap-assessment`/`rules-update` — no longer accept `--data`/`--file`.
They read JSON from stdin via `readInputData()` (0-arg), guard against
hangs when called from a real TTY, handle Windows `fs.readFileSync(0)`
EAGAIN/EOF, and emit line-hinted JSON parse errors. `evidence add` and
`task record add` keep the empty-stdin + `--set` fallback.

The four non-JSON value flags are preserved: `event log --data "string"`,
`context write --data "string"`, `packet create --file path`,
`packet create --content "text"`.

## Tasks

| Task | Title | Commit | Verdict |
|---|---|---|---|
| task-001 | CLI stdin-only refactor (input.ts + 10 commands + tests) | ad3698d | pass |
| task-002 | Docs sweep: skills/agents → stdin pattern (13 files, 20 sites) | 185ebe5 | pass |
| task-003 | Bundle regenerate + verify (grep + smoke + TTY sim) | 44c12c4 | pass |

## Metrics

- Tests: 31/31 pass (11 new `input.test.ts` cases)
- Bundle grep: 4 residuals, all whitelisted (event log, context write, packet create)
- Repo-wide grep: 0 JSON-input violations
- Security: 0 critical/high findings
- Debt: 6 items open (0 critical/high, 2 normal, 4 low)

## Open Debt

- DEBT-001 (normal): Real-Windows stdin behavior verification
- DEBT-002 (low): POSIX shebang execution smoke
- DEBT-003 (low): Unbounded stdin read
- DEBT-004 (low): Dead SyntaxError fallback branches
- DEBT-005 (normal): Duplicated readInputData try/catch across 7 commands
- DEBT-006 (low): decision.ts convention drift

## Recommended Follow-ups

1. Shell live-smoke matrix mission (Windows + POSIX) to resolve DEBT-001/002
2. Refactor mission: extract `readJsonInputOrFail` helper and clean
   dead SyntaxError branches (DEBT-004/005/006)
3. Task-compiler enhancement: CLI subcommand existence check

## Note

The `geas` binary on PATH via the plugin cache is still the pre-refactor
version. Users must reinstall / refresh the plugin marketplace entry to
pick up `plugin/bin/geas` from commit 44c12c4.
