# Phase 6: Refinement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add verification, testing, and operational tooling to ensure Phases 1-5 enforcement mechanisms work correctly and the system is observable.

**Architecture:** 4 new skills (conformance-checking, chaos-exercising, policy-managing, reporting) + 1 hook (memory-review-cadence). Skills contain inline bash/python verification scripts. No external test runner needed — the orchestrator executes scripts within the skills.

**Tech Stack:** Markdown skills, Bash/Python inline scripts, JSON, git

---

## File Structure

| File | Responsibility | Tasks |
|------|---------------|-------|
| `plugin/skills/conformance-checking/SKILL.md` | 18-scenario verification suite | 1 |
| `plugin/skills/chaos-exercising/SKILL.md` | 5 failure scenario scripts | 2 |
| `plugin/skills/policy-managing/SKILL.md` | rules.md override management | 3 |
| `plugin/skills/reporting/SKILL.md` | Dashboard + health signals | 4 |
| `plugin/hooks/scripts/memory-review-cadence.sh` | review_after expiry detection | 5 |
| `plugin/hooks/hooks.json` | Hook registration | 5 |
| `plugin/skills/setup/SKILL.md` | health-check.json init | 4 |
| `CLAUDE.md` | Migration complete | 6 |

---

### Task 1: Create conformance-checking skill

**Goal:** 18 conformance scenarios from doc 12 with inline verification scripts.

**Files:**
- Create: `plugin/skills/conformance-checking/SKILL.md`
- Reference: `docs/protocol/12_ENFORCEMENT_CONFORMANCE_AND_METRICS.md`

- [ ] **Step 1: Create the skill file**

Write `plugin/skills/conformance-checking/SKILL.md`. The skill must contain:

- YAML frontmatter: `name: conformance-checking`, description about meta-verification
- User-invocable: true (`/geas:conformance-checking`)
- Introduction explaining this verifies existing enforcement mechanisms from Phases 1-5
- 7 sections matching doc 12 categories (State Integrity, Drift/Revalidation, Parallelism/Locking, Gate/Rubric, Memory Evolution, Evolution Loop, Recovery)
- 18 scenarios total, each with:
  - ID (SI-1, DR-1, etc.)
  - Name
  - What it checks (which hook/skill directive)
  - Inline bash/python verification script
  - Expected result (pass condition)
- Output section: write `.geas/state/conformance-report.json` with timestamp, total, passed, failed, results array

Each scenario verification script should be a self-contained bash block that reads `.geas/` state files, checks conditions, and prints PASS or FAIL. Here are all 18:

**State Integrity:**
- SI-1: For each task with status "implementing" in `.geas/tasks/`, check `.geas/contracts/{task-id}.json` exists with status "approved"
- SI-2: For each task with status "reviewed", check `.geas/tasks/{task-id}/worker-self-check.json` exists
- SI-3: For each task with status "passed", check `.geas/tasks/{task-id}/final-verdict.json` exists

**Drift/Revalidation:**
- DR-1: stale-start-check.sh exists and is registered in hooks.json PostToolUse
- DR-2: Revalidation logic exists in initiative/sprint skills (grep for "Baseline Check")

**Parallelism/Locking:**
- PL-1: lock-conflict-check.sh exists and is registered in hooks.json
- PL-2: integration-lane-check.sh exists and is registered in hooks.json

**Gate/Rubric:**
- GR-1: evidence-gate/SKILL.md contains "confidence <= 2" threshold adjustment logic
- GR-2: evidence-gate/SKILL.md contains stub cap table with risk_level thresholds

**Memory Evolution:**
- ME-1: memory-promotion-gate.sh exists and checks promotion conditions
- ME-2: memory-superseded-warning.sh exists and detects stale memory in packets
- ME-3: memorizing/SKILL.md contains harmful reuse rollback (failed_reuses >= 2 → under_review)

**Evolution Loop:**
- EL-1: For each task with status "passed", check `.geas/tasks/{task-id}/retrospective.json` exists
- EL-2: initiative/SKILL.md Evolution exit gate requires gap-assessment.json
- EL-3: initiative/SKILL.md phase close requires debt-register.json
- EL-4: initiative/SKILL.md Rules Update Approval step exists (4.2.5)

