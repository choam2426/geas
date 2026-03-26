---
name: sprint-protocol
description: Sprint Mode execution — add a single feature to an existing project. Skips Genesis phase. Use when the user wants bounded feature work in an existing codebase.
---

# Sprint Mode Protocol

Add a feature to an existing project. Skips Genesis (vision, architecture, full issue breakdown).

Use this when the request is clearly about a bounded feature or change in an existing project.

Natural-language intent is enough. `sprint:` is optional shorthand, not required syntax.

## File Paths

| Purpose | Path |
|---------|------|
| Seed spec | `.geas/spec/seed.json` |
| Run state | `.geas/state/run.json` |
| Task contract | `.geas/tasks/{id}.json` |
| Context packets | `.geas/packets/{task-id}/{worker}.md` |
| Evidence bundles | `.geas/evidence/{task-id}/{worker}.json` |
| Linear config (IDs) | `.geas/memory/_project/linear-config.json` |
| Tech stack / conventions | `.geas/memory/_project/conventions.md` |

---

## Pre-conditions

Before starting, check these:

1. **`.geas/state/run.json`** — if exists, read current project state.
2. **`.geas/memory/_project/conventions.md`** — tech stack and coding conventions.
3. **`.geas/memory/_project/linear-config.json`** — Linear project info (if Linear enabled).

### If no conventions file exists

The project has not been onboarded yet. Before proceeding:

1. Invoke `/onboard` — Forge scans the codebase and produces:
   - Architecture summary
   - Tech stack identification
   - Key file/directory map
2. Forge writes findings to `.geas/memory/_project/conventions.md`.
3. If Linear enabled: bootstrap Linear (create project, discover IDs).
4. Initialize `.geas/state/run.json` with the project baseline.
5. Then continue with the Sprint flow below.

---

## Sprint Flow

### Step 1 — Intake (Lightweight)
- The seed spec (`.geas/spec/seed.json`) should already exist from Compass's intake step.
- Sprint intake focuses on:
  - What exactly does this feature do?
  - What existing code does it touch?
  - What should NOT change?

### Step 1.5 — Readiness Gate (Sprint)
- Read `readiness_score` from `.geas/spec/seed.json`.
- If `readiness_score >= 40` OR `readiness_override` is `true`: proceed to Step 2.
- If `readiness_score < 40` AND `readiness_override` is not `true`:
  - Block execution. Log event: `{"event": "readiness_gate_blocked", "score": <N>, "threshold": 40, "mode": "sprint"}`
  - Tell the user: "Feature readiness score is **<N>/100** (Sprint threshold: 40). Scope and acceptance criteria need more detail."
  - Re-invoke `/intake` in Sprint mode for targeted clarification.
  - After re-intake, re-check. If still below, ask user for override confirmation.

### Step 2 — Create Feature Issue + TaskContract
- If Linear enabled:
  - `create-issue --title "[Feature] <feature name>" --description "<acceptance criteria>" --team-id <UUID> --project-id <UUID> --estimate <points>`
  - Add appropriate labels (feature + area).
  - Store `linear_issue_id` (identifier like MY-42) and `linear_issue_uuid` in the TaskContract.
  - Post comment: `[Compass] Sprint started. Feature: {feature name}`
- Invoke `/task-compiler` with the feature description and conventions.
- Output: `.geas/tasks/{task-id}.json`
- Update run state:
  ```json
  {
    "status": "in_progress",
    "mode": "sprint",
    "current_task_id": "{task-id}"
  }
  ```

### Step 3 — Design (Palette)
- Invoke `/context-packet` for **palette** (includes Linear thread if available).
- Spawn **Palette** with ContextPacket.
- Palette respects the **existing design system**.
- Writes evidence to `.geas/evidence/{task-id}/palette.json`.
- **Linear comment verification** (if enabled):
  - Check for `[Palette]` comment. If missing: Compass posts fallback from evidence.

### Step 4 — Tech Guide (Forge)
- Invoke `/context-packet` for **forge** with Palette's evidence.
- Spawn **Forge** for technical approach respecting **existing architecture**.
- Pushes back on anything that conflicts with established patterns.
- Writes evidence to `.geas/evidence/{task-id}/forge.json`.
- **Linear comment verification** (if enabled):
  - Check for `[Forge]` comment. If missing: Compass posts fallback from evidence.

### Step 5 — Implementation (Pixel / Circuit) [WORKTREE ISOLATED]
- Invoke `/context-packet` for the assigned worker with all prior evidence.
- Spawn the worker **with worktree isolation**:
  ```
  Agent(agent: "{worker}", isolation: "worktree", prompt: "Read your ContextPacket at .geas/packets/{task-id}/{worker}.md")
  ```
- Worker implements on an isolated branch and writes evidence to `.geas/evidence/{task-id}/{worker}.json`.
- **Linear comment verification** (if enabled):
  - Check for `[{Worker}]` comment. If missing: Compass posts fallback from evidence.
- **After worker completes**: merge the worktree branch back (see Compass worktree merge protocol).
  - If merge conflict → spawn Forge to resolve.
  - Log worktree events to `.geas/ledger/events.jsonl`.

### Step 6 — Code Review (Forge)
- Invoke `/context-packet` for **forge** as reviewer.
- Spawn **Forge** for code review.
- Writes review evidence to `.geas/evidence/{task-id}/forge-review.json`.
- If Linear enabled:
  - Update issue status to **In Review**.
  - Verify `[Forge]` review comment. If missing: Compass posts fallback.

### Step 7 — Testing (Sentinel)
- Invoke `/context-packet` for **sentinel**.
- Spawn **Sentinel** for QA.
- Writes test evidence to `.geas/evidence/{task-id}/sentinel.json`.
- If Linear enabled:
  - Update issue status to **Testing**.
  - Verify `[Sentinel]` QA comment. If missing: Compass posts fallback.

### Step 8 — Evidence Gate
- Invoke `/evidence-gate` with Sentinel's evidence and the TaskContract.
- **Tier 1 (Mechanical)**: run eval_commands.
- **Tier 2 (Semantic)**: check acceptance criteria.
- If gate **passes**: proceed to Step 9.
- If gate **fails**: invoke `/verify-fix-loop`. After fix, re-run gate.
- If Linear enabled: post `[Compass] Evidence Gate: {PASSED/FAILED}. {tier results summary}`

### Step 9 — Nova Product Review (MANDATORY)
- Invoke `/evidence-gate` at Tier 3 (Product).
- Nova reads all evidence bundles for this task.
- Delivers verdict: **Ship / Iterate / Cut**.

### Step 10 — Resolve
- **Ship**: Update contract status to `"passed"`.
  - If Linear: status → **Done**. Post `[Nova] Verdict: Ship. {notes}`
- **Iterate**: Nova's feedback → new ContextPacket → re-dispatch worker.
  - If Linear: post `[Nova] Iterate: {specific feedback}`
- **Cut**: Nova explains why. Write DecisionRecord.
  - If Linear: status → **Canceled**. Post `[Nova] Cut: {reason}`

### Step 11 — Update State
- Add task to `completed_tasks`.
- Update run state: `"status": "complete"`.
- Log event: `{"event": "sprint_complete", "task_id": "..."}`

---

## What Sprint Mode Skips

| Skipped | Reason |
|---------|--------|
| Nova vision | Already established |
| Forge architecture decision | Already in conventions.md |
| Full issue breakdown | Single feature focus |
| Pipeline / Shield / Scroll | Polish phase agents — not needed for one feature |
| Vote Round on architecture | Architecture is already decided |
| Milestone management | Uses existing milestones |
| Phase summary documents | Only the feature-level flow runs |
