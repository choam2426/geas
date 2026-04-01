# Phase 3: Evolution Core — Design Spec

## Goal

Implement per-task retrospectives, structured rules updates, debt tracking, gap assessment, and phase review wiring so that the Geas pipeline learns from every task and governs phase transitions.

## Scope

### In scope
- Retrospective structured format (conforming to retrospective.schema.json)
- Retrospective timing change (after Resolve, Ship only)
- Rules update workflow (rules-update.json intermediary instead of direct rules.md modification)
- Debt register structured format (debt-register.json replacing unstructured debt.json)
- Gap assessment structured output (gap-assessment.json)
- Phase review wiring (phase-review.json at each phase transition)
- Evolution exit gate (5 required artifacts)
- Sprint Wrap-Up section (lightweight post-resolve for rules + debt)
- Protocol reflection entry for Sprint Wrap-Up in doc 13

### Out of scope
- Memory core (Phase 4)
- Sprint ↔ Initiative refactoring (future architectural decision)
- Automated memory candidate extraction (Phase 4)

## Reference

- `docs/protocol/14_EVOLUTION_DEBT_AND_GAP_LOOP.md`
- `docs/protocol/02_MODES_MISSIONS_AND_RUNTIME.md` (phase transitions, evolution phase)
- `docs/protocol/schemas/retrospective.schema.json`
- `docs/protocol/schemas/rules-update.schema.json`
- `docs/protocol/schemas/debt-register.schema.json`
- `docs/protocol/schemas/gap-assessment.schema.json`
- `docs/protocol/schemas/phase-review.schema.json`

All 5 schemas already exist. No new schemas needed.

---

## 1. Retrospective — Structured Format + Timing

### Current state
- Retrospective runs BEFORE Resolve (before task is "passed")
- Scrum writes to `.geas/memory/retro/{task-id}.json` (unstructured)
- Scrum directly modifies `rules.md`

### Target state
- Retrospective runs AFTER Resolve, only when verdict is Ship (task "passed")
- Scrum writes to `.geas/tasks/{task-id}/retrospective.json` conforming to schema
- Scrum does NOT modify rules.md directly — fills `rule_candidates[]` instead

### Pipeline change (initiative)

```
Before: ... → Final Verdict → Pre-Resolve Check → Retrospective → Resolve → ...
After:  ... → Final Verdict → Pre-Resolve Check → Resolve → Retrospective (Ship only) → ...
```

`remaining_steps` order change:
```json
["...", "evidence_gate", "closure_packet", "critical_reviewer", "final_verdict", "resolve", "retrospective"]
```
Note: `"retrospective"` moves from before `"resolve"` to after it.

### Retrospective agent prompt update

Scrum produces `retrospective.json` with schema-required fields:
- `artifact_type: "retrospective"`, `producer_type: "process_lead"`
- `what_went_well[]`, `what_broke[]`, `what_was_surprising[]`
- `rule_candidates[]` — proposed rule changes (NOT applied directly)
- `memory_candidates[]` — lessons for memory system (Phase 4)
- `debt_candidates[]` — new debt items discovered during review
- `next_time_guidance[]` — specific advice for similar future tasks

### Conditional execution

- **Ship** → run retrospective
- **Cut / Escalate** → skip retrospective (failure lessons are captured in DecisionRecord)

---

## 2. Rules Update Workflow

### Current state
Scrum directly modifies `.geas/rules.md` during retrospective.

### Target state
Two-step process:
1. Retrospective produces `rule_candidates[]`
2. If candidates exist → generate `rules-update.json` with `status: "proposed"`
3. Approval check:
   - **Initiative**: rule candidates accumulate during Build phase. Batch approval happens in Evolution phase. process_lead + domain authority review.
   - **Sprint**: inline approval after retrospective in Sprint Wrap-Up section. Auto-approve if evidence_refs >= 2 and contradiction_count = 0. Otherwise, propose to domain authority.
4. On approval: apply changes to `rules.md`, set `status: "approved"`, record `affected_rule_ids`
5. If no candidates: write `rules-update.json` with `status: "none"` (evolution exit gate requires this artifact to exist)

