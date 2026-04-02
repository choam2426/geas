#!/bin/bash
# check-debt.sh — PostToolUse hook (Write|Edit)
# When debt-register.json is updated, checks HIGH threshold and warns.

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

# Only process .geas/state/debt-register.json
case "$FILE_PATH" in
  */.geas/state/debt-register.json) ;;
  *) exit 0 ;;
esac

python -c "
import json, sys
fp = sys.argv[1]
d = json.load(open(fp))
items = d.get('items', [])
high_open = [i for i in items if i.get('severity') == 'HIGH' and i.get('status') == 'open']
if len(high_open) >= 3:
    print(f'[Geas] {len(high_open)} HIGH tech debts open. Consider addressing before new features.', file=sys.stderr)
" "$FILE_PATH" 2>&1 >&2 || true

exit 0
