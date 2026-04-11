#!/usr/bin/env bash
# checkpoint-post-write.sh — cleanup pending checkpoint after successful write
# Trigger: PostToolUse on Write matching .geas/state/run.json

set -euo pipefail

TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"

if [[ "$TOOL_INPUT" != *".geas/state/run.json"* ]]; then
  exit 0
fi

PENDING_FILE=".geas/state/_checkpoint_pending"

if [[ -f "$PENDING_FILE" ]]; then
  rm "$PENDING_FILE"
fi
