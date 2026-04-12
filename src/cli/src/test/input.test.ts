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

describe('parseSetFlags (dot-path nesting)', () => {
  it('2-level nesting: a.b=v', async () => {
    const { parseSetFlags } = await import('../lib/input');
    const result = parseSetFlags(['a.b=hello']);
    assert.deepEqual(result, { a: { b: 'hello' } });
  });

  it('3-level nesting: a.b.c=v', async () => {
    const { parseSetFlags } = await import('../lib/input');
    const result = parseSetFlags(['a.b.c=42']);
    assert.deepEqual(result, { a: { b: { c: 42 } } });
  });

  it('mixed dot-bracket: a.b[0].c=v', async () => {
    const { parseSetFlags } = await import('../lib/input');
    const result = parseSetFlags(['a.b[0].c=val']);
    // a.b is an array, b[0] is an object with key c
    const a = result.a as Record<string, unknown>;
    const b = a.b as unknown[];
    assert.ok(Array.isArray(b));
    const elem = b[0] as Record<string, unknown>;
    assert.equal(elem.c, 'val');
  });

  it('prototype pollution at nested segments: a.__proto__.b=v is skipped', async () => {
    const { parseSetFlags } = await import('../lib/input');
    const result = parseSetFlags(['a.__proto__.b=polluted', 'safe=yes']);
    assert.equal(result.safe, 'yes');
    // The entire key should be skipped
    assert.ok(!Object.prototype.hasOwnProperty.call(result, 'a'));
  });

  it('prototype pollution: a.constructor=v is skipped', async () => {
    const { parseSetFlags } = await import('../lib/input');
    const result = parseSetFlags(['a.constructor=bad']);
    assert.ok(!Object.prototype.hasOwnProperty.call(result, 'a'));
  });

  it('empty segment rejection: a..b=v throws', async () => {
    const { parseSetFlags } = await import('../lib/input');
    assert.throws(
      () => parseSetFlags(['a..b=val']),
      /empty segment/i,
    );
  });

  it('empty segment rejection: leading dot .a=v throws', async () => {
    const { parseSetFlags } = await import('../lib/input');
    assert.throws(
      () => parseSetFlags(['.a=val']),
      /empty segment/i,
    );
  });

  it('empty segment rejection: trailing dot a.=v throws', async () => {
    const { parseSetFlags } = await import('../lib/input');
    assert.throws(
      () => parseSetFlags(['a.=val']),
      /empty segment/i,
    );
  });

  it('max depth rejection: 11 segments throws', async () => {
    const { parseSetFlags } = await import('../lib/input');
    const key = 'a.b.c.d.e.f.g.h.i.j.k=val'; // 11 segments
    assert.throws(
      () => parseSetFlags([key]),
      /maximum depth/i,
    );
  });

  it('exactly 10 segments succeeds (boundary)', async () => {
    const { parseSetFlags } = await import('../lib/input');
    const key = 'a.b.c.d.e.f.g.h.i.j=val'; // 10 segments
    const result = parseSetFlags([key]);
    // Verify we can reach the leaf
    let cur: any = result;
    for (const seg of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']) {
      cur = cur[seg];
      assert.ok(cur != null, `segment ${seg} should exist`);
    }
    assert.equal(cur.j, 'val');
  });

  it('backward-compat: flat keys still work', async () => {
    const { parseSetFlags } = await import('../lib/input');
    const result = parseSetFlags(['summary=hello', 'confidence=4']);
    assert.equal(result.summary, 'hello');
    assert.equal(result.confidence, 4);
  });

  it('backward-compat: bracket arrays still work', async () => {
    const { parseSetFlags } = await import('../lib/input');
    const result = parseSetFlags(['files[0]=a.ts', 'files[1]=b.ts']);
    assert.deepEqual(result.files, ['a.ts', 'b.ts']);
  });

  it('multiple nested keys merge correctly', async () => {
    const { parseSetFlags } = await import('../lib/input');
    const result = parseSetFlags([
      'self_check.confidence=4',
      'self_check.known_risks[0]=none',
      'summary=done',
    ]);
    const sc = result.self_check as Record<string, unknown>;
    assert.equal(sc.confidence, 4);
    assert.deepEqual(sc.known_risks, ['none']);
    assert.equal(result.summary, 'done');
  });

  it('sparse arrays: a[2]=v creates sparse array', async () => {
    const { parseSetFlags } = await import('../lib/input');
    const result = parseSetFlags(['a[2]=val']);
    const arr = result.a as unknown[];
    assert.ok(Array.isArray(arr));
    assert.equal(arr.length, 3);
    assert.equal(arr[2], 'val');
  });
});

describe('deepMergeSetOverrides', () => {
  it('merges nested objects without clobbering siblings', async () => {
    const { deepMergeSetOverrides } = await import('../lib/input');
    const base = { a: { x: 1, y: 2 }, b: 'keep' };
    const overrides = { a: { z: 3 } };
    const result = deepMergeSetOverrides(
      base as Record<string, unknown>,
      overrides as Record<string, unknown>,
    );
    assert.deepEqual(result, { a: { x: 1, y: 2, z: 3 }, b: 'keep' });
  });

  it('overrides scalars win over base scalars', async () => {
    const { deepMergeSetOverrides } = await import('../lib/input');
    const base = { a: 1, b: 'old' };
    const overrides = { a: 2, b: 'new' };
    const result = deepMergeSetOverrides(base as any, overrides as any);
    assert.equal(result.a, 2);
    assert.equal(result.b, 'new');
  });

  it('arrays in overrides replace arrays in base', async () => {
    const { deepMergeSetOverrides } = await import('../lib/input');
    const base = { items: [1, 2, 3] };
    const overrides = { items: [4, 5] };
    const result = deepMergeSetOverrides(base as any, overrides as any);
    assert.deepEqual(result.items, [4, 5]);
  });

  it('override object replaces base scalar', async () => {
    const { deepMergeSetOverrides } = await import('../lib/input');
    const base = { a: 'was string' };
    const overrides = { a: { nested: true } };
    const result = deepMergeSetOverrides(base as any, overrides as any);
    assert.deepEqual(result.a, { nested: true });
  });
});
