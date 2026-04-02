# Unify Initiative + Sprint — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge initiative and sprint into a single 4-phase execution flow within the orchestrating skill, eliminating ~1200 lines of duplication.

**Architecture:** Extract initiative/sprint content into 5 reference files under `orchestrating/references/`. Update orchestrating SKILL.md with phase flow and 2-way routing. Delete initiative/ and sprint/. Update all cross-references.

**Tech Stack:** Markdown skills, git

---

## File Structure

| File | Responsibility | Tasks |
|------|---------------|-------|
| `plugin/skills/orchestrating/references/discovery.md` | **NEW** — Discovery phase | 1 |
| `plugin/skills/orchestrating/references/pipeline.md` | **NEW** — Per-task 14-step pipeline | 1 |
| `plugin/skills/orchestrating/references/build.md` | **NEW** — Build phase management | 1 |
| `plugin/skills/orchestrating/references/polish.md` | **NEW** — Polish phase | 1 |
| `plugin/skills/orchestrating/references/evolution.md` | **NEW** — Evolution phase | 1 |
| `plugin/skills/orchestrating/SKILL.md` | Remove mode detection, add phase flow | 2 |
| `plugin/skills/initiative/` | **DELETE** | 3 |
| `plugin/skills/sprint/` | **DELETE** | 3 |
| Cross-reference files (8+) | Update references | 3 |
| `CLAUDE.md` | Update execution model, skill lists | 3 |

---

### Task 1: Create 5 reference files

**Goal:** Extract content from initiative and sprint into 5 focused reference files.

**Files:**
- Create: `plugin/skills/orchestrating/references/discovery.md`
- Create: `plugin/skills/orchestrating/references/pipeline.md`
- Create: `plugin/skills/orchestrating/references/build.md`
- Create: `plugin/skills/orchestrating/references/polish.md`
- Create: `plugin/skills/orchestrating/references/evolution.md`
- Source: `plugin/skills/initiative/SKILL.md` (lines 12-743)
- Source: `plugin/skills/sprint/SKILL.md` (lines 25-451)

- [ ] **Step 1: Create discovery.md**

Extract from initiative lines 12-94 (Phase 1: Discovery). Write `plugin/skills/orchestrating/references/discovery.md`:

Content must include:
- Title: `# Discovery Phase`
- Intro: "Always runs. Scale adapts to the request."
- **Always run** section:
  - Seed check: `.geas/spec/seed.json` from intake. If missing, invoke `/geas:intake`.
  - Onboard check: if `.geas/memory/_project/conventions.md` missing, invoke `/geas:onboard`.
  - Task compilation: for each user story, invoke `/geas:task-compiler`.
  - Phase review + close: phase-review.json, log event.
- **Conditional** section (orchestrator judges based on seed complexity):
  - Vision (product-authority) — **skip if** seed describes a single well-defined feature.
  - PRD + user stories (product-authority) — **skip if** scope is 1-2 tasks.
  - Architecture (architecture-authority) + vote round — **skip if** existing project with conventions.md AND no new services/libs AND single module scope. **Always run if**: new project, new architecture, cross-module.
  - MCP server recommendations — **skip if** existing project.
- Copy the actual Agent() calls and verification steps from initiative for each sub-step.
- Phase review section from initiative line 64-94.

- [ ] **Step 2: Create pipeline.md**

The universal per-task pipeline. Merge from initiative lines 109-505 (per-task steps) and sprint lines 30-410 (identical pipeline). Write `plugin/skills/orchestrating/references/pipeline.md`:

Content must include:
- Title: `# Per-Task Pipeline`
- remaining_steps definition:
  ```json
  "remaining_steps": ["design", "tech_guide", "implementation_contract", "implementation", "self_check", "code_review", "testing", "evidence_gate", "closure_packet", "critical_reviewer", "final_verdict", "resolve", "retrospective", "memory_extraction"]
  ```
