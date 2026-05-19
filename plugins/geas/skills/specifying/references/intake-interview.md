# Intake Interview

## Table of Contents

- [Purpose](#purpose)
- [Interview Loop](#interview-loop)
- [Interview Move Priority](#interview-move-priority)
- [Assumption Proposal Gate](#assumption-proposal-gate)
- [Premature Commitment Guard](#premature-commitment-guard)
- [Readiness Checklist](#readiness-checklist)
- [Project Context Scan](#project-context-scan)
- [Outcome & Experience Shape](#outcome--experience-shape)
- [Existing Workflow Replacement](#existing-workflow-replacement)
- [Open Decision Minimum Shape](#open-decision-minimum-shape)
- [Ambiguity Patterns](#ambiguity-patterns)
- [Question Patterns](#question-patterns)
- [Exit Gate](#exit-gate)

## Purpose

Use this reference before drafting Mission Spec. The goal is to turn an unclear User request into a reviewable baseline candidate without silently inventing goals, scope, success criteria, constraints, implementation choices, or excluded work.

## Interview Loop

Repeat this loop until the readiness checklist is satisfied or a stop condition is reached.

1. Restate the User goal in one sentence.
2. Scan for ambiguity using the readiness checklist.
3. Choose the next response move using Interview Move Priority.
4. Reflect the User answer back as updated understanding.
5. Update the Intake Sketch or Baseline Candidate.
6. Check whether Mission Spec drafting is ready.

Ask only the next useful question. Do not send a long questionnaire when one blocker determines the next step.

## Interview Move Priority

Use response moves in this order.

1. Ask one focused question for User-owned facts when the missing fact affects goal, scope, success, constraints, existing workflow, current data, roles, authority, risk tolerance, or acceptance.
2. Offer 2-3 choices when the User can decide between plausible options and the tradeoff is clear.
3. Propose a candidate assumption only when the Assumption Proposal Gate is satisfied.
4. Mark a decision as a non-blocking open decision only when it does not block the current artifact.

Do not replace missing User-owned facts with a preferred design. A recommendation may accompany choices, but it does not remove the need to ask for facts that only the User can know.
Apply the Premature Commitment Guard before writing a Baseline Candidate, Mission Spec, Mission Design, or Task Contract candidate.

## Assumption Proposal Gate

Propose a candidate assumption only when all of these conditions are true:

- the decision is low-risk, reversible, explicitly delegated by the User, or supported by enough User answers and project context;
- the decision does not block the current artifact's goal, scope, acceptance criteria, or reviewability;
- the assumption names its impact, risk, and where it will be verified or revisited;
- the assumption covers one material decision, or a small chunk of 2-3 related decisions with each decision and impact shown separately.

Do not bundle multiple material assumptions into one approval question. If several material decisions remain, ask them as focused questions or as a 2-3 item choice chunk.

## Premature Commitment Guard

Use this guard for broad MVP, greenfield product, internal tool, workflow-replacement, or "make an app/tool/system" requests before drafting or asking for acceptance of any baseline artifact.

A material commitment is confirmed only when the User states it directly, selects it from choices, or explicitly accepts it as a named assumption with impact and risk. Project context may constrain choices, but it does not decide User-owned facts.

Do not default these decisions before confirmation:

- technology stack, framework, runtime, dependency policy, or implementation style;
- data storage, database, file format, persistence, import/export, or retention;
- deployment, hosting, local network sharing, device access, environment, or operational ownership;
- authentication, authorization, role boundaries, audit trail, privacy, or sensitive data handling;
- offline behavior, sync behavior, conflict handling, notification, or recovery expectations;
- data fields, checklist items, states, classifications, identifiers, or reporting shape;
- current workflow replacement details, including who enters items, who reviews them, and what pain the MVP must remove first;
- adjacent scope exclusions such as login, cloud deployment, offline sync, mobile polish, admin tools, or reporting, unless the User has accepted them as out of scope;
- first building Task or Task slicing when multiple reviewable outcomes are still plausible.

When one of these decisions affects Mission Spec goal, included scope, excluded scope, acceptance criteria, constraints, or reviewability, ask one focused question or offer 2-3 choices before drafting. When several decisions remain, provide an Intake Sketch instead of a Baseline Candidate:

```markdown
Intake Sketch:
- Current understanding: <one-sentence goal>
- User-confirmed facts: <facts only>
- Blocking question: <one next question or choice>
- Open decisions for later: <non-blocking decisions with owner and resolution point>
```

For a field inspection MVP request where field staff record inspection results on mobile and office staff review them later, first clarify the current inspection workflow, checklist/data fields, users/roles, shared access environment, or minimum acceptable evidence. Do not state or ask approval for Node.js, JSON files, local-network sharing, no login, no cloud deployment, or no offline sync unless the User has stated or selected those choices.

## Readiness Checklist

Before drafting Mission Spec, confirm each item is answered, explicitly assumed, marked not applicable, or marked as a non-blocking open decision.

- [ ] Goal: What outcome is the User trying to achieve?
- [ ] Background: Why does this matter now?
- [ ] Project context: If an existing workspace matters, what current state, files, conventions, constraints, or instructions should shape the baseline?
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
If a broad MVP or product request triggers the Premature Commitment Guard, do not mark a material commitment as assumed until the guard conditions are met.

## Project Context Scan

Run a lightweight Project Context Scan when the Mission changes, extends, explains, or depends on an existing workspace. The goal is to avoid drafting a baseline from User wording alone when current project state should constrain the Mission.

Mark project context not applicable when the Mission is greenfield, the User supplies all necessary content, the workspace is unavailable, or the existing workspace cannot affect scope, success, verification, or risk.

Inspect only context that can affect the current baseline artifact:

- relevant top-level structure and likely target areas;
- project-local instructions, conventions, or ownership notes when available;
- existing artifacts, docs, schemas, examples, or outputs related to the User goal;
- build, test, packaging, runtime, or entrypoint clues when they affect success or verification;
- current accepted baseline, Evidence, User Judgment, Memory, or debt refs when this is a revision.

Keep the scan focused. Do not inventory the whole workspace by default. Prefer targeted file listing and search terms derived from the User goal, then record concise observations with refs in the Baseline Candidate.

If current project state conflicts with the User request, surface the conflict as a decision. If a needed target or instruction cannot be read, ask the User, mark it as a blocking open decision, or stop.

Project context does not replace User intent. Use it to ask better questions, avoid false assumptions, and preserve existing conventions.

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

## Existing Workflow Replacement

Run this pattern when the Mission replaces or upgrades an existing spreadsheet, document, manual process, inbox, tracker, tool, or handoff flow.
Treat a new MVP that digitizes a manual field, office, approval, inspection, reporting, or handoff process as workflow replacement unless the User says there is no current workflow.

Ask about the current workflow before proposing the replacement shape. Start with the smallest set of User-owned facts that changes the baseline:

- current fields, columns, labels, states, or artifacts;
- where new items come from and who enters them;
- how items are currently classified, prioritized, assigned, reviewed, or closed;
- who needs shared access, ownership, permissions, or auditability;
- what must remain compatible with the old workflow;
- what pain is most important to remove in the MVP;
- what can stay manual or out of scope for the first version.

After the current workflow is understood, offer replacement options or a recommended assumption. Keep the recommendation separate from the facts gathered from the User.

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

Premature implementation ambiguity:
- The User asks for an MVP, app, tool, or system, and the agent can imagine a stack, storage model, deployment model, access boundary, or scope exclusions.
- Response move: use the Premature Commitment Guard; ask the next User-owned fact or offer choices instead of proposing a bundled implementation assumption.

Verification ambiguity:
- The result can be produced but not checked.
- Response move: ask what evidence would support acceptance.

Project context ambiguity:
- The request touches existing work, but relevant current files, conventions, instructions, or constraints are unknown.
- Response move: run a focused context scan, then ask about conflicts or missing context that block the current artifact.

Existing workflow ambiguity:
- The Mission replaces a spreadsheet, document, manual process, inbox, tracker, or existing tool, but the current workflow is unknown.
- Response move: ask for the current fields, actors, item flow, classification or assignment rules, access needs, and pain points before proposing a replacement shape.

## Question Patterns

Use questions that make the User's real goal easier to state.

Good:
- "I understand the goal as `<summary>`. Is that the outcome you want, or is the core goal different?"
- "What observable result would make this acceptable?"
- "What must be included now, and what should stay out of this Mission?"
- "Which of these is closest: A, B, or C?"
- "Can I carry `<assumption>` as an assumption, or should we decide it now?"
- "What are the current fields, steps, and handoffs in the workflow this Mission is replacing?"

Avoid:
- "Should I make it good?"
- "Should I make it scalable?"
- "Do you want everything handled?"
- "This implementation is fine, right?"
- "Can I just proceed?"
- "I'll assume these seven product decisions; approve?"
- "I'll use Node.js, JSON files, local-network access, no login, and no offline sync; approve?"

## Exit Gate

End intake and draft Mission Spec only when:

- every readiness item is answered, confirmed as an assumption, marked not applicable, or listed as a non-blocking open decision;
- the Premature Commitment Guard is satisfied for broad MVP, greenfield, product, or workflow-replacement requests;
- open decisions do not block Mission Spec review;
- each open decision has decision, impact, reason non-blocking, owner, resolution point, and blocks fields;
- the User can reject or correct the summarized Baseline Candidate;
- success can be described as observable acceptance criteria or completion criteria.

If the exit gate is not met, continue the interview or stop with the missing decision.
