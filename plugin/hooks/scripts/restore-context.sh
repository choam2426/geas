#!/bin/bash
# restore-context.sh — PostCompact hook
# Re-injects critical Geas state after context compaction.
# Prevents orchestrator from losing track of current phase/task.
set -euo pipefail
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
node -e "
const fs = require('fs');
const path = require('path');
const h = require('$HOOK_DIR/lib/geas-hooks');
const {cwd} = h.parseInput();
if (!cwd) process.exit(0);

const geas = h.geasDir(cwd);
const runFile = path.join(geas, 'state', 'run.json');
if (!fs.existsSync(geas) || !h.exists(runFile)) process.exit(0);

const d = h.readJson(runFile);
if (!d) process.exit(0);

const parts = [];
parts.push('--- GEAS STATE (restored after context compaction) ---');

const status = d.status || 'unknown';
const phase = d.phase || 'unknown';
const mission = d.mission || '';
const tid = d.current_task_id || '';
const completed = d.completed_tasks || [];

parts.push('Phase: ' + phase + ' | Status: ' + status);
parts.push('Mission: ' + mission);
parts.push('Current task: ' + tid);
const last5 = completed.slice(-5).join(', ') + (completed.length > 5 ? '...' : '');
parts.push('Completed tasks: ' + completed.length + ' (' + last5 + ')');

// Checkpoint info
const cp = d.checkpoint || {};
const remaining = cp.remaining_steps || [];
if (cp.pipeline_step) parts.push('Pipeline step: ' + cp.pipeline_step);
if (cp.agent_in_flight) parts.push('Agent in flight: ' + cp.agent_in_flight);
if (remaining.length) {
  parts.push('Remaining steps: ' + remaining.join(', '));
  parts.push('NEXT STEP: ' + remaining[0]);
}

// Recovery info
if (d.recovery_class) parts.push('Recovery class: ' + d.recovery_class);

// Task contract summary
let taskGoal = '';
if (tid) {
  const task = h.readJson(path.join(geas, 'tasks', tid + '.json'));
  if (task) {
    taskGoal = task.goal || '';
    parts.push('Task goal: ' + taskGoal);
    const criteria = task.acceptance_criteria || [];
    if (criteria.length) {
      parts.push('Acceptance criteria:');
      criteria.forEach((c, i) => parts.push('  ' + (i+1) + '. ' + c));
    }
  }
}

// SESSION CONTEXT (from session-latest.md)
const slPath = path.join(geas, 'state', 'session-latest.md');
if (h.exists(slPath)) {
  const sc = fs.readFileSync(slPath, 'utf8').trim();
  if (sc) { parts.push(''); parts.push('--- SESSION CONTEXT ---'); parts.push(sc); }
}

// Open risks from closure packet
let openRisks = [];
if (tid) {
  const cpkt = h.readJson(path.join(geas, 'tasks', tid, 'closure-packet.json'));
  if (cpkt && cpkt.open_risks) openRisks = cpkt.open_risks.items || [];
}

// Rules summary (first 30 lines)
const rulesPath = path.join(geas, 'rules.md');
let rulesLines = [];
if (h.exists(rulesPath)) {
  rulesLines = fs.readFileSync(rulesPath, 'utf8').split('\n').slice(0, 30);
  parts.push(''); parts.push('--- KEY RULES ---'); parts.push(rulesLines.join('\n').trim());
}

// MEMORY STATE SUMMARY
const mi = h.readJson(path.join(geas, 'state', 'memory-index.json'));
let memTotal = 0;
const memCounts = {};
if (mi && mi.entries) {
  memTotal = mi.entries.length;
  mi.entries.forEach(e => { const s = e.state || 'unknown'; memCounts[s] = (memCounts[s]||0)+1; });
}
if (memTotal > 0) {
  parts.push(''); parts.push('--- MEMORY STATE ---');
  const summary = Object.entries(memCounts).sort().map(([s,c]) => s+': '+c).join(', ');
  parts.push('Total memories: ' + memTotal + ' (' + summary + ')');
}

// L0 ANTI-FORGETTING (always-preserved items)
parts.push(''); parts.push('## L0 ANTI-FORGETTING');
parts.push('The following items MUST be retained across compaction:');
const l0 = [];
l0.push('1. Phase: ' + phase + ' (status: ' + status + ')');
l0.push('2. Focus task: ' + (tid || '(none)') + (taskGoal ? ' — ' + taskGoal : ''));
l0.push('3. Rewind reason: ' + (d.recovery_class || '(clean session, no recovery)'));
l0.push('4. Required next artifact: ' + (remaining.length ? remaining[0] : '(pipeline complete or unknown)'));
if (openRisks.length) {
  const strs = openRisks.slice(0,3).map(r => typeof r === 'object' ? (r.description || r.risk || JSON.stringify(r)) : String(r));
  l0.push('5. Open risks: ' + strs.join('; '));
} else l0.push('5. Open risks: (none found)');
l0.push('6. Recovery outcome: ' + (d.recovery_class || '(clean session)'));
const ruleCount = rulesLines.filter(l => l.trim() && !l.trim().startsWith('#')).length;
l0.push('7. Active rules: ' + ruleCount + ' lines loaded from rules.md | Memories: ' + memTotal + ' entries');

l0.forEach(item => parts.push(item));

h.outputContext(parts.join('\n'));
" <<< "$(cat)"