- Task File Precondition (from sprint line 27)
- Start Task: dependency check, rubric check, baseline check, lock acquisition
- Step Groups (code_review + testing parallel, critical_reviewer → final_verdict sequential)
- session-latest.md + task-focus update directive (after each step)
- Event logging directive
- All 14 steps with full content:
  - Design (ui-ux-designer) — skip conditions
  - Tech Guide (architecture-authority) — skip conditions
  - Implementation Contract — mandatory
  - Implementation — worktree isolated, pre-integration staleness check, integration lock
  - Worker Self-Check — mandatory
  - Code Review (architecture-authority) — mandatory, status → "reviewed"
  - Testing (qa-engineer) — mandatory, status → "integrated" after testing
  - Evidence Gate — run eval_commands, invoke verify-fix-loop on fail
  - Closure Packet Assembly — mandatory after gate pass
  - Critical Reviewer Challenge — conditional on risk_level
  - Final Verdict (product-authority) — mandatory
  - Pre-Resolve Check — verify 3 artifacts
  - Resolve — lock release, ship/iterate/cut
  - Retrospective (process-lead) — ship only, after resolve
  - Memory Extraction — ship only, after retrospective

- [ ] **Step 3: Create build.md**

Build phase management. Write `plugin/skills/orchestrating/references/build.md`:

Content:
- Title: `# Build Phase`
- Parallel Execution: scan `.geas/tasks/` for eligible tasks (status "ready", dependencies met). 2+ eligible → `/geas:scheduling`. 0-1 → single task through pipeline.md.
- Per-task: "Read `references/pipeline.md` and execute the full pipeline for this task."
- Phase review + close: gate criteria (all MVP-critical tasks passed, 0 critical debt, 0 unmitigated high debt). Write phase-review.json. Log event.

- [ ] **Step 4: Create polish.md**

Extract from initiative lines 524-579. Write `plugin/skills/orchestrating/references/polish.md`:

Content:
- Title: `# Polish Phase`
- 3.1 Security Review (security-engineer) — full OWASP scan
- 3.2 Triage Findings → debt-register.json (CRITICAL/HIGH → fix task, MEDIUM/LOW → debt)
- 3.3 Fix Critical Issues — mini-pipeline with worktree isolation
- 3.4 Documentation (technical-writer)
- 3.5 Entropy Scan — `/geas:cleanup`
- 3.6 Phase review + close: gate criteria (all high/critical debt triaged, reviews approved)
- Copy Agent() calls from initiative.

- [ ] **Step 5: Create evolution.md**

Extract from initiative lines 582-743 + sprint Wrap-Up (lines 410-451). Write `plugin/skills/orchestrating/references/evolution.md`:

Content:
- Title: `# Evolution Phase`
- 4.1 Gap Assessment → gap-assessment.json (from initiative)
- 4.2 Prioritize Remaining Work (from initiative)
- 4.2.5 Rules Update Approval (from initiative — batch approval of all task retrospectives)
- 4.2.7 Memory Promotion batch (from initiative)
- 4.3 Execute P0 Items — full pipeline from pipeline.md (from initiative)
- 4.4 Product-authority Final Briefing → nova-final.json + mission-summary.md (from initiative)
- 4.5 Repository-manager Release Management (from initiative)
- 4.6 Run Summary (from initiative)
- 4.7 Evolution Exit Gate + Close — 5 required artifacts (from initiative)
- Sprint Wrap-Up content is absorbed: rules update, debt register, memory — all handled by evolution steps above.

- [ ] **Step 6: Commit**

```bash
git add plugin/skills/orchestrating/references/
git commit -m "feat: create orchestrating/references/ — 5 phase reference files

Extract from initiative+sprint into: discovery.md, pipeline.md, build.md,
polish.md, evolution.md. Single source of truth for the execution pipeline."
```

---

### Task 2: Update orchestrating/SKILL.md

**Goal:** Remove mode detection, add 4-phase execution flow referencing the new files.

**Files:**
- Modify: `plugin/skills/orchestrating/SKILL.md`

- [ ] **Step 1: Replace mode detection with phase flow**

Find "### Step 2: Mode Detection" (~line 186). Replace the entire section:

