---
name: write-stories
description: Break a feature or mission into user stories with acceptance criteria.
---

# Write User Stories

Break down a feature idea or mission into structured user stories.

## Input
$ARGUMENTS — a feature description, mission statement, or problem to solve.

## Output Format

For each story, produce:

```markdown
### Story: <title>

**As a** <user type>
**I want to** <action>
**So that** <benefit>

**Acceptance Criteria:**
- [ ] <criterion 1>
- [ ] <criterion 2>
- [ ] <criterion 3>

**Priority:** P0 (must) / P1 (should) / P2 (nice)
**Estimate:** S / M / L
```

## Guidelines

- Each story should be **independent** — it can be built and shipped alone
- Each story should be **testable** — acceptance criteria are specific and verifiable
- Order stories by priority (P0 first)
- Keep stories small — if a story needs more than 3-5 acceptance criteria, split it
- Include edge cases in acceptance criteria (empty state, error state, max limits)
- Think from the user's perspective, not the developer's
