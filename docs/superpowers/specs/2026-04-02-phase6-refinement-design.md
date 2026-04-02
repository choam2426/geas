# Phase 6: Refinement — Design Spec

## Goal

Add verification, testing, and operational tooling to ensure Phases 1-5 enforcement mechanisms work correctly and the system is observable.

## Scope

### In scope
- New skill: `conformance-checking/` — script-based meta-verification of all enforcement mechanisms
- New skill: `chaos-exercising/` — 5 failure scenarios with inline setup/verification scripts
- New skill: `policy-managing/` — rules.md override management
- New skill: `reporting/` — debt/gap dashboard + health signals → health-check.json
- New hook: `memory-review-cadence.sh` — review_after expiry detection at session start
- hooks.json registration
- CLAUDE.md update (migration complete)

### Out of scope
- Web UI dashboard (CLI/markdown only)
- Automated chaos exercise execution without human trigger
- Per-dimension confidence adjustment (future schema change)

## Reference

- `docs/protocol/12_ENFORCEMENT_CONFORMANCE_AND_METRICS.md` — conformance scenarios, metrics, health signals
- `docs/protocol/13_MIGRATION_AND_IMPLEMENTATION_ROADMAP.md` — Phase 6 deliverables, chaos exercise scope

---

## 1. New Skill: `conformance-checking/SKILL.md`

Meta-verification of existing enforcement mechanisms from Phases 1-5. Each scenario contains an inline verification script that outputs pass/fail.

### Purpose

This is NOT adding new enforcement — it's verifying that hooks and skill directives built in Phases 1-5 are working. Run this periodically or after major changes to confirm the system is healthy.

### Conformance Scenarios (from doc 12)

#### State Integrity (3 scenarios)

**SI-1: Implementation contract required before implementing**
```bash
# Check: does verify-task-status.sh or evidence-gate Tier 0 block this?
# Verify: task in .geas/tasks/ with status "implementing" must have
# a corresponding .geas/contracts/{task-id}.json with status "approved"
```

**SI-2: Worker self-check required before reviewed**
```bash
# Check: task with status "reviewed" must have worker-self-check.json
```

**SI-3: Final verdict required before passed**
```bash
# Check: task with status "passed" must have final-verdict.json
```

#### Drift/Revalidation (2 scenarios)

**DR-1: Stale task start blocked**
```bash
# Verify: stale-start-check.sh hook warns on base_commit mismatch
```

**DR-2: Paused resume baseline check**
```bash
# Verify: revalidation-record.json exists when task resumes after pause
```

#### Parallelism/Locking (2 scenarios)

**PL-1: Path lock conflict blocked**
```bash
# Verify: lock-conflict-check.sh detects overlapping targets
```

**PL-2: Integration lane serialized**
```bash
# Verify: integration-lane-check.sh warns without integration lock
```

#### Gate/Rubric (2 scenarios)

**GR-1: Low confidence threshold adjustment**
```bash
# Verify: when worker self-check confidence <= 2, rubric thresholds are +1
```

**GR-2: Stub cap enforcement**
```bash
# Verify: possible_stubs exceeding cap produces block verdict
```

#### Memory Evolution (3 scenarios)

**ME-1: Low-quality incident stable promotion blocked**
```bash
# Verify: memory-promotion-gate.sh blocks promotion without conditions met
```

**ME-2: Superseded memory in packet warned**
```bash
# Verify: memory-superseded-warning.sh detects stale memory in packets
```

**ME-3: Harmful reuse triggers under_review**
```bash
# Verify: memory with failed_reuses >= 2 transitions to under_review
```

#### Evolution Loop (4 scenarios)

**EL-1: Passed task without retrospective**
```bash
# Verify: task with status "passed" has retrospective.json
```

**EL-2: Evolution close requires gap assessment**
```bash
# Verify: .geas/state/gap-assessment.json exists at evolution close
```

**EL-3: Phase close requires debt register**
```bash
# Verify: .geas/state/debt-register.json exists at polish/evolution close
```

**EL-4: Rules update incorporated in packet builder**
```bash
# Verify: approved rules-update.json changes reflected in rules.md
```

#### Recovery (2 scenarios)

**RC-1: Gate result missing but verified claimed**
```bash
# Verify: task with status "verified" has gate-result.json
```

**RC-2: Dirty worktree + missing checkpoint**
```bash
# Verify: recovery decision table classifies as dirty_state_recovery
```

### Output

