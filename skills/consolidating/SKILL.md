---
name: consolidating
description: "Internal consolidation procedure. Use only inside an active Mission or explicit mission handoff to compare accepted Task Evidence against the Mission baseline, prepare Mission judgment context, and propose reflection or Memory candidates."
---

# Consolidating

Use this skill to prepare Mission-level User Judgment input after Task Evidence has been accepted.

Consolidating compares accepted Task results to Mission Spec and Mission Design. It prepares the User's Mission judgment input and reflection/Memory candidates. The calling context records Mission User Judgment, Memory, and Mission Evidence after the User decides.

## Core Rules

- Use accepted Task Evidence as the primary Task-level summary.
- Compare against latest Mission Spec and Mission Design.
- Separate gap, debt, and follow-up.
- Surface accepted and remaining unverified scope.
- Prepare Memory candidates only from Evidence-backed repeated lessons.
- Return Mission judgment input to the calling context; do not write Mission Evidence.

## Workflow

1. Read Mission Spec, Mission Design, accepted Task Evidence, relevant role Evidence, User Judgments, and Memory.
2. Load `references/mission-judgment-input.md`.
3. Map Mission acceptance criteria to Task Evidence.
4. Identify Mission Design deltas.
5. Classify gaps, debts, follow-ups, unverified scope, and remaining risk.
6. Load `references/reflection-memory.md`.
7. Prepare reflection summary and Memory candidates.
8. Return a Mission User Judgment input packet to the calling context.

The calling context then asks the User for Mission result judgment and records Memory and Mission Evidence if accepted.

## References

- `references/mission-judgment-input.md`: Prepare the input for Mission-level User Judgment.
- `references/reflection-memory.md`: Prepare reflection and Memory candidates after Mission acceptance.
