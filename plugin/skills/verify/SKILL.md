---
name: verify
description: Structured verification checklist — BUILD, LINT, TEST, ERROR_FREE, FUNCTIONALITY. Invoke to check code quality before declaring complete.
---

# Verify

Mechanical verification checklist. Run before declaring any feature complete.

**KEY PRINCIPLE: Completion = verified, not "code is written."**

---

## Checklist Items

Run in order. Stop-on-fail is optional — running all items gives a complete picture.

| # | Item | What it checks |
|---|------|---------------|
| 1 | BUILD | Project compiles / bundles without errors |
| 2 | LINT | No lint violations |
| 3 | TEST | Unit and integration tests pass |
| 4 | ERROR_FREE | Dev server starts clean — no console errors |
| 5 | FUNCTIONALITY | Playwright E2E tests cover acceptance criteria |

---

## Stack Detection

Read `.geas/memory/_project/conventions.md` for project-specific build, lint, and test commands.

If no conventions file exists, detect from project root files:

| Marker file | Stack | Build | Lint | Test |
|-------------|-------|-------|------|------|
| `package.json` | Node.js | `npm run build` | `npm run lint` | `npm test` |
| `go.mod` | Go | `go build ./...` | `golangci-lint run` | `go test ./...` |
| `Cargo.toml` | Rust | `cargo build` | `cargo clippy` | `cargo test` |
| `pyproject.toml` | Python | `python -m py_compile` | `ruff check` | `pytest` |
| `requirements.txt` | Python | `python -m py_compile` | `ruff check` | `pytest` |

For Node.js projects, also check `package.json` scripts — prefer explicit script names (e.g. `npm run build` only if a `build` script exists). If a script is missing, skip that item and mark it `SKIP — no script configured`.

---

## Running Each Item

### 1. BUILD

```bash
# Read command from conventions file first, fall back to detection
<build_command>
```

- Exit code 0 = PASS
- Non-zero = FAIL. Capture stderr for the report.

### 2. LINT

```bash
<lint_command>
```

- Exit code 0 = PASS
- Non-zero = FAIL. Capture the specific violations (file, line, rule).

### 3. TEST

```bash
<test_command>
```

- Exit code 0 = PASS
- Non-zero = FAIL. Parse output for failed test names, files, and line numbers.

### 4. ERROR_FREE

Start the dev server and check for errors in its output.

**If Browser Tools MCP is available:**
1. Start the dev server in background
2. Use Browser Tools to navigate to the app URL
3. Check browser console for errors
4. Kill the dev server

**If Browser Tools MCP is NOT available (fallback):**
1. Start the dev server in background, capture stdout/stderr
2. Wait 5 seconds for startup
3. Check captured output for `error`, `Error`, `ERR`, `FATAL`, `failed` patterns
4. Kill the dev server

- No errors found = PASS
- Errors in output = FAIL. Include the error lines.

### 5. FUNCTIONALITY

This is Sentinel's domain — Playwright E2E testing against acceptance criteria.

- **If invoked by Sentinel**: Run the Playwright test suite. Report pass/fail per test.
- **If invoked by Forge or any other agent**: Mark as `PENDING (Sentinel E2E)`. Do not run E2E tests yourself.

---

## Forge Pre-Check Mode

When Forge invokes this during code review, run only BUILD + LINT. Skip TEST, ERROR_FREE, and FUNCTIONALITY entirely.

Output format:

```
[Pre-check] BUILD: PASS | LINT: PASS -> proceed to QA
```

```
[Pre-check] BUILD: PASS | LINT: FAIL (3 violations in src/api/routes.ts) -> fix before QA
```

This is a fast gate: does the code compile and pass lint? If yes, hand off to Sentinel for the full checklist.

---

## Output Format

**Success is silent, errors are verbose.**

### Full Checklist Output

```
BUILD:         PASS
LINT:          PASS
TEST:          FAIL — 3 tests failed (auth.test.ts:42, poll.test.ts:18, poll.test.ts:55)
ERROR_FREE:    PASS
FUNCTIONALITY: PENDING (Sentinel E2E)
---
VERDICT: FAIL — fix TEST before proceeding
```

### Rules

- **PASS** items: single word, no additional details.
- **FAIL** items: include specific error details — file name, line number, error message.
- **SKIP** items: include reason (e.g. `SKIP — no build script configured`).
- **PENDING** items: include who is responsible (e.g. `PENDING (Sentinel E2E)`).
- **VERDICT**:
  - `PASS` only if ALL items are PASS (PENDING and SKIP do not block).
  - `FAIL` if ANY item is FAIL. List which items need fixing.

### Verdict Logic

```
if any item is FAIL:
    VERDICT = FAIL — fix <failed items> before proceeding
else if all items are PASS:
    VERDICT = PASS
else:
    VERDICT = PASS (with <PENDING/SKIP count> items deferred)
```

---

## Posting Results

Print the verification result to console:

```
[<Agent>] Verify checklist:

BUILD:         PASS
LINT:          PASS
TEST:          PASS
ERROR_FREE:    PASS
FUNCTIONALITY: PENDING (Sentinel E2E)
---
VERDICT: PASS (1 item deferred)
```

Use your agent codename in the prefix (e.g. `[Forge]`, `[Sentinel]`, `[Circuit]`).

---

## Integration with Workflow

- **Forge code review**: Run pre-check (BUILD + LINT) before approving.
- **Circuit / Pixel implementation**: Run full checklist (minus FUNCTIONALITY) before posting completion.
- **Sentinel QA**: Run full checklist including FUNCTIONALITY (Playwright E2E).
- **Verify-Fix Loop**: After each fix iteration, Sentinel re-runs the full checklist.
