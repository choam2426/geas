#!/bin/bash
# memory-review-cadence.sh — SessionStart hook
# Detects memory entries past their review_after date.
set -euo pipefail

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
node -e "
const path = require('path');
const h = require(path.join('$HOOK_DIR', 'lib', 'geas-hooks'));
const {cwd} = h.parseInput();
if (!cwd) process.exit(0);

const mi = h.readJson(path.join(h.geasDir(cwd), 'state', 'memory-index.json'));
if (!mi || !mi.entries) process.exit(0);

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
" <<< "$(cat)"
