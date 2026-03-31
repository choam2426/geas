# Documentation Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite all geas documentation from scratch with a unified structure covering architecture, user guides, reference, and changelog — reflecting all recent features (Implementation Contract, Rubric evaluation, remaining_steps, seed redesign, tool-agnostic cleanup).

**Architecture:** Four documentation categories (architecture, guides, reference, changelog) organized in docs/ subdirectories. Each document is self-contained but cross-references others. Old flat docs/ files are replaced by the new structure.

**Tech Stack:** Markdown only. No build tools. Korean translations in docs/ko/ mirror structure.

**Source of truth:** All content derived from current SKILL.md files, agent definitions, hook scripts, and schemas — NOT from old docs.

---

## File Structure

### New files to create:

```
docs/
├── architecture/
│   ├── DESIGN.md              # System architecture, 4-layer, data flow, component relationships
│   ├── SCHEMAS.md             # All 6 schemas with field descriptions and relationships
│   └── PIPELINE.md            # Full pipeline: Initiative phases, Sprint flow, step-by-step with decision points
│
├── guides/
│   ├── QUICKSTART.md          # 5-minute getting started
│   ├── INITIATIVE.md          # Initiative mode walkthrough with examples
│   ├── SPRINT.md              # Sprint mode walkthrough with examples
│   ├── DEBATE.md              # Debate mode walkthrough
│   └── SCENARIOS.md           # Real-world scenarios (auction platform example from test)
│
├── reference/
│   ├── SKILLS.md              # All 22 skills reference
│   ├── AGENTS.md              # All 12 agents reference
│   ├── HOOKS.md               # All 9 hooks reference
│   └── GOVERNANCE.md          # Evaluation system: Rubric, Evidence Gate, Implementation Contract, Vote Round
│
└── CHANGELOG.md               # v0.1.0 → v0.2.0 changes
```

### Files to modify:
- `README.md` — Update documentation links to new structure
- `CLAUDE.md` — Update core skill list (add implementation-contract)

### Files to delete (replaced by new structure):
- `docs/DESIGN.md` (old, Korean)
- `docs/GUIDE.md`, `docs/GUIDE.ko.md`
- `docs/SKILLS.md`, `docs/SKILLS.ko.md`
- `docs/AGENTS.md`, `docs/AGENTS.ko.md`
- `docs/GOVERNANCE.md`, `docs/GOVERNANCE.ko.md`
- `docs/HOOKS.md`, `docs/HOOKS.ko.md`

---

## Task Dependencies

```
Task 1 (DESIGN.md)     ─┐
Task 2 (SCHEMAS.md)     ─┤─→ Task 5 (QUICKSTART) ─→ Task 10 (README update)
Task 3 (PIPELINE.md)    ─┤─→ Task 6 (INITIATIVE)
                          │─→ Task 7 (SPRINT)
Task 4 (GOVERNANCE.md)  ─┤─→ Task 8 (DEBATE)
                          │─→ Task 9 (SCENARIOS)
Task 11 (SKILLS.md)     ─┤
Task 12 (AGENTS.md)     ─┤
Task 13 (HOOKS.md)      ─┤
Task 14 (CHANGELOG.md)  ─┘─→ Task 15 (CLAUDE.md update)
                              Task 16 (delete old docs)
                              Task 17 (ko/ translations)
```

Tasks 1-4 and 11-14 are independent (can run in parallel).
Tasks 5-9 depend on architecture docs for cross-references.
Tasks 10, 15-17 are final cleanup.

---

### Task 1: docs/architecture/DESIGN.md

**Files:**
- Create: `docs/architecture/DESIGN.md`

The architecture document. Must cover:

- [ ] **Step 1: Write DESIGN.md**

