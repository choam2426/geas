#!/usr/bin/env bash
# integration-lane-check.sh — warn if git merge runs without integration lock
# Trigger: PostToolUse on Bash matching git merge/rebase

set -euo pipefail

TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"

# Only check git merge/rebase commands
if [[ "$TOOL_INPUT" != *"git merge"* && "$TOOL_INPUT" != *"git rebase"* ]]; then
  exit 0
fi

LOCKS_FILE=".geas/state/locks.json"
if [[ ! -f "$LOCKS_FILE" ]]; then
  echo "⚠️  INTEGRATION LANE: No locks.json found. Ensure integration_lock is acquired before merging."
  exit 0
fi

HAS_LOCK=$(python3 -c "
import json
data = json.load(open('$LOCKS_FILE'))
locks = data.get('locks', [])
held = [l for l in locks if l.get('lock_type') == 'integration' and l.get('status') == 'held']
print('yes' if held else 'no')
" 2>/dev/null || echo "no")

if [[ "$HAS_LOCK" != "yes" ]]; then
  echo "⚠️  INTEGRATION LANE: No integration_lock held. Acquire integration_lock before merging to ensure single-flight integration."
fi