From:
```markdown
### Step 2: Mode Detection
Infer from the user's intent:
1. **Bounded feature in existing project** → invoke `/geas:sprint` (delivery mode, Sprint pattern)
2. **New product or broad mission** → invoke `/geas:initiative` (Initiative mission)

If the mode was explicitly specified (user used `/geas:initiative` or `/geas:sprint`), skip detection and go directly to that mode.

Note: `/geas:decision` is a utility skill for decision mode. It can be invoked at any time for structured decision-making — during Initiative mission, delivery mode, or standalone. It does not go through the Orchestrator startup sequence.
```

To:
```markdown
### Step 2: Routing

Infer from the user's intent:
1. **Decision only (no code changes)** → invoke `/geas:decision`
2. **Everything else** → proceed with 4-phase execution flow below

Note: `/geas:decision` can also be invoked standalone at any time for structured decision-making.

## Execution Flow

Always 4 phases, regardless of scope. The orchestrator determines phase scale based on seed spec complexity.

### Phase 1: Discovery
Read `references/discovery.md` and follow the procedure.
Minimum: intake (seed spec confirmation with user) + task compilation.
Full: vision, PRD, architecture, vote round, task compilation.

### Phase 2: Build
Read `references/build.md` for phase management.
For each compiled task, read `references/pipeline.md` and execute the per-task pipeline.
For 2+ eligible tasks, invoke `/geas:scheduling` for parallel dispatch.

### Phase 3: Polish
Read `references/polish.md` and follow the procedure.

### Phase 4: Evolution
Read `references/evolution.md` and follow the procedure.
```

- [ ] **Step 2: Remove initiative/sprint references in orchestrating**

Search the file for any remaining `/geas:initiative`, `/geas:sprint`, "initiative", "Sprint" references. Remove or replace:
- "Initiative mission" → "4-phase execution"
- "Sprint pattern" → remove
- "initiative/sprint" → "the execution pipeline"

- [ ] **Step 3: Commit**

```bash
git add plugin/skills/orchestrating/SKILL.md
git commit -m "feat: replace mode detection with unified 4-phase execution flow"
```

---

### Task 3: Delete old skills + update cross-references

**Goal:** Delete initiative/ and sprint/, update all references across codebase.

**Files:**
- Delete: `plugin/skills/initiative/`
- Delete: `plugin/skills/sprint/`
- Modify: `plugin/skills/mission/SKILL.md`
- Modify: `plugin/skills/scheduling/SKILL.md`
- Modify: `plugin/skills/onboard/SKILL.md`
- Modify: `docs/reference/SKILLS.md`
- Modify: `docs/ko/reference/SKILLS.md`
- Modify: `docs/architecture/DESIGN.md`
- Modify: `docs/ko/architecture/DESIGN.md`
- Modify: `docs/protocol/13_MIGRATION_AND_IMPLEMENTATION_ROADMAP.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Delete initiative and sprint**

```bash
git rm -r plugin/skills/initiative
git rm -r plugin/skills/sprint
```

- [ ] **Step 2: Update mission/SKILL.md**

Replace description and body — remove initiative/sprint mentions:

```markdown
---
name: mission
description: >
  Build a product, add a feature, or make a technical decision.
  Activates the Geas multi-agent team with contract-driven verification.
  Always follows 4 phases: Discovery → Build → Polish → Evolution, scaled to the request.
---

# Mission

Invoke `/geas:orchestrating` to start the Geas orchestrator.

The orchestrating skill handles setup, intake, and the 4-phase execution pipeline (Discovery → Build → Polish → Evolution). For decision-only requests (no code), it routes to `/geas:decision`.

