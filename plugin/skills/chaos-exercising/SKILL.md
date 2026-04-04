---
name: chaos-exercising
description: Failure scenario testing — 5 chaos scenarios with inline setup, trigger, and verification scripts to validate Geas recovery mechanisms.
user-invocable: true
---

# chaos-exercising

**Invocation:** `/geas:chaos-exercising`

> **WARNING: This skill intentionally corrupts `.geas/` state for testing. Only run in a test project or on a disposable branch.**

This skill exercises 5 failure scenarios to verify that Geas recovery mechanisms behave correctly. Each scenario has three sections:

- **Setup** — inline bash script that creates the corrupted state
- **Trigger** — instruction to start a session or invoke a specific skill
- **Verification** — inline bash/python script that checks the recovery result and prints PASS/FAIL

Run scenarios individually. Reset `.geas/` state between scenarios unless intentionally chaining them.

---

## Scenario 1: Mid-task Interruption Recovery

Simulates a session crash mid-implementation. The run.json shows an in-flight agent with pending evidence that does not exist.

### Setup

```bash
mkdir -p .geas/state .geas/missions/mission-chaos/tasks
cat > .geas/state/run.json << 'EOF'
{
  "version": "1.0",
  "status": "in_progress",
  "phase": null,
  "current_task_id": "task-chaos-001",
  "completed_tasks": [],
  "decisions": [],
  "checkpoint": {
    "pipeline_step": "implementation",
    "agent_in_flight": "architecture-authority",
    "pending_evidence": [".geas/missions/mission-chaos/evidence/task-chaos-001/architecture-authority.json"],
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

### Trigger

Start new session (orchestrating startup).

### Verification

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

---

## Scenario 2: Stale Worktree Recovery

Simulates a task with a base_commit that is 5+ commits behind HEAD. The stale-start-check hook should fire when the task is started.

### Setup

```bash
mkdir -p .geas/missions/mission-chaos/tasks
OLD_COMMIT=$(git log --skip=5 -1 --format=%H 2>/dev/null || git log -1 --format=%H)
cat > .geas/missions/mission-chaos/tasks/task-chaos-002.json << EOF
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

### Trigger

Attempt to start task-chaos-002 (baseline check should fire).

### Verification

```bash
python3 -c "
import os
exists = os.path.exists('.geas/missions/mission-chaos/tasks/task-chaos-002/revalidation-record.json')
# Alternatively check if stale-start-check hook warned
print('PASS: Stale detection triggered' if exists else 'PARTIAL: Check stale-start-check.sh output')
"
```

---

## Scenario 3: Lock Orphan Detection

Simulates a held lock from a dead session that no longer exists. The orchestrating skill should clean up orphan locks on startup.

### Setup

```bash
python3 -c "
import json
locks = {'version': '1.0', 'locks': [{'lock_type': 'path', 'task_id': 'task-orphan', 'session_id': 'dead-session-999', 'targets': ['src/'], 'status': 'held', 'acquired_at': '2026-01-01T00:00:00Z'}]}
json.dump(locks, open('.geas/state/locks.json', 'w'), indent=2)
"
```

### Trigger

Start session (orchestrating lock initialization).

### Verification

```bash
python3 -c "
import json
locks = json.load(open('.geas/state/locks.json'))
orphans = [l for l in locks['locks'] if l['session_id'] == 'dead-session-999']
assert len(orphans) == 0, f'FAIL: Orphan lock not cleaned: {orphans}'
print('PASS: Lock orphan detection')
"
```

---

## Scenario 4: Contradictory Memory Handling

Creates two stable memory entries with directly contradictory guidance on the same topic. Context packet generation should surface caution items rather than silently applying one over the other.

### Setup

```bash
mkdir -p .geas/memory/entries
python3 -c "
import json

entry_a = {
  'meta': {'version':'1.0','artifact_type':'memory_entry','artifact_id':'mem-conflict-a','producer_type':'orchestration_authority','created_at':'2026-04-02T00:00:00Z'},
  'memory_id':'mem-conflict-a','memory_type':'architecture_precedent','state':'stable',
  'title':'Always use approach X for caching',
  'summary':'Caching should always use approach X based on performance testing',
  'scope':'project','evidence_refs':['retro-001','retro-002','retro-003'],
  'signals':{'evidence_count':3,'reuse_count':4,'successful_reuses':3,'failed_reuses':1,'contradiction_count':1,'confidence':0.6},
  'review_after':'2026-07-01T00:00:00Z','supersedes':[],'superseded_by':None,'tags':['caching','architecture'],'body':['Use approach X']
}
entry_b = {
  'meta': {'version':'1.0','artifact_type':'memory_entry','artifact_id':'mem-conflict-b','producer_type':'orchestration_authority','created_at':'2026-04-02T00:00:00Z'},
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

### Trigger

Generate context packet for a task with scope.paths including caching-related paths.

### Verification

```bash
python3 -c "
import json, glob
packets = glob.glob('.geas/missions/*/packets/*/memory-packet.json')
if not packets:
    print('SKIP: No memory packet generated (trigger context-packet manually)')
else:
    p = json.load(open(packets[-1]))
    caution = p.get('caution_items', [])
    print(f'PASS: {len(caution)} caution items found' if caution else 'FAIL: Contradictory memory should produce caution items')
"
```

---

## Scenario 5: Missing Specialist Review Gate

Creates a task in "integrated" state where two reviewer types are required but only one review exists. The evidence gate should block rather than pass.

### Setup

```bash
mkdir -p .geas/missions/mission-chaos/tasks/task-chaos-005 .geas/missions/mission-chaos/evidence/task-chaos-005
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
json.dump(tc, open('.geas/missions/mission-chaos/tasks/task-chaos-005.json','w'), indent=2)
# Only architecture_authority review exists (qa_engineer missing)
json.dump({'reviewer':'architecture_authority','status':'approved','summary':'LGTM'}, open('.geas/missions/mission-chaos/evidence/task-chaos-005/architecture-authority-review.json','w'), indent=2)
# worker self-check exists
json.dump({'version':'1.0','artifact_type':'worker_self_check','artifact_id':'wsc-005','producer_type':'backend_engineer','task_id':'task-chaos-005','known_risks':[],'untested_paths':[],'possible_stubs':[],'what_to_test_next':[],'confidence':4,'summary':'Done','created_at':'2026-04-02T00:00:00Z'}, open('.geas/missions/mission-chaos/tasks/task-chaos-005/worker-self-check.json','w'), indent=2)
"
```

### Trigger

Run evidence gate on task-chaos-005.

### Verification

```bash
python3 -c "
import json, os
gf = '.geas/missions/mission-chaos/tasks/task-chaos-005/gate-result.json'
if os.path.exists(gf):
    g = json.load(open(gf))
    assert g['verdict'] == 'block', f'FAIL: Expected block, got {g[\"verdict\"]}'
    print('PASS: Gate blocked on missing specialist review')
else:
    print('SKIP: Gate not yet run (invoke evidence-gate on task-chaos-005)')
"
```