Structure:
```markdown
# Geas Architecture

## Overview
One paragraph: what geas is, the core insight (contract-driven multi-agent governance).

## Four Pillars
- Governance: every decision follows a process
- Traceability: every action produces an artifact
- Verification: 3-tier gate (mechanical, semantic, product)
- Evolution: team learns across sessions

## 4-Layer Architecture
```
Collaboration Surface  ← replaceable (Dashboard, ...)
Agent Teams            ← replaceable (Geas-12, Lean-4, Custom)
Contract Engine        ← core (Intake, TaskContract, Evidence Gate)
Tool Adapters          ← replaceable (Claude Code, ...)
```

Explain each layer, what's replaceable, what's core.

## Data Flow
Trace data through a task lifecycle:
seed.json → TaskContract → ContextPacket → ImplementationContract → EvidenceBundle → GateVerdict → DecisionRecord

Include a text-based flow diagram.

## .geas/ Directory Structure
Full directory tree with descriptions. Show what each file/directory stores.

## seed.json Design
- Project identity (mission, target_user, constraints) — immutable
- Initiative: seed includes full scope (scope_in, scope_out, acceptance_criteria)
- Sprint: seed is read-only context; feature scope goes into TaskContract
- source field: "initiative" vs "sprint" (minimal auto-generated)

## Context Decay Resistance
- Problem: orchestrator forgets pipeline steps after context compaction
- Solution: remaining_steps in checkpoint, restore-context hook re-injects
- Why it works: information in files survives compaction; information in context doesn't

## Tool-Agnostic Principle
- Core skills reference conventions.md, not specific tools
- Agent definitions use MCP categories, not product names
- Detection from marker files is allowed (they're targets, not prescriptions)
```

Read the following source files to write accurate content:
- `CLAUDE.md` for principles
- `plugin/skills/compass/SKILL.md` for orchestration rules
- `plugin/skills/initiative/SKILL.md` for pipeline flow
- `plugin/skills/sprint/SKILL.md` for sprint flow
- Current run.json structure from initiative SKILL.md

- [ ] **Step 2: Verify cross-references**

Check that all file paths, schema names, and skill names mentioned match the actual codebase.

- [ ] **Step 3: Commit**

```bash
mkdir -p docs/architecture
git add docs/architecture/DESIGN.md
git commit -m "docs: rewrite architecture design document"
```

---

### Task 2: docs/architecture/SCHEMAS.md

**Files:**
- Create: `docs/architecture/SCHEMAS.md`

- [ ] **Step 1: Write SCHEMAS.md**

Structure:
```markdown
# Schema Reference

## Overview
6 schemas define the data contracts between components.

## Schema Relationship Diagram
Text-based diagram showing:
seed.json → (task-compiler) → TaskContract → (context-packet) → ContextPacket
                                           → (implementation-contract) → ImplementationContract
TaskContract + Evidence → (evidence-gate) → EvidenceBundle
Escalation/Vote → DecisionRecord

## Schema Details

### seed.schema.json
- Location: plugin/skills/intake/schemas/
- Purpose: Mission specification frozen by intake gate
- Required fields: (list each with type and description)
- Optional fields: (list)
- source field: "initiative" | "sprint"
- Immutability rules

### task-contract.schema.json
(same format for each schema)

### evidence-bundle.schema.json
(include new fields: self_check, rubric_scores, state_verification)

### implementation-contract.schema.json
(new schema — full documentation)

### decision-record.schema.json

### context-packet.schema.json
```

Read all 6 schema files to write accurate field descriptions.

- [ ] **Step 2: Commit**

```bash
git add docs/architecture/SCHEMAS.md
git commit -m "docs: add schema reference document"
```

---

### Task 3: docs/architecture/PIPELINE.md

**Files:**
- Create: `docs/architecture/PIPELINE.md`

- [ ] **Step 1: Write PIPELINE.md**

Structure:
```markdown
# Pipeline Reference

## Initiative Pipeline

### Phase 1: Genesis
Step-by-step: Seed Check → Vision (Nova) → PRD + Stories (Nova) → Architecture (Forge) → Vote Round → Task Compilation → MCP Recommendations → Close Genesis

### Phase 2: MVP Build
For each task:
2.0 Start Task (remaining_steps, rubric check)
2.1 Design (Palette) [conditional]
2.2 Tech Guide (Forge) [conditional]
2.3 Implementation Contract [MANDATORY] ← NEW
2.4 Implementation [MANDATORY, worktree]
2.5 Code Review (Forge) [MANDATORY]
2.6 Testing (Sentinel) [MANDATORY]
2.7 Evidence Gate (3-tier)
2.8 Critic Pre-ship Review [MANDATORY]
2.9 Nova Product Review [MANDATORY]
2.10 Ship Gate verification
Retrospective (Scrum) [MANDATORY]
2.11 Resolve

### Phase 3: Polish
Shield security review + Scroll documentation

### Phase 4: Evolution
Nova final review + Keeper release

## Sprint Pipeline
Steps 1-11 with same structure as MVP but single task.

## Checkpoint & Recovery
- remaining_steps array
- restore-context hook
- Session resume protocol

## Skip Conditions
When Design is skipped, when Tech Guide is skipped.

## Escalation Paths
forge-review → nova-decision → pivot
```

