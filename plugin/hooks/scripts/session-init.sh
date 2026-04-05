#!/bin/bash
# session-init.sh — SessionStart hook
# Checks .geas/ state on session start and injects context.
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

const runFile = path.join(geas, 'state', 'run.json');
if (!h.exists(runFile)) {
  h.info('.geas/ directory exists but no run.json. Run setup first.');
  process.exit(0);
}

const d = h.readJson(runFile);
if (d) {
  const status = d.status || 'unknown';
  const phase = d.phase || 'unknown';
  const mission = d.mission || 'unknown';
  const completed = (d.completed_tasks || []).length;
  h.info('Session resumed. Mission: ' + mission + ' | Phase: ' + phase + ' | Status: ' + status + ' | Tasks completed: ' + completed);

  const cp = d.checkpoint || {};
  if (cp.pipeline_step) {
    const tid = d.current_task_id || '';
    h.info('Checkpoint: task=' + tid + ', step=' + cp.pipeline_step + ', agent=' + (cp.agent_in_flight || ''));
  }
}

// Create rules.md if missing
const rulesPath = path.join(geas, 'rules.md');
if (!h.exists(rulesPath)) {
  const template = '# Agent Rules\n\n## Evidence\n- Write results to .geas/missions/{mission_id}/evidence/{task-id}/{your-name}.json as JSON (read mission_id from .geas/state/run.json)\n- Required fields: agent, task_id, summary, files_changed, created_at\n- created_at is auto-injected by the PostToolUse hook. No manual timestamp needed.\n\n## Code\n- Respect scope.paths from the TaskContract — only modify files within the declared scope\n- Do not modify files outside the task scope\n';
  fs.writeFileSync(rulesPath, template, 'utf8');
  h.info('Created .geas/rules.md with initial template.');
}

// Memory review cadence check
const mi = h.readJson(path.join(geas, 'state', 'memory-index.json'));
if (mi && mi.entries) {
  const now = new Date();
  const reviewable = ['provisional', 'stable', 'canonical'];
  const expired = mi.entries.filter(e =>
    reviewable.includes(e.state) && e.review_after && new Date(e.review_after) < now
  );
  if (expired.length) {
    h.info(expired.length + ' memory entries past review date:');
    expired.slice(0, 10).forEach(e =>
      process.stderr.write('  - ' + e.memory_id + ' (' + e.state + ') due: ' + e.review_after + '\\n')
    );
    if (expired.length > 10) process.stderr.write('  ... and ' + (expired.length - 10) + ' more\\n');
    h.info('Run /geas:memorizing for batch review.');
  }
}
" <<< "$(cat)"
