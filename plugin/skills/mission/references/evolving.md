# Evolving Phase [MANDATORY — do not skip]

### Gap Assessment

Produce a structured gap assessment comparing what was planned vs what was delivered.

1. Read `.geas/missions/{mission_id}/spec.json` (get mission_id from run.json) — extract `scope_in` and `scope_out` items
2. Read all TaskContracts in `.geas/missions/{mission_id}/tasks/` — categorize by status
3. Read `.geas/missions/{mission_id}/evolution/debt-register.json` — get open items
4. Classify each `scope_in` item:
   - Task exists with `status: "passed"` -> `fully_delivered`
   - Task exists but partially complete or with caveats -> `partially_delivered`
   - No corresponding task or task cancelled -> `not_delivered`
5. Check for `scope_out` items that were delivered anyway -> `unexpected_additions` (need traceability note)
6. Items explicitly dropped by product_authority decision -> `intentional_cuts`
7. Write `.geas/missions/{mission_id}/evolution/gap-assessment-evolving.json` conforming to `schemas/gap-assessment.schema.json`:

```json
{
  "version": "1.0",
  "artifact_type": "gap_assessment",
  "artifact_id": "ga-evolving",
  "producer_type": "product_authority",
  "scope_in_summary": "<what was planned — summarize from current mission spec scope_in>",
  "scope_out_summary": "<what was explicitly excluded — from current mission spec scope_out>",
  "fully_delivered": ["item 1", "item 2"],
  "partially_delivered": ["item 3 — missing error handling"],
  "not_delivered": ["item 4"],
  "intentional_cuts": ["item 5 — cut per decision dec-003"],
  "unexpected_additions": [],
  "recommended_followups": ["Complete item 3 error handling", "Address item 4 in next mission"],
  "created_at": "<ISO 8601>"
}
```

8. **Forward-feeding rule**: Items appearing in `partially_delivered` or `not_delivered` across 2+ gap assessments are automatically fed into the next mission spec's constraints during intake.
9. Reject any work that falls under `scope_out` — Evolving refines, it does not expand.

### Prioritize Remaining Work
Classify remaining items:
- **P0 (must)**: unimplemented `scope_in` items that are core to the mission + HIGH severity debt
- **P1 (nice-to-have)**: `scope_in` items that are enhancements + MEDIUM severity debt

Present the prioritized list to the user:
```
[Orchestrator] Evolving scope:
  P0 (will execute):
    1. <item>
    2. <item>
  P1 (skipped unless you request):
    1. <item>

  Proceed with P0 items?
```

If no P0 items remain: skip to product_authority Final Briefing.

### Rules Update Approval

1. Read all per-task retrospectives: `.geas/missions/{mission_id}/tasks/*/retrospective.json`
2. Collect all `rule_candidates[]` across tasks
3. If no candidates across any task: write `.geas/missions/{mission_id}/evolution/rules-update.json` with `status: "none"`, `reason: "no rule candidates from any task retrospective"`, `evidence_refs: []`, `applies_to: []`. Skip to next step.
4. For each candidate, check approval conditions:
   - `evidence_refs` >= 2 (same pattern observed in 2+ tasks) AND `contradiction_count` = 0 -> auto-approve
   - Otherwise -> spawn domain authority for review
5. Write `.geas/missions/{mission_id}/evolution/rules-update.json` conforming to `schemas/rules-update.schema.json`:
   ```json
   {
     "version": "1.0",
     "artifact_type": "rules_update",
     "artifact_id": "ru-{mission-id}",
     "producer_type": "orchestration_authority",
     "status": "approved",
     "affected_rule_ids": ["rule-001", "rule-002"],
     "reason": "<aggregated rationale>",
     "evidence_refs": ["retro-task-001", "retro-task-003"],
     "applies_to": ["rules.md section X"],
     "created_at": "<ISO 8601>"
   }
   ```
