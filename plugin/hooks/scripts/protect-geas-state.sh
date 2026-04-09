#!/bin/bash
# protect-geas-state.sh — PostToolUse hook (Write|Edit)
# Monitors .geas/ state file integrity. Injects real timestamps. Warns on scope violations.
set -euo pipefail
_RAW_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_DIR="$(cygpath -m "$_RAW_DIR" 2>/dev/null || echo "$_RAW_DIR")"
node -e "
const fs = require('fs');
const path = require('path');
const h = require('$HOOK_DIR/lib/geas-hooks');
const {cwd, filePath} = h.parseInput();
if (!cwd || !filePath) process.exit(0);

const geas = h.geasDir(cwd);
const rel = h.relPath(filePath, cwd);

// Scope check — only for non-.geas files
if (!rel.startsWith('.geas/') && !rel.startsWith('.geas\\\\')) {
  const run = h.readJson(path.join(geas, 'state', 'run.json'));
  if (run && run.current_task_id) {
    const mid = run.mission_id || '';
    const mdir = mid ? path.join(geas, 'missions', mid) : geas;
    const task = h.readJson(path.join(mdir, 'tasks', run.current_task_id, 'contract.json'));
    if (task) {
      const scopePaths = (task.scope && task.scope.paths) || [];
      if (scopePaths.length && !h.matchScope(rel, scopePaths))
        h.warn('Write to ' + rel + ' outside scope.paths in ' + run.current_task_id);
    }
  }
}

// .geas/ JSON timestamp injection
if (/\/.geas\/.*\.json$/.test(filePath.replace(/\\\\/g,'/')) && h.exists(filePath)) {
  const d = h.readJson(filePath);
  if (d) {
    const ts = d.created_at || '';
    if (!ts || /:00:00Z$/.test(ts) || /:00:00\\.000Z$/.test(ts)) {
      d.created_at = new Date().toISOString().replace(/\\.\\d{3}Z$/, 'Z');
      h.writeJson(filePath, d);
    }
  }
}

// Mission spec frozen warning
if (/\/.geas\/missions\/[^/]+\/spec\.json$/.test(filePath.replace(/\\\\/g,'/')))
  h.warn('Mission spec was modified. Mission specs should be frozen after intake. Use a vote round for scope changes.');
" <<< "$(cat)"
