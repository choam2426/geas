#!/bin/bash
# calculate-cost.sh — Stop hook
# Aggregates token usage from subagent sessions.
set -euo pipefail

_RAW_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_DIR="$(cygpath -m "$_RAW_DIR" 2>/dev/null || echo "$_RAW_DIR")"
node -e "
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const h = require(path.join('$HOOK_DIR', 'lib', 'geas-hooks'));
const {cwd} = h.parseInput();
if (!cwd) process.exit(0);

const geas = h.geasDir(cwd);
if (!fs.existsSync(geas)) process.exit(0);

// Find Claude project directory
const normalized = cwd.replace(/\\\\/g, '/').replace(/^([A-Z]):/, (m,d) => '/' + d.toLowerCase());
const hash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 8);
const home = process.env.HOME || process.env.USERPROFILE || '';
const base = path.join(home, '.claude', 'projects');

let projectDir = null;
try {
  const dirs = fs.readdirSync(base);
  const match = dirs.find(d => d.includes(hash));
  projectDir = match ? path.join(base, match) : null;
} catch { process.exit(0); }
if (!projectDir) process.exit(0);

// Find most recent session with subagents
let sessionDir = null;
try {
  const entries = fs.readdirSync(projectDir)
    .filter(f => !f.endsWith('.jsonl') && fs.statSync(path.join(projectDir, f)).isDirectory())
    .sort((a, b) => fs.statSync(path.join(projectDir, b)).mtimeMs - fs.statSync(path.join(projectDir, a)).mtimeMs);
  sessionDir = entries[0] ? path.join(projectDir, entries[0]) : null;
} catch { process.exit(0); }
if (!sessionDir) process.exit(0);

// Parse subagent JSONLs
const totals = { input: 0, output: 0, cache_create: 0, cache_read: 0 };
const byAgent = {};

try {
  const files = fs.readdirSync(sessionDir).filter(f => f.endsWith('.jsonl'));
  for (const f of files) {
    let agentName = 'unknown';
    const meta = h.readJson(path.join(sessionDir, f.replace('.jsonl', ''), '.meta.json'));
    if (meta) agentName = meta.agent_type || meta.name || 'unknown';

    const lines = fs.readFileSync(path.join(sessionDir, f), 'utf8').split('\\n').filter(Boolean);
    for (const line of lines) {
      try {
        const d = JSON.parse(line);
        const u = d.usage || {};
        totals.input += u.input_tokens || 0;
        totals.output += u.output_tokens || 0;
        totals.cache_create += u.cache_creation_input_tokens || 0;
        totals.cache_read += u.cache_read_input_tokens || 0;

        if (!byAgent[agentName]) byAgent[agentName] = { input: 0, output: 0 };
        byAgent[agentName].input += u.input_tokens || 0;
        byAgent[agentName].output += u.output_tokens || 0;
      } catch {}
    }
  }
} catch {}

const summary = { totals, by_agent: byAgent, timestamp: new Date().toISOString().replace(/\\.\\d{3}Z\$/, 'Z') };
h.writeJson(path.join(geas, 'state', 'token-summary.json'), summary);

const agentCount = Object.keys(byAgent).length;
h.info('Token summary: input=' + totals.input + ' output=' + totals.output + ' agents=' + agentCount);
" <<< "$(cat)"
