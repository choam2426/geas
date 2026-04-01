#!/usr/bin/env bash
# stale-start-check.sh — warn if a task enters implementing with stale base_commit
# Trigger: PostToolUse on Write|Edit matching .geas/tasks/*.json

set -euo pipefail

TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"

# Only check task files
if [[ "$TOOL_INPUT" != *".geas/tasks/"* ]]; then
  exit 0
fi

# Extract task file path
TASK_FILE=$(echo "$TOOL_INPUT" | grep -oP '\.geas/tasks/[^"]+\.json' | head -1)
if [[ -z "$TASK_FILE" || ! -f "$TASK_FILE" ]]; then
  exit 0
fi

# Check if status is being set to implementing
STATUS=$(python3 -c "import json; d=json.load(open('$TASK_FILE')); print(d.get('status',''))" 2>/dev/null || echo "")
if [[ "$STATUS" != "implementing" ]]; then
  exit 0
fi

# Compare base_commit with current HEAD
BASE_COMMIT=$(python3 -c "import json; d=json.load(open('$TASK_FILE')); print(d.get('base_commit',''))" 2>/dev/null || echo "")
if [[ -z "$BASE_COMMIT" ]]; then
  exit 0
fi

CURRENT_TIP=$(git rev-parse HEAD 2>/dev/null || echo "")
if [[ -n "$CURRENT_TIP" && "$BASE_COMMIT" != "$CURRENT_TIP" ]]; then
  echo "⚠️  STALE BASE_COMMIT: Task base_commit ($BASE_COMMIT) differs from integration tip ($CURRENT_TIP). Run revalidation before proceeding."
fi
