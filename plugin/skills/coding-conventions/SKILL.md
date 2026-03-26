---
name: coding-conventions
description: Universal coding standards for the AI startup workspace — stack-agnostic
---

# Coding Conventions

## Tech Stack

The tech stack is **NOT predefined**. It is decided by the team at project start:

1. **Forge (CTO)** proposes architecture and stack based on the mission
2. **Nova (CEO)** validates alignment with product vision
3. **Compass (PM)** confirms feasibility within scope
4. Decision is recorded as a Linear issue with label `architecture`

Once decided, Forge creates `workspace/CLAUDE.md` with the chosen stack and conventions.

## Universal Standards (apply regardless of stack)

### Code Quality
- TypeScript strict mode (if using TypeScript)
- No `any` types — always type properly
- Meaningful variable and function names
- One responsibility per function/component

### Error Handling
- Graceful failures with user-facing messages
- Never swallow errors silently
- Log errors with context for debugging

### Structure
- Clear separation of concerns
- Co-locate related files when practical
- Shared types in a dedicated directory

### Git
- Atomic commits with descriptive messages
- Never commit secrets, credentials, or API keys

### UI (if applicable)
- Mobile-first responsive design
- Loading, error, and empty states for every view
- Accessible: proper contrast, focus states, semantic HTML
