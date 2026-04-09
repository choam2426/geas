'use strict';

const fs = require('fs');
const path = require('path');

/** Read all of stdin synchronously and return trimmed string */
function readStdin() {
  return fs.readFileSync(0, 'utf8').trim();
}

/** Parse hook input JSON from stdin. Returns {cwd, toolInput, filePath, agentType, command, raw} */
function parseInput(raw) {
  if (!raw) raw = readStdin();
  const d = JSON.parse(raw);
  const cwd = d.cwd || '';
  let ti = d.tool_input || {};
  if (typeof ti === 'string') { try { ti = JSON.parse(ti); } catch { ti = {}; } }
  const filePath = (ti && typeof ti === 'object') ? (ti.file_path || '') : '';
  let agentType = (d.agent_type || '').toLowerCase();
  if (agentType.includes(':')) agentType = agentType.split(':').pop();
  const command = (ti && typeof ti === 'object') ? (ti.command || '') : '';
  return { cwd, toolInput: ti, filePath, agentType, command, raw: d };
}

/** Get .geas/ directory path */
function geasDir(cwd) { return path.join(cwd, '.geas'); }

/** Read and parse JSON file. Returns null if file doesn't exist or parse fails. */
function readJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return null; }
}

/** Write JSON with 2-space indent + trailing newline */
function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/** Append a JSON object as one line to a JSONL file */
function appendJsonl(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, JSON.stringify(obj) + '\n', 'utf8');
}

/** Print warning to stderr: [Geas] WARNING: msg */
function warn(msg) { process.stderr.write('[Geas] WARNING: ' + msg + '\n'); }

/** Print info to stderr: [Geas] msg */
function info(msg) { process.stderr.write('[Geas] ' + msg + '\n'); }

/** Simple fnmatch-style glob matching (supports * and ?) */
function fnmatch(str, pattern) {
  let re = '^';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') re += '.*';
    else if (c === '?') re += '.';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  re += '$';
  return new RegExp(re).test(str);
}

/** Check if a relative path matches any scope.surfaces entry (fnmatch + directory prefix) */
function matchScope(rel, scopePaths) {
  if (!scopePaths || !scopePaths.length) return true;
  return scopePaths.some(p =>
    fnmatch(rel, p) || rel.startsWith(p.replace(/\/$/, '') + '/')
  );
}

/** Output additionalContext JSON for SubagentStart hooks */
function outputContext(context) {
  if (context) process.stdout.write(JSON.stringify({ additionalContext: context }) + '\n');
}

/** Check if a file exists */
function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }

/** Get relative path from cwd, normalized to forward slashes */
function relPath(filePath, cwd) {
  return path.relative(cwd, filePath).replace(/\\/g, '/');
}

module.exports = {
  readStdin, parseInput, geasDir, readJson, writeJson, appendJsonl,
  warn, info, fnmatch, matchScope, outputContext, exists, relPath
};
