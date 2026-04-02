#!/bin/bash
# inject-context.sh — SubagentStart hook
# Injects rules.md + per-agent memory into every sub-agent's context.
# Output: JSON with additionalContext field on stdout.

set -euo pipefail

INPUT=$(cat)

python -c "
import json, sys, os

d = json.load(sys.stdin)
cwd = d.get('cwd', '')
agent_type = d.get('agent_type', '').lower()
# Strip plugin prefix (e.g., "geas:product-authority" -> "product-authority")
if ':' in agent_type:
    agent_type = agent_type.split(':')[-1]

if not cwd:
    sys.exit(0)

geas_dir = os.path.join(cwd, '.geas')
if not os.path.isdir(geas_dir):
    sys.exit(0)

parts = []

# Inject rules.md
rules_path = os.path.join(geas_dir, 'rules.md')
if os.path.isfile(rules_path):
    with open(rules_path, 'r', encoding='utf-8') as f:
        content = f.read().strip()
    if content:
        parts.append('--- PROJECT RULES (.geas/rules.md) ---')
        parts.append(content)

# Inject per-agent memory
if agent_type:
    memory_path = os.path.join(geas_dir, 'memory', 'agents', f'{agent_type}.md')
    if os.path.isfile(memory_path):
        with open(memory_path, 'r', encoding='utf-8') as f:
            content = f.read().strip()
        if content:
            parts.append(f'--- YOUR MEMORY (.geas/memory/agents/{agent_type}.md) ---')
            parts.append(content)

if parts:
    context = '\n\n'.join(parts)
    print(json.dumps({'additionalContext': context}))
" <<< "$INPUT" 2>/dev/null || true
