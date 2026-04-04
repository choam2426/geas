#!/bin/bash
# memory-superseded-warning.sh — PostToolUse hook (Write on packets)
# Warns if a context packet references stale memory.
set -euo pipefail

_RAW_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_DIR="$(cygpath -m "$_RAW_DIR" 2>/dev/null || echo "$_RAW_DIR")"
node -e "
const fs = require('fs');
const path = require('path');
const h = require(path.join('$HOOK_DIR', 'lib', 'geas-hooks'));
const {cwd, filePath} = h.parseInput();
if (!cwd || !filePath) process.exit(0);
if (!filePath.replace(/\\\\/g,'/').includes('/.geas/missions/')) process.exit(0);

const mi = h.readJson(path.join(h.geasDir(cwd), 'state', 'memory-index.json'));
if (!mi || !mi.entries) process.exit(0);

const stateMap = {};
mi.entries.forEach(e => { stateMap[e.memory_id] = e.state; });

const content = fs.readFileSync(filePath, 'utf8');
const ids = (content.match(/\\[mem-[^\\]]+\\]/g) || []).map(m => m.slice(1, -1));
const stale = ['superseded', 'under_review', 'decayed', 'archived', 'rejected'];

ids.forEach(id => {
  if (stale.includes(stateMap[id]))
    h.warn('Packet references ' + id + ' which is ' + stateMap[id] + '. Consider regenerating.');
});
" <<< "$(cat)"
