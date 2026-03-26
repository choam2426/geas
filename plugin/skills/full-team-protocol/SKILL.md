---
name: full-team-protocol
description: Full Team Mode execution protocol — all 4 phases from Genesis to Evolution. Use when starting a new project from a mission.
---

# Full Team Mode Protocol

Default execution mode. Runs all 4 phases: Genesis, MVP Build, Polish, Scoped Evolution.

Use this when the user is starting a new product or broad mission.

Natural-language intent is enough. `debate:` and `sprint:` are optional shorthand, not required syntax.

## File Paths

| Purpose | Path |
|---------|------|
| Seed spec | `.geas/spec/seed.json` |
| Run state | `.geas/state/run.json` |
| Task contracts | `.geas/tasks/{id}.json` |
| Context packets | `.geas/packets/{task-id}/{worker}.md` |
| Evidence bundles | `.geas/evidence/{task-id}/{worker}.json` |
| Decisions | `.geas/decisions/{id}.json` |
| Event log | `.geas/ledger/events.jsonl` |
| Linear config (IDs) | `.geas/memory/_project/linear-config.json` |
| Tech stack / conventions | `.geas/memory/_project/conventions.md` |

---

## Phase 1: Genesis

**Goal:** Establish vision, architecture, and backlog. Compile task contracts.

### Step 1 — Intake Gate
- The seed spec (`.geas/spec/seed.json`) should already exist from Compass's intake step.
- If not: invoke `/intake` now.

### Step 1.5 — Readiness Gate
- Read `readiness_score` from `.geas/spec/seed.json`.
- If `readiness_score >= 60` OR `readiness_override` is `true`: proceed to Step 2.
- If `readiness_score < 60` AND `readiness_override` is not `true`:
  - Block Genesis. Log event: `{"event": "readiness_gate_blocked", "score": <N>, "threshold": 60}`
  - Tell the user: "Mission readiness score is **<N>/100** (threshold: 60). Dimensions needing clarification: <list dimensions scoring <= 10>."
  - Re-invoke `/intake` to gather more information.
  - After re-intake, re-check the score. If still below threshold, ask the user: "Score is still <N>/100. Proceed anyway?" If yes, set `readiness_override: true` in seed.json.

### Step 2 — Bootstrap Linear (if enabled)
- Check `.geas/config.json` for `linear_enabled`.
- If enabled:
  - If config has team info: read it (skip discovery).
  - Otherwise: `list-teams` to get team ID and name.
  - `list-issue-statuses --name <team>` to get state IDs (including Waiting).
  - `list-issue-labels --team <team>` to get label IDs.
  - `save-project` to create a project for this mission.
  - Create milestones: Genesis, MVP, Polish, Evolution (`save-milestone`).
  - Save all IDs to `.geas/memory/_project/linear-config.json`.
- If disabled: skip. All state tracked via `.geas/`.

### Step 3 — Spawn Nova (CEO)
- Nova delivers: vision, MVP scope, user value proposition.
- Nova reads `.geas/spec/seed.json` for mission context.

### Step 4 — Create PRD
- Invoke `/write-prd` with Nova's vision and seed spec.
- If Linear enabled: `create-document --title "PRD: <mission>" --content "<PRD>" --project-id <UUID>`
- Write PRD to `docs/prd/` in the target project.

### Step 5 — Spawn Forge (CTO)
- Forge proposes: architecture, tech stack.
- Forge writes conventions to `.geas/memory/_project/conventions.md`.

### Step 6 — Create Architecture Decision
- If Linear enabled: `create-document --title "Architecture: <stack summary>" --content "<Forge's proposal>" --project-id <UUID>`
- Write to `docs/architecture/` in the target project.
- Write a DecisionRecord to `.geas/decisions/dec-001.json`.

### Step 7 — Vote Round on Architecture
- Trigger the `vote-round` skill.
- Spawn **Circuit** and **Palette** to vote on Forge's proposal.
- If any thumbs down: enter debate round (see vote-round skill).
- If all thumbs up: proceed.