**Recovery:**
- RC-1: For each task with status "verified", check `.geas/tasks/{task-id}/gate-result.json` exists
- RC-2: orchestrating/SKILL.md contains recovery decision table with dirty_state_recovery

- [ ] **Step 2: Commit**

```bash
git add plugin/skills/conformance-checking/SKILL.md
git commit -m "feat: create conformance-checking skill — 18 scenario verification suite"
```

---

### Task 2: Create chaos-exercising skill

**Goal:** 5 failure scenarios with inline setup, trigger, and verification scripts.

**Files:**
- Create: `plugin/skills/chaos-exercising/SKILL.md`

- [ ] **Step 1: Create the skill file**

Write `plugin/skills/chaos-exercising/SKILL.md`. The skill must contain:

- YAML frontmatter: `name: chaos-exercising`, description about failure scenario testing
- User-invocable: true (`/geas:chaos-exercising`)
- Warning: "This skill intentionally corrupts .geas/ state for testing. Only run in a test project or on a disposable branch."
- 5 scenarios, each with 3 sections:
  - **Setup** — inline bash script that creates the corrupted state
  - **Trigger** — instruction to start session or invoke specific skill
  - **Verification** — inline bash/python script that checks recovery result, prints PASS/FAIL

**Scenario 1: Mid-task Interruption Recovery**

Setup: Write run.json with status "in_progress", agent_in_flight set, pending_evidence pointing to non-existent file.

```bash
mkdir -p .geas/state .geas/tasks
cat > .geas/state/run.json << 'EOF'
{
  "version": "1.0",
  "status": "in_progress",
  "mode": "sprint",
  "phase": null,
  "current_task_id": "task-chaos-001",
  "completed_tasks": [],
  "decisions": [],
  "checkpoint": {
    "pipeline_step": "implementation",
    "agent_in_flight": "forge",
    "pending_evidence": [".geas/evidence/task-chaos-001/forge.json"],
    "retry_count": 0,
    "parallel_batch": null,
    "completed_in_batch": [],
    "remaining_steps": ["implementation", "self_check", "code_review", "testing"],
    "last_updated": "2026-04-02T00:00:00Z"
  },
  "created_at": "2026-04-02T00:00:00Z"
}
EOF
```

Trigger: Start new session (orchestrating startup).

Verification:
```bash
python3 -c "
import json, glob
files = glob.glob('.geas/recovery/recovery-*.json')
assert len(files) > 0, 'FAIL: No recovery-packet.json created'
r = json.load(open(files[-1]))
assert r['recovery_class'] == 'interrupted_subagent_resume', f'FAIL: Expected interrupted_subagent_resume, got {r[\"recovery_class\"]}'
print('PASS: Mid-task interruption recovery')
"
```

**Scenario 2: Stale Worktree Recovery**

Setup: Create a task with base_commit set to 5+ commits behind HEAD.

```bash
OLD_COMMIT=$(git log --skip=5 -1 --format=%H 2>/dev/null || git log -1 --format=%H)
cat > .geas/tasks/task-chaos-002.json << EOF
{
  "version": "1.0",
  "artifact_type": "task_contract",
  "artifact_id": "tc-chaos-002",
  "producer_type": "orchestration_authority",
  "created_at": "2026-04-02T00:00:00Z",
  "task_id": "task-chaos-002",
  "title": "[Chaos] Stale worktree test",
  "goal": "Test stale detection",
  "task_kind": "code",
  "risk_level": "low",
  "gate_profile": "code_change",
  "vote_round_policy": "never",
  "acceptance_criteria": ["test passes"],
  "eval_commands": [],
  "rubric": { "dimensions": [{ "name": "core_interaction", "threshold": 3 }] },
  "retry_budget": 3,
  "scope": { "paths": ["src/"] },
  "routing": { "primary_worker_type": "backend_engineer", "required_reviewer_types": ["architecture_authority"] },
  "base_commit": "$OLD_COMMIT",
  "status": "ready"
}
EOF
```

Trigger: Attempt to start task-chaos-002 (baseline check should fire).

Verification:
```bash
python3 -c "
import os
exists = os.path.exists('.geas/tasks/task-chaos-002/revalidation-record.json')
# Alternatively check if stale-start-check hook warned
print('PASS: Stale detection triggered' if exists else 'PARTIAL: Check stale-start-check.sh output')
"
```

**Scenario 3: Lock Orphan Detection**

