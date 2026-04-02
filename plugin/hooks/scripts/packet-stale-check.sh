#!/usr/bin/env bash
# packet-stale-check.sh — warn when context packets may be stale
# Trigger: PostToolUse on Write matching .geas/state/run.json

set -euo pipefail

TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"

if [[ "$TOOL_INPUT" != *".geas/state/run.json"* ]]; then
  exit 0
fi

RUN_FILE=".geas/state/run.json"
if [[ ! -f "$RUN_FILE" ]]; then
  exit 0
fi

python3 -c "
import json, os, glob

run = json.load(open('$RUN_FILE'))
task_id = run.get('current_task_id', '')
recovery = run.get('recovery_class')

if not task_id:
    exit()

packets = glob.glob(f'.geas/packets/{task_id}/*.md')
if not packets:
    exit()

if recovery:
    print(f'Warning: STALE PACKETS: Session recovered ({recovery}). Context packets for {task_id} may be stale. Regenerate before spawning agents.')
" 2>/dev/null
