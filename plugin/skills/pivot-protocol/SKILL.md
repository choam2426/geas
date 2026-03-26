---
name: pivot-protocol
description: When and how to pivot during product development
---

# Pivot Protocol

## When to Pivot

A pivot is triggered when ANY of these occur:
- Sentinel reports >50% test failure rate on core features
- A core feature is technically infeasible with the current stack
- Forge identifies a fundamental architecture problem
- Nova judges that a feature doesn't deliver enough user value ("Cut")
- Implementation is taking significantly longer than expected for the value it delivers
- Multiple agents raise concerns about the same approach in Linear comments
- The team discovers mid-build that the user need is different than assumed

**Any team member can suggest a pivot via Linear comment.** You don't need to wait for failures.

## Pivot Process

1. **Compass escalates to Nova** with full context:
   - What's wrong and why
   - What the team has tried
   - Options available

2. **Nova decides** from these options:
   - **Scope cut**: remove non-essential features, focus on what works
   - **Feature drop**: replace a broken feature with a simpler alternative
   - **Approach change**: different technical approach to the same goal
   - **Push through**: if the issue is fixable with reasonable effort
   - **Simplify**: keep the goal but drastically reduce complexity

3. **Nova posts decision as Linear comment** with clear rationale

4. **Compass restructures** the Linear board:
   - Cancel dropped issues with explanation
   - Create new issues for the new approach
   - Update priorities
   - Comment on affected issues to notify agents

5. **Team redirects** and continues from the new plan

## What is NOT a Pivot

- Fixing a minor bug → just fix it
- Refactoring code → normal tech debt work
- Changing a component's appearance → design iteration
- Adding error handling → normal development

A pivot is a **strategic direction change**, not a code fix.
