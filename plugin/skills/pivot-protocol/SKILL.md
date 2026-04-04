---
name: pivot-protocol
description: When and how to pivot during product development
---

# Pivot Protocol

## When to Pivot

A pivot is triggered when ANY of these occur:
- qa_engineer reports >50% test failure rate on core features
- A core feature is technically infeasible with the current stack
- architecture_authority identifies a fundamental architecture problem
- product_authority judges that a feature doesn't deliver enough user value ("Cut")
- Implementation is taking significantly longer than expected for the value it delivers
- Multiple agents raise concerns about the same approach
- The team discovers mid-build that the user need is different than assumed

**Any team member can suggest a pivot.** You don't need to wait for failures.

## Pivot Process

1. **orchestration_authority escalates to product_authority** with full context:
   - What's wrong and why
   - What the team has tried
   - Options available

2. **product_authority decides** from these options:
   - **Scope cut**: remove non-essential features, focus on what works
   - **Feature drop**: replace a broken feature with a simpler alternative
   - **Approach change**: different technical approach to the same goal
   - **Push through**: if the issue is fixable with reasonable effort
   - **Simplify**: keep the goal but drastically reduce complexity

3. **product_authority records decision** as a DecisionRecord in `.geas/missions/{mission_id}/decisions/` with clear rationale

4. **orchestration_authority restructures** the task board:
   - Cancel dropped TaskContracts with explanation
   - Create new TaskContracts for the new approach
   - Update priorities in `.geas/missions/{mission_id}/tasks/`

5. **Team redirects** and continues from the new plan

## What is NOT a Pivot

- Fixing a minor bug → just fix it
- Refactoring code → normal tech debt work
- Changing a component's appearance → design iteration
- Adding error handling → normal development

A pivot is a **strategic direction change**, not a code fix.
