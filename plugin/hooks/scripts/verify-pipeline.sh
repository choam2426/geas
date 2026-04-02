#!/bin/bash
# verify-pipeline.sh — Stop hook
# Checks pipeline completeness before session end.
# Blocks session exit (exit 2) if MANDATORY evidence is missing.

set -euo pipefail

INPUT=$(cat)
CWD=$(echo "$INPUT" | python -c "import json,sys; d=json.load(sys.stdin); print(d.get('cwd',''))" 2>/dev/null || echo "")

if [ -z "$CWD" ]; then
  exit 0
fi

GEAS_DIR="$CWD/.geas"
RUN_FILE="$GEAS_DIR/state/run.json"

# Not a Geas project — skip
if [ ! -d "$GEAS_DIR" ] || [ ! -f "$RUN_FILE" ]; then
  exit 0
fi

STATUS=$(python -c "import json,sys; d=json.load(open(sys.argv[1])); print(d.get('status',''))" "$RUN_FILE" 2>/dev/null || echo "")
PHASE=$(python -c "import json,sys; d=json.load(open(sys.argv[1])); print(d.get('phase',''))" "$RUN_FILE" 2>/dev/null || echo "")

# Skip if no tasks have been completed yet
TASK_COUNT=$(python -c "import json,sys; d=json.load(open(sys.argv[1])); print(len(d.get('completed_tasks',[])))" "$RUN_FILE" 2>/dev/null || echo "0")
if [ "$TASK_COUNT" = "0" ]; then
  exit 0
fi

# Check completed tasks for missing evidence
MISSING=$(python -c "
import json, sys, os
d = json.load(open(sys.argv[1]))
geas = sys.argv[2]
missing = []
for tid in d.get('completed_tasks', []):
    edir = os.path.join(geas, 'evidence', tid)
    if not os.path.isfile(os.path.join(edir, 'architecture-authority-review.json')):
        missing.append(f'  - {tid}: architecture-authority-review.json (Code Review) missing')
    if not os.path.isfile(os.path.join(edir, 'qa-engineer.json')):
        missing.append(f'  - {tid}: qa-engineer.json (QA Testing) missing')
    tdir = os.path.join(geas, 'tasks', tid)
    if not os.path.isfile(os.path.join(tdir, 'challenge-review.json')):
        missing.append(f'  - {tid}: tasks/{tid}/challenge-review.json (Critical Reviewer) missing')
    if not os.path.isfile(os.path.join(edir, 'product-authority-verdict.json')):
        missing.append(f'  - {tid}: product-authority-verdict.json (Product Authority verdict) missing')
    retro_path = os.path.join(geas, 'tasks', tid, 'retrospective.json')
    if not os.path.isfile(retro_path):
        missing.append(f'  - {tid}: tasks/{tid}/retrospective.json (Retrospective) missing')
print('\n'.join(missing))
" "$RUN_FILE" "$GEAS_DIR" 2>/dev/null || echo "")

if [ -n "$MISSING" ]; then
  echo "[Geas] Pipeline incomplete. MANDATORY evidence missing:" >&2
  echo "$MISSING" >&2
  echo "" >&2
  echo "Execute the missing steps before completing the session." >&2
  exit 2  # Block session exit
fi

exit 0