Read `initiative/SKILL.md` and `sprint/SKILL.md` for exact step descriptions.

- [ ] **Step 2: Commit**

```bash
git add docs/architecture/PIPELINE.md
git commit -m "docs: add pipeline reference document"
```

---

### Task 4: docs/reference/GOVERNANCE.md

**Files:**
- Create: `docs/reference/GOVERNANCE.md`

- [ ] **Step 1: Write GOVERNANCE.md**

Structure:
```markdown
# Governance & Evaluation

## Evidence Gate (3-Tier)
### Tier 1: Mechanical
### Tier 2: Semantic + Rubric
- Acceptance criteria check
- Rubric scoring (dimensions, thresholds, evaluators)
- Threshold adjustment on low confidence
- blocking_dimensions
### Tier 3: Product (Nova)

## Rubric System
- Default dimensions table (core_interaction, feature_completeness, code_quality, regression_safety)
- UI dimensions (ux_clarity, visual_coherence)
- Threshold enforcement
- Score distribution from test (reference data)

## Implementation Contract
- Purpose: prevent misunderstood requirements
- Flow: worker drafts → Sentinel reviews → Forge reviews → approved/revision
- Schema fields
- One revision cycle maximum

## Worker Self-Check
- Fields: known_risks, untested_paths, possible_stubs, what_i_would_test_next, confidence
- How it guides Sentinel testing
- Confidence ≤ 2 triggers stricter thresholds

## Vote Round
- When triggered
- 4-step process
- Critic MUST participate

## Decision Records
- When created
- Schema
- Durable rationale

## Escalation Paths
- forge-review → nova-decision → pivot
- Retry budget
```

Read `evidence-gate/SKILL.md`, `implementation-contract/SKILL.md`, `vote-round/SKILL.md`, `verify-fix-loop/SKILL.md`.

- [ ] **Step 2: Commit**

```bash
mkdir -p docs/reference
git add docs/reference/GOVERNANCE.md
git commit -m "docs: add governance and evaluation reference"
```

---

### Task 5: docs/guides/QUICKSTART.md

**Files:**
- Create: `docs/guides/QUICKSTART.md`

- [ ] **Step 1: Write QUICKSTART.md**

```markdown
# Quick Start

## Prerequisites
- Claude Code CLI (or Claude Desktop)
- Git repository

## Install
claude plugin add choam2426/geas

## Your First Initiative
1. Open a project directory
2. Describe your mission: "Build a todo app with..."
3. Geas initializes .geas/ directory
4. Intake gate asks clarifying questions
5. Team executes: Genesis → MVP → Polish → Evolution

## Your First Sprint
1. Open an existing project
2. Describe a feature: "Add user authentication"
3. Geas onboards the codebase (first time only)
4. Sprint pipeline executes

## What to Expect
- Agents spawn and work autonomously
- Each task goes through full pipeline
- Evidence is collected at every step
- You approve key decisions

## Directory Structure
After geas runs, you'll see .geas/ with...

## Next Steps
- [Initiative Guide](INITIATIVE.md)
- [Sprint Guide](SPRINT.md)
- [Architecture](../architecture/DESIGN.md)
```

- [ ] **Step 2: Commit**

```bash
mkdir -p docs/guides
git add docs/guides/QUICKSTART.md
git commit -m "docs: add quickstart guide"
```

---

### Task 6: docs/guides/INITIATIVE.md

**Files:**
- Create: `docs/guides/INITIATIVE.md`

- [ ] **Step 1: Write INITIATIVE.md**

Walkthrough of full Initiative from user perspective:
- What triggers Initiative mode
- Genesis phase (what happens, what you see, what you decide)
- MVP Build (task-by-task execution, pipeline visualization)
- What Implementation Contract looks like
- What rubric scores mean
- Polish and Evolution
- Session resume (what happens if interrupted)

Include real examples from the auction platform test where possible.

Read `initiative/SKILL.md` for exact flow.

- [ ] **Step 2: Commit**

```bash
git add docs/guides/INITIATIVE.md
git commit -m "docs: add initiative mode guide"
```

---

### Task 7: docs/guides/SPRINT.md

**Files:**
- Create: `docs/guides/SPRINT.md`

- [ ] **Step 1: Write SPRINT.md**

