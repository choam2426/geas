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
6. Items explicitly dropped by product-authority decision -> `intentional_cuts`
7. Assemble the gap assessment JSON and write it via CLI:
   ```bash
   Bash("geas evolution gap-assessment --mission {mission_id} --phase evolving --data '<gap_assessment_json>'")
   ```
   The CLI validates the data automatically. Required fields: `scope_in_summary`, `fully_delivered`, `partially_delivered`, `not_delivered`, `intentional_cuts`, `recommended_followups`.

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

If no P0 items remain: skip to product-authority Final Briefing.

### Rules Update Approval

1. Read all per-task retrospectives from record.json: for each task directory in `.geas/missions/{mission_id}/tasks/`, read `record.json` and extract the `retrospective` section
2. Collect all `rule_candidates[]` across tasks
3. If no candidates across any task: write rules-update via CLI: `Bash("geas evolution rules-update --mission {mission_id} --data '<rules_update_json>'")`  with `status: "none"`, `reason: "no rule candidates from any task retrospective"`, `evidence_refs: []`, `applies_to: []`. Skip to next step.
4. For each candidate, check approval conditions:
   - `evidence_refs` >= 2 (same pattern observed in 2+ tasks) AND `contradiction_count` = 0 -> auto-approve
   - Otherwise -> spawn domain authority for review:
     ```bash
     Bash("geas state checkpoint set --step rules_update_review --agent {domain-authority}")
     ```
     ```
     Agent(agent: "{domain-authority}", prompt: "...")
     ```
     ```bash
     Bash("geas state checkpoint clear")
     ```
5. Assemble the rules-update JSON and write it via CLI: `Bash("geas evolution rules-update --mission {mission_id} --data '<rules_update_json>'")`  Required fields: `status` (approved/none), `reason`, `evidence_refs`, `applies_to`. **`producer_type`**: omit when `status: "none"` (no producer needed). For approved/proposed/rejected: use the domain authority that made the decision.
   **Note:** When `status` is `"approved"`, `affected_rule_ids[]` is required (at least 1 item).
6. If `status: "approved"`: apply changes to `.geas/rules.md`
7. Log: `Bash("geas event log --type rules_update --data '{\"status\":\"approved|none\"}'")` 

### Memory Consolidation

Batch review of accumulated memory across the mission. Memory uses a 2-file model: `rules.md` for project knowledge, `memory/agents/{agent}.md` for per-agent notes.

1. Read all per-task retrospectives from record.json -> collect all `memory_candidates[]` and `rule_candidates[]`
2. For project-level candidates (conventions, patterns, recurring issues):
   - If approved (evidence_refs >= 2 or domain authority approval): apply to `.geas/rules.md`
   - If rejected or uncertain: skip (do not modify rules.md)
3. For agent-specific candidates:
   - Write to the relevant agent's memory file via CLI:
     ```bash
     Bash("geas memory agent-note --agent {agent_type} --add '<lesson>'")
     ```
4. Review existing agent memory files for stale or contradicted entries. Rewrite if needed.
5. Log: `Bash("geas event log --type memory_consolidation --data '{\"rules_added\":N,\"agent_notes_added\":M}'")` 

### Execute P0 Items
For each P0 item, run the full pipeline from `references/pipeline.md`:
- Compile TaskContract -> Design -> Design Guide -> Implementation Contract -> Implementation -> Specialist Review -> Testing -> Evidence Gate -> Critical Reviewer Challenge -> Final Verdict -> Resolve -> Retrospective

Same mandatory steps, same Closure Packet verification, same checkpoint management as Building phase.

**Exit criteria** — stop executing when ANY of:
- All P0 items are complete
- User requests stop

### Product-authority Final Briefing [MANDATORY]
```bash
Bash("geas state checkpoint set --step product_authority_final --agent product-authority")
```
```
Agent(agent: "product-authority", prompt: "Final product review. Read the current mission spec at .geas/missions/{mission_id}/spec.json (get mission_id from .geas/state/run.json), .geas/missions/{mission_id}/evolution/gap-assessment-evolving.json, .geas/missions/{mission_id}/evolution/debt-register.json, and all evidence across all phases. Deliver your Final Briefing per your Review Protocols. Write your evidence via CLI. Run: geas evidence add --phase evolving --agent product-authority-final --role authority --set summary='<strategic summary>' --set verdict='pass' --set rationale='<final assessment>'. ALSO write a human-readable markdown summary to .geas/missions/{mission_id}/mission-summary.md (use Write tool -- no dedicated CLI command for mission-summary).")
```
```bash
Bash("geas state checkpoint clear")
```
Verify `.geas/missions/{mission_id}/evolution/evidence/product-authority-final.json` exists.
Verify `.geas/missions/{mission_id}/mission-summary.md` exists.

### Mission Briefing [MANDATORY — orchestrator writes directly]

Assemble a detailed execution briefing by reading all `.geas/` artifacts. This is NOT an agent spawn — orchestrator reads and writes directly.

**Read these sources:**
- `.geas/state/events.jsonl` — find `run_started` timestamp for this mission, then all events after it
- `.geas/missions/{mission_id}/tasks/{task-id}/contract.json` — filter to tasks with `task_compiled` events after `run_started`
- `.geas/missions/{mission_id}/tasks/{task-id}/record.json` — gate_result (verdict, iteration count), challenge_review (challenger execution), verdict (final verdict), closure (open risks)
- `.geas/missions/{mission_id}/evolution/debt-register.json` — open debt items
- `.geas/missions/{mission_id}/evolution/gap-assessment-evolving.json` — recommended follow-ups

**Write `.geas/missions/{mission_id}/mission-briefing.md`** (use Write tool — no dedicated CLI command for mission-briefing):