### File location
- Per-task: `.geas/tasks/{task-id}/rules-update.json` (proposed candidates from that task's retro)
- Phase-level: `.geas/state/rules-update.json` (aggregated, approved — written during Evolution or Sprint Wrap-Up)

---

## 3. Debt Register

### Current state
- `cleanup/SKILL.md` writes unstructured entries to `.geas/debt.json`
- Initiative Phase 3 (Polish) triages Shield findings into `.geas/debt.json`

### Target state
- All debt written to `.geas/state/debt-register.json` conforming to schema
- Each debt item has: `debt_id`, `severity`, `kind`, `title`, `description`, `introduced_by_task_id`, `owner_type`, `status`, `target_phase`
- Rollup fields: `rollup_by_severity`, `rollup_by_kind`
- Scope field: `"task"` for per-task, `"phase"` for phase-level, `"mission"` for mission-level

### Affected skills
- **cleanup/SKILL.md**: Change output path and format. Each finding becomes a structured debt item.
- **initiative/SKILL.md Phase 3 (Polish)**: Shield findings triage writes to debt-register.json instead of debt.json.
- **initiative/SKILL.md Phase 2 (Build)**: Closure packet's `debt_snapshot` pulls from debt-register.json for the task's items.
- **setup/SKILL.md**: Initialize `.geas/state/debt-register.json` instead of `.geas/debt.json`.

### Rollup timing
Orchestrator computes rollup at:
- Each phase close (build→polish, polish→evolution)
- Evolution phase (mission-level rollup)
- Sprint Wrap-Up

### Debt action rules (from doc 14)
- Critical debt: triage required before phase exit
- High debt: must resolve in polish phase or receive product_authority acceptance
- Accepted debt: requires rationale and owner_type
- Dropped debt: requires process_lead approval and drop_reason

---

## 4. Gap Assessment

### Current state
Initiative Phase 4.1 has basic diff logic (scope_in items vs completed tasks). No structured output.

### Target state
Produce `.geas/state/gap-assessment.json` conforming to schema:
- `scope_in_summary`, `scope_out_summary`
- `fully_delivered[]`, `partially_delivered[]`, `not_delivered[]`
- `intentional_cuts[]`, `unexpected_additions[]`
- `recommended_followups[]`

### When produced
- Initiative build→polish transition
- Initiative polish→evolution transition
- Initiative evolution→close
- After major pivot

### Forward-feeding rule (doc 14)
Items appearing in `partially_delivered` or `not_delivered` across 2+ gap assessments trigger automatic forward-feeding to next discovery phase's seed.json constraints.

---

## 5. Phase Review Wiring

### Current state
Phase transitions just log `phase_complete` events. No structured gate check.

### Target state
Produce `phase-review.json` at each transition conforming to schema:
- `mission_phase`, `status` (ready_to_exit | blocked | escalated)
- `summary`, `gate_criteria_met[]`, `gate_criteria_unmet[]`
- `risk_notes[]`, `next_phase`

### Gate criteria per transition (from doc 02)

**build → polish:**
- All MVP-critical tasks passed
- No blocking_conflict
- 0 critical debt
- 0 unmitigated high debt
- Required artifacts: phase-review.json, gap-assessment.json

**polish → evolution:**
- All high/critical debt triaged
- Required reviews approved
- Shipping rationale recorded for every known risk
- Required artifacts: phase-review.json, gap-assessment.json

**evolution → close:**
- gap-assessment.json exists
- debt-register.json (all open debt triaged)
- rules-update.json (approved or none)
- mission-summary.md exists
- phase-review.json

### Transition failure handling (from doc 02)
If required artifacts missing or conditions unmet → transition rejected. After 3 consecutive failures → enter decision mode. Failure history recorded in phase-review.json.

---

## 6. Evolution Exit Gate

### Current state
Initiative Phase 4 closing just updates run state and logs event.

### Target state
Before closing, verify 5 artifacts:
1. `.geas/state/gap-assessment.json` — exists
2. `.geas/state/debt-register.json` — all open debt triaged (no items with status "open")
3. `.geas/state/rules-update.json` — exists with status "approved" or "none"
4. `.geas/evidence/evolution/mission-summary.md` — exists (generated by Nova Final Briefing)
5. `.geas/state/phase-review.json` — exists with status "ready_to_exit"

If ANY missing → do not close. Execute the missing step.

### Mission summary
Nova Final Briefing (Step 4.4) currently writes `.geas/evidence/evolution/nova-final.json`. Update to ALSO write `.geas/evidence/evolution/mission-summary.md` as a human-readable markdown summary.

---

## 7. Sprint Wrap-Up

### Current state
Sprint ends: Resolve → Run Summary → end.

### Target state
Sprint ends: Resolve → Retrospective (Ship only) → Sprint Wrap-Up → Run Summary → end.

### Sprint Wrap-Up contents
1. **Rules update approval**: Read retrospective's `rule_candidates[]`. If non-empty:
   - Check approval conditions (evidence_refs >= 2, contradiction_count = 0)
   - If conditions met: auto-approve, apply to rules.md, write `rules-update.json` with `status: "approved"`
   - If not met: write `rules-update.json` with `status: "proposed"`, note for future review
   - If no candidates: write with `status: "none"`
2. **Debt register update**: Read retrospective's `debt_candidates[]`. Add to `.geas/state/debt-register.json`. Compute rollup.
3. **Sprint result confirmation**: Brief summary of what was delivered vs requested.

### Protocol reflection
Add to doc 13 "Skill-Specific Mechanisms Requiring Protocol Reflection" table:

| Skill-specific item | Description | Recommended action |
|---|---|---|
| Sprint Wrap-Up | Lightweight post-resolve section for rules approval + debt update in Sprint | Add to doc 02 as Sprint pattern extension |

---

## 8. Affected Skills Summary

| Skill | Changes |
|-------|---------|
| `initiative/SKILL.md` | remaining_steps reorder, retrospective format+timing, Phase 2 debt→debt-register, Phase 3 debt→debt-register, Phase 4 gap-assessment structured output, phase-review at each transition, evolution exit gate, Nova mission-summary.md |
| `sprint/SKILL.md` | remaining_steps reorder, retrospective format+timing, Sprint Wrap-Up section |
| `cleanup/SKILL.md` | debt.json → debt-register.json format |
| `setup/SKILL.md` | Initialize debt-register.json instead of debt.json |
| `orchestrating/SKILL.md` | debt/rules reference paths update |
| `CLAUDE.md` | Phase 3 completion, Phase 4 current |
