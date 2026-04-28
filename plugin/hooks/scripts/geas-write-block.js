#!/usr/bin/env node
/**
 * geas-write-block.js — PreToolUse hook (Write|Edit)
 *
 * Blocks Write and Edit tool calls that target .geas/ paths so that all
 * .geas/ file modifications go through the geas CLI.
 *
 * Whitelist: writes under `.geas/tmp/` are ALLOWED. This is the canonical
 * scratch dir for sub-skills staging prose-heavy inputs (see mission
 * mission-20260428-ava973xA, task-006). The whitelist is exact prefix
 * with a trailing path separator — `.geas/tmpfoo` and `.geas/.tmp/` are
 * blocked. Path traversal (e.g. `.geas/tmp/../missions/foo`) is also
 * blocked because comparison happens after normalization.
 *
 * Exit codes:
 *   0 = allow (not a .geas/ path, or a whitelisted .geas/tmp/ path)
 *   0 with stdout JSON {"decision":"block",...} = block the call
 *
 * (The tool always exits 0; the block is signalled via the JSON body so
 * Claude Code's hook protocol can surface a structured reason.)
 */
'use strict';

const fs = require('fs');
const path = require('path');

// Read hook input from stdin
let input = '';
try {
  input = fs.readFileSync(0, 'utf8').trim();
} catch {
  process.exit(0);
}

if (!input) process.exit(0);

let data;
try {
  data = JSON.parse(input);
} catch {
  process.exit(0);
}

const cwd = data.cwd || '';
let toolInput = data.tool_input || {};
if (typeof toolInput === 'string') {
  try { toolInput = JSON.parse(toolInput); } catch { toolInput = {}; }
}

const filePath = (toolInput && typeof toolInput === 'object') ? (toolInput.file_path || '') : '';

if (!filePath) process.exit(0);

/**
 * Decide whether the (cwd, filePath) pair targets a forbidden .geas/ path.
 *
 * Algorithm:
 *   1. Slash-fold both paths to POSIX form.
 *   2. If the file path looks absolute and lives under cwd, derive the
 *      cwd-relative form first; otherwise use the slash-folded path as-is.
 *   3. Run path.posix.normalize to collapse `..` and `.` segments. This
 *      defuses traversal escapes like `.geas/tmp/../missions/foo` because
 *      the resolved form becomes `.geas/missions/foo`, which is then
 *      caught by the .geas/ block rule.
 *   4. Locate the `.geas` segment by walking segments (NOT substring),
 *      so paths like `notgeas/foo` cannot collide.
 *   5. If `.geas` is found, look at the segment immediately after it.
 *      Allow ONLY when that segment is exactly `tmp` AND at least one
 *      further segment exists (i.e. a real file under `.geas/tmp/`).
 *      The bare `.geas/tmp` directory itself is NOT allowed — there is
 *      no file to write there.
 *   6. If a normalized path starts with `..`, treat it as suspicious
 *      and block (defense in depth: a path that escapes its anchor
 *      should not be silently allowed).
 */
function decide(cwdRaw, filePathRaw) {
  const slashFold = (s) => String(s || '').replace(/\\/g, '/');
  const cwdPosix = slashFold(cwdRaw);
  const fpPosix = slashFold(filePathRaw);

  // Determine the path to inspect: prefer cwd-relative form if filePath is
  // absolute under cwd; otherwise normalize filePath as-is.
  let inspect;
  if (cwdPosix && fpPosix.toLowerCase().startsWith(cwdPosix.toLowerCase() + '/')) {
    inspect = fpPosix.slice(cwdPosix.length + 1);
  } else if (cwdPosix && fpPosix.toLowerCase() === cwdPosix.toLowerCase()) {
    inspect = '';
  } else {
    inspect = fpPosix;
  }

  // Normalize to collapse `..` and `.` segments. path.posix.normalize is
  // platform-independent regardless of host OS.
  const normalized = path.posix.normalize(inspect);

  // Defense in depth: a normalized path that still begins with `..` is
  // attempting to escape its anchor. Block conservatively.
  if (normalized === '..' || normalized.startsWith('../')) {
    return { allow: false, reason: 'path-escape' };
  }

  // Walk segments, looking for `.geas`.
  const segments = normalized.split('/').filter((s) => s !== '');
  const geasIdx = segments.indexOf('.geas');

  if (geasIdx === -1) {
    // Path is not under any .geas/ tree → not our concern, allow.
    return { allow: true, reason: 'not-geas' };
  }

  // The path is inside .geas/. Inspect the very next segment.
  const after = segments.slice(geasIdx + 1);

  // .geas itself, or .geas/<single-segment-only-no-trailing-content>
  // — block. Bare `.geas` is never a write target; the only allow
  // path is `.geas/tmp/<file>`.
  if (after.length === 0) {
    return { allow: false, reason: 'geas-root' };
  }

  // Allow only when first sub-segment is exactly `tmp` AND at least
  // one more segment follows (a real file/dir below .geas/tmp/).
  if (after[0] === 'tmp' && after.length >= 2) {
    return { allow: true, reason: 'geas-tmp-whitelist' };
  }

  // Anything else inside .geas/ — including `.geas/tmp` (no children),
  // `.geas/tmpfoo`, `.geas/.tmp/...`, `.geas/missions/...` — is blocked.
  return { allow: false, reason: 'geas-other' };
}

const verdict = decide(cwd, filePath);

if (!verdict.allow) {
  // Block the write with an explanation.
  const result = {
    decision: 'block',
    reason:
      '[Geas] BLOCKED: Direct Write/Edit to .geas/ is not allowed. ' +
      'All .geas/ file modifications must use geas CLI commands. ' +
      'Examples: geas mission create, geas task draft, geas evidence append, ' +
      'geas memory shared-set, geas debt register, geas event log. ' +
      'Use Bash tool to invoke CLI commands instead. ' +
      '(Note: writes under .geas/tmp/ are allowed for sub-skill staging.)'
  };
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exit(0);
}

// Allowed (non-.geas/ path or .geas/tmp/<file>)
process.exit(0);
