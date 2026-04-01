#!/usr/bin/env bash
# lock-conflict-check.sh — detect conflicting locks in locks.json
# Trigger: PostToolUse on Write matching .geas/state/locks.json

set -euo pipefail

LOCKS_FILE=".geas/state/locks.json"
if [[ ! -f "$LOCKS_FILE" ]]; then
  exit 0
fi

# Check for conflicting targets between held locks of different tasks
CONFLICTS=$(python3 -c "
import json
from collections import defaultdict

data = json.load(open('$LOCKS_FILE'))
locks = data.get('locks', [])

by_type = defaultdict(list)
for lock in locks:
    if lock.get('status') == 'held':
        by_type[lock['lock_type']].append(lock)

conflicts = []
for lock_type, entries in by_type.items():
    for i, a in enumerate(entries):
        for b in entries[i+1:]:
            if a['task_id'] != b['task_id']:
                overlap = set(a['targets']) & set(b['targets'])
                if overlap:
                    conflicts.append(f'{lock_type}: {a[\"task_id\"]} vs {b[\"task_id\"]} on {list(overlap)}')

for c in conflicts:
    print(c)
" 2>/dev/null)

if [[ -n "$CONFLICTS" ]]; then
  echo "🚨 LOCK CONFLICT DETECTED:"
  echo "$CONFLICTS"
fi
