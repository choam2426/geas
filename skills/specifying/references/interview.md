# Interview

Use this reference to elicit the User's goal without guessing away important ambiguity.

## Research-Informed Basis

The interview model applies these source patterns:

- IIBA Business Analysis Standard: prepare, conduct, confirm, and communicate elicitation results; use techniques such as interviews, document analysis, workshops, scope modelling, user stories, acceptance criteria, and reviews.
- PMI requirements elicitation guidance: stakeholder needs often start latent or unclear; elicitation asks questions, selects techniques for the context, iteratively documents, analyzes, and confirms requirements.
- Agile Alliance user story guidance: preserve who, what, and why; use conversation to fill details; split work into valuable increments; apply INVEST as a quality check when useful.
- Atlassian acceptance criteria guidance: criteria should be clear, concise, testable, measurable where possible, outcome-focused, and independent.
- Scrum.org Definition of Done guidance: a shared done criterion improves transparency and makes completed work inspectable.
- Specification-first agent workflow patterns: compare viable approaches, record why one option was selected, and pass a compact context pack to the next stage.

These sources inform the procedure; do not quote them to the User unless the User asks for methodology background.

## Prepare

Before asking the User for more input, collect context that can reduce question cost.

- Read the current User request and recent decisions.
- Inspect existing project structure, docs, tests, build files, and active `.geas/` runtime state when present.
- Identify probable affected surfaces and likely verification checks.
- Identify what the User has already decided in conversation.
- Convert known facts into confirm-this prompts instead of blank questions.

Keep preparation notes as working context. Runtime artifacts start only after the User accepts a baseline payload.

## Project Pre-Scan

Before the first intake question, run a read-only scan that is sized to the request and workspace.

Check:

- Runtime state: `.geas/run-state.yaml`, active Mission, current Task, latest baseline artifacts, and relevant Memory.
- Project shape: top-level files, source directories, documentation directories, and whether the workspace is empty or already an app/library/plugin.
- Manifests and build files: `package.json`, lockfiles, `pyproject.toml`, `Cargo.toml`, `go.mod`, `Makefile`, framework configs, and script entries.
- Tests and checks: `tests/`, `vitest`, `jest`, `pytest`, `cargo test`, CI configs, lint configs, and format configs.
- Existing conventions: nearby components, docs, naming, storage patterns, state management, and UI or API patterns related to the request.
- Likely affected surfaces: files, docs, commands, runtime artifacts, or user flows named by the request or matching its keywords.
- Verification candidates: commands, manual checks, screenshots, rendered artifacts, or review steps that could support later Evidence.

Use scan results as `observed` gate sources only when they are repository, runtime, test, configuration, or artifact facts. Use confirm-this prompts for inferred product intent, stakeholder needs, scope preferences, or delegated decisions.

The pre-scan should reduce question cost. It should not become a separate report unless the User asks for it or the scan reveals drift, missing prerequisites, or conflicting project facts.

## Intake Output Flow

Use this flow to decide what the User sees next:

1. Project Pre-Scan produces working notes: observed facts, candidate interpretation, likely affected surfaces, and candidate verification checks.
2. The first user-facing specifying output is an Intake Sketch unless the current conversation already has a User-accepted Baseline Candidate.
3. Intake Sketches show observed facts and candidate interpretation, then ask the smallest gate-closing question. They do not offer `accept spec`, `accept design`, `accept task contracts`, or runtime recording choices.
4. When every readiness gate has an accepted source status, present a Baseline Candidate. This is still an intake output: it asks whether the candidate should become the basis for a Mission Spec draft.
5. Mission Spec Review starts only after the User accepts the Baseline Candidate as the basis for a Spec draft.

## Interview Expansion Triggers

Use these triggers to decide when intake needs more than a quick confirm-this round. These are interview effort signals, not runtime fields.

| Trigger | Intake Response |
| --- | --- |
| Broad delegation | Clarify which decisions the agent may make and which decisions return to the User. |
| Data, security, permissions, or migration | Ask for constraints, failure cost, and review evidence before drafting acceptance criteria. |
| Storage or persistence choice | Compare approach options and lock the review path for data loss or migration risk. |
| Long-term maintenance cost | Ask what future change should remain easy and what complexity stays out. |
| "Real use", "production-ready", "app-like", or "extend later" language | Clarify stakeholder, review cost, and boundary before proposing a baseline. |

Every Mission still receives a Mission Design. Keep it short when the tradeoff surface is small.

## Intake Stages

Separate draft types so the User can see whether the conversation is still discovering requirements or ready for artifact-specific review.

