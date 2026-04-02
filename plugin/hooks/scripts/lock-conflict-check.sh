#!/bin/bash
# lock-conflict-check.sh — PostToolUse hook (Write on locks.json)
# Detects conflicting locks between tasks.
set -euo pipefail

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
node -e "
const path = require('path');
const h = require(path.join('$HOOK_DIR', 'lib', 'geas-hooks'));
const {cwd, filePath} = h.parseInput();
if (!cwd || !filePath) process.exit(0);
if (!filePath.replace(/\\\\/g,'/').endsWith('.geas/state/locks.json')) process.exit(0);

const locks = h.readJson(filePath);
if (!locks || !locks.locks) process.exit(0);

const held = locks.locks.filter(l => l.status === 'held');
const byType = {};
held.forEach(l => { (byType[l.lock_type] = byType[l.lock_type] || []).push(l); });

const conflicts = [];
Object.entries(byType).forEach(([type, group]) => {
  for (let i = 0; i < group.length; i++) {
    for (let j = i+1; j < group.length; j++) {
      if (group[i].task_id === group[j].task_id) continue;
      const overlap = (group[i].targets||[]).filter(t => (group[j].targets||[]).includes(t));
      if (overlap.length)
        conflicts.push(type + ': ' + group[i].task_id + ' vs ' + group[j].task_id + ' on [' + overlap.join(', ') + ']');
    }
  }
});

if (conflicts.length) {
  h.warn('Lock conflicts detected:');
  conflicts.forEach(c => process.stderr.write('  ' + c + '\\n'));
}
" <<< "$(cat)"
