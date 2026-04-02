#!/bin/bash
# integration-lane-check.sh — PostToolUse hook (Bash)
# Warns if git merge/rebase runs without integration lock held.
set -euo pipefail
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
node -e "
const path = require('path');
const h = require('$HOOK_DIR/lib/geas-hooks');
const {cwd, command} = h.parseInput();
if (!cwd || !command) process.exit(0);
if (!/git\s+(merge|rebase)/.test(command)) process.exit(0);

const locks = h.readJson(path.join(h.geasDir(cwd), 'state', 'locks.json'));
if (!locks) process.exit(0);

const held = (locks.locks || []).filter(l => l.lock_type === 'integration' && l.status === 'held');
if (!held.length)
  h.warn('git merge/rebase detected but no integration lock is held. Acquire lock first.');
" <<< "$(cat)"