Write conformance report to `.geas/state/conformance-report.json`:
```json
{
  "timestamp": "<ISO 8601>",
  "total": 18,
  "passed": N,
  "failed": M,
  "results": [
    { "id": "SI-1", "name": "Implementation contract before implementing", "status": "pass|fail|skip", "details": "..." },
    ...
  ]
}
```

---

## 2. New Skill: `chaos-exercising/SKILL.md`

5 failure scenarios with inline bash setup scripts, trigger instructions, and verification scripts.

### Scenario 1: Mid-task Interruption Recovery

**Setup:**
```bash
# Create run.json with implementing state + agent_in_flight
cat > .geas/state/run.json << 'CHAOS'
{
  "version": "1.0",
  "status": "in_progress",
  "current_task_id": "task-chaos-001",
  "checkpoint": {
    "pipeline_step": "implementation",
    "agent_in_flight": "forge",
    "pending_evidence": [".geas/evidence/task-chaos-001/forge.json"],
    "remaining_steps": ["implementation", "self_check", "code_review"],
    "last_updated": "<now>"
  },
  "created_at": "<now>"
}
CHAOS
```

**Trigger:** Start new session or invoke `/geas:orchestrating`

**Verification:**
```bash
# recovery-packet.json should be created
ls .geas/recovery/recovery-*.json
# recovery_class should be interrupted_subagent_resume
python3 -c "import json,glob; r=json.load(open(glob.glob('.geas/recovery/recovery-*.json')[-1])); assert r['recovery_class']=='interrupted_subagent_resume', f'Expected interrupted_subagent_resume, got {r[\"recovery_class\"]}'; print('PASS: recovery_class correct')"
```

### Scenario 2: Stale Worktree Recovery

**Setup:**
```bash
# Set base_commit to a commit 5+ behind HEAD
OLD_COMMIT=$(git log --skip=5 -1 --format=%H)
python3 -c "
import json
t = json.load(open('.geas/tasks/task-chaos-002.json'))
t['base_commit'] = '$OLD_COMMIT'
t['status'] = 'ready'
json.dump(t, open('.geas/tasks/task-chaos-002.json','w'), indent=2)
"
```

**Trigger:** Attempt to start task-chaos-002

**Verification:**
```bash
# revalidation-record.json should exist
test -f .geas/tasks/task-chaos-002/revalidation-record.json && echo "PASS" || echo "FAIL"
```

### Scenario 3: Lock Orphan Detection

**Setup:**
```bash
# Add a lock with a non-existent session_id
python3 -c "
import json
locks = json.load(open('.geas/state/locks.json'))
locks['locks'].append({
  'lock_type': 'path',
  'task_id': 'task-orphan',
  'session_id': 'dead-session-999',
  'targets': ['src/'],
  'status': 'held',
  'acquired_at': '2026-01-01T00:00:00Z'
})
json.dump(locks, open('.geas/state/locks.json','w'), indent=2)
"
```

**Trigger:** Start new session (orchestrating startup runs orphan detection)

**Verification:**
```bash
# Lock should be removed
python3 -c "
import json
locks = json.load(open('.geas/state/locks.json'))
orphans = [l for l in locks['locks'] if l['session_id'] == 'dead-session-999']
assert len(orphans) == 0, f'Orphan lock not cleaned: {orphans}'
print('PASS: orphan lock cleaned')
"
```

### Scenario 4: Contradictory Memory Handling

**Setup:**
```bash
# Create two conflicting memory entries on the same topic
# Entry A says "always use approach X"
# Entry B says "never use approach X"
# Both with state "stable"
```
(Full setup script creates two memory-entry.json files with contradicting summaries and adds them to memory-index.json)

**Trigger:** Generate a context packet for a task matching the memory topic

**Verification:**
```bash
# At least one should appear in caution_items, not applicable_memory_ids
python3 -c "
import json
packet = json.load(open('.geas/packets/task-chaos-004/memory-packet.json'))
assert len(packet.get('caution_items', [])) > 0, 'Contradictory memory should be in caution_items'
print('PASS: contradictory memory in caution_items')
"
```

### Scenario 5: Missing Specialist Review Gate

**Setup:**
```bash
# Create a task in "integrated" state but without required specialist reviews
# Task has routing.required_reviewer_types = ["architecture_authority", "qa_engineer"]
# Only architecture_authority review exists, qa_engineer review is missing
```

**Trigger:** Run evidence gate on the task

**Verification:**
```bash
# Gate should return "block" verdict (Tier 0 — missing required reviewer)
python3 -c "
import json
gate = json.load(open('.geas/tasks/task-chaos-005/gate-result.json'))
assert gate['verdict'] == 'block', f'Expected block, got {gate[\"verdict\"]}'
assert gate['tier_results']['tier_0']['status'] == 'block'
print('PASS: gate blocked on missing reviewer')
"
```

