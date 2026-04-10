---
name: setup
description: First-time setup — initialize .geas/ runtime directory, generate config files.
---

# Setup

orchestration-authority should invoke this automatically on the first natural-language request in a new project.

Users should not need to run setup manually unless they are troubleshooting.

## Inputs

- **Project directory** — the repository root where `.geas/` will be initialized
- **Existing codebase** (optional) — configuration files (package.json, go.mod, etc.) for stack detection
- **Previous `.geas/memory/agents/`** (optional) — old agent notes requiring migration

## Output

- **`.geas/` directory** — initialized with `state/`, `memory/agents/`, `recovery/` subdirectories
- **`.geas/state/run.json`** — initial run state (version 1.0, status initialized)
- **`.geas/state/health-check.json`** — initial health check with all 8 signals
- **`.geas/rules.md`** — project-wide rules with detected code conventions
- **`.gitignore`** — updated to include `.geas/` entry

---

## Steps

### Phase 0: Verify CLI

The `geas` command is pre-bundled and available via PATH. Verify it works:

```bash
geas --version
```

If this fails, the plugin is not installed correctly. Reinstall the geas plugin.

### Phase A: Initialize `.geas/` Runtime Directory

Bootstrap the entire `.geas/` directory structure and initial `run.json` via CLI:

```bash
geas state init
```

This single command creates:
- `.geas/state/` directory with `run.json` (version 1.0, status initialized)
- `.geas/memory/agents/` directory
- `.geas/recovery/` directory

If `run.json` already exists, the command is a safe no-op.

Then generate the initial health check via CLI:
```bash
geas health generate
```
The CLI creates `.geas/state/health-check.json` with all 8 signals computed from current state.

Then ask the user whether `.geas/` should be added to `.gitignore`:
- If the user wants it gitignored (default recommendation): append `.geas/` to `.gitignore` (create the file if it doesn't exist)
- If the user wants `.geas/` tracked in git: skip this step

After initialization, all state updates use the CLI:
```bash
geas state update --field status --value in_progress
geas state update --field phase --value specifying
```

The CLI enforces schema validation on the RunState.

### Phase A-1.5: Codebase Discovery (Onboarding)

Phase A also includes codebase discovery — scan project structure, detect stack, and populate the Code section of `.geas/rules.md`. This absorbs the functionality of the former onboard skill.

1. Scan project root for configuration files (package.json, go.mod, pyproject.toml, Cargo.toml, Makefile, etc.)
2. Detect the project stack (language, framework, package manager, test runner)
3. Read existing build/lint/test commands from configuration files
4. Pass detected conventions to the `geas memory init-rules --code-section` flag during Phase A-2, or if rules.md was already created, use `geas policy-managing` to update. Conventions to detect:
   - Build commands
   - Lint commands
   - Test commands
   - Dev server start command
   - Project structure notes

If the project is empty (no source files yet), write a minimal Code section noting that commands will be populated as the project develops.

### Phase A-1.6: Agent Memory Migration

If `.geas/memory/agents/` already exists with files from a previous version, migrate old agent type names:

| old file | action |
|---|---|
| `frontend_engineer.md` + `backend_engineer.md` | merge into `software-engineer.md` (concatenate with `---` separator) |
| `devops_engineer.md` | rename to `platform-engineer.md` |
| `critical_reviewer.md` | rename to `challenger.md` |
| `ui_ux_designer.md` | merge relevant content into `software-engineer.md` |
| `architecture_authority.md` | rename to `design-authority.md` |

Migration is best-effort. Log what was migrated. Do not delete originals until migration is confirmed successful.

If `.geas/memory/agents/` does not exist or has no old-named files, skip this step.

### Phase A-2: Generate `.geas/rules.md`

Create `.geas/rules.md` via CLI — the shared rules that ALL agents must follow:

```bash
geas memory init-rules
```

This creates `rules.md` with the standard agent rules (evidence CLI usage, scope enforcement). If `rules.md` already exists, the command is a safe no-op.

If codebase discovery (Phase A-1.5) detected project conventions, append them to the Code section by passing the `--code-section` flag:

```bash
geas memory init-rules --code-section "- Build: npm run build\n- Test: npm test\n- Lint: npm run lint"
```

### Phase B: Report Results

```
Setup complete:
- .geas/: initialized (state, memory/agents, recovery)
- Mission directories will be created by intake when the mission starts.

Ready! Stay in Claude and describe your mission in natural language.
```
