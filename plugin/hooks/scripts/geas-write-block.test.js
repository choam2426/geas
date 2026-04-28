/**
 * Unit tests for plugin/hooks/scripts/geas-write-block.js
 *
 * Mission mission-20260428-ava973xA, task-006 (issue 4 / AC5.2):
 * spawn the hook as a subprocess (matching how Claude Code's PreToolUse
 * harness invokes it) and assert allow/block decisions for the six
 * required cases plus a bonus traversal case.
 *
 * Run with:
 *   node --test plugin/hooks/scripts/geas-write-block.test.js
 *
 * No third-party deps. Uses node:test (Node >=18).
 */

'use strict';

const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');

const HOOK = path.join(__dirname, 'geas-write-block.js');

/**
 * Spawn the hook with the given (cwd, filePath) payload. Returns the
 * raw stdout, parsed JSON if any, the exit code, and a derived `decision`
 * — 'block' if stdout contained {"decision":"block"}, otherwise 'allow'.
 */
function spawnHook(cwd, filePath) {
  const payload = JSON.stringify({
    cwd,
    tool_input: { file_path: filePath },
  });

  const res = spawnSync(process.execPath, [HOOK], {
    input: payload,
    encoding: 'utf-8',
  });

  let parsed = null;
  if (res.stdout && res.stdout.trim()) {
    try { parsed = JSON.parse(res.stdout); } catch { parsed = null; }
  }
  const decision = parsed && parsed.decision === 'block' ? 'block' : 'allow';
  return { status: res.status, stdout: res.stdout, parsed, decision };
}

// Stable cwd for tests. The hook compares filePath against this cwd.
const FAKE_CWD = '/tmp/fake-project';

test('AC5.2 (a): .geas/tmp/foo.md is allowed', () => {
  const r = spawnHook(FAKE_CWD, `${FAKE_CWD}/.geas/tmp/foo.md`);
  assert.equal(
    r.decision,
    'allow',
    `expected allow for whitelisted .geas/tmp/foo.md, got block: stdout=${r.stdout}`
  );
});

test('AC5.2 (b): .geas/tmpfoo (prefix-only look-alike) is blocked', () => {
  const r = spawnHook(FAKE_CWD, `${FAKE_CWD}/.geas/tmpfoo`);
  assert.equal(
    r.decision,
    'block',
    `expected block for prefix-only sibling .geas/tmpfoo, got allow — whitelist must be exact-segment`
  );
});

test('AC5.2 (c): .geas/tmp (directory itself, no child) is blocked', () => {
  const r = spawnHook(FAKE_CWD, `${FAKE_CWD}/.geas/tmp`);
  assert.equal(
    r.decision,
    'block',
    `expected block for bare .geas/tmp (the dir itself is not a write target), got allow`
  );
});

test('AC5.2 (d): .geas/missions/m/foo is blocked', () => {
  const r = spawnHook(FAKE_CWD, `${FAKE_CWD}/.geas/missions/m/foo`);
  assert.equal(
    r.decision,
    'block',
    `expected block for non-tmp .geas/ path, got allow`
  );
});

test('AC5.2 (e): src/foo (outside .geas/) is allowed', () => {
  const r = spawnHook(FAKE_CWD, `${FAKE_CWD}/src/foo`);
  assert.equal(
    r.decision,
    'allow',
    `expected allow for non-.geas path src/foo, got block: stdout=${r.stdout}`
  );
});

test('AC5.2 (f): Windows-style \\.geas\\tmp\\bar is allowed', () => {
  // Simulate a Windows-style path coming from Claude Code's hook input.
  // The hook must slash-fold internally and treat it the same as the
  // POSIX form .geas/tmp/bar.
  const winCwd = 'C:\\Users\\dev\\proj';
  const winPath = 'C:\\Users\\dev\\proj\\.geas\\tmp\\bar';
  const r = spawnHook(winCwd, winPath);
  assert.equal(
    r.decision,
    'allow',
    `expected allow for windows .geas\\tmp\\bar, got block: stdout=${r.stdout}`
  );
});

// Bonus: traversal escape must not bypass the whitelist (verification_plan
// step 3, mission-design risk note). Not part of AC5.2's six but included
// to pin the regression.
test('bonus: .geas/tmp/../missions/foo (traversal escape) is blocked', () => {
  const r = spawnHook(FAKE_CWD, `${FAKE_CWD}/.geas/tmp/../missions/foo`);
  assert.equal(
    r.decision,
    'block',
    `expected block for traversal escape .geas/tmp/../missions/foo — whitelist must be applied AFTER normalization`
  );
});

// Bonus: legacy .geas/.tmp/ (residue dir from old setups, per task-005
// risk_transfer) must remain blocked so it cannot become a writable
// bypass.
test('bonus: legacy .geas/.tmp/foo is blocked (residue dir is not whitelisted)', () => {
  const r = spawnHook(FAKE_CWD, `${FAKE_CWD}/.geas/.tmp/foo`);
  assert.equal(
    r.decision,
    'block',
    `expected block for legacy .geas/.tmp/ residue path, got allow — only .geas/tmp/ is whitelisted`
  );
});
