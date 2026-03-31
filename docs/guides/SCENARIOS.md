# User Scenarios

These scenarios describe how users interact with Geas across its three execution modes — Initiative, Sprint, and Debate — plus common variations like session resume and first-time onboarding.

---

## Scenario 1: New Product from Scratch (Initiative)

### Actor

A developer with a product idea and no existing codebase. They want a working MVP — not a prototype — with architecture, tests, documentation, and a security review.

### Preconditions

- Empty directory with `git init` done
- A mission idea in the developer's head (e.g., "a habit-tracking app with streaks and a dashboard")
- Geas plugin installed

### Flow

1. **You** describe the mission in plain language.
2. **Intake** asks focused questions one at a time — scope boundaries, target user, constraints, success criteria, what is explicitly out of scope. It presents 2–3 approach options with trade-offs and lets you choose direction.
3. **You** answer each question and approve sections as they are finalized.
4. **Intake** freezes the spec as `.geas/spec/seed.json`. The seed is immutable from this point.
5. **Nova** delivers a vision statement, MVP scope, and user value proposition. Writes the PRD and breaks it into user stories.
6. **Forge** proposes the architecture and tech stack, writes project conventions to `.geas/memory/_project/conventions.md`.
7. **Circuit**, **Palette**, and **Critic** vote on the architecture in parallel. If all agree, Genesis continues. If anyone disagrees, a structured debate runs first, then re-vote.
8. **Task Compiler** converts user stories into TaskContracts with acceptance criteria and scored rubric dimensions.
9. MVP Build begins. For each task, the pipeline runs: Implementation Contract → Implementation (worktree isolated) → Code Review (**Forge**) → QA (**Sentinel**) → Evidence Gate → Critic Review → Nova Review → Retrospective → Resolve.
10. After all tasks pass, **Shield** runs a security review and **Scroll** writes the documentation.
11. **Nova** delivers a final strategic summary. **Keeper** creates the release — version bump, changelog, final commit.

### Decision Points