6. If `status: "approved"`: apply changes to `.geas/rules.md`
7. Log: `{"event": "rules_update", "status": "approved|none", "timestamp": "<actual>"}`

### Memory Promotion

Batch review and promotion of accumulated memory candidates across the mission.

1. Read all candidates from `.geas/memory/candidates/`
2. For each candidate:
   a. Check promotion conditions: evidence_refs >= 2 OR similar incidents >= 2 OR explicit approval
   b. If conditions met and no domain review yet: spawn domain authority (per memorizing skill section 3)
   c. If domain authority approves (promote_provisional): promote candidate -> provisional
      - Move from `candidates/` to `entries/`
      - Update state, set `review_after` to 30 days from now
      - Update memory-index.json
   d. If rejected: set state to `rejected` in candidate file, update index
   e. If keep: leave as candidate for future evidence
3. Check existing provisional entries for stable promotion:
   - 3+ successful_reuses + 0 contradictions -> spawn domain authority for stable review
4. Run decay detection (memorizing skill section 6)
5. Run application logging for all mission tasks (memorizing skill section 5)
6. Log: `{"event": "memory_promotion_batch", "promoted": N, "rejected": M, "decayed": K, "timestamp": "<actual>"}`

### Execute P0 Items
For each P0 item, run the full pipeline from `references/pipeline.md`:
- Compile TaskContract -> Design -> Design Guide -> Implementation Contract -> Implementation -> Specialist Review -> Testing -> Evidence Gate -> Critical Reviewer Challenge -> Final Verdict -> Resolve -> Retrospective

Same mandatory steps, same Closure Packet verification, same checkpoint management as Building phase.

**Exit criteria** — stop executing when ANY of:
- All P0 items are complete
- User requests stop

### Product-authority Final Briefing [MANDATORY]
```
Agent(agent: "product-authority", prompt: "Final product review. Read the current mission spec at .geas/missions/{mission_id}/spec.json (get mission_id from .geas/state/run.json), .geas/missions/{mission_id}/evolution/gap-assessment-evolving.json, .geas/missions/{mission_id}/evolution/debt-register.json, and all evidence across all phases. Deliver strategic summary: what shipped, what was cut, product health assessment, and recommendations for future work. Write JSON to .geas/missions/{mission_id}/evidence/evolving/product-authority-final.json. ALSO write a human-readable markdown summary to .geas/missions/{mission_id}/mission-summary.md covering: mission goal, delivered scope, known gaps, debt status, and recommendations.")
```
Verify `.geas/missions/{mission_id}/evidence/evolving/product-authority-final.json` exists.
Verify `.geas/missions/{mission_id}/mission-summary.md` exists.

### Mission Briefing [MANDATORY — orchestrator writes directly]

Assemble a detailed execution briefing by reading all `.geas/` artifacts. This is NOT an agent spawn — orchestrator reads and writes directly.

**Read these sources:**
- `events.jsonl` — find `run_started` timestamp for this mission, then all events after it
- `.geas/missions/{mission_id}/tasks/*.json` — filter to tasks with `task_compiled` events after `run_started`
- `.geas/missions/{mission_id}/tasks/{task-id}/gate-result.json` — gate verdict and iteration count
- `.geas/missions/{mission_id}/tasks/{task-id}/challenge-review.json` — challenger execution
- `.geas/missions/{mission_id}/tasks/{task-id}/final-verdict.json` — verdict
- `.geas/missions/{mission_id}/evolution/debt-register.json` — open debt items
- `.geas/missions/{mission_id}/evolution/gap-assessment-evolving.json` — recommended follow-ups
- `.geas/missions/{mission_id}/tasks/{task-id}/closure-packet.json` — open risks
- `.geas/ledger/token-summary.json` — token usage
- `.geas/ledger/costs.jsonl` — subagent count

**Write `.geas/missions/{mission_id}/mission-briefing.md`:**

