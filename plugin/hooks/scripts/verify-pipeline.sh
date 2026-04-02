#!/bin/bash
# verify-pipeline.sh — Stop hook
# Checks pipeline completeness before session end.
set -euo pipefail
_RAW_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_DIR="$(cygpath -m "$_RAW_DIR" 2>/dev/null || echo "$_RAW_DIR")"
node -e "
const path = require('path');
const h = require('$HOOK_DIR/lib/geas-hooks');
const {cwd} = h.parseInput();
if (!cwd) process.exit(0);

const geas = h.geasDir(cwd);
const run = h.readJson(path.join(geas, 'state', 'run.json'));
if (!run) process.exit(0);

const completed = run.completed_tasks || [];
if (!completed.length) process.exit(0);

const missing = [];
for (const tid of completed) {
  const edir = path.join(geas, 'evidence', tid);
  const tdir = path.join(geas, 'tasks', tid);
  if (!h.exists(path.join(edir, 'architecture-authority-review.json')))
    missing.push('  - ' + tid + ': architecture-authority-review.json (Code Review) missing');
  if (!h.exists(path.join(edir, 'qa-engineer.json')))
    missing.push('  - ' + tid + ': qa-engineer.json (QA Testing) missing');
  if (!h.exists(path.join(tdir, 'challenge-review.json')))
    missing.push('  - ' + tid + ': tasks/' + tid + '/challenge-review.json (Critical Reviewer) missing');
  if (!h.exists(path.join(edir, 'product-authority-verdict.json')))
    missing.push('  - ' + tid + ': product-authority-verdict.json (Product Authority) missing');
  if (!h.exists(path.join(tdir, 'retrospective.json')))
    missing.push('  - ' + tid + ': tasks/' + tid + '/retrospective.json (Retrospective) missing');
}

if (missing.length) {
  h.info('Pipeline incomplete. MANDATORY evidence missing:');
  missing.forEach(m => process.stderr.write(m + '\\n'));
  process.stderr.write('\\nExecute the missing steps before completing the session.\\n');
  process.exit(2);
}
" <<< "$(cat)"
