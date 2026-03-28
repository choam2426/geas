#!/bin/bash
# track-cost.sh — SubagentStop hook
# Logs agent spawn data for cost analysis.
# Token counts are not in hook input — logs agent/task/model for JSONL correlation.

set -euo pipefail

INPUT=$(cat)

python -c "
import json, sys, os
from datetime import datetime, timezone

d = json.load(sys.stdin)
cwd = d.get('cwd', '')
agent_type = d.get('agent_type', 'unknown')

if not cwd:
    sys.exit(0)

geas = os.path.join(cwd, '.geas')
run_file = os.path.join(geas, 'state', 'run.json')
costs_file = os.path.join(geas, 'ledger', 'costs.jsonl')

if not os.path.isfile(run_file):
    sys.exit(0)

run = json.load(open(run_file))
tid = run.get('current_task_id', '')
phase = run.get('phase', '')

# Determine model from agent definition (hardcoded mapping)
opus_agents = {'nova', 'forge', 'circuit', 'pixel', 'critic'}
model = 'opus' if agent_type in opus_agents else 'sonnet'

entry = {
    'event': 'agent_complete',
    'agent': agent_type,
    'task_id': tid,
    'phase': phase,
    'model': model,
    'timestamp': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
}

os.makedirs(os.path.dirname(costs_file), exist_ok=True)
with open(costs_file, 'a', encoding='utf-8') as f:
    f.write(json.dumps(entry, ensure_ascii=False) + chr(10))
" <<< "$INPUT" 2>/dev/null || true
