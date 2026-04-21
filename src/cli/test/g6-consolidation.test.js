/**
 * G6 Consolidation Scaffold integration test.
 *
 *   geas consolidation scaffold --mission <id>
 *
 * Contract summary (CLI.md §14.4 + §609, §625):
 *   - Walks every task's evidence/*.json under a mission.
 *   - Harvests debt_candidate, memory_suggestion, gap_signal fields.
 *   - Writes to .geas/missions/{mission_id}/consolidation/candidates.json
 *     (convenience cache, not a protocol artifact — NOT schema-validated).
 *   - Phase guard: polishing or consolidating only.
 *   - Full-replace on re-run (atomic overwrite).
 *   - Each harvested item carries source_task_id + source_evidence_entry_id.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeTempRoot, runCli, readArtifact } = require('./helpers/setup');

const MID = 'mission-20260420-g6consol';

function baseSpec(overrides = {}) {
  return {
    name: 'G6 consolidation scaffold test',
    description: 'scaffold harvest from task evidence into candidates cache',
    mode: 'standard',
    definition_of_done:
      'scaffold produces a candidates.json cache per mission',
    scope: {
      in: ['consolidation scaffold command'],
      out: ['other consolidation writers'],
    },
    acceptance_criteria: [
      'scaffold walks task evidence and harvests candidates',
    ],
    constraints: ['no writes outside the CLI'],
    affected_surfaces: ['src/cli/src/commands/consolidation.ts'],
    risks: ['silent harvest miss on malformed entries'],
    ...overrides,
  };
}

function baseContract(overrides = {}) {
  return {
    title: 'G6 consolidation task',
    goal: 'exercise scaffold harvest',
    risk_level: 'normal',
    acceptance_criteria: ['scaffold produces candidates'],
    verification_plan: 'manual via integration test',
    surfaces: ['src/cli/src/commands/consolidation.ts'],
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

function setupMission(dir, missionId) {
  let r = runCli(['setup'], { cwd: dir });
  assert.equal(r.status, 0, `setup failed: ${r.stderr}`);
  r = runCli(['mission', 'create'], {
    cwd: dir,
    input: JSON.stringify(baseSpec()),
    env: { GEAS_MOCK_MISSION_ID: missionId },
  });
  assert.equal(r.status, 0, `mission create failed: ${r.stderr}`);
  r = runCli(['mission', 'approve', '--mission', missionId], { cwd: dir });
  assert.equal(r.status, 0, `mission approve failed: ${r.stderr}`);
}

function draftTask(dir, missionId, taskId) {
  let r = runCli(['task', 'draft', '--mission', missionId], {
    cwd: dir,
    input: JSON.stringify(baseContract()),
    env: { GEAS_MOCK_TASK_ID: taskId },
  });
  assert.equal(r.status, 0, `task draft failed: ${r.stderr}`);
  r = runCli(['task', 'approve', '--mission', missionId, '--task', taskId], {
    cwd: dir,
  });
  assert.equal(r.status, 0, `task approve failed: ${r.stderr}`);
}

/**
 * Force a mission into a phase via low-level state set.
 * Bypasses phase guards — used only to exercise the scaffold command.
 */
function setPhase(dir, missionId, phase) {
  const r = runCli(['state', 'mission-set', '--mission', missionId], {
    cwd: dir,
    input: JSON.stringify({
      mission_id: missionId,
      phase,
      active_tasks: [],
    }),
  });
  assert.equal(r.status, 0, `state mission-set failed: ${r.stderr}`);
}

/**
 * Write an evidence file directly (bypasses CLI validation) with
 * synthetic entries that carry harvestable candidate fields. Scaffold
 * is tolerant of malformed entries, so this mirrors the real world
 * where evidence files land via `geas evidence append`.
 */
function writeEvidenceFile(dir, missionId, taskId, agent, slot, entries) {
  const base = path.join(
    dir,
    '.geas',
    'missions',
    missionId,
    'tasks',
    taskId,
    'evidence',
  );
  fs.mkdirSync(base, { recursive: true });
  const file = {
    mission_id: missionId,
    task_id: taskId,
    agent,
    slot,
    entries,
    created_at: '2026-04-20T00:00:00Z',
    updated_at: '2026-04-20T00:00:00Z',
  };
  fs.writeFileSync(
    path.join(base, `${agent}.${slot}.json`),
    JSON.stringify(file, null, 2),
  );
}