| When | What you decide |
|------|-----------------|
| Intake | Mission statement, scope in/out, acceptance criteria, approach direction |
| Architecture vote | Whether to accept the proposed architecture (you see each agent's stance) |
| MCP server setup | Which MCP servers to connect based on the tech stack |
| Cut verdict | If Nova decides to Cut a task, you can override or agree |
| Iterate feedback | If a task is sent back for iteration, you can add guidance |

### Expected Outcome

- Working application deployed or ready to deploy
- README, API docs, deployment guide
- `.geas/spec/seed.json` — frozen mission spec
- `.geas/tasks/` — TaskContracts for every feature
- `.geas/evidence/` — code reviews, QA results, implementation contracts
- `.geas/decisions/` — architecture vote records
- `.geas/memory/retro/` — lessons learned per task
- `conventions.md` — project conventions for future Sprints
- Release tagged (e.g., `v0.1.0`)

### Alternate Flows

- **Evidence Gate fails:** The verify-fix loop spawns a fixer agent in a worktree. The fixer addresses failures and the gate re-runs. Retry budget is 3. If exhausted, **Forge** reviews the architecture and **Nova** makes a strategic call (Iterate or Cut).
- **Architecture vote disagrees:** A structured debate runs where disagreeing agents argue their positions. After the debate, agents re-vote. If still no consensus, **Nova** makes the final call.
- **Intake determines mission is too broad:** Intake proposes a decomposition and focuses on the first sub-project. The rest is tracked as future work.
- **Session interrupted mid-task:** See Scenario 4.

---

## Scenario 2: Adding a Feature to an Existing Project (Sprint)

### Actor

A developer working on an existing codebase. They have one clear feature to add — a new endpoint, a UI page, an integration — and want the same verification rigor as a full Initiative, scoped to one task.

### Preconditions

- Existing codebase in any language or framework
- Git repository initialized
- `.geas/` directory exists from a prior Initiative or Sprint (if not, see Scenario 5)
- `conventions.md` already written

### Flow

1. **You** describe the feature. One bounded addition. "Add email notifications when order status changes."
2. **Intake** asks 1–2 focused questions — what the feature does, what it touches, what should NOT change.
3. **Task Compiler** generates a TaskContract with acceptance criteria and rubric dimensions. Feature scope goes into the TaskContract, not into `seed.json`.
4. The full pipeline runs for this one task: Design (**Palette**, if user-facing) → Tech Guide (**Forge**, if new libs or cross-module changes) → Implementation Contract → Implementation (worktree isolated) → Code Review (**Forge**) → QA (**Sentinel**) → Evidence Gate → Critic Review → Nova Review → Retrospective → Resolve.
5. **Keeper** commits with a conventional commit message.
6. Run summary generates the audit trail.

### Decision Points

| When | What you decide |
|------|-----------------|
| Intake | Feature description, scope boundaries, what should not change |
| Implementation Contract | Review the proposed action plan before coding starts (optional — agents approve by default) |
| Cut/Iterate | If Evidence Gate or Nova recommends Cut or Iterate |

### Expected Outcome

- Feature merged to main, verified by Evidence Gate
- `.geas/tasks/{task-id}.json` — TaskContract for this feature
- `.geas/evidence/{task-id}/` — implementation contract, code review, QA results, critic review, nova verdict
- `.geas/memory/retro/{task-id}.json` — lessons learned
- Updated `conventions.md` if the retrospective found new patterns

### Alternate Flows

- **Evidence Gate fails on `regression_safety`:** The existing test suite ran as part of Tier 1 mechanical checks and something broke. The fixer addresses the regression specifically, re-runs the full test suite, and the gate re-evaluates.
- **Feature is too broad:** Intake flags that the description covers multiple independent subsystems and recommends breaking it into separate Sprints.

---

## Scenario 3: Making a Decision Without Code (Debate)

### Actor

A developer or engineering lead facing an architectural, technology, or strategic decision. They want structured reasoning from multiple perspectives before committing to a direction.

### Preconditions

- A decision to make with 2–3 clear options
- Context available (existing codebase state, constraints, why this matters)
- No code needs to be written — just a decision

### Flow

1. **You** describe the decision and identify 2–3 options. "Should we migrate the monolith to microservices, a modular monolith, or use a strangler-fig pattern?"
2. **You** provide context — current pain points, team structure, constraints, time pressure.
3. **Forge** argues FOR one option with technical rationale.
4. **Critic** argues AGAINST and challenges assumptions.
5. **Circuit** evaluates from a backend/scalability perspective.
6. **Palette** evaluates from a UX/frontend perspective.
7. Arguments are synthesized — trade-offs acknowledged, recommendations noted.
8. **You** make the final call.
9. A **DecisionRecord** is written to `.geas/decisions/`.

### Decision Points

| When | What you decide |
|------|-----------------|
| Framing | The question, the options, the context |
| Final call | Which option to choose after hearing all perspectives |

### Expected Outcome

- DecisionRecord in `.geas/decisions/` containing:
  - The decision made and why
  - All options considered with pros, cons, and risks
  - Trade-offs — what you gain and what you lose
  - Which agents argued which positions
  - Specific technical points cited by each agent

### Alternate Flows

- **New option emerges during debate:** An agent proposes an option not in the original framing. You can accept it as a new candidate and the debate expands.
- **No consensus:** Agents disagree fundamentally. The synthesis highlights the disagreement clearly. You decide with full visibility into why each agent holds their position.

---

## Scenario 4: Resuming an Interrupted Session

### Actor

A developer whose previous session was interrupted mid-task — context window limit reached, terminal closed, or machine restarted.

### Preconditions

- `.geas/state/run.json` exists with an in-progress task
- The checkpoint records `current_task_id`, `pipeline_step`, `agent_in_flight`, and `remaining_steps`

### Flow

1. **You** start a new session on the same project directory.
2. Geas detects `run.json` with an in-progress state. Resume triggers automatically.
3. Geas checks whether evidence for the interrupted step already exists in `.geas/evidence/`.
4. **If evidence exists:** The step completed before the session ended. Geas moves to the next step in `remaining_steps`.
5. **If evidence is missing:** The step did not complete. Geas re-runs it from the beginning.
6. The pipeline continues from the resume point through the remaining steps.

### Decision Points

None — resume is automatic. You do not need to specify where to pick up.

### Expected Outcome

- The interrupted task completes through the full remaining pipeline
- No duplicate work — steps with existing evidence are skipped
- The session continues as if uninterrupted

### Alternate Flows

- **Multiple tasks remaining:** After the interrupted task completes, the pipeline moves to the next task in dependency order and continues normally.
- **Evidence is corrupted or incomplete:** Geas treats the step as not completed and re-runs it.

---

## Scenario 5: First Sprint on a Legacy Codebase

### Actor

A developer inheriting or maintaining an existing codebase that has never used Geas. They want to add a feature with verification, but Geas has no knowledge of the project yet.

### Preconditions

- Existing codebase in any language or framework
- Git repository initialized
- No `.geas/` directory exists
- A feature to add

### Flow

1. **You** describe the feature. "Add a health-check endpoint that returns service status and database connectivity."
2. Geas detects no `.geas/` directory — initializes the runtime directory.
3. **Forge** onboards the codebase before any work begins:
   - Scans marker files (`package.json`, `go.mod`, `pyproject.toml`, etc.) to detect the stack
   - Maps architecture — entry points, routing patterns, database connections, key modules
   - Detects naming conventions, import style, linter and formatter config
   - Scan depth adapts: full scan for small projects (~50 files), focused scan for medium (50–500), targeted scan for large (500+)
   - Writes `.geas/memory/_project/conventions.md`
4. **Intake** creates a minimal `seed.json` with project identity — mission, target user, detected constraints. Stamped `"source": "sprint"` to mark it as auto-generated.
5. **Intake** asks 1–2 questions about the feature.
6. The full Sprint pipeline runs — same as Scenario 2.
7. **Scrum** writes a retrospective, updating `conventions.md` with new patterns discovered.

### Decision Points

| When | What you decide |
|------|-----------------|
| Intake | Feature description, what should not change |
| Onboarding review | Optionally review `conventions.md` to check if Forge understood the codebase correctly |

### Expected Outcome

- Feature merged to main, verified by Evidence Gate
- `.geas/` directory initialized with full runtime state
- `conventions.md` — Forge's understanding of the codebase (stack, build commands, key paths, architecture notes)
- `seed.json` — minimal project identity for future Sprints
- Subsequent Sprints skip onboarding entirely — they read `conventions.md` and start immediately

### Alternate Flows

- **Forge misidentifies the stack:** You notice `conventions.md` has incorrect information. Delete `conventions.md` and tell Geas to re-onboard. The next Sprint re-scans from scratch.
- **Codebase is too large for targeted scan to cover the feature area:** Forge asks which directories are relevant to the feature before scanning.
