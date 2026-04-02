#!/bin/bash
# session-init.sh — SessionStart hook
# Checks .geas/ state on session start and injects context.

set -euo pipefail

INPUT=$(cat)
CWD=$(echo "$INPUT" | python -c "import json,sys; d=json.load(sys.stdin); print(d.get('cwd',''))" 2>/dev/null || echo "")

if [ -z "$CWD" ]; then
  exit 0
fi

GEAS_DIR="$CWD/.geas"
RUN_FILE="$GEAS_DIR/state/run.json"

# Not a Geas project — skip
if [ ! -d "$GEAS_DIR" ]; then
  exit 0
fi

# No run.json — prompt setup
if [ ! -f "$RUN_FILE" ]; then
  echo "[Geas] .geas/ directory exists but no run.json. Run setup first." >&2
  exit 0
fi

# Load previous session state
python -c "
import json, sys, os
d = json.load(open(sys.argv[1]))
status = d.get('status', 'unknown')
phase = d.get('phase', 'unknown')
mission = d.get('mission', 'unknown')
completed = len(d.get('completed_tasks', []))
print(f'[Geas] Session resumed. Mission: {mission} | Phase: {phase} | Status: {status} | Tasks completed: {completed}', file=sys.stderr)
cp = d.get('checkpoint', {})
if cp:
    step = cp.get('pipeline_step', '')
    agent = cp.get('agent_in_flight', '')
    tid_current = d.get('current_task_id', '')
    if step:
        print(f'[Geas] Checkpoint: task={tid_current}, step={step}, agent={agent}', file=sys.stderr)

# Create rules.md if missing
rules = os.path.join(sys.argv[2], 'rules.md')
if not os.path.isfile(rules):
    template = '''# Agent Rules

## Evidence
- Write results to .geas/evidence/{task-id}/{your-name}.json as JSON
- Required fields: agent, task_id, summary, files_changed, created_at
- created_at is auto-injected by the PostToolUse hook. No manual timestamp needed.

## Code
- Respect scope.paths from the TaskContract — only modify files within the declared scope
'''
    with open(rules, 'w', encoding='utf-8') as f:
        f.write(template)
    print('[Geas] Created .geas/rules.md with initial template.', file=sys.stderr)
" "$RUN_FILE" "$GEAS_DIR" 2>&1 >&2 || true

exit 0