// ── guard tests ────────────────────────────────────────────────────────

test('consolidation scaffold rejects when mission missing', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    const r = runCli(['setup'], { cwd: dir });
    assert.equal(r.status, 0);
    const r2 = runCli(
      ['consolidation', 'scaffold', '--mission', 'mission-20260101-zzzzzzzz'],
      { cwd: dir },
    );
    assert.notEqual(r2.status, 0);
    assert.equal(r2.json.ok, false);
    assert.equal(r2.json.error.code, 'missing_artifact');
  } finally {
    cleanup();
  }
});

test('consolidation scaffold rejects when phase is specifying', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    // Mission is in `specifying` after setup+approve.
    const r = runCli(
      ['consolidation', 'scaffold', '--mission', MID],
      { cwd: dir },
    );
    assert.equal(r.status, 3, `expected guard_failed, got ${r.stderr}`);
    assert.equal(r.json.error.code, 'guard_failed');
    assert.match(r.json.error.message, /polishing or consolidating/);
  } finally {
    cleanup();
  }
});

test('consolidation scaffold rejects when phase is building', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    setPhase(dir, MID, 'building');
    const r = runCli(
      ['consolidation', 'scaffold', '--mission', MID],
      { cwd: dir },
    );
    assert.equal(r.status, 3);
    assert.equal(r.json.error.code, 'guard_failed');
  } finally {
    cleanup();
  }
});

// ── happy-path tests ───────────────────────────────────────────────────

test('consolidation scaffold writes empty buckets when no evidence has candidate fields', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    draftTask(dir, MID, 'task-001');
    setPhase(dir, MID, 'polishing');

    const r = runCli(
      ['consolidation', 'scaffold', '--mission', MID],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `scaffold failed: ${r.stderr}`);
    assert.equal(r.json.ok, true);
    assert.deepEqual(r.json.data.counts, {
      debt_candidates: 0,
      memory_suggestions: 0,
      gap_signals: 0,
    });
    assert.match(
      r.json.data.path,
      /consolidation\/candidates\.json$/,
    );

    const onDisk = readArtifact(
      dir,
      `.geas/missions/${MID}/consolidation/candidates.json`,
    );
    assert.equal(onDisk.mission_id, MID);
    assert.deepEqual(onDisk.debt_candidates, []);
    assert.deepEqual(onDisk.memory_suggestions, []);
    assert.deepEqual(onDisk.gap_signals, []);
    assert.ok(onDisk.created_at);
    assert.ok(onDisk.updated_at);
  } finally {
    cleanup();
  }
});

