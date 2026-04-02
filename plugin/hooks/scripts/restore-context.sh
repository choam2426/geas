#!/bin/bash
# restore-context.sh — PostCompact hook
# Re-injects critical Geas state after context compaction.
# Prevents orchestrator from losing track of current phase/task.

set -euo pipefail

INPUT=$(cat)
CWD=$(echo "$INPUT" | python -c "import json,sys; d=json.load(sys.stdin); print(d.get('cwd',''))" 2>/dev/null || echo "")

if [ -z "$CWD" ]; then
  exit 0
fi

GEAS_DIR="$CWD/.geas"
RUN_FILE="$GEAS_DIR/state/run.json"

if [ ! -d "$GEAS_DIR" ] || [ ! -f "$RUN_FILE" ]; then
  exit 0
fi

python -c "
import json, sys, os

geas = sys.argv[1]
run_file = sys.argv[2]
d = json.load(open(run_file))

parts = []
parts.append('--- GEAS STATE (restored after context compaction) ---')

status = d.get('status', 'unknown')
phase = d.get('phase', 'unknown')
mode = d.get('mode', 'unknown')
mission = d.get('mission', '')
tid = d.get('current_task_id', '')
completed = d.get('completed_tasks', [])

parts.append(f'Mode: {mode} | Phase: {phase} | Status: {status}')
parts.append(f'Mission: {mission}')
parts.append(f'Current task: {tid}')
parts.append(f'Completed tasks: {len(completed)} ({\", \".join(completed[-5:])}{\"...\" if len(completed) > 5 else \"\"})')

# Checkpoint info
cp = d.get('checkpoint', {})
remaining = []
if cp:
    step = cp.get('pipeline_step', '')
    agent = cp.get('agent_in_flight', '')
    if step:
        parts.append(f'Pipeline step: {step}')
    if agent:
        parts.append(f'Agent in flight: {agent}')
    remaining = cp.get('remaining_steps', [])
    if remaining:
        parts.append(f'Remaining steps: {", ".join(remaining)}')
        parts.append(f'NEXT STEP: {remaining[0]}')

# Recovery info
recovery_class = d.get('recovery_class', None)
if recovery_class:
    parts.append(f'Recovery class: {recovery_class}')

# Current task contract summary
task_goal = ''
if tid:
    task_file = os.path.join(geas, 'tasks', f'{tid}.json')
    if os.path.isfile(task_file):
        task = json.load(open(task_file))
        task_goal = task.get('goal', '')
        parts.append(f'Task goal: {task_goal}')
        criteria = task.get('acceptance_criteria', [])
        if criteria:
            parts.append('Acceptance criteria:')
            for i, c in enumerate(criteria, 1):
                parts.append(f'  {i}. {c}')

# --- SESSION CONTEXT (from session-latest.md) ---
session_latest_path = d.get('session_latest_path', '.geas/state/session-latest.md')
# Resolve relative to project root (parent of .geas)
project_root = os.path.dirname(geas)
if not os.path.isabs(session_latest_path):
    session_latest_abs = os.path.join(project_root, session_latest_path)
else:
    session_latest_abs = session_latest_path
# Also try the default location directly under .geas
if not os.path.isfile(session_latest_abs):
    session_latest_abs = os.path.join(geas, 'state', 'session-latest.md')
if os.path.isfile(session_latest_abs):
    try:
        with open(session_latest_abs, 'r', encoding='utf-8') as f:
            session_content = f.read().strip()
        if session_content:
            parts.append('')
            parts.append('--- SESSION CONTEXT ---')
            parts.append(session_content)
    except Exception:
        pass

# --- Open risks from closure packet ---
open_risks_items = []
if tid:
    closure_dir = os.path.join(geas, 'closure')
    if os.path.isdir(closure_dir):
        # Look for closure packet matching current task
        for fname in os.listdir(closure_dir):
            if fname.endswith('.json'):
                try:
                    cp_file = os.path.join(closure_dir, fname)
                    cp_data = json.load(open(cp_file))
                    if cp_data.get('task_id') == tid or cp_data.get('artifact_id', '').startswith(tid):
                        risks = cp_data.get('open_risks', {})
                        open_risks_items = risks.get('items', [])
                        break
                except Exception:
                    pass

# Rules summary (first 30 lines)
rules_lines = []
rules_path = os.path.join(geas, 'rules.md')
if os.path.isfile(rules_path):
    with open(rules_path, 'r', encoding='utf-8') as f:
        rules_lines = f.readlines()[:30]
    parts.append('')
    parts.append('--- KEY RULES ---')
    parts.append(''.join(rules_lines).strip())

# --- MEMORY STATE SUMMARY ---
memory_index_path = os.path.join(geas, 'state', 'memory-index.json')
memory_counts = {}
memory_total = 0
if os.path.isfile(memory_index_path):
    try:
        mi = json.load(open(memory_index_path))
        entries = mi.get('entries', [])
        memory_total = len(entries)
        for entry in entries:
            state = entry.get('state', 'unknown')
            memory_counts[state] = memory_counts.get(state, 0) + 1
    except Exception:
        pass

if memory_total > 0:
    parts.append('')
    parts.append('--- MEMORY STATE ---')
    summary_parts = [f'{s}: {c}' for s, c in sorted(memory_counts.items())]
    parts.append(f'Total memories: {memory_total} ({", ".join(summary_parts)})')

# === L0 ANTI-FORGETTING (always-preserved items) ===
parts.append('')
parts.append('## L0 ANTI-FORGETTING')
parts.append('The following items MUST be retained across compaction:')

l0 = []
# 1. Mode and phase
l0.append(f'1. Mode/Phase: {mode}/{phase} (status: {status})')
# 2. Focus task state
l0.append(f'2. Focus task: {tid or \"(none)\"}' + (f' — {task_goal}' if task_goal else ''))
# 3. Rewind reason (recovery class)
if recovery_class:
    l0.append(f'3. Rewind reason: {recovery_class}')
else:
    l0.append('3. Rewind reason: (clean session, no recovery)')
# 4. Required next artifact
next_artifact = remaining[0] if remaining else '(pipeline complete or unknown)'
l0.append(f'4. Required next artifact: {next_artifact}')
# 5. Open risks
if open_risks_items:
    risk_strs = [r.get('description', r.get('risk', str(r))) if isinstance(r, dict) else str(r) for r in open_risks_items[:3]]
    l0.append(f'5. Open risks: {"; ".join(risk_strs)}')
else:
    l0.append('5. Open risks: (none found)')
# 6. Recovery outcome
if recovery_class:
    l0.append(f'6. Recovery outcome: {recovery_class}')
else:
    l0.append('6. Recovery outcome: (clean session)')
# 7. Active rules + memory count
rule_count = len([l for l in rules_lines if l.strip() and not l.strip().startswith('#')])
l0.append(f'7. Active rules: {rule_count} lines loaded from rules.md | Memories: {memory_total} entries')

for item in l0:
    parts.append(item)

context = chr(10).join(parts)
print(json.dumps({'additionalContext': context}))
" "$GEAS_DIR" "$RUN_FILE" 2>/dev/null || true