Setup: Add lock with dead session_id.

```bash
python3 -c "
import json
locks = {'version': '1.0', 'locks': [{'lock_type': 'path', 'task_id': 'task-orphan', 'session_id': 'dead-session-999', 'targets': ['src/'], 'status': 'held', 'acquired_at': '2026-01-01T00:00:00Z'}]}
json.dump(locks, open('.geas/state/locks.json', 'w'), indent=2)
"
```

Trigger: Start session (orchestrating lock initialization).

Verification:
```bash
python3 -c "
import json
locks = json.load(open('.geas/state/locks.json'))
orphans = [l for l in locks['locks'] if l['session_id'] == 'dead-session-999']
assert len(orphans) == 0, f'FAIL: Orphan lock not cleaned: {orphans}'
print('PASS: Lock orphan detection')
"
```

**Scenario 4: Contradictory Memory Handling**

Setup: Create two conflicting stable memory entries.

```bash
mkdir -p .geas/memory/entries
python3 -c "
import json

entry_a = {
  'meta': {'version':'1.0','artifact_type':'memory_entry','artifact_id':'mem-conflict-a','producer_type':'process_lead','created_at':'2026-04-02T00:00:00Z'},
  'memory_id':'mem-conflict-a','memory_type':'architecture_precedent','state':'stable',
  'title':'Always use approach X for caching',
  'summary':'Caching should always use approach X based on performance testing',
  'scope':'project','evidence_refs':['retro-001','retro-002','retro-003'],
  'signals':{'evidence_count':3,'reuse_count':4,'successful_reuses':3,'failed_reuses':1,'contradiction_count':1,'confidence':0.6},
  'review_after':'2026-07-01T00:00:00Z','supersedes':[],'superseded_by':None,'tags':['caching','architecture'],'body':['Use approach X']
}
entry_b = {
  'meta': {'version':'1.0','artifact_type':'memory_entry','artifact_id':'mem-conflict-b','producer_type':'process_lead','created_at':'2026-04-02T00:00:00Z'},
  'memory_id':'mem-conflict-b','memory_type':'architecture_precedent','state':'stable',
  'title':'Never use approach X for caching',
  'summary':'Approach X causes memory leaks in production; use approach Y instead',
  'scope':'project','evidence_refs':['retro-004','retro-005','retro-006'],
  'signals':{'evidence_count':3,'reuse_count':4,'successful_reuses':3,'failed_reuses':1,'contradiction_count':1,'confidence':0.6},
  'review_after':'2026-07-01T00:00:00Z','supersedes':[],'superseded_by':None,'tags':['caching','architecture'],'body':['Use approach Y']
}
json.dump(entry_a, open('.geas/memory/entries/mem-conflict-a.json','w'), indent=2)
json.dump(entry_b, open('.geas/memory/entries/mem-conflict-b.json','w'), indent=2)

idx = {'meta':{'version':'1.0','artifact_type':'memory_index','artifact_id':'mi-chaos','producer_type':'orchestration_authority','created_at':'2026-04-02T00:00:00Z'},
  'entries':[
    {'memory_id':'mem-conflict-a','memory_type':'architecture_precedent','state':'stable','confidence':0.6,'tags':['caching','architecture'],'review_after':'2026-07-01T00:00:00Z'},
    {'memory_id':'mem-conflict-b','memory_type':'architecture_precedent','state':'stable','confidence':0.6,'tags':['caching','architecture'],'review_after':'2026-07-01T00:00:00Z'}
]}
json.dump(idx, open('.geas/state/memory-index.json','w'), indent=2)
"
```

Trigger: Generate context packet for a task with scope.paths including caching-related paths.

Verification:
```bash
python3 -c "
import json, glob
packets = glob.glob('.geas/packets/*/memory-packet.json')
if not packets:
    print('SKIP: No memory packet generated (trigger context-packet manually)')
else:
    p = json.load(open(packets[-1]))
    caution = p.get('caution_items', [])
    print(f'PASS: {len(caution)} caution items found' if caution else 'FAIL: Contradictory memory should produce caution items')
"
```

**Scenario 5: Missing Specialist Review Gate**

Setup: Create task in "integrated" with required reviewers but missing one review.

