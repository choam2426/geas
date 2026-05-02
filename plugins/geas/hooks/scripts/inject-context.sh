#!/bin/bash
# inject-context.sh — SubagentStart hook (Geas v3)
#
# Injects shared memory + per-agent memory into a sub-agent's initial
# context. No other state is injected — mission / task context flows
# through the orchestrator's explicit TaskContract, not through hooks.
#
# The canonical v3 memory surface is .geas/memory/shared.md plus
# .geas/memory/agents/{agent}.md.
#
# Input (stdin): Claude Code hook payload JSON { cwd, agent_type, ... }.
# Output (stdout): { "additionalContext": "..." } or nothing.
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

// Inject shared memory (applies to all agents).
const sharedPath = path.join(geas, 'memory', 'shared.md');
if (h.exists(sharedPath)) {
  const content = fs.readFileSync(sharedPath, 'utf8').trim();
  if (content) {
    parts.push('--- SHARED MEMORY (.geas/memory/shared.md) ---');
    parts.push(content);
  }
}

// Inject per-agent memory if we know the agent type.
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
