#!/bin/bash
# verify-task-status.sh — PostToolUse hook (Write|Edit)
# When a task is marked "passed", verifies all mandatory evidence exists.
set -euo pipefail
_RAW_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_DIR="$(cygpath -m "$_RAW_DIR" 2>/dev/null || echo "$_RAW_DIR")"
node -e "
const path = require('path');
const h = require('$HOOK_DIR/lib/geas-hooks');
const {cwd, filePath} = h.parseInput();
if (!cwd || !filePath) process.exit(0);
if (!/\/.geas\/missions\/[^/]+\/tasks\/[^/]+\.json$/.test(filePath.replace(/\\\\/g,'/'))) process.exit(0);

const d = h.readJson(filePath);
if (!d || d.status !== 'passed') process.exit(0);

const tid = d.task_id || d.id || '';
if (!tid) process.exit(0);
const geas = h.geasDir(cwd);
const run = h.readJson(path.join(geas, 'state', 'run.json'));
const mid = run && run.mission_id;
if (!mid) process.exit(0);
const mdir = path.join(geas, 'missions', mid);
const edir = path.join(mdir, 'evidence', tid);
const tdir = path.join(mdir, 'tasks', tid);

// Check required reviewer evidence from task routing
const routing = d.routing || {};
const reviewerTypes = routing.required_reviewer_types || [];
for (const rt of reviewerTypes) {
  const kebab = rt.replace(/_/g, '-');
  const found = h.exists(path.join(edir, kebab + '-review.json'))
    || h.exists(path.join(edir, kebab + '.json'))
    || h.exists(path.join(edir, rt + '-review.json'))
    || h.exists(path.join(edir, rt + '.json'));
  if (!found)
    h.warn(tid + ' marked as passed but evidence from ' + rt + ' is missing');
}

// Always required: product-authority verdict
if (!h.exists(path.join(edir, 'product-authority-verdict.json')))
  h.warn(tid + ' marked as passed but product-authority-verdict.json is missing');

// Challenge review: required for high/critical
const riskLevel = d.risk_level || 'normal';
if (['high', 'critical'].includes(riskLevel)) {
  if (!h.exists(path.join(tdir, 'challenge-review.json')))
    h.warn(tid + ' is ' + riskLevel + ' risk but challenge-review.json is missing');
}

// Retrospective
if (!h.exists(path.join(tdir, 'retrospective.json')))
  h.warn(tid + ' marked as passed but retrospective.json is missing');

// Rubric scores check on all reviewer evidence (domain-agnostic)
const fs = require('fs');
try {
  const files = fs.readdirSync(edir).filter(f => f.endsWith('.json'));
  for (const f of files) {
    const review = h.readJson(path.join(edir, f));
    if (review && review.reviewer_type && (!review.rubric_scores || !Object.keys(review.rubric_scores).length))
      h.warn(tid + ' ' + f + ' is missing rubric_scores');
  }
} catch {}
" <<< "$(cat)"