**Do NOT spawn an orchestrator agent. Orchestrating is a skill, not an agent.**
```

- [ ] **Step 3: Update scheduling/SKILL.md**

Search for references to "initiative/sprint" or "initiative" or "sprint" in the file. Replace:
- "per-task pipeline defined in initiative/sprint SKILL.md" → "per-task pipeline defined in `orchestrating/references/pipeline.md`"
- "initiative/sprint" → "the execution pipeline"
- Any other references.

- [ ] **Step 4: Update onboard/SKILL.md**

Find "delivery mode (Sprint pattern)" reference. Replace with "the execution pipeline" or just "delivery mode".

- [ ] **Step 5: Update docs/reference/SKILLS.md**

Remove initiative and sprint skill entries. Update orchestrating entry to mention 4-phase execution and references/. Remove `/geas:initiative` and `/geas:sprint` invocation references.

- [ ] **Step 6: Update docs/ko/reference/SKILLS.md**

Same changes as English version.

- [ ] **Step 7: Update docs/architecture/DESIGN.md**

Remove `initiative/` and `sprint/` from the plugin skills directory tree. Add `references/` under orchestrating.

- [ ] **Step 8: Update docs/ko/architecture/DESIGN.md**

Same changes.

- [ ] **Step 9: Update doc 13 protocol reflection**

In `docs/protocol/13_MIGRATION_AND_IMPLEMENTATION_ROADMAP.md`, find the "Skill-Specific Mechanisms Requiring Protocol Reflection" table. Remove the Sprint Wrap-Up row. Add:

```
| Initiative/Sprint unification | Single 4-phase execution flow replacing separate initiative and sprint skills. Always runs Discovery→Build→Polish→Evolution with adaptive scaling. | Update doc 02 to replace Initiative mission + Sprint pattern with unified execution model |
```

- [ ] **Step 10: Update CLAUDE.md**

Find the "## Execution Model" section. Replace:

```markdown
## Execution Model

Two top-level modes: `execution` and `decision`.

- **Execution** — 4-phase structure: Discovery → Build → Polish → Evolution. Scale adapts to the request — from a single feature to a full product. Always follows the same pipeline order.
- **Decision** — structured decision-making without code changes
```

Find the skill sections. Remove "### Team skills (execution protocols)" with initiative/sprint/decision entries. Replace:

```markdown
### Execution pipeline
- `orchestrating/` — Geas orchestrator: startup, recovery, 4-phase execution (Discovery → Build → Polish → Evolution)
  - `references/discovery.md` — Discovery phase procedure
  - `references/pipeline.md` — Per-task 14-step pipeline
  - `references/build.md` — Build phase management
  - `references/polish.md` — Polish phase procedure
  - `references/evolution.md` — Evolution phase procedure
- `scheduling/` — parallel task scheduling: batch construction, lock checks, safe conditions
- `decision/` — decision mode: structured decision-making, no code
```

- [ ] **Step 11: Verify no stale references**

```bash
grep -r "/geas:initiative\|/geas:sprint" plugin/skills/ docs/reference/ docs/ko/ docs/architecture/ CLAUDE.md --include="*.md" | grep -v superpowers/
```

Should return 0 matches.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "refactor: unify initiative + sprint into orchestrating

Delete plugin/skills/initiative/ and plugin/skills/sprint/.
Content extracted to orchestrating/references/ (5 files).
Single 4-phase execution flow: Discovery → Build → Polish → Evolution.
Updated mission, scheduling, onboard, docs, CLAUDE.md."
```

---

## Verification Checklist

After all 3 tasks complete:

- [ ] `plugin/skills/initiative/` does NOT exist
- [ ] `plugin/skills/sprint/` does NOT exist
- [ ] `plugin/skills/orchestrating/references/discovery.md` exists
- [ ] `plugin/skills/orchestrating/references/pipeline.md` exists with 14-step remaining_steps
- [ ] `plugin/skills/orchestrating/references/build.md` exists
- [ ] `plugin/skills/orchestrating/references/polish.md` exists
- [ ] `plugin/skills/orchestrating/references/evolution.md` exists
- [ ] `orchestrating/SKILL.md` has 4-phase execution flow (no mode detection)
- [ ] No `/geas:initiative` or `/geas:sprint` references remain (excluding superpowers/ history)
- [ ] CLAUDE.md has unified execution model
- [ ] Doc 13 has protocol reflection entry for the merger