Walkthrough of Sprint mode:
- Pre-conditions (existing project, onboarding)
- seed.json behavior (read-only if exists, minimal creation if first time)
- Feature scope goes into TaskContract (not seed)
- Pipeline (same steps as MVP, single task)
- How it differs from Initiative

Read `sprint/SKILL.md` and `onboard/SKILL.md`.

- [ ] **Step 2: Commit**

```bash
git add docs/guides/SPRINT.md
git commit -m "docs: add sprint mode guide"
```

---

### Task 8: docs/guides/DEBATE.md

**Files:**
- Create: `docs/guides/DEBATE.md`

- [ ] **Step 1: Write DEBATE.md**

Walkthrough of Debate mode:
- When to use (decision-only, no code)
- How it works (structured multi-agent discussion)
- Output (DecisionRecord)

Read `debate/SKILL.md`.

- [ ] **Step 2: Commit**

```bash
git add docs/guides/DEBATE.md
git commit -m "docs: add debate mode guide"
```

---

### Task 9: docs/guides/SCENARIOS.md

**Files:**
- Create: `docs/guides/SCENARIOS.md`

- [ ] **Step 1: Write SCENARIOS.md**

Real scenarios based on actual test data:

**Scenario 1: Real-Time Auction Platform (Initiative)**
- Mission: 실시간 경매 플랫폼
- 15 tasks, 56 subagents, ~2.5 hours
- Key moments: architecture vote (3/3 agree), US-01 implementation contract, US-15 low rubric scores

**Scenario 2: Settlement + Dispute Feature (Sprint)**
- Adding feature to existing project
- Implementation Contract: 21 actions, 10 edge cases
- Rubric results: all dimensions ≥ 4
- remaining_steps tracking through full pipeline

Reference data from `docs/superpowers/test-report-2026-03-30.md`.

- [ ] **Step 2: Commit**

```bash
git add docs/guides/SCENARIOS.md
git commit -m "docs: add real-world scenarios"
```

---

### Task 10: README.md Update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update documentation links section**

Replace old documentation links with new structure:
```markdown
## Documentation

| Category | Document | Description |
|----------|----------|-------------|
| Architecture | [Design](docs/architecture/DESIGN.md) | System architecture, data flow, principles |
| | [Schemas](docs/architecture/SCHEMAS.md) | Data contracts and relationships |
| | [Pipeline](docs/architecture/PIPELINE.md) | Execution pipeline step-by-step |
| Guides | [Quick Start](docs/guides/QUICKSTART.md) | 5-minute getting started |
| | [Initiative](docs/guides/INITIATIVE.md) | Build a new product |
| | [Sprint](docs/guides/SPRINT.md) | Add a feature |
| | [Debate](docs/guides/DEBATE.md) | Structured decisions |
| | [Scenarios](docs/guides/SCENARIOS.md) | Real-world examples |
| Reference | [Skills](docs/reference/SKILLS.md) | 22 skills reference |
| | [Agents](docs/reference/AGENTS.md) | 12 agents reference |
| | [Hooks](docs/reference/HOOKS.md) | 9 hooks reference |
| | [Governance](docs/reference/GOVERNANCE.md) | Evaluation & quality gates |
| | [Changelog](docs/CHANGELOG.md) | Version history |
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README with new documentation structure"
```

---

### Task 11: docs/reference/SKILLS.md

**Files:**
- Create: `docs/reference/SKILLS.md`

- [ ] **Step 1: Write SKILLS.md**

Reference for all 22 skills. For each skill:
- Name, description (from frontmatter)
- Category (Entry, Orchestration, Core, Team, Utility)
- When invoked and by whom
- Inputs and outputs
- Key behaviors

Include implementation-contract as a new Core skill.

Read all 22 SKILL.md files for accurate descriptions.

- [ ] **Step 2: Commit**

```bash
git add docs/reference/SKILLS.md
git commit -m "docs: add skills reference (22 skills)"
```

---

### Task 12: docs/reference/AGENTS.md

**Files:**
- Create: `docs/reference/AGENTS.md`

- [ ] **Step 1: Write AGENTS.md**

Reference for all 12 agents. For each:
- Name, role, model, tools, skills
- Primary responsibilities
- Pipeline position (when spawned, what they produce)
- Evidence output format (including rubric scores for Sentinel/Forge)
- Self-check requirements (for Pixel/Circuit)

Read all 12 agent .md files.

- [ ] **Step 2: Commit**

