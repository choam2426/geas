#!/bin/bash
# session-init.sh — SessionStart hook (Geas v3)
#
# On session start, print a one-line context summary derived from v3
# artifacts if .geas/ exists. No mutation: session-init is read-only
# and never creates runtime files. The canonical runtime tree is owned
# by the geas CLI; hooks merely surface existing state.
#
# Input (stdin): Claude Code hook payload JSON { cwd, ... }.
# Output (stderr): one-line [Geas] info lines, suppressed if nothing
# to report.
set -euo pipefail
_RAW_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_DIR="$(cygpath -m "$_RAW_DIR" 2>/dev/null || echo "$_RAW_DIR")"
node -e "
const fs = require('fs');
const path = require('path');
const h = require('$HOOK_DIR/lib/geas-hooks');
const {cwd} = h.parseInput();
if (!cwd) process.exit(0);

const geas = h.geasDir(cwd);
if (!fs.existsSync(geas)) process.exit(0);

// Count missions (v3: .geas/missions/{mission_id}/)
let missionCount = 0;
let latestMission = null;
let latestPhase = null;
try {
  const missionsDir = path.join(geas, 'missions');
  if (fs.existsSync(missionsDir)) {
    const entries = fs.readdirSync(missionsDir)
      .filter((n) => /^mission-/.test(n) && fs.statSync(path.join(missionsDir, n)).isDirectory());
    missionCount = entries.length;
    if (entries.length) {
      entries.sort();
      latestMission = entries[entries.length - 1];
      const statePath = path.join(missionsDir, latestMission, 'mission-state.json');
      const state = h.readJson(statePath);
      if (state) latestPhase = state.mission_phase || null;
    }
  }
} catch {}

// Count shared/agent memory files.
let memShared = fs.existsSync(path.join(geas, 'memory', 'shared.md'));
let agentNotes = 0;
try {
  const agentsDir = path.join(geas, 'memory', 'agents');
  if (fs.existsSync(agentsDir)) {
    agentNotes = fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md')).length;
  }
} catch {}

// Count open debts.
let openDebts = 0;
try {
  const debts = h.readJson(path.join(geas, 'debts.json'));
  if (debts && Array.isArray(debts.entries)) {
    openDebts = debts.entries.filter((d) => d && d.status === 'open').length;
  }
} catch {}

const parts = [];
if (missionCount) {
  let s = 'Missions: ' + missionCount;
  if (latestMission) s += ' | latest: ' + latestMission + (latestPhase ? ' (' + latestPhase + ')' : '');
  parts.push(s);
}
if (memShared || agentNotes) parts.push('Memory: shared=' + (memShared ? 'yes' : 'no') + ', agent notes=' + agentNotes);
if (openDebts) parts.push('Open debts: ' + openDebts);
if (parts.length) h.info('Session resumed. ' + parts.join(' | '));
" <<< "$(cat)"
