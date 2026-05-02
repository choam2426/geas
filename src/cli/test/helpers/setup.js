/**
 * Shared test primitives for G1+ test suite.
 *
 * Each test creates its own `.geas/` root under os.tmpdir() so test
 * runs are isolated. The CLI bundle at bin/geas is invoked as
 * a child process; stdout/stderr are captured.
 */

'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const BUNDLE = path.join(REPO_ROOT, 'bin', 'geas');

/**
 * Create a fresh temp directory to act as the project root. The caller
 * is responsible for calling cleanup() (returned) when the test is done.
 */
function makeTempRoot(prefix = 'geas-test-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const cleanup = () => {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  };
  return { dir, cleanup };
}

/**
 * Run the geas bundle with `args` using `cwd` as the working directory.
 * Optional `input` is written to stdin.
 *
 * Returns { status, stdout, stderr, json }, where `json` is the parsed
 * stdout envelope if parseable, otherwise null.
 */
function runCli(args, opts = {}) {
  const cwd = opts.cwd;
  if (!cwd) throw new Error('runCli requires opts.cwd');
  const input = opts.input;

  const res = spawnSync(process.execPath, [BUNDLE, ...args], {
    cwd,
    input: input ?? undefined,
    encoding: 'utf-8',
    env: { ...process.env, ...(opts.env ?? {}) },
  });

  let json = null;
  if (res.stdout) {
    try {
      json = JSON.parse(res.stdout);
    } catch {
      json = null;
    }
  }
  return {
    status: res.status,
    stdout: res.stdout,
    stderr: res.stderr,
    json,
  };
}

/**
 * Read and parse a JSON artifact under the given project root.
 */
function readArtifact(projectRoot, relPath) {
  const full = path.join(projectRoot, relPath);
  const content = fs.readFileSync(full, 'utf-8');
  return JSON.parse(content);
}

/**
 * Compute a stable hash for comparison / drift detection.
 */
function hashString(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

module.exports = {
  makeTempRoot,
  runCli,
  readArtifact,
  hashString,
  BUNDLE,
  REPO_ROOT,
};
