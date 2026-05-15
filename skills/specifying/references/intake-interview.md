# Intake Interview

## Table of Contents

- [Purpose](#purpose)
- [Interview Loop](#interview-loop)
- [Readiness Checklist](#readiness-checklist)
- [Outcome & Experience Shape](#outcome--experience-shape)
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

Before drafting Mission Spec, confirm each item is answered, explicitly assumed, marked not applicable, or marked as a non-blocking open decision.

- [ ] Goal: What outcome is the User trying to achieve?
- [ ] Background: Why does this matter now?
- [ ] Success: What observable state means this worked?
- [ ] Outcome and experience shape: If the result form or human use/review experience is unclear and could affect acceptance, what shape decisions are needed now?
- [ ] Included scope: What must be part of this Mission?
- [ ] Excluded scope: What should not be included now?
- [ ] Constraints: What must not change, or what limits apply?
- [ ] Verification: How can an agent produce evidence for success?
- [ ] Risks: What could make the result unacceptable or costly?
- [ ] Decision owner: Which decisions require User confirmation?
- [ ] Assumptions: Which assumptions are safe to carry forward only after User confirmation?

If an item is unclear, do not silently fill it. Ask, offer choices, propose a candidate assumption, or keep it as an open decision if it does not block Mission Spec review.

## Outcome & Experience Shape

Run an Outcome & Experience Shape interview when the result form or human use, review, acceptance, or maintenance experience is unclear, has multiple plausible shapes, and could affect scope, acceptance criteria, review cost, or handoff. Mark it not applicable when the result shape is already fixed, the Mission is simple and bounded, or the decision would not affect the current artifact.

Clarify only enough for the affected baseline artifact. Mission Spec needs only the shape decisions that affect goal, scope, or success. Mission Design owns mission-level approach and experience decisions. Task Contract owns executable commitments, acceptance criteria, verification checks, review focus, and first-step work.

Do not ask every dimension by default. Ask only about dimensions that are unclear or likely to affect User acceptance for the current artifact, and present 2-3 choices when that reduces ambiguity.

Useful dimensions:

- Outcome form: document, code, policy, plan, report, design, dataset, automation, decision input, operating procedure, or another deliverable type.
- Audience or user: who will read, use, judge, maintain, or act on the result.
- Use context: when, where, and under what conditions the result will be used.
- Structure or approach: organization, workflow, methodology, architecture, taxonomy, outline, or other shaping decision.
- Presentation or interaction style: narrative, checklist, template, table, decision memo, operating procedure, visual review, form, command surface, API, automation, guided walkthrough, or another suitable mode.
- User journey: first use, repeated use, handoff, failure, recovery, or follow-up flows when the result is interactive, repeated, handed off, or has material failure/recovery behavior.
- Review shape: diff, demo, checklist, summary, screenshot, sample output, walkthrough, or another judgment aid.
- Decision budget: which decisions need User confirmation now, which can be carried as assumptions, and which can wait.
- Constraints: time, scope, format, tools, permissions, cost, compatibility, policy, or environment limits.
- Quality bar: what makes the result good enough for the User's purpose.
- Verification or review: what evidence will let the User judge the result.
- Risks or tradeoffs: speed versus completeness, simplicity versus extensibility, automation versus human review, or other meaningful tradeoff.
- Lifecycle or ownership: whether the result is one-off, maintained, repeated, extended, published, handed off, or owned by a specific person, team, role, or agent.

If the User does not know a shape decision, offer options and a recommended assumption. Carry the decision forward only after the User confirms it or after it is marked as a non-blocking open decision.

If a shape decision affects the current artifact's goal, scope, acceptance criteria, or reviewability, resolve it before drafting that artifact. Do not carry it as a later open decision.

Route shape decisions by ownership. Mission-level outcome form, audience, use context, structure, approach, experience, lifecycle, and ownership usually belong in Mission Design. Directly executable or reviewable commitments, acceptance criteria, verification checks, review focus, concrete quality thresholds, first-Task constraints, and first-step commitments belong in Task Contract.

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

- every readiness item is answered, confirmed as an assumption, marked not applicable, or listed as a non-blocking open decision;
- open decisions do not block Mission Spec review;
- each open decision has decision, impact, reason non-blocking, owner, resolution point, and blocks fields;
- the User can reject or correct the summarized Baseline Candidate;
- success can be described as observable acceptance criteria or completion criteria.

If the exit gate is not met, continue the interview or stop with the missing decision.
