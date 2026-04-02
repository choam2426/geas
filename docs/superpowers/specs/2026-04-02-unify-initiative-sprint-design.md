# Unify Initiative + Sprint — Design Spec

## Goal

Merge initiative and sprint into a single execution flow within the orchestrating skill. Always 4 phases (Discovery → Build → Polish → Evolution), scale adapts to the request. Eliminate ~1200 lines of duplication.

## Scope

### In scope
- Delete `plugin/skills/initiative/` and `plugin/skills/sprint/`
- Create `plugin/skills/orchestrating/references/` with 5 files (discovery, pipeline, build, polish, evolution)
- Simplify orchestrating/SKILL.md — remove mode detection (initiative vs sprint), add phase flow
- Update cross-references across skills, docs, CLAUDE.md
- Add protocol reflection entry for the merger

### Out of scope
- Protocol doc 02 update (registered for future reflection)
- Decision mode changes (stays separate)
- Scheduling skill changes (references pipeline.md instead of initiative/sprint)

## Reference

- Current: `plugin/skills/initiative/SKILL.md` (~743 lines)
- Current: `plugin/skills/sprint/SKILL.md` (~452 lines)
- Current: `plugin/skills/orchestrating/SKILL.md` (~150 lines)

---

## 1. orchestrating/SKILL.md Changes

### Remove
- Mode detection section (Step 2: "Bounded feature → sprint, New product → initiative")
- All references to `/geas:initiative` and `/geas:sprint`

### Replace with

```markdown
## Execution Flow

Always 4 phases, regardless of scope. The orchestrator determines phase scale based on the seed spec complexity.

### Phase 1: Discovery
Read `references/discovery.md` and follow the procedure.
Minimum: intake (seed spec confirmation with user) + task compilation.
Full: vision, PRD, architecture, vote round, task compilation.

### Phase 2: Build
For each compiled task, read `references/pipeline.md` and execute the per-task pipeline.
For 2+ eligible tasks, read `/geas:scheduling` for parallel dispatch.
Read `references/build.md` for build phase management.

### Phase 3: Polish
Read `references/polish.md` and follow the procedure.

### Phase 4: Evolution
Read `references/evolution.md` and follow the procedure.
```

### Simplify mode routing

```markdown
### Step 2: Routing
Infer from the user's intent:
1. **Decision only (no code)** → invoke `/geas:decision`
2. **Everything else** → proceed with 4-phase execution flow above
```

---

## 2. references/ Files

### discovery.md

Content from initiative Phase 1, with adaptive scaling.

**Always run:**
- Seed check — `.geas/spec/seed.json` from intake. If missing, invoke `/geas:intake`.
- Onboard check — if `.geas/memory/_project/conventions.md` is missing, invoke `/geas:onboard` to scan the existing project.
- Task compilation — compile each user story into a TaskContract.
- Phase review + close.

**Conditional (orchestrator judges based on seed complexity):**
- Vision (product-authority) — **skip if** seed describes a single well-defined feature with clear acceptance criteria.
- PRD + user stories — **skip if** scope is 1-2 tasks (seed already specific enough to compile directly).
- Architecture + vote round — **skip if** existing project with conventions.md AND no new external services/libs AND single module scope. Always run if: new project, new architecture patterns, cross-module changes.
- MCP server recommendations — **skip if** existing project (already configured).

### pipeline.md

The universal per-task pipeline. Content from initiative Phase 2 per-task steps + sprint pipeline (identical).

```
remaining_steps: ["design", "tech_guide", "implementation_contract", "implementation",
  "self_check", "code_review", "testing", "evidence_gate", "closure_packet",
  "critical_reviewer", "final_verdict", "resolve", "retrospective", "memory_extraction"]
```

Includes:
- Step groups (code_review + testing parallel)
- Baseline check before implementing
- Lock acquisition before implementing
- Integration lock before merge
- Lock release at resolve
- session-latest.md + task-focus update after each step
- Skip conditions per step (design: skip if no UI, tech_guide: skip if routine, critical_reviewer: conditional on risk_level)

### build.md

Build phase management.

- Scan `.geas/tasks/` for eligible tasks (status "ready", dependencies met)
- If 2+ eligible: invoke `/geas:scheduling` for parallel dispatch
- If 0-1 eligible: run single task through pipeline.md
- Per-task pipeline invocation
- Phase review + close (gate criteria: all MVP-critical tasks passed, 0 critical debt, 0 unmitigated high debt)

### polish.md

Content from initiative Phase 3.

- Security review (security-engineer)
- Triage findings → debt-register.json
- Fix critical/high issues (mini-pipeline)
- Documentation (technical-writer)
- Entropy scan (/geas:cleanup)
- Phase review + close (gate criteria: all high/critical debt triaged, reviews approved)

### evolution.md

Content from initiative Phase 4 + sprint Wrap-Up (absorbed).

- Gap assessment → gap-assessment.json
- Prioritize remaining work (P0 must, P1 nice-to-have)
- Rules update approval (batch from all task retrospectives)
- Memory promotion batch
- Execute P0 items (full pipeline from pipeline.md)
- Product-authority final briefing → mission-summary.md
- Debt triage
- Evolution exit gate (5 artifacts)
- Phase review + close

Sprint Wrap-Up is no longer needed — Evolution handles everything Sprint Wrap-Up did (rules, debt, memory) plus more.

---

## 3. Cross-reference Updates

| File | Change |
|------|--------|
| `plugin/skills/mission/SKILL.md` | Remove initiative/sprint mentions. Just "invoke /geas:orchestrating". |
| `plugin/skills/scheduling/SKILL.md` | Replace "initiative/sprint" references with "orchestrating/references/pipeline.md" |
| `plugin/skills/orchestrating/SKILL.md` | Remove mode detection, add phase flow, reference files |
| `plugin/skills/onboard/SKILL.md` | Remove sprint-specific pre-condition text |
| `docs/reference/SKILLS.md` | Remove initiative/sprint entries, update orchestrating description |
| `docs/ko/reference/SKILLS.md` | Same |
| `docs/architecture/DESIGN.md` | Remove initiative/, sprint/ from directory tree, add references/ |
| `docs/ko/architecture/DESIGN.md` | Same |
| `CLAUDE.md` | Remove initiative/sprint from team skills, update orchestrating description, update execution model |

---

## 4. Protocol Reflection

Update `docs/protocol/13_MIGRATION_AND_IMPLEMENTATION_ROADMAP.md` "Skill-Specific Mechanisms Requiring Protocol Reflection" table:

**Remove:**
```
| Sprint Wrap-Up | ... | Add to doc 02 as Sprint pattern extension |
```

**Add:**
```
| Initiative/Sprint unification | Single 4-phase execution flow replacing separate initiative and sprint skills. Always runs Discovery→Build→Polish→Evolution with adaptive scaling. | Update doc 02 to replace Initiative mission + Sprint pattern with unified execution model |
```

---

## 5. Deletion

- `plugin/skills/initiative/` — entire directory
- `plugin/skills/sprint/` — entire directory

After deletion, grep for `/geas:initiative` and `/geas:sprint` — should return 0 in plugin/skills/ and docs/ (excluding superpowers/ historical files).