test('consolidation scaffold harvests debt_candidate / memory_suggestion / gap_signals across tasks', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    draftTask(dir, MID, 'task-001');
    draftTask(dir, MID, 'task-002');

    // task-001: one orchestrator closure-like entry with 2 debt candidates +
    // 1 memory suggestion.
    writeEvidenceFile(dir, MID, 'task-001', 'orchestrator', 'orchestrator', [
      {
        entry_id: 1,
        evidence_kind: 'closure',
        summary: 'closure one',
        artifacts: [],
        memory_suggestions: ['prefer atomic writes'],
        debt_candidates: [
          {
            title: 'thin coverage on retry',
            kind: 'verification_gap',
            severity: 'normal',
            summary: 'retry branches lack tests',
          },
          {
            title: 'docs missing for helper',
            kind: 'documentation',
            severity: 'low',
            summary: 'helper lacks JSDoc',
          },
        ],
        gap_signals: [
          { kind: 'under_delivery', summary: 'edge case X not handled' },
        ],
        revision_ref: null,
        verdict: 'approved',
        rationale: 'ok',
        what_went_well: [],
        what_broke: [],
        what_was_surprising: [],
        next_time_guidance: [],
        created_at: '2026-04-20T00:00:00Z',
      },
    ]);

    // task-002: one verification entry + one review entry, each with a
    // memory suggestion; no debt candidates.
    writeEvidenceFile(dir, MID, 'task-002', 'verifier', 'verifier', [
      {
        entry_id: 1,
        evidence_kind: 'verification',
        summary: 'verified',
        artifacts: [],
        memory_suggestions: ['use tier_results consistently'],
        debt_candidates: [],
        gap_signals: [
          { kind: 'learning_gain', summary: 'gate ordering clarified' },
        ],
        revision_ref: null,
        verdict: 'approved',
        rationale: 'pass',
        scope_examined: 'all artifacts',
        methods_used: ['gate'],
        scope_excluded: [],
        concerns: [],
        criteria_results: [],
        created_at: '2026-04-20T00:00:00Z',
      },
    ]);
    writeEvidenceFile(dir, MID, 'task-002', 'challenger', 'challenger', [
      {
        entry_id: 1,
        evidence_kind: 'review',
        summary: 'reviewed',
        artifacts: [],
        memory_suggestions: ['challenge edge cases early'],
        debt_candidates: [
          {
            title: 'logging inconsistent',
            kind: 'output_quality',
            severity: 'normal',
            summary: 'logs use mixed formats',
          },
        ],
        gap_signals: [],
        revision_ref: null,
        verdict: 'approved',
        rationale: 'looks good',
        scope_examined: 'changes',
        methods_used: ['manual'],
        scope_excluded: [],
        concerns: [],
        created_at: '2026-04-20T00:00:00Z',
      },
    ]);

    setPhase(dir, MID, 'consolidating');

    const r = runCli(
      ['consolidation', 'scaffold', '--mission', MID],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `scaffold failed: ${r.stderr}`);

    const onDisk = readArtifact(
      dir,
      `.geas/missions/${MID}/consolidation/candidates.json`,
    );

    assert.equal(onDisk.debt_candidates.length, 3);
    assert.equal(onDisk.memory_suggestions.length, 3);
    assert.equal(onDisk.gap_signals.length, 2);

    // Source traceability: each item carries source_task_id and
    // source_evidence_entry_id.
    for (const bucket of [
      onDisk.debt_candidates,
      onDisk.memory_suggestions,
      onDisk.gap_signals,
    ]) {
      for (const item of bucket) {
        assert.match(item.source_task_id, /^task-[0-9]{3}$/);
        assert.equal(typeof item.source_evidence_entry_id, 'number');
        assert.ok(item.source_evidence_entry_id >= 1);
      }
    }

    // task-001 contributes 2 debt candidates + 1 memory suggestion + 1 gap.
    const t001Debts = onDisk.debt_candidates.filter(
      (d) => d.source_task_id === 'task-001',
    );
    assert.equal(t001Debts.length, 2);
    const titles = t001Debts.map((d) => d.title).sort();
    assert.deepEqual(titles, ['docs missing for helper', 'thin coverage on retry']);

    // task-002 contributes 1 debt candidate + 2 memory suggestions + 1 gap.
    const t002Debts = onDisk.debt_candidates.filter(
      (d) => d.source_task_id === 'task-002',
    );
    assert.equal(t002Debts.length, 1);
    assert.equal(t002Debts[0].title, 'logging inconsistent');

    const t002Mems = onDisk.memory_suggestions.filter(
      (m) => m.source_task_id === 'task-002',
    );
    assert.equal(t002Mems.length, 2);
  } finally {
    cleanup();
  }
});

