---
name: write-prd
description: Create a Product Requirements Document from a feature idea or mission.
---

# Write PRD

Create a structured Product Requirements Document.

## Input
$ARGUMENTS — a feature idea, problem statement, or mission.

## Output Format

```markdown
# PRD: <product/feature name>

## Problem
What problem are we solving? Who has this problem? How do they deal with it today?

## Objective
What does success look like? Define 2-3 measurable outcomes.

## Target Users
Who is the primary user? What are their characteristics and needs?

## Scope

### In Scope (MVP)
- Feature 1
- Feature 2

### Out of Scope
- Feature X (why: too complex for MVP)
- Feature Y (why: not validated)

## User Flows
Describe the key user journeys step by step.

## Requirements

### Functional
| # | Requirement | Priority | Notes |
|---|-------------|----------|-------|
| 1 | ... | P0 | ... |

### Non-Functional
- Performance: ...
- Accessibility: ...
- Security: ...

## Success Metrics
How will we measure if this is working?

## Open Questions
What do we still need to figure out?
```

## Guidelines

- Keep it concise — a PRD is a communication tool, not a novel
- Focus on the "what" and "why", not the "how" (that's for the engineers)
- Every requirement should trace back to a user need
- Be explicit about what's out of scope — this prevents scope creep
