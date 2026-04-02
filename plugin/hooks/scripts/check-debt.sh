#!/bin/bash
# check-debt.sh — PostToolUse hook (Write|Edit)
# Warns when 3+ HIGH severity debt items are open.
set -euo pipefail
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
node -e "
const path = require('path');
const h = require('$HOOK_DIR/lib/geas-hooks');
const {cwd, filePath} = h.parseInput();
if (!cwd || !filePath) process.exit(0);
if (!filePath.replace(/\\\\/g,'/').endsWith('.geas/evolution/debt-register.json')) process.exit(0);

const d = h.readJson(filePath);
if (!d || !d.items) process.exit(0);

const highOpen = d.items.filter(i => i.severity === 'high' && i.status === 'open');
if (highOpen.length >= 3)
  h.warn('Debt register has ' + highOpen.length + ' open HIGH severity items. Consider addressing before proceeding.');
" <<< "$(cat)"
