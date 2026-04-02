#!/usr/bin/env bash
# checkpoint-pre-write.sh — backup run.json before write (two-phase checkpoint)
# Trigger: PreToolUse on Write matching .geas/state/run.json

set -euo pipefail

TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"

if [[ "$TOOL_INPUT" != *".geas/state/run.json"* ]]; then
  exit 0
fi

RUN_FILE=".geas/state/run.json"
PENDING_FILE=".geas/state/_checkpoint_pending"

if [[ -f "$RUN_FILE" ]]; then
  cp "$RUN_FILE" "$PENDING_FILE"
fi
