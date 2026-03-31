# Initiative Mode Guide

## When to Use

Initiative mode is for starting something new from scratch — a product, a service, a tool. Use it when:

- You have a mission but no codebase yet
- You need a team to think through architecture, not just write code
- You want every decision traceable and every output verified

If you are adding a feature to an existing project, use Sprint mode instead.

---

## Before You Start: Intake

Before Initiative runs, Geas needs a frozen mission spec. If you do not have one, run `/geas:intake` first.

Intake works section by section:

1. The agent reads your raw mission and checks if it is too broad. If so, it proposes a decomposition and focuses on the first sub-project.
2. It asks you questions one at a time — scope boundaries, target user, constraints, success criteria, what is explicitly out of scope.
3. It presents 2–3 approach options with trade-offs and lets you choose direction.
4. It walks through each section of the spec, gets your approval, then freezes it.

The result is `.geas/spec/seed.json`. Once confirmed, the seed does not change during the session. If the mission needs to shift mid-build, that triggers a pivot protocol, not an edit.

**What you decide during intake:** mission statement, scope in/out, acceptance criteria, target user, constraints, approach direction.

---

## The Four Phases

### Phase 1: Discovery

Everything before a single line of code is written.

**What happens:**

1. Seed check — Geas reads `seed.json`. If the completeness checklist has gaps and no override is set, it returns to intake.
2. **Nova** delivers a vision statement, MVP scope definition, and user value proposition.
3. **Nova** writes the PRD and breaks it into user stories.
4. **Forge** proposes the architecture and tech stack, writes project conventions to `.geas/memory/_project/conventions.md`, and records the decision.
5. Three agents vote on the architecture in parallel: **Circuit** (backend/scalability), **Palette** (UX/frontend), **Critic** (devil's advocate — identifies risks even when broadly in agreement). If all agree, Discovery continues. If anyone disagrees, a structured debate runs first, then re-vote.
6. **Task Compiler** converts each user story into a TaskContract with acceptance criteria and a rubric of scored dimensions.
7. Based on the tech stack, Geas recommends MCP servers that will help agents during the build (database query, web standards, git platform, etc.).

**What you decide:** mission details during intake, architecture approval (the vote gives you a structured view of each agent's stance), any MCP servers you want to connect.

---

### Phase 2: MVP Build

Every task runs the full pipeline. No shortcuts. The pipeline for each task is:

#### Start
- Task is selected in dependency order.
- Status set to `"in_progress"`.
- `remaining_steps` written to the checkpoint — the exact step list for this task. Steps are popped from the front as they complete, so if the session is interrupted, Geas knows exactly where to resume.

#### Design (Palette) — UI tasks only
Skipped for backend, API, CI, database, or utility tasks. Runs for anything with pages, forms, or dashboards. Palette writes a design spec before any implementation begins.

#### Tech Guide (Forge) — conditional
Skipped only when all four conditions hold simultaneously: the task follows an existing pattern, requires no new libraries, touches a single module, and has no schema changes. If any of those conditions is false, Forge provides technical direction first.

#### Implementation Contract — mandatory
Before any code is written, the worker proposes a concrete action plan: what actions will be taken, what edge cases are covered, what is explicitly out of scope, and how to demo completion. Sentinel checks that the demo steps cover all acceptance criteria. Forge checks that the planned actions are technically viable and consistent with the tech guide. Both must approve. If revision is requested, the worker updates and resubmits — one revision cycle, then Forge makes the final call. The approved contract is saved to `.geas/contracts/{task-id}.json`.

#### Implementation — mandatory, worktree isolated
The worker implements in a git worktree branch, keeping the main branch clean. Evidence is written to `.geas/evidence/{task-id}/{worker}.json`. The worktree branch is merged after implementation.

#### Code Review (Forge) — mandatory
Forge reviews the implementation against the rubric's `code_quality` dimension and writes a review to `.geas/evidence/{task-id}/forge-review.json`.

#### QA (Sentinel) — mandatory
Sentinel tests the feature across five quality dimensions: `core_interaction`, `feature_completeness`, `regression_safety`, and (for UI tasks) `ux_clarity` and `visual_coherence`. Results go to `.geas/evidence/{task-id}/sentinel.json`.

#### Evidence Gate — mandatory
Three-tier verification:
- **Tier 1 (Mechanical):** Runs `eval_commands` from the TaskContract. Build, lint, test. Stops on first failure.
- **Tier 2 (Semantic):** Checks each acceptance criterion against the evidence. Scores rubric dimensions against thresholds. If the worker's confidence is low or unresolved stubs exist, thresholds tighten.
- **Tier 3 (Product):** Spawns Nova for a product judgment — Ship, Iterate, or Cut.

If the gate fails, `/geas:verify-fix-loop` runs. A fixer agent (Circuit for backend, Pixel for frontend) spawns in a worktree, addresses the failures, and the gate re-runs. The retry budget defaults to 3. If the budget is exhausted, Forge reviews the architecture, then Nova makes a strategic call.

#### Critic Review — mandatory
Critic reads all evidence and challenges whether the task is truly ready to ship. Looks for risks, missing edge cases, and technical debt. This is not a rubber stamp — the Critic is expected to find problems.

#### Nova Review — mandatory
Nova reads all evidence including the Critic's challenge. Delivers a verdict: **Ship**, **Iterate**, or **Cut**.

#### Ship Gate
Before marking a task passed, Geas verifies that all four mandatory files exist: forge-review, sentinel QA, critic-review, nova-verdict. If any is missing, the missing step runs first.

#### Retrospective (Scrum) — mandatory
Scrum reads all evidence and updates `conventions.md` with new patterns discovered during the task, and writes lessons to `.geas/memory/retro/{task-id}.json`. Lessons from each task inform the next.

#### Resolve
- **Ship:** Task status set to `"passed"`. Keeper commits with conventional commit format.
- **Iterate:** Worker re-dispatched with Nova's feedback.
- **Cut:** Task status set to `"failed"`. A DecisionRecord is written explaining why.

---

### Phase 3: Polish

Mandatory — runs after all MVP tasks are resolved.

- **Shield** runs a security review of the project. Issues found are fixed before proceeding.
- **Scroll** writes the README and documentation.

---

### Phase 4: Evolution

Mandatory — the final phase before release.

- Geas assesses remaining work within the seed's `scope_in`. Anything in `scope_out` is rejected.
- **Nova** delivers a final strategic summary and recommendations.
- **Keeper** creates the release: version bump, changelog, and final commit.
- `/geas:run-summary` generates the full session audit trail.

---

## Real Example: Auction Platform

A session building an online auction platform from scratch. 15 tasks, approximately 56 agent spawns across all phases.

**Discovery:**
- Intake surfaced 4 scope questions: bidding rules, payment integration, real-time updates, and admin tooling. Payment and admin were scoped out.
- Nova proposed a focused MVP: item listing, bidding, and auction close.
- Forge proposed a Node.js/PostgreSQL stack with a REST API and a React frontend.
- Architecture vote: Circuit agree (clean separation of concerns), Palette agree (REST maps well to UI state), Critic agree with notes on real-time bid updates needing SSE or WebSocket consideration.
- 15 TaskContracts compiled from 12 user stories (3 stories decomposed into multiple tasks).

**MVP Build — example task (US-01: Item Listing):**
- Implementation Contract: 24 planned actions, covering schema creation, API endpoints, image upload handling, and 6 edge cases including empty auction and concurrent bid race condition.
- Code Review rubric score: `code_quality` 4/4.
- QA rubric scores: `core_interaction` 3/3, `feature_completeness` 4/4, `regression_safety` 4/4, `ux_clarity` 3/3, `visual_coherence` 2/3. Gate passed — `visual_coherence` met its threshold of 3 after one fix cycle.
- Critic flagged missing input validation on description field length. Worker fixed before Ship verdict.
- Nova verdict: Ship.

**Rubric scores across the full run** ranged from 1 to 5. Lower-scoring tasks triggered fix loops; higher-scoring tasks sailed through. The rubric surfaced real gaps — several tasks that "looked done" failed the semantic tier on first pass.

**Polish:** Shield found two missing authentication checks on admin-adjacent endpoints. Fixed before Scroll wrote the docs.

**Evolution:** Keeper tagged `v0.1.0` at completion.

---

## Session Resume

If a session is interrupted mid-task, Geas resumes from exactly where it stopped.

The checkpoint in `.geas/state/run.json` tracks:
- `current_task_id` — which task was in progress
- `pipeline_step` — which step was running
- `agent_in_flight` — which agent was executing
- `remaining_steps` — the ordered list of steps still to complete

On resume, Geas checks whether evidence for the interrupted step already exists. If it does, the step completed before the session ended and Geas moves to the next step. If evidence is missing, the step re-runs from the beginning.

You do not need to do anything special — starting a new session on a project with an in-progress `run.json` triggers the resume automatically.

---

## Tips

- **Be specific in your mission description.** Vague missions produce wide scope and harder tradeoffs. A focused mission produces a tighter, faster MVP.
- **Answer intake questions thoughtfully.** The seed shapes everything: the PRD, user stories, task contracts, and acceptance criteria all derive from it. A weak seed means weak contracts and a harder evidence gate.
- **Review the architecture vote before approving.** Circuit, Palette, and Critic each evaluate from a different angle. Their disagreements are signal — even the Critic's "agree with concerns" notes are worth reading.
- **Trust the pipeline.** The pipeline is designed to surface problems early, not late. A task that fails the evidence gate on the first pass is doing its job. Let the verify-fix loop run.
- **Intervene when asked.** Geas pauses for human input at intake, architecture approval, and whenever a task is Cut. Outside those checkpoints, the agents are working — interrupting mid-pipeline means a step may need to re-run.
- **The seed is immutable for a reason.** If you find yourself wanting to change the mission mid-build, that is a pivot, not an edit. Use `/geas:pivot-protocol` to handle scope changes cleanly with a DecisionRecord.