```markdown
# Mission Briefing — {mission title}

## Task Execution Summary

| Task | Title | Risk | Gate | Retries | Critical Reviewer | Verdict |
|------|-------|------|------|---------|-------------------|---------|
| {task_id} | {title} | {risk_level} | {gate verdict} | {retry count} | {in-pipeline/post-backfill/skipped} | {ship/iterate/escalate} |

## Metrics

- **Total duration:** {run_started to phase_complete(complete)}
- **Phase breakdown:** specifying {Xm} | building {Xm} | polishing {Xm} | evolving {Xm}
- **Subagents spawned:** {count from costs.jsonl agent_stop events}
- **Token usage:** input {X}K | output {X}K
- **Git commits:** {count of task_resolved events with commit field}
- **Memory candidates:** {count} new

## Open Items

### Technical Debt
{for each item in debt-register where status == "open":}
- {debt_id} ({severity}): {title}

### Risks
{for each task, from closure-packet open_risks.items:}
- {task_id}: {description}

### Recommended Follow-ups
{from gap-assessment-evolving recommended_followups:}
- {item}
```

**Critical Reviewer detection logic:**
- Find `step_complete` event where `step == "challenger"` for each task
- If timestamp is between `gate_result` and `task_resolved` → `in-pipeline`
- If timestamp is after `task_resolved` → `post-backfill`
- If no such event exists → `skipped`

**After writing the file, print a console summary:**

```
[Orchestrator] Mission briefing written to .geas/missions/{mission_id}/mission-briefing.md

  Tasks: {passed}/{total} passed | Duration: {total} | Commits: {count}
  Debt: {count} open ({high_count} high) | Memory: {count} new candidates
```

Verify `.geas/missions/{mission_id}/mission-briefing.md` exists.

### Release Management [MANDATORY]

Orchestrator runs release directly:
1. Determine version bump (from gap-assessment and debt status)
2. Generate changelog from `.geas/ledger/events.jsonl`
3. Commit version bump and changelog
4. Tag release with semantic version
5. Log: `{"event": "release_created", "version": "...", "timestamp": "<actual>"}`

### Run Summary
Invoke `/geas:reporting` to generate session audit trail.

### Evolving Exit Gate and Close

**Before closing, verify ALL 5 required artifacts exist:**

1. `.geas/missions/{mission_id}/evolution/gap-assessment-evolving.json` — produced in Gap Assessment step
2. `.geas/missions/{mission_id}/evolution/debt-register.json` — all open debt triaged (no items with `severity: "high"` or `"critical"` and `status: "open"`)
3. `.geas/missions/{mission_id}/evolution/rules-update.json` — exists with `status: "approved"` or `"none"` (produced in Rules Update Approval step)
4. `.geas/missions/{mission_id}/mission-summary.md` — produced in product_authority Final Briefing step
5. `.geas/missions/{mission_id}/phase-reviews/evolving.json` — write now (see below)

**If ANY artifact is missing: go back and execute the missing step. Do NOT close without all 5.**

**Debt triage check**: Read debt-register.json. If any item has `severity: "critical"` and `status: "open"`, the exit gate fails. Product_authority must decide: (a) immediate fix as task, (b) accept with mandatory rationale, or (c) defer to next mission. Record decision in a DecisionRecord with `decision_type: "critical_debt_triage"`.

Write `.geas/missions/{mission_id}/phase-reviews/evolving.json`:
```json
{
  "version": "1.0",
  "artifact_type": "phase_review",
  "artifact_id": "pr-evolving",
  "producer_type": "orchestration_authority",
  "mission_phase": "evolving",
  "status": "ready_to_exit",
  "summary": "<evolving outcomes>",
  "gate_criteria_met": ["gap-assessment exists", "debt triaged", "rules-update exists", "mission-summary exists"],
  "gate_criteria_unmet": [],
  "risk_notes": [],
  "created_at": "<ISO 8601>"
}
```

Update run state: `{ "phase": "complete", "status": "complete" }`
Log: `{"event": "phase_complete", "phase": "complete", "timestamp": "<actual>"}`
