#!/bin/bash
# inject-context.sh — SubagentStart hook
# Injects rules.md + policy overrides + per-agent memory into every sub-agent's context.
set -euo pipefail
_RAW_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_DIR="$(cygpath -m "$_RAW_DIR" 2>/dev/null || echo "$_RAW_DIR")"
node -e "
const fs = require('fs');
const path = require('path');
const h = require('$HOOK_DIR/lib/geas-hooks');
const {cwd, agentType} = h.parseInput();
if (!cwd) process.exit(0);

const geas = h.geasDir(cwd);
if (!fs.existsSync(geas)) process.exit(0);

const parts = [];

// Inject rules.md
const rulesPath = path.join(geas, 'rules.md');
if (h.exists(rulesPath)) {
  const content = fs.readFileSync(rulesPath, 'utf8').trim();
  if (content) {
    parts.push('--- PROJECT RULES (.geas/rules.md) ---');
    parts.push(content);
  }
}

// Inject active policy overrides
const ov = h.readJson(path.join(geas, 'state', 'policy-overrides.json'));
if (ov) {
  const active = (ov.overrides || []).filter(o => !o.expired);
  if (active.length) {
    parts.push('--- ACTIVE POLICY OVERRIDES (.geas/state/policy-overrides.json) ---');
    active.forEach(o => parts.push('- ' + (o.rule_id||'?') + ': ' + (o.action||'?') + ' (reason: ' + (o.reason||'?') + ', expires: ' + (o.expires_at||'?') + ')'));
  }
}

// Inject per-agent memory
if (agentType) {
  const memPath = path.join(geas, 'memory', 'agents', agentType + '.md');
  if (h.exists(memPath)) {
    const content = fs.readFileSync(memPath, 'utf8').trim();
    if (content) {
      parts.push('--- YOUR MEMORY (.geas/memory/agents/' + agentType + '.md) ---');
      parts.push(content);
    }
  }
}

if (parts.length) h.outputContext(parts.join('\n\n'));
" <<< "$(cat)"