---

## 3. Hook: `memory-review-cadence.sh`

- **Trigger:** SessionStart
- **Logic:** Read `.geas/state/memory-index.json`. For each entry with state `provisional`, `stable`, or `canonical`: check if `review_after` date has passed. If any expired, output warning with list of expired entries.
- **Output:** "⚠️ MEMORY REVIEW DUE: {count} entries past review_after date: {ids}. Run batch review via /geas:memorizing."

---

## 4. New Skill: `policy-managing/SKILL.md`

Manage rules.md overrides for specific scenarios (relaxing/tightening enforcement).

### Capabilities

1. **List current rules** — parse rules.md sections, show active rules
2. **Override a rule** — temporarily disable or modify a rule
   - Write override to `.geas/state/policy-overrides.json`:
     ```json
     {
       "overrides": [
         {
           "rule_id": "require-retrospective",
           "action": "disable",
           "reason": "hotfix deployment — skip retrospective",
           "expires_at": "<ISO 8601>",
           "approved_by": "product_authority"
         }
       ]
     }
     ```
3. **Check expiry** — detect expired overrides and re-enable rules
4. **Override history** — log all overrides for audit trail

### Rules
- Every override requires `reason` and `approved_by`
- Overrides expire — no permanent overrides without explicit `"expires_at": null` + product_authority approval
- Override history preserved (never deleted, only marked expired)

---

## 5. New Skill: `reporting/SKILL.md`

Debt/gap dashboard + health signal calculation.

### Dashboard Sections

1. **Debt Summary** — read `.geas/state/debt-register.json`:
   - Items by severity (critical/high/medium/low)
   - Items by kind (code_quality/architecture/security/...)
   - Items by status (open/accepted/scheduled/resolved/dropped)
   - Trend: items introduced this phase vs resolved

2. **Gap Summary** — read `.geas/state/gap-assessment.json`:
   - Fully delivered count
   - Partially delivered items (with details)
   - Not delivered items (with rationale)
   - Gap closure ratio

3. **Health Signals** — calculate 8 signals from doc 12:

   | Signal | Threshold | Source |
   |--------|-----------|--------|
   | Memory bloat | >100 entries with 0 reuses in last 10 tasks | memory-index.json |
   | Review gap | >20% specialist miss rate in last 5 tasks | events.jsonl |
   | Gate quality issue | >30% iterate rate in last 10 tasks | events.jsonl |
   | Contradiction accumulation | 2+ stable memories with contradiction_count ≥ 3 | memory-index.json |
   | Repeated failure class | same failure_class 3+ times | events.jsonl |
   | Debt stagnation | accepted debt ≥ 2× resolved per phase | debt-register.json |
   | Scope control weakness | >30% scope change after impl contract in last 5 tasks | events.jsonl |
   | Worker low-confidence | >25% confidence ≤ 2 rate in last 10 tasks | worker self-checks |

4. **Mandatory Responses** — for each triggered signal, show the required response from doc 12

### Output

- Write `.geas/state/health-check.json`:
  ```json
  {
    "timestamp": "<ISO 8601>",
    "signals": [
      { "name": "memory_bloat", "value": 15, "threshold": 100, "triggered": false },
      { "name": "debt_stagnation", "value": 2.5, "threshold": 2.0, "triggered": true, "mandatory_response": "process_lead creates debt resolution plan" }
    ]
  }
  ```
- Print markdown summary to conversation

### When to run

- Invokable anytime via `/geas:reporting`
- Orchestrating skill calls it at: phase transitions, session start (after recovery), evolution phase

---

## 6. Affected Files Summary

| File | Change |
|------|--------|
| `plugin/skills/conformance-checking/SKILL.md` | **NEW** — 18 scenario verification suite |
| `plugin/skills/chaos-exercising/SKILL.md` | **NEW** — 5 failure scenarios with inline scripts |
| `plugin/skills/policy-managing/SKILL.md` | **NEW** — rules.md override management |
| `plugin/skills/reporting/SKILL.md` | **NEW** — dashboard + health signals |
| `plugin/hooks/scripts/memory-review-cadence.sh` | **NEW** — review_after expiry detection |
| `plugin/hooks/hooks.json` | SessionStart에 memory-review-cadence 등록 |
| `plugin/skills/setup/SKILL.md` | health-check.json 초기화 (없으면 생성) |
| `CLAUDE.md` | Phase 6 완료 → 전체 마이그레이션 완료 |
