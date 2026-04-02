#!/bin/bash
# verify-task-status.sh — PostToolUse hook (Write|Edit)
# When a task is marked "passed", verifies all mandatory evidence exists.

set -euo pipefail

INPUT=$(cat)

PARSED=$(echo "$INPUT" | python -c "
import json, sys
d = json.load(sys.stdin)
cwd = d.get('cwd', '')
ti = d.get('tool_input', {})
if isinstance(ti, str):
    try:
        ti = json.loads(ti)
    except:
        ti = {}
fp = ti.get('file_path', '') if isinstance(ti, dict) else ''
print(cwd)
print(fp)
" 2>/dev/null || echo "")

CWD=$(echo "$PARSED" | head -1)
FILE_PATH=$(echo "$PARSED" | tail -1)

if [ -z "$CWD" ] || [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only process .geas/tasks/*.json files
case "$FILE_PATH" in
  */.geas/tasks/*.json) ;;
  *) exit 0 ;;
esac

GEAS_DIR="$CWD/.geas"

if [ -f "$FILE_PATH" ]; then
  WARN=$(python -c "
import json, sys, os
fp = sys.argv[1]
geas = sys.argv[2]
d = json.load(open(fp))
if d.get('status') == 'passed':
    tid = d.get('task_id') or d.get('id', '')
    edir = os.path.join(geas, 'evidence', tid)
    if not os.path.isfile(os.path.join(edir, 'architecture-authority-review.json')):
        print(f'[Geas] Warning: {tid} marked as passed but architecture-authority-review.json is missing')
    if not os.path.isfile(os.path.join(edir, 'qa-engineer.json')):
        print(f'[Geas] Warning: {tid} marked as passed but qa-engineer.json is missing')
    tdir = os.path.join(geas, 'tasks', tid)
    if not os.path.isfile(os.path.join(tdir, 'challenge-review.json')):
        print(f'[Geas] Warning: {tid} marked as passed but tasks/{tid}/challenge-review.json is missing')
    if not os.path.isfile(os.path.join(edir, 'product-authority-verdict.json')):
        print(f'[Geas] Warning: {tid} marked as passed but product-authority-verdict.json is missing')
    retro_path = os.path.join(geas, 'tasks', tid, 'retrospective.json')
    if not os.path.isfile(retro_path):
        print(f'[Geas] Warning: {tid} marked as passed but tasks/{tid}/retrospective.json is missing (retrospective not run)')
    # Check rubric_scores in qa-engineer and architecture-authority-review evidence
    qa_engineer_path = os.path.join(edir, 'qa-engineer.json')
    if os.path.isfile(qa_engineer_path):
        try:
            qa_engineer = json.load(open(qa_engineer_path))
            if 'rubric_scores' not in qa_engineer or not qa_engineer.get('rubric_scores'):
                print(f'[Geas] Warning: {tid} qa-engineer.json is missing rubric_scores')
        except: pass
    arch_review_path = os.path.join(edir, 'architecture-authority-review.json')
    if os.path.isfile(arch_review_path):
        try:
            arch_review = json.load(open(arch_review_path))
            if 'rubric_scores' not in arch_review or not arch_review.get('rubric_scores'):
                print(f'[Geas] Warning: {tid} architecture-authority-review.json is missing rubric_scores')
        except: pass
" "$FILE_PATH" "$GEAS_DIR" 2>/dev/null || echo "")
  if [ -n "$WARN" ]; then
    echo "$WARN" >&2
  fi
fi

exit 0
