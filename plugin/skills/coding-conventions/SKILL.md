---
name: coding-conventions
description: Follow project conventions from conventions.md. Update when new patterns emerge. Default to Google Style Guide for unlisted areas.
---

# Coding Conventions

## Primary Source

Read `.geas/memory/_project/conventions.md` before writing any code. This file contains the project's specific stack, build commands, naming patterns, and architectural decisions detected during onboarding.

**Follow conventions.md exactly.** If it says the project uses tabs, use tabs. If it says the test command is `pytest`, use `pytest`. Do not override project conventions with personal preferences.

## When conventions.md Is Silent

For coding patterns not covered by conventions.md, follow the **Google Style Guide** for the project's language:

- Use the style guide for the language detected in conventions.md (e.g., Python, Go, Java, C++, Kotlin)
- When multiple style guides conflict, prefer the one closest to existing project patterns
- If no language-specific guide exists, apply general principles: clarity over cleverness, consistency over novelty

## Updating Conventions

When you discover a new pattern during implementation that is not yet in conventions.md:

1. **Verify it is consistent** with existing patterns in the file
2. **Add it** to the appropriate section of conventions.md
3. **Keep entries concrete** — "API routes use camelCase for URL params" not "use consistent naming"

Do NOT update conventions.md with personal preferences or hypothetical patterns. Only add patterns that are established in the codebase or decided by the team.

## What This Skill Does NOT Do

- Does not define specific coding rules (those belong in conventions.md)
- Does not prescribe any language, framework, or tooling
- Does not override project-specific patterns