### Step 8 — Create Linear Issues + Compile TaskContracts
- Create 5-10+ granular issues, one per feature.
- Each issue has:
  - Title with label: `[Feature] Add todo item`
  - Description + acceptance criteria
  - Priority: 1=Urgent, 2=High, 3=Normal, 4=Low
  - Estimate: Fibonacci 1-13 story points
  - Linked to project
- For complex features, create **sub-issues** with relations.
- **After creating issues**: invoke `/task-compiler` for each feature to produce TaskContracts in `.geas/tasks/`.

### Step 9 — Genesis Summary
- If Linear enabled: `create-document --title "Genesis Summary" --content "..." --project-id <UUID>`
- Content:
  ```
  [Compass] Genesis Summary
  - Vision: <Nova's core value prop>
  - Stack: <Forge's tech choices>
  - Vote: <who voted, result, resolutions>
  - Issues created: <count>
  - TaskContracts compiled: <count>
  - Key decisions: <list>
  ```

### Step 10 — Close Genesis
- If Linear: mark Genesis milestone complete.
- Update `.geas/state/run.json`:
  ```json
  { "phase": "mvp", "status": "in_progress" }
  ```
- Log event: `{"event": "phase_complete", "phase": "genesis"}`

---

## Phase 2: MVP Build

**Goal:** Ship every feature through the contract-based pipeline.

For **each** TaskContract in `.geas/tasks/` (ordered by dependencies):

### Step 1 — Start Task
- Read the TaskContract from `.geas/tasks/{task-id}.json`.
- Check dependencies: all dependent tasks must have `status: "passed"`.
- Update contract status to `"in_progress"`.
- If Linear enabled:
  - Update issue status to **In Progress**.
  - Post comment: `[Compass] Task started. Assigned to {worker}.`
- Update run state: `"current_task_id": "{task-id}"`.

### Step 2 — Design (Palette)
- Invoke `/context-packet` for **palette** with the TaskContract.
- Spawn **Palette** with ContextPacket (includes Linear thread if available).
- Palette writes design spec to `.geas/evidence/{task-id}/palette.json` (EvidenceBundle).
- **Linear comment verification** (if enabled):
  - `list-comments --issue-id {id}` — check for `[Palette]` prefixed comment.
  - If found: proceed.
  - If missing: Compass posts fallback: `[Palette] {summary from evidence}`

### Step 3 — Tech Guide (Forge)
- Invoke `/context-packet` for **forge** with the TaskContract + Palette's evidence.
- Spawn **Forge** for technical approach.
- Forge writes to `.geas/evidence/{task-id}/forge.json` (EvidenceBundle).
- **Linear comment verification** (if enabled):
  - Check for `[Forge]` comment. If missing: Compass posts fallback from evidence.

### Step 4 — Implementation (Pixel / Circuit) [WORKTREE ISOLATED]
- Invoke `/context-packet` for the assigned worker with all prior evidence.
- Spawn the worker **with worktree isolation**:
  ```
  Agent(agent: "{worker}", isolation: "worktree", prompt: "Read your ContextPacket at .geas/packets/{task-id}/{worker}.md")
  ```
- Worker implements on an isolated branch and writes `.geas/evidence/{task-id}/{worker}.json` (EvidenceBundle with files_changed).
- **Linear comment verification** (if enabled):
  - Check for `[{Worker}]` comment. If missing: Compass posts fallback from evidence.
- **After worker completes**: merge the worktree branch back (see Compass worktree merge protocol).
  - If merge conflict → spawn Forge to resolve.
  - Log worktree events to `.geas/ledger/events.jsonl`.
- Proceed to Step 5 only after successful merge.

### Step 5 — Code Review (Forge)
- Invoke `/context-packet` for **forge** as reviewer with implementer evidence.
- Spawn **Forge** for code review.
- Forge writes review evidence to `.geas/evidence/{task-id}/forge-review.json`.
- If Linear enabled:
  - Update issue status to **In Review**.
  - Verify `[Forge]` review comment. If missing: Compass posts fallback.