```bash
mkdir -p .geas/tasks/task-chaos-005 .geas/evidence/task-chaos-005
# Task contract with two required reviewers
python3 -c "
import json
tc = {
  'version':'1.0','artifact_type':'task_contract','artifact_id':'tc-chaos-005','producer_type':'orchestration_authority',
  'created_at':'2026-04-02T00:00:00Z','task_id':'task-chaos-005','title':'[Chaos] Missing review test',
  'goal':'Test missing reviewer gate block','task_kind':'code','risk_level':'normal',
  'gate_profile':'code_change','vote_round_policy':'never',
  'acceptance_criteria':['test passes'],'eval_commands':[],'rubric':{'dimensions':[{'name':'core_interaction','threshold':3}]},
  'retry_budget':3,'scope':{'paths':['src/']},'routing':{'primary_worker_type':'backend_engineer','required_reviewer_types':['architecture_authority','qa_engineer']},
  'base_commit':'abc123','status':'integrated'
}
json.dump(tc, open('.geas/tasks/task-chaos-005.json','w'), indent=2)
# Only architecture_authority review exists (qa_engineer missing)
json.dump({'reviewer':'architecture_authority','status':'approved','summary':'LGTM'}, open('.geas/evidence/task-chaos-005/forge-review.json','w'), indent=2)
# worker self-check exists
json.dump({'version':'1.0','artifact_type':'worker_self_check','artifact_id':'wsc-005','producer_type':'backend_engineer','task_id':'task-chaos-005','known_risks':[],'untested_paths':[],'possible_stubs':[],'what_to_test_next':[],'confidence':4,'summary':'Done','created_at':'2026-04-02T00:00:00Z'}, open('.geas/tasks/task-chaos-005/worker-self-check.json','w'), indent=2)
"
```

Trigger: Run evidence gate on task-chaos-005.

Verification:
```bash
python3 -c "
import json, os
gf = '.geas/tasks/task-chaos-005/gate-result.json'
if os.path.exists(gf):
    g = json.load(open(gf))
    assert g['verdict'] == 'block', f'FAIL: Expected block, got {g[\"verdict\"]}'
    print('PASS: Gate blocked on missing specialist review')
else:
    print('SKIP: Gate not yet run (invoke evidence-gate on task-chaos-005)')
"
```

- [ ] **Step 2: Commit**

```bash
git add plugin/skills/chaos-exercising/SKILL.md
git commit -m "feat: create chaos-exercising skill — 5 failure scenarios with inline scripts"
```

---

### Task 3: Create policy-managing skill

**Goal:** rules.md override management tool.

**Files:**
- Create: `plugin/skills/policy-managing/SKILL.md`

- [ ] **Step 1: Create the skill file**

Write `plugin/skills/policy-managing/SKILL.md` with:

- YAML frontmatter: `name: policy-managing`, description about rules.md override management
- User-invocable: true (`/geas:policy-managing`)
- 4 capabilities:
  1. **List rules** — parse `.geas/rules.md` sections, show active rules. Also read `.geas/state/policy-overrides.json` to show which rules are overridden.
  2. **Override a rule** — create/update `.geas/state/policy-overrides.json`. Each override needs: rule_id, action (disable|modify), reason, expires_at, approved_by. Example JSON inline.
  3. **Check expiry** — read policy-overrides.json, detect expired overrides (expires_at < now), re-enable expired rules by removing the override entry.
  4. **Override history** — all overrides are preserved (expired ones marked with `expired: true`), never deleted.
- Rules section: every override requires reason + approved_by. No permanent overrides without product_authority explicit approval. Override history preserved for audit.
- policy-overrides.json format example inline:
  ```json
  {
    "overrides": [
      {
        "rule_id": "require-retrospective",
        "action": "disable",
        "reason": "hotfix deployment",
        "expires_at": "2026-04-03T00:00:00Z",
        "approved_by": "product_authority",
        "created_at": "2026-04-02T12:00:00Z",
        "expired": false
      }
    ]
  }
  ```

- [ ] **Step 2: Commit**

```bash
git add plugin/skills/policy-managing/SKILL.md
git commit -m "feat: create policy-managing skill — rules.md override management"
```

---

### Task 4: Create reporting skill + setup update

**Goal:** Debt/gap dashboard + health signal calculation.

**Files:**
- Create: `plugin/skills/reporting/SKILL.md`
- Modify: `plugin/skills/setup/SKILL.md`

