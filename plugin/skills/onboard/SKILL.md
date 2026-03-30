---
name: onboard
description: Codebase discovery protocol — scan project structure, detect stack, map architecture. Used automatically when Sprint mode finds no existing state.
---

# Onboard

Codebase discovery protocol for Sprint mode on existing projects. A single-agent scan that maps an unknown codebase into a structured conventions file so the rest of the team can work immediately.

**KEY PRINCIPLE: Discover first, act second. Never guess what the project uses.**

---

## When Triggered

Compass detects no `.geas/state/run.json` during Sprint mode. This means the project has never been onboarded by this team.

If `.geas/memory/_project/conventions.md` already exists from a previous Sprint, skip onboarding entirely — the project is already "known."

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
| `package.json` | Node.js | Read `dependencies` for Next.js, Express, React, Vue, etc. |
| `go.mod` | Go | Read module path and dependencies |
| `Cargo.toml` | Rust | Read `[dependencies]` section |
| `pyproject.toml` | Python | Check `[tool.poetry]` or `[project]` for framework |
| `requirements.txt` | Python | Scan for Django, Flask, FastAPI, etc. |

From the detected stack, identify:
- **Framework** (e.g. Next.js 14, Express, FastAPI)
- **Build system** (e.g. npm, cargo, poetry)
- **Test framework** (e.g. Jest, pytest, go test)
- **Package manager** (e.g. npm, pnpm, yarn — check for lockfiles)

### 2. Architecture Mapping

Find the structural skeleton of the project:

- **Entry points**: `src/index`, `main`, `app`, `server` files
- **Routing patterns**: File-based (Next.js `app/`), explicit (Express `routes/`), framework-specific
- **Database connections**: Look for ORM config (Prisma, Drizzle, SQLAlchemy, GORM), connection strings, migration directories
- **Key modules**: Auth, API, services, models, utils — identify the major directories and what they own
- **External services**: Look for SDK imports (Stripe, AWS, Supabase, Firebase)

### 3. Convention Detection

Read existing configuration to understand the project's style:

- **Linter config**: `.eslintrc`, `.prettierrc`, `rustfmt.toml`, `ruff.toml`, `.golangci.yml`
- **Existing conventions**: If `.geas/memory/_project/conventions.md` exists, read and respect it — do not overwrite
- **Naming patterns**: camelCase vs snake_case, file naming conventions, directory structure patterns
- **Import style**: Absolute vs relative, barrel exports, path aliases (tsconfig paths)
- **TypeScript strictness**: Check `tsconfig.json` for strict mode, noImplicitAny, etc.

### 4. Adaptive Depth

Adjust scan depth based on project size. Count source files (exclude `node_modules`, `vendor`, `target`, `.git`, `dist`, `build`):

| Size | File count | Scan strategy |
|------|-----------|---------------|
| Small | ~50 files | **Full scan** — read all source files to understand the full picture |
| Medium | 50-500 files | **Focused scan** — `src/` + config files + entry points + key modules |
| Large | 500+ files | **Targeted scan** — only directories relevant to the Sprint feature. Use `find` to list structure, read selectively. |

For Large projects, ask Compass which directories are relevant to the Sprint feature before deep-reading.

### 5. Output Conventions File

Write `.geas/memory/_project/conventions.md` with everything discovered:

```markdown
# Project Conventions

## Stack
- Language: <e.g. TypeScript>
- Framework: <e.g. Next.js 14 (App Router)>
- Runtime: <e.g. Node.js 20>
- Package manager: <e.g. pnpm>
- Database: <e.g. PostgreSQL via Prisma>

## Build Commands
- Install: <e.g. pnpm install>
- Build: <e.g. pnpm build>
- Dev: <e.g. pnpm dev>
- Lint: <e.g. pnpm lint>
- Test: <e.g. pnpm test>
- Format: <e.g. pnpm format>

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
- Linting: <e.g. ESLint + Prettier, config in .eslintrc.json>
```

### 6. Create State File

Write `.geas/memory/_project/state.json`:

```json
{
  "mode": "sprint",
  "phase": "active",
  "onboarded_at": "<ISO date>",
  "project_size": "small|medium|large",
  "stack_summary": "<one-line summary, e.g. Next.js 14 + Prisma + PostgreSQL>"
}
```

---

## Second Sprint Behavior

When Compass triggers Sprint mode and `.geas/memory/_project/conventions.md` already exists:

1. **Skip onboarding entirely** — do not re-scan
2. Read conventions.md to load project context
3. Proceed directly to Sprint execution

This makes repeat Sprints fast: no redundant scanning.

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
Ready for Sprint execution.
```
