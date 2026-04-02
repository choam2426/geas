#!/bin/bash
# stale-start-check.sh — PostToolUse hook (Write|Edit)
# Warns if task enters implementing with stale base_commit.
set -euo pipefail
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
node -e "
const path = require('path');
const {execSync} = require('child_process');
const h = require('$HOOK_DIR/lib/geas-hooks');
const {cwd, filePath} = h.parseInput();
if (!cwd || !filePath) process.exit(0);
if (!/\/.geas\/tasks\/[^/]+\.json$/.test(filePath.replace(/\\\\/g,'/'))) process.exit(0);

const d = h.readJson(filePath);
if (!d || d.status !== 'implementing' || !d.base_commit) process.exit(0);

try {
  const head = execSync('git rev-parse HEAD', {cwd, encoding: 'utf8'}).trim();
  if (head !== d.base_commit)
    h.warn('Task ' + (d.task_id||'') + ' entering implementing with stale base_commit. base=' + d.base_commit.slice(0,8) + ' HEAD=' + head.slice(0,8));
} catch {}
" <<< "$(cat)"
