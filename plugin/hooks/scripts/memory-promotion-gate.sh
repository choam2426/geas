#!/usr/bin/env bash
# memory-promotion-gate.sh — verify promotion conditions when memory entries are written
# Trigger: PostToolUse on Write matching .geas/memory/entries/*.json

set -euo pipefail

TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"

if [[ "$TOOL_INPUT" != *".geas/memory/entries/"* ]]; then
  exit 0
fi

ENTRY_FILE=$(echo "$TOOL_INPUT" | grep -oP '\.geas/memory/entries/[^"]+\.json' | head -1)
if [[ -z "$ENTRY_FILE" || ! -f "$ENTRY_FILE" ]]; then
  exit 0
fi

python3 -c "
import json

entry = json.load(open('$ENTRY_FILE'))
state = entry.get('state', '')
signals = entry.get('signals', {})
evidence = entry.get('evidence_refs', [])

warnings = []

if state == 'provisional' and len(evidence) < 2 and signals.get('evidence_count', 0) < 2:
    warnings.append('provisional promotion requires 2+ evidence_refs or similar incidents')

if state == 'stable':
    if signals.get('successful_reuses', 0) < 3:
        warnings.append(f'stable promotion requires 3+ successful_reuses (has {signals.get(\"successful_reuses\", 0)})')
    if signals.get('contradiction_count', 0) > 0:
        warnings.append(f'stable promotion requires 0 contradictions (has {signals.get(\"contradiction_count\", 0)})')

if state == 'canonical':
    if signals.get('successful_reuses', 0) < 5:
        warnings.append(f'canonical promotion requires 5+ successful_reuses (has {signals.get(\"successful_reuses\", 0)})')

for w in warnings:
    print(f'Warning: MEMORY PROMOTION: {w}')
" 2>/dev/null
