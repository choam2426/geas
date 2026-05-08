# Interview

Use this reference to elicit the User's goal without guessing away important ambiguity.

## Research-Informed Basis

The interview model applies these source patterns:

- IIBA Business Analysis Standard: prepare, conduct, confirm, and communicate elicitation results; use techniques such as interviews, document analysis, workshops, scope modelling, user stories, acceptance criteria, and reviews.
- PMI requirements elicitation guidance: stakeholder needs often start latent or unclear; elicitation asks questions, selects techniques for the context, iteratively documents, analyzes, and confirms requirements.
- Agile Alliance user story guidance: preserve who, what, and why; use conversation to fill details; split work into valuable increments; apply INVEST as a quality check when useful.
- Atlassian acceptance criteria guidance: criteria should be clear, concise, testable, measurable where possible, outcome-focused, and independent.
- Scrum.org Definition of Done guidance: a shared done standard improves transparency and makes completed work inspectable.

These sources inform the procedure; do not quote them to the User unless the User asks for methodology background.

## Prepare

Before asking the User for more input, collect context that can reduce question cost.

- Read the current User request and recent decisions.
- Inspect existing project structure, docs, tests, build files, and active `.geas/` runtime state when present.
- Identify probable affected surfaces and likely verification checks.
- Identify what the User has already decided in conversation.
- Convert known facts into confirm-this prompts instead of blank questions.

Keep preparation notes as working context. Runtime artifacts start only after the User accepts a baseline payload.

## Elicitation Loop

Run this loop until Mission Spec fields are concrete enough for User review.

1. State the current interpretation in one or two sentences.
2. Name the one gap that most affects scope, success, verification, or User responsibility.
3. Ask one focused question.
4. Offer two to four concrete options when the choice has clear tradeoffs.
5. Include a free-form escape when options may miss the User's intent.
6. Reflect the answer back as a baseline update.
7. Record remaining assumptions explicitly.

Use open questions for goal discovery, then closed or confirm-this questions for baseline locking.

## Question Ladder

Use the smallest question that resolves the current uncertainty.

| Need | Question Pattern |
| --- | --- |
| Goal | "What state should be true when this Mission is successful?" |
| Motivation | "Why does this matter now?" |
| User or audience | "Who will judge whether this result is useful?" |
| Scope in | "Which surfaces must this Mission change or produce?" |
| Scope out | "Which tempting adjacent work should stay outside this Mission?" |
| Acceptance | "What observable result would make you accept this?" |
| Verification | "What check, test, review, run, or artifact should support that criterion?" |
| Constraint | "What must remain true while we work?" |
| Risk | "What failure would be expensive, embarrassing, unsafe, or hard to unwind?" |
| Delegation | "Which decisions may the agent make, and which decisions must come back to you?" |
| Review cost | "What would make your final review easy rather than exhausting?" |

## Interaction Patterns

### Confirm-This Prompt

Use when context suggests the likely answer.

```text
I found Vitest config and existing tests under tests/. Should verification for this Mission include running the relevant Vitest suite unless the Task Contract says otherwise?
```

### Tradeoff Prompt

Use when the User is choosing depth or scope.

```text
The Mission can either cover only the Skill/Agent prompt files, or also update docs that describe them. I recommend covering both because the docs are the baseline for this step. Which boundary do you want?
```

### Decision Ownership Prompt

Use when agent autonomy could blur User responsibility.

```text
For wording tradeoffs inside role prompts, should I choose and report them, or bring each meaningful persona/boundary decision back to you?
```

### Ambiguity Compression Prompt

Use when many small ambiguities share one root decision.

```text
Most open questions come from one boundary: whether this Mission should optimize for a small usable slice or a complete first version. Which target should govern the Task Contracts?
```

## Capture Rules

Every material answer should become one of:

- Mission Spec field.
- Mission Design field.
- Task Contract field.
- Explicit assumption.
- Risk.
- Excluded scope.
- User decision to revisit later.

Do not leave important answers only in prose conversation. If the answer will govern implementation, make it part of the baseline draft.

## Quality Bar

The interview is ready to move to Mission Spec review when:

- The goal is stated as a desired end state.
- Included and excluded scope are both meaningful.
- Acceptance criteria are observable enough for User review.
- Verification expectations are connected to criteria.
- Constraints and risks are visible.
- User-owned decisions are identified.
- Remaining assumptions are few and explicit.
- The User can reject, revise, or accept the draft without reconstructing the conversation.
