/**
 * G5 Memory integration test.
 *
 * Exercises the two memory markdown writers described in CLI.md §14.8:
 *
 *   geas memory shared-set                       (stdin: full markdown)
 *   geas memory agent-set --agent <agent_type>   (stdin: full markdown)
 *
 * Both commands are full-replace, atomic, schema-less writes to
 * `.geas/memory/shared.md` and `.geas/memory/agents/{agent_type}.md`.
 * Protocol 06 constrains `--agent` to a concrete agent type; protocol
 * slot ids are rejected.
 *
 * The test also confirms read-only commands (`geas context`) still
 * succeed after a memory write, i.e. memory writes do not leak state
 * that destabilises other commands.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeTempRoot, runCli } = require('./helpers/setup');

// Every protocol slot id. `agent-set --agent <slot_id>` must reject each.
const SLOT_IDS = [
  'orchestrator',
  'decision-maker',
  'design-authority',
  'challenger',
  'implementer',
  'verifier',
  'risk-assessor',
  'operator',
  'communicator',
];

function bootstrap(dir) {
  const r = runCli(['setup'], { cwd: dir });
  assert.equal(r.status, 0, `setup failed: ${r.stderr}`);
}

function readFile(projectRoot, relPath) {
  return fs.readFileSync(path.join(projectRoot, relPath), 'utf-8');
}

test('memory shared-set writes stdin bytes verbatim to shared.md', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    bootstrap(dir);
    const body =
      '# Shared memory\n\n' +
      '## rule-001 — prefer atomic writes\n' +
      'Body paragraph with _markdown_ and a trailing newline.\n';
    const r = runCli(['memory', 'shared-set'], { cwd: dir, input: body });
    assert.equal(r.status, 0, `shared-set failed: ${r.stderr}`);
    assert.equal(r.json.ok, true, r.stdout);
    assert.equal(r.json.data.scope, 'shared');
    assert.match(r.json.data.path, /\.geas\/memory\/shared\.md$/);

    const onDisk = readFile(dir, '.geas/memory/shared.md');
    assert.equal(onDisk, body, 'on-disk content must match stdin byte-for-byte');
    assert.equal(r.json.data.bytes, Buffer.byteLength(body, 'utf-8'));
  } finally {
    cleanup();
  }
});

test('memory shared-set is full-replace (not patch): second call overwrites', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    bootstrap(dir);
    const first = '# first body\n\nline A\nline B\n';
    const second = '# second body\n\nonly this line\n';
    let r = runCli(['memory', 'shared-set'], { cwd: dir, input: first });
    assert.equal(r.status, 0, `first shared-set failed: ${r.stderr}`);
    assert.equal(readFile(dir, '.geas/memory/shared.md'), first);

    r = runCli(['memory', 'shared-set'], { cwd: dir, input: second });
    assert.equal(r.status, 0, `second shared-set failed: ${r.stderr}`);
    const onDisk = readFile(dir, '.geas/memory/shared.md');
    assert.equal(onDisk, second, 'second write must fully replace, not append');
    assert.equal(onDisk.includes('line A'), false);
    assert.equal(onDisk.includes('line B'), false);
  } finally {
    cleanup();
  }
});

test('memory agent-set writes to agents/{agent_type}.md', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    bootstrap(dir);
    const body =
      '# software-engineer memory\n\n' +
      '- tip: run the bundle before testing the CLI\n';
    const r = runCli(
      ['memory', 'agent-set', '--agent', 'software-engineer'],
      { cwd: dir, input: body },
    );
    assert.equal(r.status, 0, `agent-set failed: ${r.stderr}`);
    assert.equal(r.json.ok, true, r.stdout);
    assert.equal(r.json.data.scope, 'agent');
    assert.equal(r.json.data.agent, 'software-engineer');
    assert.match(
      r.json.data.path,
      /\.geas\/memory\/agents\/software-engineer\.md$/,
    );
    assert.equal(
      readFile(dir, '.geas/memory/agents/software-engineer.md'),
      body,
    );
  } finally {
    cleanup();
  }
});

test('memory agent-set rejects every protocol slot id', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    bootstrap(dir);
    for (const slotId of SLOT_IDS) {
      const r = runCli(
        ['memory', 'agent-set', '--agent', slotId],
        { cwd: dir, input: `# attempted ${slotId}\n` },
      );
      assert.equal(
        r.status,
        1,
        `agent-set with slot '${slotId}' should fail: ${r.stderr}`,
      );
      assert.equal(r.json.ok, false);
      assert.equal(r.json.error.code, 'invalid_argument');
      assert.match(
        r.json.error.message,
        /protocol slot/,
        `expected slot-id rejection message for '${slotId}'`,
      );
      assert.equal(
        fs.existsSync(path.join(dir, '.geas/memory/agents', `${slotId}.md`)),
        false,
        `no file should be created for rejected slot id '${slotId}'`,
      );
    }
  } finally {
    cleanup();
  }
});

test('memory agent-set creates agents/ directory if missing', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    bootstrap(dir);
    // setup creates the dir; remove it so we can observe re-creation.
    const agentsDir = path.join(dir, '.geas/memory/agents');
    fs.rmSync(agentsDir, { recursive: true, force: true });
    assert.equal(fs.existsSync(agentsDir), false);

    const r = runCli(
      ['memory', 'agent-set', '--agent', 'security-engineer'],
      { cwd: dir, input: '# security notes\n' },
    );
    assert.equal(r.status, 0, `agent-set failed: ${r.stderr}`);
    assert.equal(fs.existsSync(agentsDir), true);
    assert.equal(
      fs.existsSync(path.join(agentsDir, 'security-engineer.md')),
      true,
    );
  } finally {
    cleanup();
  }
});

test('memory shared-set rejects empty stdin', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    bootstrap(dir);
    const r = runCli(['memory', 'shared-set'], { cwd: dir, input: '' });
    assert.equal(r.status, 1);
    assert.equal(r.json.ok, false);
    assert.equal(r.json.error.code, 'invalid_argument');
    assert.match(r.json.error.message, /stdin/i);
  } finally {
    cleanup();
  }
});

test('memory agent-set rejects empty stdin', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    bootstrap(dir);
    const r = runCli(
      ['memory', 'agent-set', '--agent', 'software-engineer'],
      { cwd: dir, input: '' },
    );
    assert.equal(r.status, 1);
    assert.equal(r.json.ok, false);
    assert.equal(r.json.error.code, 'invalid_argument');
  } finally {
    cleanup();
  }
});

test('memory agent-set requires --agent flag', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    bootstrap(dir);
    const r = runCli(['memory', 'agent-set'], { cwd: dir, input: '# x\n' });
    // commander treats missing required option as an error (exit code 1)
    assert.notEqual(
      r.status,
      0,
      'agent-set without --agent must not succeed',
    );
  } finally {
    cleanup();
  }
});

test('memory agent-set rejects non-kebab-case agent identifiers', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    bootstrap(dir);
    const bad = ['Software-Engineer', 'software_engineer', 'software engineer', '-leading', '../traversal'];
    for (const id of bad) {
      const r = runCli(
        ['memory', 'agent-set', '--agent', id],
        { cwd: dir, input: '# x\n' },
      );
      assert.equal(
        r.status,
        1,
        `agent identifier '${id}' should be rejected: ${r.stderr}`,
      );
      assert.equal(r.json && r.json.ok, false);
      assert.equal(r.json.error.code, 'invalid_argument');
    }
  } finally {
    cleanup();
  }
});

test('memory shared-set preserves existing content when called again with new body', () => {
  // Sanity re-run: write A, read back, write B, read back. No bleed.
  const { dir, cleanup } = makeTempRoot();
  try {
    bootstrap(dir);
    const a = '# A\n\nentry-a\n';
    const b = '# B\n\nentry-b\n';
    let r = runCli(['memory', 'shared-set'], { cwd: dir, input: a });
    assert.equal(r.status, 0, `a-set failed: ${r.stderr}`);
    assert.equal(readFile(dir, '.geas/memory/shared.md'), a);
    r = runCli(['memory', 'shared-set'], { cwd: dir, input: b });
    assert.equal(r.status, 0, `b-set failed: ${r.stderr}`);
    assert.equal(readFile(dir, '.geas/memory/shared.md'), b);
  } finally {
    cleanup();
  }
});

test('memory writes do not break geas context read-back', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    bootstrap(dir);
    let r = runCli(
      ['memory', 'shared-set'],
      { cwd: dir, input: '# shared\n' },
    );
    assert.equal(r.status, 0, `shared-set failed: ${r.stderr}`);
    r = runCli(
      ['memory', 'agent-set', '--agent', 'software-engineer'],
      { cwd: dir, input: '# se\n' },
    );
    assert.equal(r.status, 0, `agent-set failed: ${r.stderr}`);

    const ctx = runCli(['context'], { cwd: dir });
    assert.equal(
      ctx.status,
      0,
      `geas context failed after memory writes: ${ctx.stderr}`,
    );
    assert.equal(ctx.json.ok, true, ctx.stdout);
  } finally {
    cleanup();
  }
});

test('memory writes append events to events.jsonl with cli:auto actor', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    bootstrap(dir);
    let r = runCli(
      ['memory', 'shared-set'],
      { cwd: dir, input: '# shared\n' },
    );
    assert.equal(r.status, 0, `shared-set failed: ${r.stderr}`);
    r = runCli(
      ['memory', 'agent-set', '--agent', 'software-engineer'],
      { cwd: dir, input: '# se\n' },
    );
    assert.equal(r.status, 0, `agent-set failed: ${r.stderr}`);

    const events = fs
      .readFileSync(path.join(dir, '.geas/events.jsonl'), 'utf-8')
      .split('\n')
      .filter((l) => l.length > 0)
      .map((l) => JSON.parse(l));

    const kinds = events.map((e) => e.kind);
    assert.ok(
      kinds.includes('memory_shared_set'),
      `expected memory_shared_set in events, got ${JSON.stringify(kinds)}`,
    );
    assert.ok(
      kinds.includes('memory_agent_set'),
      `expected memory_agent_set in events, got ${JSON.stringify(kinds)}`,
    );
    for (const ev of events.filter((e) => e.kind.startsWith('memory_'))) {
      assert.equal(ev.actor, 'cli:auto', 'memory events must be cli:auto');
      assert.ok(
        typeof ev.created_at === 'string' && ev.created_at.length > 0,
        'memory events must carry created_at',
      );
    }
  } finally {
    cleanup();
  }
});
