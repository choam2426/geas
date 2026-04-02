#!/bin/bash
# protect-geas-state.sh — PostToolUse hook (Write|Edit)
# Monitors .geas/ state file integrity.
# Injects real timestamps into .geas/**/*.json files.
# Warns on prohibited path violations.

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

GEAS_DIR="$CWD/.geas"

# Prohibited path check — warn if file matches a prohibited pattern
python -c "
import json, sys, os, fnmatch

cwd = sys.argv[1]
fp = sys.argv[2]
geas = os.path.join(cwd, '.geas')
run_file = os.path.join(geas, 'state', 'run.json')

if not os.path.isfile(run_file):
    sys.exit(0)

run = json.load(open(run_file))
tid = run.get('current_task_id', '')
if not tid:
    sys.exit(0)

task_file = os.path.join(geas, 'tasks', f'{tid}.json')
if not os.path.isfile(task_file):
    sys.exit(0)

task = json.load(open(task_file))
rel = os.path.relpath(fp, cwd).replace(chr(92), '/')

if rel.startswith('.geas/'):
    sys.exit(0)

scope_paths = task.get('scope', {}).get('paths', [])
if scope_paths and not any(fnmatch.fnmatch(rel, p) for p in scope_paths):
    print(f'[Geas] WARNING: Write to {rel} outside scope.paths in {tid}', file=sys.stderr)
" "$CWD" "$FILE_PATH" 2>&1 >&2 || true

# .geas/ file checks
case "$FILE_PATH" in
  */.geas/*.json)
    # Inject real timestamp if created_at is missing or dummy
    if [ -f "$FILE_PATH" ]; then
      python -c "
import json, sys, re
from datetime import datetime, timezone

fp = sys.argv[1]
with open(fp, 'r', encoding='utf-8') as f:
    d = json.load(f)

ts = d.get('created_at', '')
needs_fix = False

if not ts:
    needs_fix = True
elif re.search(r':00:00Z$', ts) or re.search(r':00:00\.000Z$', ts):
    needs_fix = True

if needs_fix:
    d['created_at'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    with open(fp, 'w', encoding='utf-8') as f:
        json.dump(d, f, indent=2, ensure_ascii=False)
        f.write('\n')
" "$FILE_PATH" 2>/dev/null || true
    fi
    ;;&
  */.geas/spec/seed.json)
    # seed.json is frozen after intake — warn on any modification
    echo "[Geas] Warning: seed.json was modified. Seed should be frozen after intake. Use /geas:pivot-protocol for scope changes." >&2
    ;;
esac

exit 0