| Stage | Use When | Output |
| --- | --- | --- |
| Intake Sketch | One or more readiness gates are `open`, or the User asks for a draft before readiness is complete. | Current interpretation, candidate assumptions, gate status, unresolved questions, and the next gate-closing question. |
| Baseline Candidate | Every readiness gate has source status `confirmed`, `observed`, `delegated`, or `deferred`, but the User has not yet accepted the candidate as the basis for a Mission Spec draft. | Compact candidate goal, boundary, evidence path, decision ownership, review cost, assumptions, risks, and the choice to draft Mission Spec from it or revise intake. |
| Artifact Review | The current artifact draft has the prerequisite accepted artifact and is ready for User review. | Mission Spec Review, Mission Design Review, or Task Contract Review with choices scoped to that artifact. |
| Baseline Readiness Review | Mission Spec, Mission Design, and initial Task Contracts have each been accepted and recorded. | Transition packet with readiness blockers, transfer context, and choices to start building or return to a specific artifact. |

## Elicitation Loop

Run Discovery, Compression, Options, and Locking until every minimum readiness gate has a confirmed value, observed project fact, explicit User delegation, or explicit User decision to defer it.

1. Discovery: ask open-ended questions that reveal the desired outcome, real users or reviewers, the problem being solved, and known constraints.
2. Compression: turn several ambiguities into the smallest useful decision. State the core choice in the User's language.
3. Options: present two or three viable approaches with tradeoffs. Include the recommended option when the available context supports one.
4. Locking: convert the User's answer into Mission Spec, Mission Design, Task Contract fields, or explicit assumptions. State which user-owned decisions remain open.

Use open questions for Discovery, then closed or confirm-this questions for Locking. Move to Baseline Candidate after the readiness gates are filled from accepted sources. Move to Mission Spec Review only after the User accepts the Baseline Candidate as the basis for a Spec draft. When a gate remains open, continue the interview with the smallest question that fills that gate.

For structured choices, ask one decision at a time. Offer two to four options that differ in scope, cost, risk, or review path, plus a free-form escape so the User can correct the frame.

## Gate Sources

Track the source of each readiness gate.

| Status | Meaning |
| --- | --- |
| `confirmed` | The User directly answered, corrected, or accepted the value for this gate. |
| `observed` | The value comes from repository, runtime, test, configuration, or artifact facts. |
| `delegated` | The User explicitly gave the agent authority to decide this gate within stated boundaries. |
| `deferred` | The User explicitly chose to postpone this gate, and the baseline names the consequence. |
| `open` | The value is missing or exists only as an agent-created candidate assumption. |

Agent-created candidate assumptions help form questions and partial drafts. They do not fill readiness gates until the User confirms, delegates, or defers them.

Observed project facts can close gates about existing files, runtime state, manifests, tests, commands, or recorded artifacts. They do not close gates about why the User wants the work, who will judge it, which product decisions the agent may make, or what review burden is acceptable unless those facts are explicitly recorded in existing accepted artifacts.

## Intake Sketch Before Readiness

After pre-scan, or when the User asks for a draft before readiness gates are filled, provide an Intake Sketch rather than an artifact review packet.

Include:

- Current interpretation.
- Candidate assumptions, labeled as unconfirmed.
- Readiness gate status.
- Unresolved questions.
- The next smallest question that would close the most important open gate.

Offer choices that answer open gates. Reserve artifact acceptance choices for the appropriate Mission Spec, Mission Design, or Task Contract review after readiness blockers are cleared.

## Minimum Readiness Gates

Each gate describes information that must appear in the baseline. The gate is complete when the baseline contains the information and its source status is `confirmed`, `observed`, `delegated`, or `deferred`.

| Gate | Baseline Information Required |
| --- | --- |
| Outcome | The desired end state, the reason it matters now, and the observable change from the current state. |
| Stakeholder | The user, reviewer, or affected party whose needs shape the work, plus what they care about most. |
| Boundary | The included scope, excluded adjacent work, and constraints that protect unrelated behavior or documents. |
| Evidence | The verification basis for each acceptance criterion, plus known unverified scope that the User will need to review. |
| Decision Ownership | Decisions delegated to the agent, decisions retained by the User, and triggers for returning to the User. |
| Review Cost | The artifacts, output, screenshots, commands, or notes that make human review and acceptance judgment practical. |

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

Use when the User is choosing scope, cost, or review burden.

```text
The Mission can either cover only the procedure files, or also update the docs that describe them. I recommend covering both when the docs are the review baseline for this step. Which boundary do you want?
```

### Decision Ownership Prompt

Use when agent autonomy could blur User responsibility.

```text
For wording tradeoffs inside role guidance, should I choose and report them, or bring back boundary decisions that change scope, risk, or review burden?
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
- Readiness gate status.
- Readiness gate source.

Do not leave important answers only in prose conversation. If the answer will govern implementation, make it part of the baseline draft.

## Quality Bar

The interview is ready to present a Baseline Candidate when:

- Minimum readiness gates have source status `confirmed`, `observed`, `delegated`, or `deferred`.
- The goal is stated as a desired end state.
- Included scope names the surfaces to change, and excluded scope names adjacent work that stays outside the Mission.
- Acceptance criteria are observable enough for User review.
- Verification expectations are connected to criteria.
- Constraints and risks are visible.
- User-owned decisions are identified.
- Remaining assumptions are few and explicit.
- The User can reject, revise, or accept the candidate as the basis for a Mission Spec draft without reconstructing the conversation.