test('consolidation scaffold re-run fully overwrites the cache', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    draftTask(dir, MID, 'task-001');

    writeEvidenceFile(dir, MID, 'task-001', 'challenger', 'challenger', [
      {
        entry_id: 1,
        evidence_kind: 'review',
        summary: 'first pass',
        artifacts: [],
        memory_suggestions: ['lesson-A'],
        debt_candidates: [],
        gap_signals: [],
        revision_ref: null,
        verdict: 'approved',
        rationale: 'ok',
        scope_examined: 'x',
        methods_used: ['m'],
        scope_excluded: [],
        concerns: [],
        created_at: '2026-04-20T00:00:00Z',
      },
    ]);

    setPhase(dir, MID, 'polishing');

    let r = runCli(
      ['consolidation', 'scaffold', '--mission', MID],
      { cwd: dir },
    );
    assert.equal(r.status, 0, r.stderr);

    const first = readArtifact(
      dir,
      `.geas/missions/${MID}/consolidation/candidates.json`,
    );
    assert.equal(first.memory_suggestions.length, 1);
    assert.equal(first.memory_suggestions[0].suggestion, 'lesson-A');

    // Replace the evidence file with a different set of entries.
    writeEvidenceFile(dir, MID, 'task-001', 'challenger', 'challenger', [
      {
        entry_id: 1,
        evidence_kind: 'review',
        summary: 'second pass',
        artifacts: [],
        memory_suggestions: ['lesson-B', 'lesson-C'],
        debt_candidates: [],
        gap_signals: [],
        revision_ref: null,
        verdict: 'approved',
        rationale: 'ok',
        scope_examined: 'x',
        methods_used: ['m'],
        scope_excluded: [],
        concerns: [],
        created_at: '2026-04-20T00:00:00Z',
      },
    ]);

    r = runCli(['consolidation', 'scaffold', '--mission', MID], { cwd: dir });
    assert.equal(r.status, 0, r.stderr);

    const second = readArtifact(
      dir,
      `.geas/missions/${MID}/consolidation/candidates.json`,
    );
    // Full replace: no leftover 'lesson-A' from the first run.
    assert.equal(second.memory_suggestions.length, 2);
    const suggestions = second.memory_suggestions
      .map((m) => m.suggestion)
      .sort();
    assert.deepEqual(suggestions, ['lesson-B', 'lesson-C']);
    // created_at preserved across re-run; updated_at refreshed.
    assert.equal(second.created_at, first.created_at);
    assert.ok(second.updated_at >= first.updated_at);
  } finally {
    cleanup();
  }
});

test('consolidation scaffold skips tasks with no evidence directory', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    draftTask(dir, MID, 'task-001');
    draftTask(dir, MID, 'task-002');

    // Only task-001 has evidence. task-002 should be silently skipped.
    writeEvidenceFile(dir, MID, 'task-001', 'implementer', 'implementer', [
      {
        entry_id: 1,
        evidence_kind: 'implementation',
        summary: 'impl',
        artifacts: [],
        memory_suggestions: ['only-t1'],
        debt_candidates: [],
        gap_signals: [],
        revision_ref: null,
        created_at: '2026-04-20T00:00:00Z',
      },
    ]);

    setPhase(dir, MID, 'polishing');

    const r = runCli(
      ['consolidation', 'scaffold', '--mission', MID],
      { cwd: dir },
    );
    assert.equal(r.status, 0, `scaffold failed: ${r.stderr}`);
    assert.deepEqual(r.json.data.counts, {
      debt_candidates: 0,
      memory_suggestions: 1,
      gap_signals: 0,
    });
  } finally {
    cleanup();
  }
});

test('consolidation scaffold emits consolidation_scaffolded event', () => {
  const { dir, cleanup } = makeTempRoot();
  try {
    setupMission(dir, MID);
    draftTask(dir, MID, 'task-001');
    setPhase(dir, MID, 'consolidating');

    const r = runCli(
      ['consolidation', 'scaffold', '--mission', MID],
      { cwd: dir },
    );
    assert.equal(r.status, 0, r.stderr);

    const events = fs
      .readFileSync(path.join(dir, '.geas/events.jsonl'), 'utf-8')
      .split('\n')
      .filter((l) => l.length > 0)
      .map((l) => JSON.parse(l));

    const scaffolded = events.find(
      (e) => e.kind === 'consolidation_scaffolded',
    );
    assert.ok(scaffolded, 'consolidation_scaffolded event must be emitted');
    assert.equal(scaffolded.actor, 'cli:auto');
    assert.equal(scaffolded.payload.mission_id, MID);
    assert.ok(scaffolded.payload.counts);
  } finally {
    cleanup();
  }
});
