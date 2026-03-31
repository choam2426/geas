# Sprint Mode Guide

## When to Use

Sprint mode is for adding a bounded feature to an existing project. Use it when the codebase already exists and you have one clear addition to make — a new endpoint, a UI page, a background job, a service integration.

Sprint skips the Discovery phase. It does not scaffold a new project or establish architectural patterns from scratch. The existing codebase is the constraint.

## Pre-conditions

- Existing codebase in any language or framework
- Git repository initialized at the project root
- A clear feature description (one addition, not a refactor of the whole system)

---

## How It Works

### First Sprint (New to Geas)

1. Geas detects no `.geas/` state — initializes the runtime directory
2. Forge onboards the codebase — scans marker files, maps architecture, writes `.geas/memory/_project/conventions.md`
3. Intake asks about your feature — 1-2 focused questions (lighter than Initiative):
   - What exactly does this feature do?
   - What existing code does it touch?
   - What should NOT change?
4. No `seed.json` exists yet — Intake creates a minimal one with project identity (mission, target user, detected constraints) and stamps it `"source": "sprint"` to mark it as auto-generated rather than from a full Initiative intake
5. Feature scope (acceptance criteria, scope boundaries) goes into the TaskContract — not into seed.json
6. Full pipeline executes

### Subsequent Sprints

1. Geas reads existing `.geas/` state — no re-initialization
2. `seed.json` is READ-ONLY — not modified under any circumstance
3. Intake asks about the new feature (same 1-2 questions)
4. Feature scope goes into the TaskContract
5. Pipeline executes directly — no onboarding delay

---

## seed.json Behavior

| Situation | Behavior |
|-----------|----------|
| `seed.json` exists (from Initiative or prior Sprint) | Read for project context (mission, constraints). Never modified. |
| `seed.json` does not exist (first Sprint) | Minimal seed created with project identity. Stamped `"source": "sprint"`. |

Feature-specific scope — acceptance criteria, what is in scope, what is out of scope — always goes into the TaskContract, not into seed.json. This keeps the project identity stable across all Sprints.

---

## The Pipeline

Sprint runs the same steps as Initiative MVP Build, applied to one task:

| Step | Agent | Mandatory |
|------|-------|-----------|
| Compile TaskContract | task-compiler | Always |
| Design | Palette | If user-facing interface |
| Tech Guide | Forge | If new libs, new schema, or cross-module changes |
| Implementation Contract | Worker + Sentinel + Forge | Always |
| Implementation | Worker (worktree isolated) | Always |
| Code Review | Forge | Always |
| Testing | Sentinel | Always |
| Evidence Gate | — | Always |
| Critic Pre-ship Review | Critic | Always |
| Nova Product Review | Nova | Always |
| Retrospective | Scrum | Always |
| Commit | Keeper | On ship |

Design and Tech Guide have skip conditions. Everything else is mandatory — Code Review and Testing cannot be removed.

The TaskContract includes a `rubric` array used during Evidence Gate evaluation. Default rubric dimensions: `core_interaction`, `feature_completeness`, `code_quality`, `regression_safety`. Frontend tasks add `ux_clarity` and `visual_coherence`. All scores must meet threshold before the gate passes.

---

## Onboarding

The first Sprint triggers Forge to scan the codebase before any work begins.

**What Forge detects:**

- Stack from marker files (`package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `requirements.txt`)
- Framework, build system, test framework, package manager
- Entry points, routing patterns, database connections, key modules
- Naming conventions, import style, linter and formatter config

**Scan depth adapts to project size:**

| Size | Files | Strategy |
|------|-------|----------|
| Small | ~50 | Full scan — all source files |
| Medium | 50–500 | Focused — `src/`, config, entry points, key modules |
| Large | 500+ | Targeted — only directories relevant to the Sprint feature |

**Output:** `.geas/memory/_project/conventions.md` — a structured summary of stack, build commands, key paths, architecture notes, and conventions.

Subsequent Sprints skip onboarding entirely. If `conventions.md` already exists, Forge reads it and the pipeline starts immediately.

---

## Real Example: Settlement and Dispute Feature

Sprint on an existing auction platform:

- TaskContract `SP-01` compiled with 6 rubric dimensions (core interaction, feature completeness, code quality, regression safety, UX clarity, visual coherence)
- Implementation Contract: 21 discrete actions, 10 edge cases documented and approved before coding started
- All rubric scores at or above 4 at Evidence Gate — shipped

---

## Tips

- **Keep the feature bounded.** One clear addition. If the description covers multiple independent subsystems, break it into separate Sprints.
- **State scope_out explicitly** when describing your feature. "This should NOT touch the existing payment flow" is as important as what the feature should do.
- **Existing code constraints are auto-detected** from `conventions.md` — you do not need to re-describe the stack. Forge already knows it.
- **If the codebase changes significantly** between Sprints (major refactor, stack migration), delete `conventions.md` and tell Geas to re-onboard. The next Sprint will re-scan from scratch.
- **seed.json is immutable after creation.** If the project mission or constraints change fundamentally, use `/geas:pivot-protocol` rather than editing the seed by hand.
