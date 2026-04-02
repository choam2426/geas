#!/bin/bash
# packet-stale-check.sh — PostToolUse hook (Write on run.json)
# Warns when context packets may be stale after recovery.
set -euo pipefail

_RAW_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_DIR="$(cygpath -m "$_RAW_DIR" 2>/dev/null || echo "$_RAW_DIR")"
node -e "
const fs = require('fs');
const path = require('path');
const h = require(path.join('$HOOK_DIR', 'lib', 'geas-hooks'));
const {cwd, filePath} = h.parseInput();
if (!cwd || !filePath) process.exit(0);
if (!filePath.replace(/\\\\/g,'/').endsWith('.geas/state/run.json')) process.exit(0);

const d = h.readJson(filePath);
if (!d || !d.current_task_id || !d.recovery_class) process.exit(0);

const packetsDir = path.join(h.geasDir(cwd), 'packets', d.current_task_id);
try {
  const files = fs.readdirSync(packetsDir).filter(f => f.endsWith('.md'));
  if (files.length)
    h.warn('Recovery detected (' + d.recovery_class + '). Context packets in packets/' + d.current_task_id + '/ may be stale. Consider regenerating.');
} catch {}
" <<< "$(cat)"