- [ ] **Step 1: Create the reporting skill**

Write `plugin/skills/reporting/SKILL.md` with:

- YAML frontmatter: `name: reporting`, description about dashboard and health signals
- User-invocable: true (`/geas:reporting`)
- 4 sections:

**Section 1: Debt Summary** — Read `.geas/state/debt-register.json`:
- Items count by severity (critical/high/medium/low)
- Items count by kind (code_quality/architecture/security/docs/ops/test_gap/product_gap)
- Items count by status (open/accepted/scheduled/resolved/dropped)
- Use `rollup_by_severity` and `rollup_by_kind` for quick counts

**Section 2: Gap Summary** — Read `.geas/state/gap-assessment.json`:
- Fully delivered count and list
- Partially delivered items with details
- Not delivered items with rationale
- Gap closure ratio: `fully_delivered / (fully + partially + not_delivered)`

**Section 3: Health Signals** — Calculate 8 signals from doc 12. For each signal, read the source data, compute the value, compare against threshold:

| Signal | Threshold | Source | Calculation |
|--------|-----------|--------|-------------|
| memory_bloat | entries > 100 with 0 reuses in last 10 tasks | memory-index.json | Count entries where reuse_count = 0 |
| review_gap | > 20% miss rate in last 5 tasks | events.jsonl | Count tasks without specialist review / total tasks |
| gate_quality_issue | > 30% iterate rate in last 10 tasks | events.jsonl | Count iterate verdicts / total verdicts |
| contradiction_accumulation | 2+ stable memories with contradiction >= 3 | memory-index.json | Count stable entries with contradiction_count >= 3 |
| repeated_failure_class | same failure 3+ times | events.jsonl | Group gate failures by blocking_dimensions |
| debt_stagnation | accepted >= 2x resolved per phase | debt-register.json | Count accepted / count resolved |
| scope_control_weakness | > 30% scope change after impl contract in last 5 tasks | events.jsonl | Heuristic from revalidation events |
| worker_low_confidence | > 25% confidence <= 2 in last 10 tasks | worker self-checks | Count low confidence / total |

For each triggered signal, include the mandatory response from doc 12.

**Section 4: Output** — Write `.geas/state/health-check.json`:
```json
{
  "timestamp": "<ISO 8601>",
  "signals": [
    { "name": "memory_bloat", "value": 15, "threshold": 100, "triggered": false },
    { "name": "debt_stagnation", "value": 2.5, "threshold": 2.0, "triggered": true, "mandatory_response": "process_lead creates debt resolution plan during phase review" }
  ]
}
```
Also print a markdown summary to conversation.

**When to run:** invokable anytime via `/geas:reporting`. Orchestrating skill calls at phase transitions, session start, evolution phase.

- [ ] **Step 2: Add health-check.json defensive creation to setup**

In `plugin/skills/setup/SKILL.md`, after the memory-index.json initialization, add:

```markdown
Write the initial health check `.geas/state/health-check.json`:
```json
{
  "timestamp": "<ISO 8601>",
  "signals": []
}
```
```

- [ ] **Step 3: Commit**

```bash
git add plugin/skills/reporting/SKILL.md plugin/skills/setup/SKILL.md
git commit -m "feat: create reporting skill — dashboard + health signals"
```

---

### Task 5: Memory review cadence hook + hooks.json

**Goal:** Detect expired memory review_after dates at session start.

**Files:**
- Create: `plugin/hooks/scripts/memory-review-cadence.sh`
- Modify: `plugin/hooks/hooks.json`

- [ ] **Step 1: Create hook script**

Write `plugin/hooks/scripts/memory-review-cadence.sh`:

```bash
#!/usr/bin/env bash
# memory-review-cadence.sh — detect memory entries past review_after date
# Trigger: SessionStart

set -euo pipefail

INDEX_FILE=".geas/state/memory-index.json"
if [[ ! -f "$INDEX_FILE" ]]; then
  exit 0
fi

python3 -c "
import json
from datetime import datetime, timezone

index = json.load(open('$INDEX_FILE'))
entries = index.get('entries', [])
now = datetime.now(timezone.utc)

expired = []
for e in entries:
    if e.get('state') in ('provisional', 'stable', 'canonical'):
        review_after = e.get('review_after', '')
        if review_after:
            try:
                ra = datetime.fromisoformat(review_after.replace('Z', '+00:00'))
                if ra < now:
                    expired.append(f'{e[\"memory_id\"]} ({e[\"state\"]}, due {review_after})')
            except (ValueError, TypeError):
                pass

if expired:
    print(f'Warning: MEMORY REVIEW DUE: {len(expired)} entries past review_after date:')
    for item in expired[:10]:
        print(f'  - {item}')
    if len(expired) > 10:
        print(f'  ... and {len(expired)-10} more')
    print('Run batch review via /geas:memorizing.')
" 2>/dev/null
```

