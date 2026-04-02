#!/usr/bin/env bash
# memory-review-cadence.sh — detect memory entries past review_after date
# Trigger: SessionStart

set -euo pipefail

INDEX_FILE=".geas/state/memory-index.json"
if [[ ! -f "$INDEX_FILE" ]]; then
  exit 0
fi

python3 -c "
import json
from datetime import datetime, timezone

index = json.load(open('$INDEX_FILE'))
entries = index.get('entries', [])
now = datetime.now(timezone.utc)

expired = []
for e in entries:
    if e.get('state') in ('provisional', 'stable', 'canonical'):
        review_after = e.get('review_after', '')
        if review_after:
            try:
                ra = datetime.fromisoformat(review_after.replace('Z', '+00:00'))
                if ra < now:
                    expired.append(f'{e[\"memory_id\"]} ({e[\"state\"]}, due {review_after})')
            except (ValueError, TypeError):
                pass

if expired:
    print(f'Warning: MEMORY REVIEW DUE: {len(expired)} entries past review_after date:')
    for item in expired[:10]:
        print(f'  - {item}')
    if len(expired) > 10:
        print(f'  ... and {len(expired)-10} more')
    print('Run batch review via /geas:memorizing.')
" 2>/dev/null
