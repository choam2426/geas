#!/bin/bash
# memory-promotion-gate.sh — PostToolUse hook (Write on memory entries)
# Verifies promotion conditions for memory entries.
set -euo pipefail

_RAW_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_DIR="$(cygpath -m "$_RAW_DIR" 2>/dev/null || echo "$_RAW_DIR")"
node -e "
const path = require('path');
const h = require(path.join('$HOOK_DIR', 'lib', 'geas-hooks'));
const {cwd, filePath} = h.parseInput();
if (!cwd || !filePath) process.exit(0);
if (!filePath.replace(/\\\\/g,'/').includes('/.geas/memory/entries/')) process.exit(0);

const d = h.readJson(filePath);
if (!d || !d.state) process.exit(0);

const warnings = [];
const refs = (d.evidence_refs || []).length;
const reuses = d.successful_reuses || 0;
const contradictions = d.contradiction_count || 0;

if (d.state === 'provisional' && refs < 2 && (d.evidence_count || 0) < 2)
  warnings.push('provisional requires evidence_refs >= 2 or evidence_count >= 2 (has ' + refs + ')');
if (d.state === 'stable' && (reuses < 3 || contradictions > 0))
  warnings.push('stable requires successful_reuses >= 3 AND contradiction_count == 0 (has reuses=' + reuses + ', contradictions=' + contradictions + ')');
if (d.state === 'canonical' && reuses < 5)
  warnings.push('canonical requires successful_reuses >= 5 (has ' + reuses + ')');

warnings.forEach(w => h.warn('Memory ' + (d.memory_id||'?') + ': ' + w));
" <<< "$(cat)"
