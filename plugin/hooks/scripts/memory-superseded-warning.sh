#!/usr/bin/env bash
# memory-superseded-warning.sh — warn if stale memory is in a context packet
# Trigger: PostToolUse on Write matching .geas/packets/*.md

set -euo pipefail

TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"

if [[ "$TOOL_INPUT" != *".geas/packets/"* ]]; then
  exit 0
fi

INDEX_FILE=".geas/state/memory-index.json"
if [[ ! -f "$INDEX_FILE" ]]; then
  exit 0
fi

PACKET_FILE=$(echo "$TOOL_INPUT" | grep -oP '\.geas/packets/[^"]+\.md' | head -1)
if [[ -z "$PACKET_FILE" || ! -f "$PACKET_FILE" ]]; then
  exit 0
fi

python3 -c "
import json, re

index = json.load(open('$INDEX_FILE'))
entries = {e['memory_id']: e['state'] for e in index.get('entries', [])}

with open('$PACKET_FILE') as f:
    content = f.read()

memory_ids = re.findall(r'\[mem-[^\]]+\]', content)
memory_ids = [m.strip('[]') for m in memory_ids]

for mid in memory_ids:
    state = entries.get(mid)
    if state in ('superseded', 'under_review', 'decayed', 'archived', 'rejected'):
        print(f'Warning: STALE MEMORY: {mid} has state \"{state}\" — should not be in active packet')
" 2>/dev/null