- [ ] **Step 2: Make executable**

```bash
chmod +x plugin/hooks/scripts/memory-review-cadence.sh
```

- [ ] **Step 3: Register in hooks.json**

Read `plugin/hooks/hooks.json`. Find the `SessionStart` section (~line 105). Add `memory-review-cadence.sh` to the existing SessionStart hooks array:

```json
{
  "type": "command",
  "command": "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/memory-review-cadence.sh",
  "timeout": 10
}
```

- [ ] **Step 4: Commit**

```bash
git add plugin/hooks/scripts/memory-review-cadence.sh plugin/hooks/hooks.json
git commit -m "feat: add memory review cadence hook — review_after expiry detection"
```

---

### Task 6: CLAUDE.md — migration complete

**Goal:** Mark Phase 6 complete and entire migration as done.

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update completed phases — migration complete**

Find the "Completed phases" and "Current phase" sections. Replace:

```markdown
### Completed phases

- **Phase 1 (Minimum Enforceable State)**: 7-state task model, worker self-check, gate/verdict separation, closure packet, critical reviewer, debate→decision rename
- **Phase 2 (Baseline, Stale, Parallelism)**: revalidation-record/lock-manifest schemas, staleness detection, lock lifecycle, safe parallel conditions, compass→orchestrating + parallel-dispatch→scheduling renames
- **Phase 3 (Evolution Core)**: structured retrospective (after Resolve, Ship only), rules-update workflow, debt-register.json, gap-assessment.json, phase-review wiring, evolution exit gate, Sprint Wrap-Up
- **Phase 4 (Memory Core)**: memorizing skill (9-state lifecycle, 6-stage promotion), memory retrieval scoring in context-packet, application logging, memory-index, memory hooks
- **Phase 5 (Recovery and Context Engine)**: recovery-packet schema, extended run-state, recovery decision table, session-latest.md + task-focus maintenance, two-phase checkpoint hooks, enhanced restore-context.sh with L0 anti-forgetting
- **Phase 6 (Refinement)**: conformance-checking (18 scenarios), chaos-exercising (5 failure scenarios), policy-managing, reporting (health signals), memory review cadence hook

### Migration complete

All 6 phases of the v3 protocol migration are implemented. Skills are aligned with the protocol. See `docs/protocol/13_MIGRATION_AND_IMPLEMENTATION_ROADMAP.md` for the full roadmap.
```

- [ ] **Step 2: Update core skills list**

Add the new Phase 6 skills to the appropriate section in CLAUDE.md:

After the "### Orchestration + scheduling" and "### Team skills" sections, add:

```markdown
### Operational tooling
- `conformance-checking/` — 18-scenario enforcement verification suite
- `chaos-exercising/` — 5 failure scenario testing with inline scripts
- `policy-managing/` — rules.md override management
- `reporting/` — debt/gap dashboard + 8 health signals from doc 12
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: mark v3 protocol migration complete — all 6 phases done"
```

---

## Verification Checklist

After all 6 tasks complete:

- [ ] `plugin/skills/conformance-checking/SKILL.md` exists with 18 scenarios
- [ ] `plugin/skills/chaos-exercising/SKILL.md` exists with 5 scenarios (each has setup/trigger/verification)
- [ ] `plugin/skills/policy-managing/SKILL.md` exists with 4 capabilities
- [ ] `plugin/skills/reporting/SKILL.md` exists with debt/gap/health sections
- [ ] `plugin/hooks/scripts/memory-review-cadence.sh` exists and is executable
- [ ] hooks.json SessionStart has memory-review-cadence registered
- [ ] setup/SKILL.md initializes health-check.json
- [ ] CLAUDE.md shows "Migration complete" with all 6 phases listed
- [ ] CLAUDE.md has "Operational tooling" skill section
