#!/bin/bash
# verify-task-status.sh — PostToolUse hook (Write|Edit)
# When a task is marked "passed", verifies all mandatory evidence exists.
set -euo pipefail
_RAW_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_DIR="$(cygpath -m "$_RAW_DIR" 2>/dev/null || echo "$_RAW_DIR")"
node -e "
const h = require('$HOOK_DIR/lib/geas-hooks');
const {cwd, filePath} = h.parseInput();
if (!cwd || !filePath) process.exit(0);
if (!/\/.geas\/missions\/[^/]+\/tasks\/[^/]+\.json$/.test(filePath.replace(/\\\\/g,'/'))) process.exit(0);

const d = h.readJson(filePath);
if (!d || d.status !== 'passed') process.exit(0);

const tid = d.task_id || d.id || '';
if (!tid) process.exit(0);
const geas = h.geasDir(cwd);
const run = h.readJson(require('path').join(geas, 'state', 'run.json'));
const mid = run && run.mission_id;
if (!mid) process.exit(0);
const mdir = require('path').join(geas, 'missions', mid);
const edir = require('path').join(mdir, 'evidence', tid);
const tdir = require('path').join(mdir, 'tasks', tid);

if (!h.exists(require('path').join(edir, 'architecture-authority-review.json')))
  h.warn(tid + ' marked as passed but architecture-authority-review.json is missing');
if (!h.exists(require('path').join(edir, 'qa-engineer.json')))
  h.warn(tid + ' marked as passed but qa-engineer.json is missing');
if (!h.exists(require('path').join(tdir, 'challenge-review.json')))
  h.warn(tid + ' marked as passed but tasks/' + tid + '/challenge-review.json is missing');
if (!h.exists(require('path').join(edir, 'product-authority-verdict.json')))
  h.warn(tid + ' marked as passed but product-authority-verdict.json is missing');
if (!h.exists(require('path').join(tdir, 'retrospective.json')))
  h.warn(tid + ' marked as passed but tasks/' + tid + '/retrospective.json is missing');

// Check rubric_scores
const qa = h.readJson(require('path').join(edir, 'qa-engineer.json'));
if (qa && (!qa.rubric_scores || !Object.keys(qa.rubric_scores).length))
  h.warn(tid + ' qa-engineer.json is missing rubric_scores');
const arch = h.readJson(require('path').join(edir, 'architecture-authority-review.json'));
if (arch && (!arch.rubric_scores || !Object.keys(arch.rubric_scores).length))
  h.warn(tid + ' architecture-authority-review.json is missing rubric_scores');
" <<< "$(cat)"
