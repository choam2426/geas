#!/bin/bash
# agent-telemetry.sh — SubagentStop hook
# Logs agent spawn metadata (agent name, task, model) for distribution analysis.
# For actual token costs, see calculate-cost.sh (Stop hook).
set -euo pipefail
_RAW_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_DIR="$(cygpath -m "$_RAW_DIR" 2>/dev/null || echo "$_RAW_DIR")"
node -e "
const path = require('path');
const h = require('$HOOK_DIR/lib/geas-hooks');
const {cwd, agentType} = h.parseInput();
if (!cwd || !agentType) process.exit(0);

const geas = h.geasDir(cwd);
const run = h.readJson(path.join(geas, 'state', 'run.json'));
if (!run) process.exit(0);

const taskId = run.current_task_id || '';
const phase = run.phase || '';

h.appendJsonl(path.join(geas, 'ledger', 'costs.jsonl'), {
  event: 'agent_stop', agent: agentType, task_id: taskId,
  phase: phase, timestamp: new Date().toISOString().replace(/\\.\\d{3}Z$/, 'Z')
});
" <<< "$(cat)"
