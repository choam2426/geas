---
name: onboard
description: Codebase discovery protocol — scan project structure, detect stack, map architecture. Used automatically when delivery mode finds no existing state.
---

# Onboard

Codebase discovery protocol for delivery mode (Sprint pattern) on existing projects. A single-agent scan that maps an unknown codebase into a structured conventions file so the rest of the team can work immediately.

**KEY PRINCIPLE: Discover first, act second. Never guess what the project uses.**

---

## When Triggered

Compass detects no `.geas/state/run.json` during delivery mode. This means the project has never been onboarded by this team.

If `.geas/memory/_project/conventions.md` already exists from a previous session, skip onboarding entirely — the project is already "known."

---

## Who Runs It

**Forge only.** Single agent, not parallel. This is a cost-effective reconnaissance step — no reason to spawn multiple agents for a read-only scan.

---

## Steps

Run in order. Each step feeds the next.

### 1. Structure Scan

Check project root for marker files to identify the stack:

| Marker file | Stack | Framework detection |
|-------------|-------|-------------------|
| `package.json` | Node.js | Read `dependencies` and `devDependencies` for framework and tooling |
| `go.mod` | Go | Read module path and dependencies |
| `Cargo.toml` | Rust | Read `[dependencies]` section |
| `pyproject.toml` | Python | Check `[tool]` or `[project]` sections for framework and tooling |
| `requirements.txt` | Python | Scan for framework and tooling packages |

From the detected stack, identify:
- **Framework** (detected from dependency declarations)
- **Build system** (detected from project configuration)
- **Test framework** (detected from config files or dependencies)
- **Package manager** (detected from lockfile presence)

### 2. Architecture Mapping

Find the structural skeleton of the project:

- **Entry points**: `src/index`, `main`, `app`, `server` files
- **Routing patterns**: File-based or explicit — identify from directory structure and framework conventions
- **Database connections**: Look for ORM config files, connection strings, migration directories
- **Key modules**: Auth, API, services, models, utils — identify the major directories and what they own
- **External services**: Look for third-party SDK imports and API key references

### 3. Convention Detection

Read existing configuration to understand the project's style:

- **Linter config**: Search for linter/formatter configuration files in the project root
- **Existing conventions**: If `.geas/memory/_project/conventions.md` exists, read and respect it — do not overwrite
- **Naming patterns**: camelCase vs snake_case, file naming conventions, directory structure patterns
- **Import style**: Absolute vs relative, barrel exports, path aliases
- **Type checking**: Check for type-checking configuration and strictness settings

### 4. Adaptive Depth

Adjust scan depth based on project size. Count source files (exclude `node_modules`, `vendor`, `target`, `.git`, `dist`, `build`):

| Size | File count | Scan strategy |
|------|-----------|---------------|
| Small | ~50 files | **Full scan** — read all source files to understand the full picture |
| Medium | 50-500 files | **Focused scan** — `src/` + config files + entry points + key modules |
| Large | 500+ files | **Targeted scan** — only directories relevant to the Sprint feature. Use `find` to list structure, read selectively. |

For Large projects, ask Compass which directories are relevant to the feature before deep-reading.

### 5. Output Conventions File

Write `.geas/memory/_project/conventions.md` with everything discovered:

```markdown
# Project Conventions

## Stack
- Language: <detected language>
- Framework: <detected framework and version>
- Runtime: <detected runtime and version>
- Package manager: <detected from lockfile>
- Database: <detected from ORM/driver config>

## Build Commands
- Install: <install command from package manager>
- Build: <build command from project config>
- Dev: <dev server command>
- Lint: <lint command>
- Test: <test command>
- Format: <format command, if configured>

## Key Paths
- Entry point: <e.g. src/app/layout.tsx>
- API routes: <e.g. src/app/api/>
- Components: <e.g. src/components/>
- Database: <e.g. prisma/schema.prisma>
- Tests: <e.g. __tests__/ or *.test.ts co-located>

## Architecture Notes
- <routing pattern>
- <state management approach>
- <auth mechanism>
- <anything non-obvious>

## Conventions
- Naming: <e.g. camelCase for files, PascalCase for components>
- Imports: <e.g. absolute with @/ alias>
- TypeScript: <e.g. strict mode enabled>
- Linting: <linter and formatter, config location>
```

### 6. Create State File

Write `.geas/memory/_project/state.json`:

```json
{
  "mode": "sprint",
  "phase": "active",
  "onboarded_at": "<ISO date>",
  "project_size": "small|medium|large",
  "stack_summary": "<one-line summary of detected stack>"
}
```

---

## Second Sprint Behavior

When Compass triggers delivery mode and `.geas/memory/_project/conventions.md` already exists:

1. **Skip onboarding entirely** — do not re-scan
2. Read conventions.md to load project context
3. Proceed directly to delivery mode execution

This makes repeat sessions fast: no redundant scanning.

---

## Error Handling

- **No marker files found**: Report to Compass: "Cannot detect project stack. No package.json, go.mod, Cargo.toml, or Python config found. Is this the right directory?"
- **Multiple stacks detected** (e.g. package.json + go.mod): Document both. Note which is primary (usually the one with the entry point).
- **Existing conventions.md is stale**: If the human says "re-onboard", delete conventions.md and re-run from step 1.

---

## Post-Onboard

After writing conventions.md, Forge prints onboarding status to console:

```
[Forge] Onboarding complete.
Stack: <summary>
Project size: <small/medium/large> (<file count> source files)
Key paths mapped. Conventions written to `.geas/memory/`.
Ready for delivery mode execution.
```
