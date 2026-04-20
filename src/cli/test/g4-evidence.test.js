/**
 * G4 Evidence integration test.
 *
 * Drives the task-level evidence command surface:
 *
 *   geas evidence append --mission --task --agent --slot   (stdin: entry)
 *   geas self-check set  --mission --task                  (stdin: body)
 *   geas gate run        --mission --task                  (stdin: tier_results)
 *   geas deliberation append --mission --level … --task …  (stdin: entry)
 *
 * and the transition-guard tightening that consumes their artifacts:
 *
 *   implementing -> reviewed   : self-check schema-valid + each required
 *                                reviewer slot has a review-kind entry.
 *   reviewed     -> verified   : gate-results last run verdict=pass with
 *                                tier_2.status=pass.
 *   verified     -> passed     : orchestrator closure evidence with
 *                                verdict=approved and the file validates
 *                                against the evidence schema.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeTempRoot, runCli, readArtifact } = require('./helpers/setup');

const MID_STANDARD = 'mission-20260420-g4evsdmn';
const MID_FULL = 'mission-20260420-g4evfull';

function baseSpec(overrides = {}) {
  return {
    name: 'G4 evidence test',
    description: 'evidence, self-check, gate, deliberation lifecycle',
    mode: 'standard',
    definition_of_done: 'evidence command surface behaves per protocol 03',
    scope: {
      in: ['evidence command surface'],
      out: ['memory command surface (G5)'],
    },
    acceptance_criteria: [
      'evidence append writes entries with CLI-assigned ids',
      'self-check set rejects overwrite',
      'gate run produces pass/fail/block per tier aggregation',
      'deliberation rejected outside full_depth',
    ],
    constraints: ['no writes to .geas/ outside the CLI'],
    affected_surfaces: ['src/cli/src/commands/evidence.ts'],
    risks: ['evidence schema drift produces silent guard failures'],
    ...overrides,
  };
}

function baseContract(overrides = {}) {
  return {
    title: 'G4 task',
    goal: 'exercise the evidence / self-check / gate / deliberation commands',
    risk_level: 'normal',
    acceptance_criteria: ['every artifact writes atomically'],
    verification_plan: 'manual via the integration test',
    surfaces: ['src/cli/src/commands/evidence.ts'],
    routing: {
      primary_worker_type: 'software-engineer',
      required_reviewers: ['challenger'],
    },
    base_snapshot: 'synthetic-base',
    dependencies: [],
    supersedes: null,
    ...overrides,
  };
}

function setupMission(dir, missionId, specOverrides = {}) {
  let r = runCli(['setup'], { cwd: dir });
  assert.equal(r.status, 0, `setup failed: ${r.stderr}`);
  r = runCli(['mission', 'create'], {
    cwd: dir,
    input: JSON.stringify(baseSpec(specOverrides)),
    env: { GEAS_MOCK_MISSION_ID: missionId },
  });
  assert.equal(r.status, 0, `mission create failed: ${r.stderr}`);
  r = runCli(['mission', 'approve', '--mission', missionId], { cwd: dir });
  assert.equal(r.status, 0, `mission approve failed: ${r.stderr}`);
}

function draftTaskReady(dir, missionId, taskId, contractOverrides = {}) {
  let r = runCli(['task', 'draft', '--mission', missionId], {
    cwd: dir,
    input: JSON.stringify(baseContract(contractOverrides)),
    env: { GEAS_MOCK_TASK_ID: taskId },
  });
  assert.equal(r.status, 0, `task draft failed: ${r.stderr}`);
  r = runCli(['task', 'approve', '--mission', missionId, '--task', taskId], {
    cwd: dir,
  });
  assert.equal(r.status, 0, `task approve failed: ${r.stderr}`);
  r = runCli(
    ['task', 'transition', '--mission', missionId, '--task', taskId, '--to', 'implementing'],
    { cwd: dir },
  );
  assert.equal(r.status, 0, `ready->implementing failed: ${r.stderr}`);
}

function validReviewEntry(overrides = {}) {
  return {
    evidence_kind: 'review',
    summary: 'reviewed the implementation',
    verdict: 'approved',
    concerns: [],
    rationale: 'meets all acceptance criteria',
    scope_examined: 'all changed files',
    methods_used: ['code read-through'],
    scope_excluded: [],
    ...overrides,
  };
}

function validImplementationEntry() {
  return {
    evidence_kind: 'implementation',
    summary: 'implemented the feature',
  };
}

function validSelfCheck() {
  return {
    completed_work: 'landed the target change on the surfaces listed',
    reviewer_focus: [],
    known_risks: [],
    deviations_from_plan: [],
    gap_signals: [],
  };
}

function validClosureEntry(overrides = {}) {
  return {
    evidence_kind: 'closure',
    summary: 'task closure by orchestrator',
    verdict: 'approved',
    rationale: 'all reviewers approved and gate passed',
    what_went_well: [],
    what_broke: [],
    what_was_surprising: [],
    next_time_guidance: [],
    ...overrides,
  };
}

// ── evidence append ─────────────────────────────────────────────────────

test('evidence append assigns entry_id sequentially from 1', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID_STANDARD);
    draftTaskReady(dir, MID_STANDARD, 'task-001');

    let r = runCli(
      [
        'evidence',
        'append',
        '--mission',
        MID_STANDARD,
        '--task',
        'task-001',
        '--agent',
        'software-engineer',
        '--slot',
        'implementer',
      ],
      { cwd: dir, input: JSON.stringify(validImplementationEntry()) },
    );
    assert.equal(r.status, 0, `first evidence append failed: ${r.stderr}\n${r.stdout}`);
    assert.equal(r.json.data.ids.entry_id, 1);

    r = runCli(
      [
        'evidence',
        'append',
        '--mission',
        MID_STANDARD,
        '--task',
        'task-001',
        '--agent',
        'software-engineer',
        '--slot',
        'implementer',
      ],
      { cwd: dir, input: JSON.stringify(validImplementationEntry()) },
    );
    assert.equal(r.status, 0, `second evidence append failed: ${r.stderr}`);
    assert.equal(r.json.data.ids.entry_id, 2);

    const file = readArtifact(
      dir,
      `.geas/missions/${MID_STANDARD}/tasks/task-001/evidence/software-engineer.implementer.json`,
    );
    assert.equal(file.entries.length, 2);
    assert.equal(file.entries[0].entry_id, 1);
    assert.equal(file.entries[1].entry_id, 2);
  } finally {
    cleanup();
  }
});

test('evidence append strips client-provided entry_id and created_at', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID_STANDARD);
    draftTaskReady(dir, MID_STANDARD, 'task-001');
    const entry = {
      ...validImplementationEntry(),
      entry_id: 999,
      created_at: '1970-01-01T00:00:00Z',
    };
    const r = runCli(
      [
        'evidence',
        'append',
        '--mission',
        MID_STANDARD,
        '--task',
        'task-001',
        '--agent',
        'software-engineer',
        '--slot',
        'implementer',
      ],
      { cwd: dir, input: JSON.stringify(entry) },
    );
    assert.equal(r.status, 0);
    assert.equal(r.json.data.ids.entry_id, 1, 'CLI overrides client entry_id');
    const file = readArtifact(
      dir,
      `.geas/missions/${MID_STANDARD}/tasks/task-001/evidence/software-engineer.implementer.json`,
    );
    assert.notEqual(
      file.entries[0].created_at,
      '1970-01-01T00:00:00Z',
      'CLI overrides client created_at',
    );
  } finally {
    cleanup();
  }
});

test('evidence append rejects implementer + other slot for same agent', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID_STANDARD);
    draftTaskReady(dir, MID_STANDARD, 'task-001');
    // software-engineer becomes the implementer.
    let r = runCli(
      [
        'evidence',
        'append',
        '--mission',
        MID_STANDARD,
        '--task',
        'task-001',
        '--agent',
        'software-engineer',
        '--slot',
        'implementer',
      ],
      { cwd: dir, input: JSON.stringify(validImplementationEntry()) },
    );
    assert.equal(r.status, 0);

    // Same agent cannot also take challenger on this task.
    r = runCli(
      [
        'evidence',
        'append',
        '--mission',
        MID_STANDARD,
        '--task',
        'task-001',
        '--agent',
        'software-engineer',
        '--slot',
        'challenger',
      ],
      { cwd: dir, input: JSON.stringify(validReviewEntry()) },
    );
    assert.notEqual(r.status, 0);
    assert.equal(r.json.error.code, 'guard_failed');
    assert.match(r.json.error.message, /implementer/);
  } finally {
    cleanup();
  }
});

test('evidence append allows one agent across two reviewer slots', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID_STANDARD);
    // Required reviewers include two slots the same reviewer can cover.
    draftTaskReady(dir, MID_STANDARD, 'task-001', {
      routing: {
        primary_worker_type: 'software-engineer',
        required_reviewers: ['risk-assessor', 'operator'],
      },
    });
    // Implementer evidence first, but from a DIFFERENT concrete agent.
    let r = runCli(
      [
        'evidence',
        'append',
        '--mission',
        MID_STANDARD,
        '--task',
        'task-001',
        '--agent',
        'software-engineer',
        '--slot',
        'implementer',
      ],
      { cwd: dir, input: JSON.stringify(validImplementationEntry()) },
    );
    assert.equal(r.status, 0);

    // security-engineer covers both risk-assessor and operator.
    r = runCli(
      [
        'evidence',
        'append',
        '--mission',
        MID_STANDARD,
        '--task',
        'task-001',
        '--agent',
        'security-engineer',
        '--slot',
        'risk-assessor',
      ],
      { cwd: dir, input: JSON.stringify(validReviewEntry()) },
    );
    assert.equal(r.status, 0, `risk-assessor append failed: ${r.stderr}\n${r.stdout}`);

    r = runCli(
      [
        'evidence',
        'append',
        '--mission',
        MID_STANDARD,
        '--task',
        'task-001',
        '--agent',
        'security-engineer',
        '--slot',
        'operator',
      ],
      { cwd: dir, input: JSON.stringify(validReviewEntry()) },
    );
    assert.equal(r.status, 0, `operator append failed: ${r.stderr}\n${r.stdout}`);
  } finally {
    cleanup();
  }
});

test('evidence append rejects unknown slot', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID_STANDARD);
    draftTaskReady(dir, MID_STANDARD, 'task-001');
    const r = runCli(
      [
        'evidence',
        'append',
        '--mission',
        MID_STANDARD,
        '--task',
        'task-001',
        '--agent',
        'software-engineer',
        '--slot',
        'wrangler',
      ],
      { cwd: dir, input: JSON.stringify(validImplementationEntry()) },
    );
    assert.notEqual(r.status, 0);
    assert.equal(r.json.error.code, 'invalid_argument');
  } finally {
    cleanup();
  }
});

test('evidence append infers implementer agent from contract primary_worker_type', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID_STANDARD);
    draftTaskReady(dir, MID_STANDARD, 'task-001');
    const r = runCli(
      [
        'evidence',
        'append',
        '--mission',
        MID_STANDARD,
        '--task',
        'task-001',
        '--slot',
        'implementer',
      ],
      { cwd: dir, input: JSON.stringify(validImplementationEntry()) },
    );
    assert.equal(r.status, 0, `implementer append w/o --agent failed: ${r.stderr}`);
    assert.equal(r.json.data.agent, 'software-engineer');
  } finally {
    cleanup();
  }
});

// ── self-check set ──────────────────────────────────────────────────────

test('self-check set writes once; second call rejected', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID_STANDARD);
    draftTaskReady(dir, MID_STANDARD, 'task-001');

    let r = runCli(
      ['self-check', 'set', '--mission', MID_STANDARD, '--task', 'task-001'],
      { cwd: dir, input: JSON.stringify(validSelfCheck()) },
    );
    assert.equal(r.status, 0, `self-check set failed: ${r.stderr}`);

    r = runCli(
      ['self-check', 'set', '--mission', MID_STANDARD, '--task', 'task-001'],
      { cwd: dir, input: JSON.stringify(validSelfCheck()) },
    );
    assert.notEqual(r.status, 0);
    assert.equal(r.json.error.code, 'path_collision');
  } finally {
    cleanup();
  }
});

test('self-check set rejects schema-invalid body', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID_STANDARD);
    draftTaskReady(dir, MID_STANDARD, 'task-001');

    const r = runCli(
      ['self-check', 'set', '--mission', MID_STANDARD, '--task', 'task-001'],
      { cwd: dir, input: JSON.stringify({ completed_work: '' }) },
    );
    assert.notEqual(r.status, 0);
    assert.equal(r.json.error.code, 'schema_validation_failed');
  } finally {
    cleanup();
  }
});

// ── gate run + verdict-aware transitions ─────────────────────────────────

test('gate run aggregates overall verdict from tier statuses', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID_STANDARD);
    draftTaskReady(dir, MID_STANDARD, 'task-001');

    let r = runCli(
      ['gate', 'run', '--mission', MID_STANDARD, '--task', 'task-001'],
      {
        cwd: dir,
        input: JSON.stringify({
          tier_results: {
            tier_0: { status: 'pass', details: 'all present' },
            tier_1: { status: 'pass', details: 'plan ran clean' },
            tier_2: { status: 'pass', details: 'all reviewers approved' },
          },
        }),
      },
    );
    assert.equal(r.status, 0, `gate run failed: ${r.stderr}`);
    assert.equal(r.json.data.verdict, 'pass');
    assert.equal(r.json.data.suggested_next_transition.target_state, 'verified');

    // changes_requested in tier 2 → fail
    r = runCli(
      ['gate', 'run', '--mission', MID_STANDARD, '--task', 'task-001'],
      {
        cwd: dir,
        input: JSON.stringify({
          tier_results: {
            tier_0: { status: 'pass', details: 'all present' },
            tier_1: { status: 'pass', details: 'plan ran clean' },
            tier_2: { status: 'fail', details: 'risk-assessor changes_requested' },
          },
        }),
      },
    );
    assert.equal(r.status, 0);
    assert.equal(r.json.data.verdict, 'fail');
    assert.equal(r.json.data.suggested_next_transition.target_state, null);

    // any block → block
    r = runCli(
      ['gate', 'run', '--mission', MID_STANDARD, '--task', 'task-001'],
      {
        cwd: dir,
        input: JSON.stringify({
          tier_results: {
            tier_0: { status: 'pass', details: 'all present' },
            tier_1: { status: 'pass', details: 'plan ran clean' },
            tier_2: { status: 'block', details: 'challenger blocked' },
          },
        }),
      },
    );
    assert.equal(r.status, 0);
    assert.equal(r.json.data.verdict, 'block');
    assert.equal(r.json.data.suggested_next_transition.target_state, 'blocked');

    const file = readArtifact(
      dir,
      `.geas/missions/${MID_STANDARD}/tasks/task-001/gate-results.json`,
    );
    assert.equal(file.runs.length, 3);
    assert.deepEqual(
      file.runs.map((r) => r.gate_run_id),
      ['gate-1', 'gate-2', 'gate-3'],
    );
  } finally {
    cleanup();
  }
});

test('implementing -> reviewed requires schema-valid self-check (G4 tightening)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID_STANDARD);
    draftTaskReady(dir, MID_STANDARD, 'task-001');

    // Manually write a schema-invalid self-check.json bypassing CLI.
    const scPath = path.join(
      dir,
      '.geas',
      'missions',
      MID_STANDARD,
      'tasks',
      'task-001',
      'self-check.json',
    );
    fs.writeFileSync(scPath, JSON.stringify({ bogus: true }, null, 2));

    // Add a review entry so only self-check is the missing guard.
    let r = runCli(
      [
        'evidence',
        'append',
        '--mission',
        MID_STANDARD,
        '--task',
        'task-001',
        '--agent',
        'challenger-a',
        '--slot',
        'challenger',
      ],
      { cwd: dir, input: JSON.stringify(validReviewEntry()) },
    );
    assert.equal(r.status, 0);

    r = runCli(
      ['task', 'transition', '--mission', MID_STANDARD, '--task', 'task-001', '--to', 'reviewed'],
      { cwd: dir },
    );
    assert.notEqual(r.status, 0);
    assert.equal(r.json.error.code, 'guard_failed');
    assert.match(r.json.error.message, /self-check/);
  } finally {
    cleanup();
  }
});

test('implementing -> reviewed requires review-kind entry, not just a file', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID_STANDARD);
    draftTaskReady(dir, MID_STANDARD, 'task-001');

    // Valid self-check via CLI.
    let r = runCli(
      ['self-check', 'set', '--mission', MID_STANDARD, '--task', 'task-001'],
      { cwd: dir, input: JSON.stringify(validSelfCheck()) },
    );
    assert.equal(r.status, 0);

    // Write a challenger evidence file that has entries but none are
    // review-kind (evidence_kind=implementation). Direct file write.
    const evDir = path.join(
      dir,
      '.geas',
      'missions',
      MID_STANDARD,
      'tasks',
      'task-001',
      'evidence',
    );
    fs.mkdirSync(evDir, { recursive: true });
    fs.writeFileSync(
      path.join(evDir, 'challenger-a.challenger.json'),
      JSON.stringify(
        {
          mission_id: MID_STANDARD,
          task_id: 'task-001',
          agent: 'challenger-a',
          slot: 'challenger',
          entries: [
            {
              entry_id: 1,
              evidence_kind: 'implementation',
              summary: 'stub',
              artifacts: [],
              memory_suggestions: [],
              debt_candidates: [],
              gap_signals: [],
              revision_ref: null,
              created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
            },
          ],
          created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
          updated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        },
        null,
        2,
      ),
    );

    r = runCli(
      ['task', 'transition', '--mission', MID_STANDARD, '--task', 'task-001', '--to', 'reviewed'],
      { cwd: dir },
    );
    assert.notEqual(r.status, 0);
    assert.equal(r.json.error.code, 'guard_failed');
    assert.deepEqual(r.json.error.hints.missing_review_slots, ['challenger']);
  } finally {
    cleanup();
  }
});

test('reviewed -> verified requires gate-results last run verdict=pass (G4 tightening)', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID_STANDARD);
    draftTaskReady(dir, MID_STANDARD, 'task-001');

    // Get to reviewed.
    let r = runCli(
      ['self-check', 'set', '--mission', MID_STANDARD, '--task', 'task-001'],
      { cwd: dir, input: JSON.stringify(validSelfCheck()) },
    );
    assert.equal(r.status, 0);
    r = runCli(
      [
        'evidence',
        'append',
        '--mission',
        MID_STANDARD,
        '--task',
        'task-001',
        '--agent',
        'challenger-a',
        '--slot',
        'challenger',
      ],
      { cwd: dir, input: JSON.stringify(validReviewEntry()) },
    );
    assert.equal(r.status, 0);
    r = runCli(
      ['task', 'transition', '--mission', MID_STANDARD, '--task', 'task-001', '--to', 'reviewed'],
      { cwd: dir },
    );
    assert.equal(r.status, 0);

    // Gate run with fail verdict — should not satisfy reviewed -> verified.
    r = runCli(['gate', 'run', '--mission', MID_STANDARD, '--task', 'task-001'], {
      cwd: dir,
      input: JSON.stringify({
        tier_results: {
          tier_0: { status: 'pass', details: 'ok' },
          tier_1: { status: 'pass', details: 'ok' },
          tier_2: { status: 'fail', details: 'changes_requested' },
        },
      }),
    });
    assert.equal(r.status, 0);
    assert.equal(r.json.data.verdict, 'fail');

    r = runCli(
      ['task', 'transition', '--mission', MID_STANDARD, '--task', 'task-001', '--to', 'verified'],
      { cwd: dir },
    );
    assert.notEqual(r.status, 0);
    assert.equal(r.json.error.code, 'guard_failed');
    assert.match(r.json.error.message, /verdict=pass/);

    // Now a passing gate run — should go through.
    r = runCli(['gate', 'run', '--mission', MID_STANDARD, '--task', 'task-001'], {
      cwd: dir,
      input: JSON.stringify({
        tier_results: {
          tier_0: { status: 'pass', details: 'ok' },
          tier_1: { status: 'pass', details: 'ok' },
          tier_2: { status: 'pass', details: 'all approved' },
        },
      }),
    });
    assert.equal(r.status, 0);
    r = runCli(
      ['task', 'transition', '--mission', MID_STANDARD, '--task', 'task-001', '--to', 'verified'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `verified transition failed: ${r.stderr}\n${r.stdout}`);
  } finally {
    cleanup();
  }
});

test('verified -> passed requires approved closure evidence validating the schema', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID_STANDARD);
    draftTaskReady(dir, MID_STANDARD, 'task-001');

    let r = runCli(
      ['self-check', 'set', '--mission', MID_STANDARD, '--task', 'task-001'],
      { cwd: dir, input: JSON.stringify(validSelfCheck()) },
    );
    assert.equal(r.status, 0);
    r = runCli(
      [
        'evidence',
        'append',
        '--mission',
        MID_STANDARD,
        '--task',
        'task-001',
        '--agent',
        'challenger-a',
        '--slot',
        'challenger',
      ],
      { cwd: dir, input: JSON.stringify(validReviewEntry()) },
    );
    assert.equal(r.status, 0);
    r = runCli(
      ['task', 'transition', '--mission', MID_STANDARD, '--task', 'task-001', '--to', 'reviewed'],
      { cwd: dir },
    );
    assert.equal(r.status, 0);
    r = runCli(['gate', 'run', '--mission', MID_STANDARD, '--task', 'task-001'], {
      cwd: dir,
      input: JSON.stringify({
        tier_results: {
          tier_0: { status: 'pass', details: 'ok' },
          tier_1: { status: 'pass', details: 'ok' },
          tier_2: { status: 'pass', details: 'ok' },
        },
      }),
    });
    assert.equal(r.status, 0);
    r = runCli(
      ['task', 'transition', '--mission', MID_STANDARD, '--task', 'task-001', '--to', 'verified'],
      { cwd: dir },
    );
    assert.equal(r.status, 0);

    // No closure yet — verified -> passed should fail.
    r = runCli(
      ['task', 'transition', '--mission', MID_STANDARD, '--task', 'task-001', '--to', 'passed'],
      { cwd: dir },
    );
    assert.notEqual(r.status, 0);
    assert.equal(r.json.error.code, 'guard_failed');
    assert.match(r.json.error.message, /closure/);

    // Append closure evidence via CLI.
    r = runCli(
      [
        'evidence',
        'append',
        '--mission',
        MID_STANDARD,
        '--task',
        'task-001',
        '--agent',
        'orchestrator',
        '--slot',
        'orchestrator',
      ],
      { cwd: dir, input: JSON.stringify(validClosureEntry()) },
    );
    assert.equal(r.status, 0, `closure append failed: ${r.stderr}`);

    r = runCli(
      ['task', 'transition', '--mission', MID_STANDARD, '--task', 'task-001', '--to', 'passed'],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `verified->passed failed: ${r.stderr}\n${r.stdout}`);
  } finally {
    cleanup();
  }
});

// ── deliberation mode gate ──────────────────────────────────────────────

test('deliberation rejected when mission mode is not full_depth', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID_STANDARD); // mode = standard
    draftTaskReady(dir, MID_STANDARD, 'task-001');

    const entry = {
      proposal_summary: 'should we escalate?',
      votes: [
        { voter: 'challenger', vote: 'agree', rationale: 'yes' },
        { voter: 'decision-maker', vote: 'agree', rationale: 'yes' },
      ],
      result: 'agree',
    };
    const r = runCli(
      [
        'deliberation',
        'append',
        '--mission',
        MID_STANDARD,
        '--level',
        'task',
        '--task',
        'task-001',
      ],
      { cwd: dir, input: JSON.stringify(entry) },
    );
    assert.notEqual(r.status, 0);
    assert.equal(r.json.error.code, 'guard_failed');
    assert.match(r.json.error.message, /full_depth/);
  } finally {
    cleanup();
  }
});

test('deliberation accepted when mission mode is full_depth', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID_FULL, { mode: 'full_depth' });
    draftTaskReady(dir, MID_FULL, 'task-001');

    const entry = {
      proposal_summary: 'should the task enter verified now?',
      votes: [
        { voter: 'challenger', vote: 'agree', rationale: 'all concerns addressed' },
        { voter: 'risk-assessor', vote: 'agree', rationale: 'risk is mitigated' },
        { voter: 'operator', vote: 'agree', rationale: 'ops plan is clear' },
      ],
      result: 'agree',
    };
    const r = runCli(
      [
        'deliberation',
        'append',
        '--mission',
        MID_FULL,
        '--level',
        'task',
        '--task',
        'task-001',
      ],
      { cwd: dir, input: JSON.stringify(entry) },
    );
    assert.equal(r.status, 0, `deliberation append failed: ${r.stderr}\n${r.stdout}`);
    assert.equal(r.json.data.result, 'agree');

    const file = readArtifact(
      dir,
      `.geas/missions/${MID_FULL}/tasks/task-001/deliberations.json`,
    );
    assert.equal(file.level, 'task');
    assert.equal(file.entries.length, 1);
  } finally {
    cleanup();
  }
});

test('deliberation result must match vote aggregation rule', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID_FULL, { mode: 'full_depth' });
    draftTaskReady(dir, MID_FULL, 'task-001');

    // Votes majority-agree but result=disagree → guard fail.
    const entry = {
      proposal_summary: 'p',
      votes: [
        { voter: 'challenger', vote: 'agree', rationale: 'r' },
        { voter: 'decision-maker', vote: 'agree', rationale: 'r' },
        { voter: 'operator', vote: 'disagree', rationale: 'r' },
      ],
      result: 'disagree',
    };
    const r = runCli(
      [
        'deliberation',
        'append',
        '--mission',
        MID_FULL,
        '--level',
        'task',
        '--task',
        'task-001',
      ],
      { cwd: dir, input: JSON.stringify(entry) },
    );
    assert.notEqual(r.status, 0);
    assert.equal(r.json.error.code, 'guard_failed');
    assert.match(r.json.error.message, /aggregation/);
  } finally {
    cleanup();
  }
});

test('deliberation with any escalate vote forces result=escalate', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID_FULL, { mode: 'full_depth' });
    draftTaskReady(dir, MID_FULL, 'task-001');

    const entry = {
      proposal_summary: 'p',
      votes: [
        { voter: 'challenger', vote: 'agree', rationale: 'r' },
        { voter: 'decision-maker', vote: 'escalate', rationale: 'r' },
      ],
      result: 'escalate',
    };
    const r = runCli(
      [
        'deliberation',
        'append',
        '--mission',
        MID_FULL,
        '--level',
        'task',
        '--task',
        'task-001',
      ],
      { cwd: dir, input: JSON.stringify(entry) },
    );
    assert.equal(r.status, 0, `escalate deliberation failed: ${r.stderr}\n${r.stdout}`);
    assert.equal(r.json.data.result, 'escalate');
  } finally {
    cleanup();
  }
});