```bash
git add docs/reference/AGENTS.md
git commit -m "docs: add agents reference (12 agents)"
```

---

### Task 13: docs/reference/HOOKS.md

**Files:**
- Create: `docs/reference/HOOKS.md`

- [ ] **Step 1: Write HOOKS.md**

Reference for all 9 hooks across 6 events:
- Event trigger
- Script name
- What it does
- Blocking behavior (exit codes)
- Configuration

Include recent additions: remaining_steps in restore-context, rubric_scores check in verify-task-status.

Read `plugin/hooks/hooks.json` and all scripts.

- [ ] **Step 2: Commit**

```bash
git add docs/reference/HOOKS.md
git commit -m "docs: add hooks reference (9 hooks)"
```

---

### Task 14: docs/CHANGELOG.md

**Files:**
- Create: `docs/CHANGELOG.md`

- [ ] **Step 1: Write CHANGELOG.md**

```markdown
# Changelog

## v0.2.0 (2026-03-31)

### New Features
- **Implementation Contract**: Pre-implementation agreement between worker and reviewers
- **Rubric Evaluation**: Quality dimension scoring with hard thresholds in Evidence Gate Tier 2
- **Worker Self-Check**: Mandatory self_check in EvidenceBundle (known_risks, untested_paths, confidence)
- **Stateful QA**: Sentinel can verify API responses and DB state beyond UI testing
- **remaining_steps**: Pipeline steps tracked in checkpoint for context decay resistance

### Improvements
- **Tool-agnostic cleanup**: All core skills reference conventions.md instead of hardcoded tools
- **seed.json redesign**: Project identity (immutable) separated from execution scope
- **Event logging**: step_complete events for every pipeline step
- **Hook enhancements**: restore-context includes remaining_steps, verify-task-status checks rubric_scores

### Breaking Changes
- TaskContract schema: `rubric` is now a required field
- seed.json: Sprint mode no longer overwrites existing seed

## v0.1.0 (2026-03-28)
- Initial release: 12 agents, 20 skills, contract engine, hooks system
```

- [ ] **Step 2: Commit**

```bash
git add docs/CHANGELOG.md
git commit -m "docs: add changelog"
```

---

### Task 15: CLAUDE.md Update

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add implementation-contract to core skills list**

In the "Core skills (contract engine)" section, add:
```markdown
- `implementation-contract/` — pre-implementation agreement between worker and reviewers
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add implementation-contract to CLAUDE.md core skills list"
```

---

### Task 16: Delete Old Docs

**Files:**
- Delete: `docs/DESIGN.md`, `docs/GUIDE.md`, `docs/GUIDE.ko.md`, `docs/SKILLS.md`, `docs/SKILLS.ko.md`, `docs/AGENTS.md`, `docs/AGENTS.ko.md`, `docs/GOVERNANCE.md`, `docs/GOVERNANCE.ko.md`, `docs/HOOKS.md`, `docs/HOOKS.ko.md`

- [ ] **Step 1: Remove old documentation files**

```bash
git rm docs/DESIGN.md docs/GUIDE.md docs/GUIDE.ko.md docs/SKILLS.md docs/SKILLS.ko.md docs/AGENTS.md docs/AGENTS.ko.md docs/GOVERNANCE.md docs/GOVERNANCE.ko.md docs/HOOKS.md docs/HOOKS.ko.md
git commit -m "docs: remove old flat documentation (replaced by new structure)"
```

---

### Task 17: Korean Translations (docs/ko/)

**Files:**
- Create: `docs/ko/` mirroring the English structure

- [ ] **Step 1: Create Korean translations**

Translate all documents in docs/architecture/, docs/guides/, docs/reference/ to Korean.
Place in docs/ko/ with same directory structure:

```
docs/ko/
├── architecture/
│   ├── DESIGN.md
│   ├── SCHEMAS.md
│   └── PIPELINE.md
├── guides/
│   ├── QUICKSTART.md
│   ├── INITIATIVE.md
│   ├── SPRINT.md
│   ├── DEBATE.md
│   └── SCENARIOS.md
├── reference/
│   ├── SKILLS.md
│   ├── AGENTS.md
│   ├── HOOKS.md
│   └── GOVERNANCE.md
└── CHANGELOG.md
```

Also update `README.ko.md` to match the new structure.

- [ ] **Step 2: Commit**

```bash
git add docs/ko/ README.ko.md
git commit -m "docs: add Korean translations for all documentation"
```
