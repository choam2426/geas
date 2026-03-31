#!/bin/bash
# calculate-cost.sh — Stop hook
# Calculates actual token usage and estimated cost by parsing subagent session JSONLs.
# Runs once at session end. Writes summary to .geas/ledger/cost-summary.json.

set -euo pipefail

INPUT=$(cat)
CWD=$(echo "$INPUT" | python -c "import json,sys; d=json.load(sys.stdin); print(d.get('cwd',''))" 2>/dev/null || echo "")

if [ -z "$CWD" ]; then
  exit 0
fi

GEAS_DIR="$CWD/.geas"

if [ ! -d "$GEAS_DIR" ]; then
  exit 0
fi

python -c "
import json, sys, os, glob

cwd = sys.argv[1]
geas = sys.argv[2]
home = os.path.expanduser('~')

# Find Claude project directory
# cwd path conversion: A:\geas-test3 -> A--geas-test3
cwd_normalized = cwd.replace('\\\\', '-').replace('/', '-').replace(':', '-')
project_hash = cwd_normalized.lstrip('-')
projects_base = os.path.join(home, '.claude', 'projects')

# Try to find the project directory
project_dir = None
if os.path.isdir(projects_base):
    for d in os.listdir(projects_base):
        if d == project_hash or project_hash in d:
            project_dir = os.path.join(projects_base, d)
            break

if not project_dir:
    sys.exit(0)

# Find the most recent session with subagents
session_dir = None
latest_mtime = 0
for item in os.listdir(project_dir):
    sub_path = os.path.join(project_dir, item, 'subagents')
    if os.path.isdir(sub_path):
        mtime = os.path.getmtime(sub_path)
        if mtime > latest_mtime:
            latest_mtime = mtime
            session_dir = sub_path

if not session_dir:
    sys.exit(0)

# Parse all subagent JSONLs
total = {'input_tokens': 0, 'output_tokens': 0, 'cache_creation_input_tokens': 0, 'cache_read_input_tokens': 0}
agent_totals = {}
agent_count = 0

for jf in glob.glob(os.path.join(session_dir, '*.jsonl')):
    meta_file = jf.replace('.jsonl', '.meta.json')
    agent_type = 'unknown'
    if os.path.isfile(meta_file):
        try:
            agent_type = json.load(open(meta_file)).get('agentType', 'unknown')
        except:
            pass

    name = agent_type.split(':')[-1] if ':' in agent_type else agent_type
    subtotal = {'input': 0, 'output': 0, 'cache_create': 0, 'cache_read': 0}

    try:
        with open(jf) as f:
            for line in f:
                try:
                    d = json.loads(line)
                    if d.get('type') == 'assistant':
                        u = d.get('message', {}).get('usage', {})
                        subtotal['input'] += u.get('input_tokens', 0)
                        subtotal['output'] += u.get('output_tokens', 0)
                        subtotal['cache_create'] += u.get('cache_creation_input_tokens', 0)
                        subtotal['cache_read'] += u.get('cache_read_input_tokens', 0)
                except:
                    pass
    except:
        continue

    total['input_tokens'] += subtotal['input']
    total['output_tokens'] += subtotal['output']
    total['cache_creation_input_tokens'] += subtotal['cache_create']
    total['cache_read_input_tokens'] += subtotal['cache_read']

    agent_totals.setdefault(name, {'input': 0, 'output': 0, 'spawns': 0})
    agent_totals[name]['input'] += subtotal['input']
    agent_totals[name]['output'] += subtotal['output']
    agent_totals[name]['spawns'] += 1
    agent_count += 1

# Calculate estimated cost (Opus pricing as upper bound)
input_cost = total['input_tokens'] * 15 / 1_000_000
output_cost = total['output_tokens'] * 75 / 1_000_000
cache_create_cost = total['cache_creation_input_tokens'] * 3.75 / 1_000_000
cache_read_cost = total['cache_read_input_tokens'] * 1.50 / 1_000_000
total_cost = input_cost + output_cost + cache_create_cost + cache_read_cost

from datetime import datetime, timezone

summary = {
    'session_cost_usd': round(total_cost, 2),
    'tokens': {
        'input': total['input_tokens'],
        'output': total['output_tokens'],
        'cache_creation': total['cache_creation_input_tokens'],
        'cache_read': total['cache_read_input_tokens']
    },
    'cost_breakdown_usd': {
        'input': round(input_cost, 2),
        'output': round(output_cost, 2),
        'cache_creation': round(cache_create_cost, 2),
        'cache_read': round(cache_read_cost, 2)
    },
    'agent_count': agent_count,
    'agents': {k: v for k, v in sorted(agent_totals.items(), key=lambda x: -x[1]['output'])},
    'calculated_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
}

# Write summary
summary_file = os.path.join(geas, 'ledger', 'cost-summary.json')
os.makedirs(os.path.dirname(summary_file), exist_ok=True)
with open(summary_file, 'w', encoding='utf-8') as f:
    json.dump(summary, f, indent=2, ensure_ascii=False)
    f.write(chr(10))

print(f'[Geas] Session cost: \${total_cost:.2f} ({agent_count} agents, {total[\"output_tokens\"]:,} output tokens)', file=sys.stderr)
" "$CWD" "$GEAS_DIR" 2>&1 >&2 || true

exit 0
