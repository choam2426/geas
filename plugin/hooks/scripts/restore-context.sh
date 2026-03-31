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

# Current task contract summary
if tid:
    task_file = os.path.join(geas, 'tasks', f'{tid}.json')
    if os.path.isfile(task_file):
        task = json.load(open(task_file))
        parts.append(f'Task goal: {task.get(\"goal\", \"\")}')
        criteria = task.get('acceptance_criteria', [])
        if criteria:
            parts.append('Acceptance criteria:')
            for i, c in enumerate(criteria, 1):
                parts.append(f'  {i}. {c}')

# Rules summary (first 30 lines)
rules_path = os.path.join(geas, 'rules.md')
if os.path.isfile(rules_path):
    with open(rules_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()[:30]
    parts.append('--- KEY RULES ---')
    parts.append(''.join(lines).strip())

context = chr(10).join(parts)
print(json.dumps({'additionalContext': context}))
" "$GEAS_DIR" "$RUN_FILE" 2>/dev/null || true
