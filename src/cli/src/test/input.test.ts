/**
 * Unit tests for src/lib/input.ts (stdin-only readInputData).
 *
 * These tests run the function in a child Node process so each case can set
 * up process.stdin (pipe, TTY, empty) and the fs.readFileSync(0) path
 * independently without contaminating the parent test runner's stdin.
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';

// Resolve the compiled input module relative to this test file. At runtime
// this file lives at dist/test/input.test.js, and input.js sits at
// dist/lib/input.js.
const INPUT_MODULE = path.resolve(__dirname, '..', 'lib', 'input.js');

/**
 * Run readInputData() in a fresh Node child process and capture the outcome
 * as a JSON object on stdout: { ok, value?, code?, message? }.
 *
 * `stdinPayload === null`  => do not provide a stdin (inherit = TTY-like);
 *                             we simulate isTTY=true by patching in the
 *                             wrapper script.
 * `stdinPayload === ''`    => provide an empty pipe (0-byte stdin).
 * `stdinPayload === string`=> provide the string via pipe.
 */
function runReadInput(opts: {
  stdinPayload: string | null;
  forceTTY?: boolean;
  forceIsTTYUndefined?: boolean;
  simulateReadError?: 'EAGAIN' | 'EOF' | 'UV_EOF' | 'ENOENT';
}): { ok: boolean; value?: unknown; code?: string; message?: string } {
  const pre: string[] = [];

  if (opts.forceTTY) {
    pre.push(
      "Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });",
    );
  } else if (opts.forceIsTTYUndefined) {
    pre.push(
      "Object.defineProperty(process.stdin, 'isTTY', { value: undefined, configurable: true });",
    );
  }

  if (opts.simulateReadError) {
    const errnoMap: Record<string, { code: string; errno: number }> = {
      EAGAIN: { code: 'EAGAIN', errno: -11 },
      EOF: { code: 'EOF', errno: -1 },
      UV_EOF: { code: 'EOF', errno: -4095 },
      ENOENT: { code: 'ENOENT', errno: -2 },
    };
    const meta = errnoMap[opts.simulateReadError];
    pre.push(`
      {
        const fs = require('fs');
        const origRead = fs.readFileSync;
        fs.readFileSync = function(target, enc) {
          if (target === 0) {
            const e = new Error('simulated stdin read failure');
            e.code = ${JSON.stringify(meta.code)};
            e.errno = ${meta.errno};
            throw e;
          }
          return origRead.apply(fs, arguments);
        };
      }
    `);
  }

  const script = `
    ${pre.join('\n')}
    try {
      const { readInputData } = require(${JSON.stringify(INPUT_MODULE)});
      const value = readInputData();
      process.stdout.write(JSON.stringify({ ok: true, value }));
    } catch (err) {
      process.stdout.write(JSON.stringify({
        ok: false,
        code: err && err.code,
        message: err && err.message,
      }));
    }
  `;

  const result = spawnSync(process.execPath, ['-e', script], {
    input: opts.stdinPayload === null ? undefined : opts.stdinPayload,
    // When stdinPayload is null AND forceTTY is set, we still want to
    // provide SOME stdin so Node doesn't inherit the test runner's TTY.
    // Passing an empty string as input makes stdin a non-TTY pipe by
    // default; the forceTTY Object.defineProperty override flips isTTY.
    stdio: ['pipe', 'pipe', 'pipe'],
    encoding: 'utf-8',
  });

  if (result.status !== 0 && !result.stdout) {
    throw new Error(
      `child process failed: status=${result.status} stderr=${result.stderr}`,
    );
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`could not parse child stdout: ${result.stdout}`);
  }
}