### Step 6 — Testing (Sentinel)
- Invoke `/context-packet` for **sentinel** with all evidence.
- Spawn **Sentinel** for QA testing.
- Sentinel writes test evidence to `.geas/evidence/{task-id}/sentinel.json`.
- If Linear enabled:
  - Update issue status to **Testing**.
  - Verify `[Sentinel]` QA comment. If missing: Compass posts fallback.

### Step 7 — Evidence Gate
- Invoke `/evidence-gate` with Sentinel's evidence and the TaskContract.
- **Tier 1 (Mechanical)**: run eval_commands from contract.
- **Tier 2 (Semantic)**: check each acceptance criterion.
- If gate **passes**: proceed to Step 8.
- If gate **fails**: invoke `/verify-fix-loop` with failure details. After fix, re-run gate.
- If Linear enabled: post `[Compass] Evidence Gate: {PASSED/FAILED}. {tier results summary}`

> **Note**: If the verify-fix loop dispatches Pixel/Circuit for fixes, those fix dispatches also use worktree isolation. The fix branch name follows: `worktree/{task-id}/{worker}-fix-{N}`.

### Step 8 — Nova Product Review (MANDATORY — never skip)
- Invoke `/evidence-gate` at Tier 3 (Product).
- Nova reads all evidence bundles for this task.
- Nova delivers verdict: **Ship / Iterate / Cut**.

### Step 9 — Resolve
- **Ship**: Update contract status to `"passed"`. Add to `completed_tasks`.
  - If Linear: status → **Done**. Post `[Nova] Verdict: Ship. {notes}`
- **Iterate**: Nova's feedback → new ContextPacket → re-dispatch worker. Counts against retry budget.
  - If Linear: post `[Nova] Iterate: {specific feedback}`
- **Cut**: Update contract status to `"failed"`. Write DecisionRecord.
  - If Linear: status → **Canceled**. Post `[Nova] Cut: {reason}`

### After All Tasks — Close Phase 2
- Create **MVP Summary**:
  ```
  [Compass] MVP Summary
  - Tasks completed: <count> / <total>
  - Gate failures: <count> (which tasks, resolutions)
  - Debates triggered: <count>
  - Nova verdicts: <Ship/Iterate/Cut counts>
  - Decisions made: <count>
  ```
- If Linear: mark MVP milestone complete.
- Update run state: `"phase": "polish"`
- Log event: `{"event": "phase_complete", "phase": "mvp"}`

---

## Phase 3: Polish

**Goal:** Deploy, secure, and document.

### Step 1 — Spawn Pipeline (DevOps)
- Build and deployment setup.
- Writes evidence to `.geas/evidence/polish/pipeline.json`.

### Step 2 — Spawn Shield (Security)
- Security review. Creates issues for findings.
- Writes evidence to `.geas/evidence/polish/shield.json`.

### Step 3 — Spawn Scroll (Tech Writer)
- README.md and documentation to `docs/`.
- Writes evidence to `.geas/evidence/polish/scroll.json`.

### Step 4 — Fix Issues
- Fix issues found by Shield and Sentinel.
- Use `/verify-fix-loop` if testing is needed.

### Step 5 — Close Phase 3
- Create **Polish Summary**.
- If Linear: mark Polish milestone complete.
- Update run state: `"phase": "evolve"`
- Log event: `{"event": "phase_complete", "phase": "polish"}`

---

## Phase 4: Scoped Evolution

**Goal:** Refine within mission bounds. No scope creep.

### Step 1 — Assess Remaining Work
- Read seed spec's `scope_in` and `scope_out`.
- What is still incomplete within scope_in?
- Spawn agents as needed for improvements.

### Step 2 — Scope Validation
Every proposed improvement must pass:
- Bug fixes, performance optimization, UX refinement: **ACCEPT**
- Accessibility, security hardening, refactoring: **ACCEPT**
- Features in `scope_out`: **REJECT**
- Features not in `scope_in`: **REJECT**

### Step 3 — Nova Morning Briefing
- Spawn **Nova** for final product review and strategic direction.

### Close Out
- If Linear: mark Evolution milestone complete.
- Update run state: `"phase": "complete", "status": "complete"`
- Log event: `{"event": "phase_complete", "phase": "evolve"}`
- Invoke `/run-summary` to generate session report.
