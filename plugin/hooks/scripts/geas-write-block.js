#!/usr/bin/env node
/**
 * geas-write-block.js — PreToolUse hook (Write|Edit)
 *
 * Blocks Write and Edit tool calls that target .geas/ paths.
 * All .geas/ file modifications must go through the geas CLI.
 *
 * Exit codes:
 *   0 = allow (not a .geas/ path)
 *   2 = block (targets .geas/ path) — outputs JSON with "decision":"block"
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

// Normalize the path for comparison
const normalizedPath = filePath.replace(/\\/g, '/');
const normalizedCwd = cwd.replace(/\\/g, '/');

// Check if the file path targets .geas/
const relPath = normalizedCwd
  ? path.relative(normalizedCwd, filePath).replace(/\\/g, '/')
  : normalizedPath;

const isGeasPath =
  relPath.startsWith('.geas/') ||
  relPath === '.geas' ||
  normalizedPath.includes('/.geas/') ||
  normalizedPath.includes('\\.geas/') ||
  normalizedPath.includes('\\.geas\\');

if (isGeasPath) {
  // Block the write with an explanation
  const result = {
    decision: 'block',
    reason:
      '[Geas] BLOCKED: Direct Write/Edit to .geas/ is not allowed. ' +
      'All .geas/ file modifications must use geas CLI commands. ' +
      'Examples: geas mission create, geas task draft, geas evidence append, ' +
      'geas memory shared-set, geas debt register, geas event log. ' +
      'Use Bash tool to invoke CLI commands instead.'
  };
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exit(0);
}

// Not a .geas/ path — allow
process.exit(0);