describe('readInputData (stdin-only)', () => {
  it('isTTY=true guard: throws NO_STDIN without blocking', () => {
    const r = runReadInput({ stdinPayload: '', forceTTY: true });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'NO_STDIN');
    assert.match(r.message ?? '', /interactive terminal/i);
  });

  it('non-TTY pipe with valid JSON parses to object', () => {
    const r = runReadInput({ stdinPayload: '{"foo":"bar","n":1}' });
    assert.equal(r.ok, true);
    assert.deepEqual(r.value, { foo: 'bar', n: 1 });
  });

  it('non-TTY 0-byte stdin throws NO_STDIN empty-stdin', () => {
    const r = runReadInput({ stdinPayload: '' });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'NO_STDIN');
    assert.match(r.message ?? '', /empty|0 bytes/i);
  });

  it('invalid JSON throws with line/column hint when position is available', () => {
    // The "x" at position 1 is an unexpected token; V8 reports a position.
    const r = runReadInput({ stdinPayload: '{x}' });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'INVALID_JSON');
    // Must surface a parser message; line hint is optional on older engines.
    assert.match(r.message ?? '', /Invalid JSON on stdin/);
  });

  it('invalid JSON fallback path: still surfaces parser message when regex fails', () => {
    // A lone "," is invalid JSON; even if the V8 position regex does NOT
    // match in a future Node version, the error message must still include
    // the raw parser text (fallback branch of computeJsonLineHint).
    const r = runReadInput({ stdinPayload: ',' });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'INVALID_JSON');
    assert.ok(
      (r.message ?? '').length > 'Invalid JSON on stdin: '.length,
      'message should contain parser output',
    );
  });

  it('isTTY=undefined does not trigger guard (CI / Claude Code Bash)', () => {
    const r = runReadInput({
      stdinPayload: '{"ok":true}',
      forceIsTTYUndefined: true,
    });
    assert.equal(r.ok, true);
    assert.deepEqual(r.value, { ok: true });
  });

  it('Windows readFileSync(0) EAGAIN → NO_STDIN empty-stdin', () => {
    const r = runReadInput({
      stdinPayload: '',
      simulateReadError: 'EAGAIN',
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'NO_STDIN');
  });

  it('Windows readFileSync(0) EOF → NO_STDIN empty-stdin', () => {
    const r = runReadInput({
      stdinPayload: '',
      simulateReadError: 'EOF',
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'NO_STDIN');
  });

  it('Windows readFileSync(0) UV_EOF (errno -4095) → NO_STDIN empty-stdin', () => {
    const r = runReadInput({
      stdinPayload: '',
      simulateReadError: 'UV_EOF',
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'NO_STDIN');
  });

  it('stdin with UTF-8 BOM + JSON parses correctly', () => {
    const r = runReadInput({ stdinPayload: '\uFEFF{"a":1}' });
    assert.equal(r.ok, true);
    assert.deepEqual(r.value, { a: 1 });
  });

  it('stdin with surrounding whitespace trims and parses', () => {
    const r = runReadInput({ stdinPayload: '\n  {"a":1}  \n' });
    assert.equal(r.ok, true);
    assert.deepEqual(r.value, { a: 1 });
  });
});

describe('parseSetFlags (regression smoke)', () => {
  it('parses key=value pairs and coerces numbers, booleans, arrays', async () => {
    const { parseSetFlags } = await import('../lib/input');
    const result = parseSetFlags([
      'summary=hello',
      'confidence=4',
      'ok=true',
      'skip=false',
      'files[0]=a.ts',
      'files[1]=b.ts',
      'padded=001',
    ]);
    assert.equal(result.summary, 'hello');
    assert.equal(result.confidence, 4);
    assert.equal(result.ok, true);
    assert.equal(result.skip, false);
    assert.deepEqual(result.files, ['a.ts', 'b.ts']);
    // Zero-padded strings remain strings (coerceValue preserves them).
    assert.equal(result.padded, '001');
  });

  it('blocks __proto__ / constructor / prototype keys', async () => {
    const { parseSetFlags } = await import('../lib/input');
    const result = parseSetFlags([
      '__proto__=polluted',
      'constructor=bad',
      'prototype=bad',
      'safe=yes',
    ]);
    assert.equal(result.safe, 'yes');
    assert.ok(!Object.prototype.hasOwnProperty.call(result, '__proto__'));
    assert.ok(!Object.prototype.hasOwnProperty.call(result, 'constructor'));
    assert.ok(!Object.prototype.hasOwnProperty.call(result, 'prototype'));
  });
});