```markdown
# Mission Briefing — {mission title}

## Task Execution Summary

| Task | Title | Risk | Gate | Retries | Critical Reviewer | Verdict |
|------|-------|------|------|---------|-------------------|---------|
| {task_id} | {title} | {risk_level} | {gate verdict} | {retry count} | {in-pipeline/post-backfill/skipped} | {ship/iterate/escalate} |

## Metrics

- **Total duration:** {run_started to phase_complete(complete)}
- **Phase breakdown:** specifying {Xm} | building {Xm} | polishing {Xm} | evolving {Xm}
- **Subagents spawned:** {count from events.jsonl agent_stop events}
- **Token usage:** input {X}K | output {X}K
- **Git commits:** {count of task_resolved events with commit field}
- **Memory candidates:** {count} new

## Open Items

### Technical Debt
{for each item in debt-register where status == "open":}
- {debt_id} ({severity}): {title}

### Risks
{for each task, from record.json closure.open_risks:}
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

**After writing the file, print a detailed console briefing:**

```
═══════════════════════════════════════════════════
  MISSION COMPLETE — {mission title}
═══════════════════════════════════════════════════

─── TASK RESULTS ──────────────────────────────────

  ┌ {task-001}: {title}
  │ Risk: {risk_level} | Gate: {PASS/FAIL} | Retries: {N}
  │ Challenger: {in-pipeline / skipped}
  │ Verdict: {PASS}
  └─────────────────────────────────────────────

  ┌ {task-002}: {title}
  │ ...
  └─────────────────────────────────────────────

  Result: {passed}/{total} tasks passed

─── SCOPE DELIVERY ────────────────────────────────

  Fully delivered:
    ✓ {scope_in item}
    ✓ {scope_in item}
  Partially delivered:
    △ {item} — {what's missing}
  Not delivered:
    ✗ {item}
  Intentional cuts:
    — {item} (reason)

─── METRICS ───────────────────────────────────────

  Duration:       {total} (specifying {Xm} | building {Xm} | polishing {Xm} | evolving {Xm})
  Agents spawned: {count}
  Tokens:         input {X}K | output {X}K
  Commits:        {count}

─── OPEN ITEMS ────────────────────────────────────

  Debt ({count} open):
    • [{severity}] {debt_id}: {title}
    • ...

  Risks:
    • {task_id}: {risk description}
    • ...
    (none = "No open risks")

─── EVOLUTION ─────────────────────────────────────

  Rules updated:  {count} new rules added to rules.md
  Agent notes:    {count} notes added across {N} agent memory files
  Follow-ups:
    • {recommended follow-up}
    • ...

═══════════════════════════════════════════════════
  Full report: .geas/missions/{mission_id}/mission-briefing.md
═══════════════════════════════════════════════════
```

Verify `.geas/missions/{mission_id}/mission-briefing.md` exists.

### Release Management [MANDATORY]

Orchestrator runs release directly:
1. Determine version bump (from gap-assessment and debt status)
2. Generate changelog from `.geas/state/events.jsonl`
3. Commit version bump and changelog
4. Tag release with semantic version
5. Log: `Bash("geas event log --type release_created --data '{\"version\":\"...\"}'")` 

### Run Summary
Invoke `/geas:reporting` to generate session audit trail.

### Evolving Exit Gate and Close

**Before closing, verify ALL 5 required artifacts exist:**

1. `.geas/missions/{mission_id}/evolution/gap-assessment-evolving.json` — produced in Gap Assessment step
2. `.geas/missions/{mission_id}/evolution/debt-register.json` — all open debt triaged (no items with `severity: "high"` or `"critical"` and `status: "open"`)
3. `.geas/missions/{mission_id}/evolution/rules-update.json` — exists with `status: "approved"` or `"none"` (produced in Rules Update Approval step)
4. `.geas/missions/{mission_id}/mission-summary.md` — produced in product_authority Final Briefing step
5. Phase review for evolving — write via `geas phase write` (see below), verify via `geas phase read-latest --mission {mission_id} --phase evolving`

**If ANY artifact is missing: go back and execute the missing step. Do NOT close without all 5.**

**Debt triage check**: Read debt-register.json. If any item has `severity: "critical"` and `status: "open"`, the exit gate fails. Product-authority must decide: (a) immediate fix as task, (b) accept with mandatory rationale, or (c) defer to next mission. Record decision in a DecisionRecord with `decision_type: "critical_debt_triage"`.

Write the evolving phase review via CLI:
```bash
Bash("geas phase write --mission {mission_id} --data '<phase_review_json>'")
```
The phase review data:
```json
{
  "version": "1.0",
  "artifact_type": "phase_review",
  "artifact_id": "pr-evolving",
  "producer_type": "orchestration-authority",
  "mission_phase": "evolving",
  "status": "ready_to_exit",
  "summary": "<evolving outcomes>",
  "gate_criteria_met": ["gap-assessment exists", "debt triaged", "rules-update exists", "mission-summary exists"],
  "gate_criteria_unmet": [],
  "risk_notes": [],
  "created_at": "<ISO 8601>"
}
```

Update run state:
```bash
Bash("geas state checkpoint clear")
Bash("geas state update --field current_task_id --value null")
Bash("geas state update --field status --value complete")
Bash("geas state update --field phase --value complete")
```
The `phase: complete` transition MUST be last — the CLI auto-clears `mission_id`, `mission`, `completed_tasks`, and `current_task_id` when phase is set to `complete`, leaving run.json clean for the next mission.

Log: `Bash("geas event log --type phase_complete --data '{\"phase\":\"complete\"}'")` 
