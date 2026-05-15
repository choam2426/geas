# Intake Interview

## Table of Contents

- [Purpose](#purpose)
- [Interview Loop](#interview-loop)
- [Readiness Checklist](#readiness-checklist)
- [Open Decision Minimum Shape](#open-decision-minimum-shape)
- [Ambiguity Patterns](#ambiguity-patterns)
- [Question Patterns](#question-patterns)
- [Exit Gate](#exit-gate)

## Purpose

Use this reference before drafting Mission Spec. The goal is to turn an unclear User request into a reviewable baseline candidate without silently inventing goals, scope, success criteria, or constraints.

## Interview Loop

Repeat this loop until the readiness checklist is satisfied or a stop condition is reached.

1. Restate the User goal in one sentence.
2. Scan for ambiguity using the readiness checklist.
3. Choose one response move:
   - ask one focused question;
   - offer 2-3 choices;
   - propose a candidate assumption for User confirmation;
   - mark a non-blocking item as an open decision with the minimum shape below.
4. Reflect the User answer back as updated understanding.
5. Update the Baseline Candidate.
6. Check whether Mission Spec drafting is ready.

Ask only the next useful question. Do not send a long questionnaire when one blocker determines the next step.

## Readiness Checklist

Before drafting Mission Spec, confirm each item is answered, explicitly assumed, or marked as a non-blocking open decision.

- [ ] Goal: What outcome is the User trying to achieve?
- [ ] Background: Why does this matter now?
- [ ] Success: What observable state means this worked?
- [ ] Included scope: What must be part of this Mission?
- [ ] Excluded scope: What should not be included now?
- [ ] Constraints: What must not change, or what limits apply?
- [ ] Verification: How can an agent produce evidence for success?
- [ ] Risks: What could make the result unacceptable or costly?
- [ ] Decision owner: Which decisions require User confirmation?
- [ ] Assumptions: Which assumptions are safe to carry forward only after User confirmation?

If an item is unclear, do not silently fill it. Ask, offer choices, propose a candidate assumption, or keep it as an open decision if it does not block Mission Spec review.

## Open Decision Minimum Shape

Use this shape before carrying an ambiguity forward as a non-blocking open decision.

```markdown
- Decision: <what remains undecided>
- Impact: <what could change if the decision goes one way or another>
- Reason non-blocking: <why Mission Spec review can proceed now>
- Owner: User | agent | later role/stage
- Resolution point: Mission Design | Task Contract | building | later Task
- Blocks: none | Mission Spec | Mission Design | Task Contract | building
```

An open decision is non-blocking only when `Blocks` is `none` for the current artifact. If it blocks the current artifact, continue the interview or stop with the missing decision.

## Ambiguity Patterns

Goal ambiguity:
- The User names an activity but not the intended outcome.
- Response move: restate the likely outcome and ask if that is the real goal.

Scope ambiguity:
- The User names a broad area without included and excluded work.
- Response move: ask what must be included now and what can stay out.

Success ambiguity:
- The User asks for improvement without observable acceptance criteria.
- Response move: ask what result would convince them it worked.

Constraint ambiguity:
- The User implies limits such as compatibility, style, files, time, tools, or risk tolerance without naming them.
- Response move: ask for the constraint or propose a candidate assumption.

Priority ambiguity:
- The request has competing goals such as speed, quality, simplicity, completeness, compatibility, or polish.
- Response move: offer 2-3 priority choices.

Decision ambiguity:
- The agent could choose, but the choice changes scope, risk, or User acceptance.
- Response move: ask the User to decide or mark it as an open decision.

Verification ambiguity:
- The result can be produced but not checked.
- Response move: ask what evidence would support acceptance.

## Question Patterns

Use questions that make the User's real goal easier to state.

Good:
- "I understand the goal as `<summary>`. Is that the outcome you want, or is the core goal different?"
- "What observable result would make this acceptable?"
- "What must be included now, and what should stay out of this Mission?"
- "Which of these is closest: A, B, or C?"
- "Can I carry `<assumption>` as an assumption, or should we decide it now?"

Avoid:
- "Should I make it good?"
- "Should I make it scalable?"
- "Do you want everything handled?"
- "This implementation is fine, right?"
- "Can I just proceed?"

## Exit Gate

End intake and draft Mission Spec only when:

- every readiness item is answered, confirmed as an assumption, or listed as a non-blocking open decision;
- open decisions do not block Mission Spec review;
- each open decision has decision, impact, reason non-blocking, owner, resolution point, and blocks fields;
- the User can reject or correct the summarized Baseline Candidate;
- success can be described as observable acceptance criteria or completion criteria.

If the exit gate is not met, continue the interview or stop with the missing decision.
